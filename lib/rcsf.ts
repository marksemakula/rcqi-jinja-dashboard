/**
 * Routine Client Satisfaction Feedback: summaries of the Assisted Client Interviews (MoH tool, Implementation
 * Guidelines Appendix 1). Each aspect is scored by the share of clients rating it Good or Excellent; overall
 * satisfaction is the share answering Yes to Q4.
 */
import type { AciRec } from './types';

export const ACI_SCALE = ['Excellent', 'Good', 'Fair', 'Poor'] as const;
export const ACI_ASPECTS: { code: string; label: string }[] = [
  { code: 'Q1a', label: 'Cleanliness' },
  { code: 'Q1b', label: 'Timeliness (waiting time)' },
  { code: 'Q1c', label: 'Privacy' },
  { code: 'Q1d', label: 'Respect' },
  { code: 'Q1e', label: 'Medicines available' },
  { code: 'Q1f', label: 'Received all services needed' },
  { code: 'Q1g', label: 'Health workers available' },
  { code: 'Q1h', label: 'Health information' }
];
export const ACI_COST = ['Free', 'Affordable', 'Not affordable'];
export const ACI_UNITS = ['OPD', 'Medical ward', 'Maternity', 'Antenatal', 'EPI/YCC/Postnatal', 'Surgical ward', 'ART', 'Community services'];

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);
const yesShare = (rows: AciRec[], key: 'overall' | 'bribe' | 'informed') => {
  const answered = rows.filter((r) => r[key] === 'Yes' || r[key] === 'No');
  return { yes: answered.filter((r) => r[key] === 'Yes').length, answered: answered.length };
};

export interface AspectSummary { code: string; label: string; counts: Record<string, number>; answered: number; goodPct: number | null }

export function aspectSummary(rows: AciRec[]): AspectSummary[] {
  return ACI_ASPECTS.map(({ code, label }) => {
    const counts: Record<string, number> = Object.fromEntries(ACI_SCALE.map((s) => [s, 0]));
    let answered = 0;
    for (const r of rows) {
      const v = r.items?.[code];
      if (v && v in counts) { counts[v] += 1; answered += 1; }
    }
    return { code, label, counts, answered, goodPct: pct(counts.Excellent + counts.Good, answered) };
  });
}

export interface AciSummary {
  interviews: number;
  satisfiedPct: number | null;
  bribes: number;
  bribePct: number | null;
  informedPct: number | null;
  /** The mean, across the eight aspects, of the share rating each aspect Good or Excellent. */
  aspectsPct: number | null;
}

export function aciSummary(rows: AciRec[]): AciSummary {
  const o = yesShare(rows, 'overall');
  const b = yesShare(rows, 'bribe');
  const i = yesShare(rows, 'informed');
  const scored = aspectSummary(rows).map((a) => a.goodPct).filter((v): v is number => v !== null);
  return {
    interviews: rows.length,
    satisfiedPct: pct(o.yes, o.answered),
    bribes: b.yes,
    bribePct: pct(b.yes, b.answered),
    informedPct: pct(i.yes, i.answered),
    aspectsPct: scored.length ? scored.reduce((a, v) => a + v, 0) / scored.length : null
  };
}

/** The summary for each value of a field (service unit, facility, month), largest group first. */
export function aciBy(rows: AciRec[], key: (r: AciRec) => string | null | undefined): ({ name: string } & AciSummary)[] {
  const groups = new Map<string, AciRec[]>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) || []), r]);
  }
  return Array.from(groups.entries()).map(([name, g]) => ({ name, ...aciSummary(g) })).sort((a, b) => b.interviews - a.interviews || a.name.localeCompare(b.name));
}
