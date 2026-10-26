import {
  BASIC_IPC_DOMAINS, FIVE_S_DOMAINS, HFQAP_M5_PARTS, HFQAP_MODULES, HFQAP_PRIVATE_FINANCING, HH_CADRE_GROUPS,
  LEVEL_MAP, MOH_IPC_AREAS, MOH_IPC_GRADED, MOH_IPC_REVERSE, STAR_BANDS, type LevelKey, type RagDomain
} from './catalogue';
import type { FiveSRec, HfqapRec, HhRec, IpcBasicRec, IpcMohRec } from './types';

export type Rag = 'Green' | 'Amber' | 'Red';

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const pct = (part: number, whole: number): number | null => (whole > 0 ? (part / whole) * 100 : null);

/* 5S ---------------------------------------------------------------------------- */
export interface FiveSScore {
  domains: { code: string; name: string; score: number; max: number; pct: number }[];
  total: number;
  max: number;
  pct: number;
}

export function scoreFiveS(rec: FiveSRec): FiveSScore {
  const domains = FIVE_S_DOMAINS.map((d) => {
    const score = d.items.reduce((s, code) => s + Math.max(0, Math.min(3, num(rec.items[code]) ?? 0)), 0);
    const max = d.items.length * 3;
    return { code: d.code, name: d.name, score, max, pct: (score / max) * 100 };
  });
  const total = domains.reduce((s, d) => s + d.score, 0);
  const max = domains.reduce((s, d) => s + d.max, 0);
  return { domains, total, max, pct: (total / max) * 100 };
}

/* Hand hygiene -------------------------------------------------------------------- */
export interface HhTotals {
  opp: number;
  hr: number;
  hw: number;
  actions: number;
  missed: number;
  gloves: number;
  compliance: number | null;
  sessions: number;
}

/** WHO basic compliance: actions (hand rub plus hand wash) divided by opportunities, actions capped at opportunities. */
export function hhTotals(recs: HhRec[]): HhTotals {
  let opp = 0; let hr = 0; let hw = 0; let actions = 0; let gloves = 0;
  for (const r of recs) {
    const o = Math.max(0, num(r.opp) ?? 0);
    const a = Math.max(0, num(r.hr) ?? 0);
    const w = Math.max(0, num(r.hw) ?? 0);
    opp += o; hr += a; hw += w; actions += Math.min(o, a + w); gloves += Math.max(0, num(r.gloves) ?? 0);
  }
  return { opp, hr, hw, actions, missed: opp - actions, gloves, compliance: pct(actions, opp), sessions: recs.length };
}

export function hhMoments(recs: HhRec[]) {
  return [1, 2, 3, 4, 5].map((m) => {
    let ind = 0; let act = 0;
    for (const r of recs) {
      const i = Math.max(0, num((r as unknown as Record<string, unknown>)[`m${m}i`]) ?? 0);
      const a = Math.max(0, num((r as unknown as Record<string, unknown>)[`m${m}a`]) ?? 0);
      ind += i; act += Math.min(i, a);
    }
    return { moment: m, indications: ind, actions: act, ratio: pct(act, ind) };
  });
}

export const cadreGroup = (profCat?: string | null) => (profCat && HH_CADRE_GROUPS[profCat]) || 'Other health worker';

/* Basic IPC (RAG) ------------------------------------------------------------------ */
export interface RagResult {
  code: string;
  name: string;
  core: boolean;
  score: number;
  applicable: number;
  items: number;
  scaled: number | null;
  rag: Rag | null;
}

export function ragFor(domain: RagDomain, score: number, applicable: number): Rag | null {
  if (applicable <= 0) return null;
  const scaled = (score / applicable) * domain.items;
  if (scaled >= domain.green - 1e-9) return 'Green';
  if (scaled >= domain.amber - 1e-9) return 'Amber';
  return 'Red';
}

/** Overall RAG: the colour with the highest count across core standards; where counts tie, the lower colour applies. */
export function overallRag(rags: (Rag | null)[]): Rag | null {
  const counts = { Green: 0, Amber: 0, Red: 0 };
  let n = 0;
  for (const r of rags) if (r) { counts[r] += 1; n += 1; }
  if (!n) return null;
  const best = Math.max(counts.Green, counts.Amber, counts.Red);
  if (counts.Red === best) return 'Red';
  if (counts.Amber === best) return 'Amber';
  return 'Green';
}

export function scoreBasicIpc(rec: IpcBasicRec) {
  const domains: RagResult[] = BASIC_IPC_DOMAINS.map((d) => {
    let score = 0; let applicable = 0;
    for (let i = 1; i <= d.items; i++) {
      const code = d.code + i;
      const v = (rec.items[code] || '').trim();
      if (!v || v === 'N/A') continue;
      applicable += 1;
      const yes = v.toLowerCase().startsWith('yes');
      const good = d.reverse && d.reverse.includes(code) ? !yes : yes;
      if (good) score += 1;
    }
    const rag = ragFor(d, score, applicable);
    return {
      code: d.code, name: d.name, core: d.core, score, applicable, items: d.items,
      scaled: applicable ? (score / applicable) * d.items : null, rag
    };
  });
  const core = domains.filter((d) => d.core);
  const counts = { Green: 0, Amber: 0, Red: 0 };
  core.forEach((d) => { if (d.rag) counts[d.rag] += 1; });
  const coreScore = core.reduce((s, d) => s + d.score, 0);
  const coreApplicable = core.reduce((s, d) => s + d.applicable, 0);
  return { domains, counts, overall: overallRag(core.map((d) => d.rag)), pct: pct(coreScore, coreApplicable) };
}

/* MoH IPC facility assessment ------------------------------------------------------- */
export function mohItemPoints(code: string, value: string | undefined): number | null {
  if (!value) return null;
  const v = value.trim();
  const graded = MOH_IPC_GRADED[code];
  if (graded && v in graded) return graded[v];
  if (v === 'N/A' || v.startsWith('N/A')) return null;
  const yes = v.toLowerCase().startsWith('yes');
  const no = v.toLowerCase().startsWith('no');
  if (!yes && !no) return null;
  if (MOH_IPC_REVERSE.has(code)) return yes ? 0 : 1;
  return yes ? 1 : 0;
}

export function scoreMohIpc(rec: IpcMohRec) {
  const areas = MOH_IPC_AREAS.map((a) => {
    let points = 0; let applicable = 0;
    for (const code of a.codes) {
      const p = mohItemPoints(code, rec.items[code]);
      if (p === null) continue;
      points += p; applicable += 1;
    }
    return { id: a.id, name: a.name, points, applicable, pct: pct(points, applicable) };
  });
  const points = areas.reduce((s, a) => s + a.points, 0);
  const applicable = areas.reduce((s, a) => s + a.applicable, 0);
  const sdp = num(rec.sdp);
  return {
    areas,
    pct: pct(points, applicable),
    hhCoverage: sdp ? Math.min(100, ((num(rec.hhStations) ?? 0) / sdp) * 100) : null,
    binCoverage: sdp ? Math.min(100, ((num(rec.sdpBins) ?? 0) / sdp) * 100) : null
  };
}

/* HFQAP ------------------------------------------------------------------------------ */
export const levelKey = (level?: string | null): LevelKey => (level && LEVEL_MAP[level]) || 'H';

export const isPrivate = (ownership?: string | null) => !!ownership && /private/i.test(ownership);

export function starFor(pctValue: number | null): number | null {
  if (pctValue === null || !Number.isFinite(pctValue)) return null;
  let star = 0;
  for (const b of STAR_BANDS) if (pctValue >= b.min) star = b.star;
  return star;
}

export function expectedFor(moduleId: string, level: LevelKey, privateFacility: boolean): number {
  const m = HFQAP_MODULES.find((x) => x.id === moduleId);
  if (!m) return 0;
  if (moduleId === 'm3' && privateFacility) return HFQAP_PRIVATE_FINANCING;
  return m.expected[level];
}

export function scoreHfqap(rec: HfqapRec) {
  const level = levelKey(rec.level);
  const priv = isPrivate(rec.ownership);
  const r = rec as unknown as Record<string, unknown>;
  const modules = HFQAP_MODULES.map((m) => {
    const expected = expectedFor(m.id, level, priv);
    let score: number;
    if (m.id === 'm5') {
      score = HFQAP_M5_PARTS.reduce((s, p) => s + Math.max(0, Math.min(p.expected[level], num(r[p.field]) ?? 0)), 0);
    } else {
      score = Math.max(0, Math.min(expected, num(r[m.fields[0]]) ?? 0));
    }
    return { id: m.id, name: m.name, short: m.short, score, expected, pct: pct(score, expected) ?? 0 };
  });
  const total = modules.reduce((s, m) => s + m.score, 0);
  const expected = modules.reduce((s, m) => s + m.expected, 0);
  const overall = pct(total, expected);
  return { level, modules, total, expected, pct: overall, star: starFor(overall) };
}
