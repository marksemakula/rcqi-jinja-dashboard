/**
 * QI collaboratives: several facilities working on one shared aim and indicator. A collaborative is registered in the
 * QI Collaborative Register form; facility teams then register their own projects in the QI Documentation Journal and
 * choose the collaborative there, so the collaborative's facilities and monthly results come from those projects.
 */
import { ALL, type Filters } from './filters';
import { filterProjects, NOT_IN_COLLAB, type JournalProject } from './journal';
import type { CollabRec, DirectoryFacility } from './types';

export { NOT_IN_COLLAB };

/** The statuses offered in the register form, in the order a collaborative moves through them. */
export const COLLAB_STATUSES = ['Being developed', 'Awaiting approval', 'Approved', 'Active', 'Completed', 'Closed'];
/** Order on the page: running collaboratives first, then those being prepared, then those that have ended. */
const SHOW_ORDER = ['Active', 'Approved', 'Awaiting approval', 'Being developed', 'Completed', 'Closed'];

export interface CollabFacility {
  name: string;
  district: string | null;
  /** Listed as a participating facility when the collaborative was registered. */
  planned: boolean;
  /** QI projects registered under the collaborative at this facility. */
  projects: number;
}

export interface CollabUpdate { date: string | null; status: string | null; notes: string | null }

export interface CollabMonth { key: string; numerator: number; denominator: number; pct: number | null; projects: number }

export interface Collaborative {
  name: string;
  /** False when projects name a collaborative that is not (yet) in the register. */
  registered: boolean;
  registeredOn: string | null;
  aim: string | null;
  lead: string | null;
  secretariat: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  indicator: string | null;
  numeratorDef: string | null;
  denominatorDef: string | null;
  target: number | null;
  charter: string | null;
  facilities: CollabFacility[];
  projects: JournalProject[];
  updates: CollabUpdate[];
  /** The projects' monthly results pooled: the numerators and denominators added across projects. */
  months: CollabMonth[];
}

const fold = (s: string) => s.trim().toLowerCase();
/** A loose form of a facility name, so "Kiyunga HC IV" finds "Kiyunga Health Centre IV". */
export const normaliseFacility = (s: string) => s.toLowerCase()
  .replace(/\bh\s*\/\s*c\b|\bhc\b/g, 'health centre').replace(/\bhealth center\b/g, 'health centre')
  .replace(/\bgen\.?\s+hosp(ital)?\b/g, 'general hospital').replace(/\bhosp\b/g, 'hospital')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/** The facilities typed at registration, one per line (commas and semicolons also separate them). */
export function splitFacilities(text?: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (text || '').split(/\r?\n|;|,/)) {
    const name = raw.replace(/^\s*(?:[-*•]|\d{1,2}[.)])\s*/, '').trim();
    if (name && !seen.has(fold(name))) { seen.add(fold(name)); out.push(name); }
  }
  return out;
}

const isRegistration = (r: CollabRec) => /^register/i.test(r.entryType || '');
const isUpdate = (r: CollabRec) => /^update/i.test(r.entryType || '');
const day = (r: CollabRec) => r.date || (r.ts ? r.ts.slice(0, 10) : null);

/** Monthly results pooled across projects. */
export function poolMonths(projects: JournalProject[]): CollabMonth[] {
  const byKey = new Map<string, CollabMonth>();
  for (const p of projects) {
    for (const m of p.months) {
      const cur = byKey.get(m.key) || { key: m.key, numerator: 0, denominator: 0, pct: null, projects: 0 };
      cur.numerator += m.numerator;
      cur.denominator += m.denominator;
      cur.projects += 1;
      byKey.set(m.key, cur);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key))
    .map((m) => ({ ...m, pct: m.denominator > 0 ? (m.numerator / m.denominator) * 100 : null }));
}

/**
 * One entry per collaborative. The latest registration of a name gives its charter; updates after it change the
 * status and the charter link. Facilities are those listed at registration plus those with a project under it.
 */
export function buildCollaboratives(records: CollabRec[], projects: JournalProject[], directory: DirectoryFacility[] = []): Collaborative[] {
  const byName = new Map<string, DirectoryFacility>();
  const byLoose = new Map<string, DirectoryFacility>();
  for (const f of directory) { byName.set(fold(f.name), f); byLoose.set(normaliseFacility(f.name), f); }
  const findFacility = (name: string) => byName.get(fold(name)) || byLoose.get(normaliseFacility(name)) || null;

  const sorted = records.slice().sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
  const regs = new Map<string, CollabRec>();
  for (const r of sorted) if (isRegistration(r) && r.name && r.name.trim()) regs.set(fold(r.name), r);

  const names = new Map<string, string>();
  for (const r of regs.values()) names.set(fold(r.name!), r.name!.trim());
  for (const p of projects) if (p.collaborative && !names.has(fold(p.collaborative))) names.set(fold(p.collaborative), p.collaborative.trim());

  const out: Collaborative[] = [];
  for (const [key, name] of names) {
    const reg = regs.get(key) || null;
    const updates = sorted.filter((r) => isUpdate(r) && r.collaborative && fold(r.collaborative) === key && (!reg || (r.ts || '') >= (reg.ts || '')));
    let status = reg?.status || (reg ? 'Being developed' : 'Not in the register');
    let charter = reg?.charter || null;
    for (const u of updates) {
      if (u.newStatus) status = u.newStatus;
      if (u.newCharter) charter = u.newCharter;
    }
    const mine = projects.filter((p) => p.collaborative && fold(p.collaborative) === key);
    const facilities = new Map<string, CollabFacility>();
    for (const typed of splitFacilities(reg?.plannedFacilities)) {
      const f = findFacility(typed);
      const display = f ? f.name : typed;
      if (!facilities.has(fold(display))) facilities.set(fold(display), { name: display, district: f ? f.district : null, planned: true, projects: 0 });
    }
    for (const p of mine) {
      const cur = facilities.get(fold(p.facility)) || { name: p.facility, district: p.district, planned: false, projects: 0 };
      cur.projects += 1;
      if (!cur.district) cur.district = p.district;
      facilities.set(fold(p.facility), cur);
    }
    out.push({
      name,
      registered: !!reg,
      registeredOn: reg ? day(reg) : null,
      aim: reg?.aim || null,
      lead: reg?.lead || null,
      secretariat: reg?.secretariat || null,
      status,
      startDate: reg?.startDate || null,
      endDate: reg?.endDate || null,
      indicator: reg?.indicator || null,
      numeratorDef: reg?.numeratorDef || null,
      denominatorDef: reg?.denominatorDef || null,
      target: reg?.target ?? null,
      charter,
      // By district, with names not matched to DHIS2 last.
      facilities: Array.from(facilities.values()).sort((a, b) => Number(!a.district) - Number(!b.district) || (a.district || '').localeCompare(b.district || '') || a.name.localeCompare(b.name)),
      projects: mine,
      updates: updates.map((u) => ({ date: day(u), status: u.newStatus || null, notes: u.updateNotes || null })),
      months: poolMonths(mine)
    });
  }
  const rank = (s: string) => { const i = SHOW_ORDER.indexOf(s); return i < 0 ? SHOW_ORDER.length : i; };
  return out.sort((a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name));
}

type PlaceFilters = Pick<Filters, 'district' | 'facility' | 'department'>;

/**
 * The collaboratives that reach the chosen district or facility, each narrowed to the facilities and projects there.
 * The department narrows the projects only (facilities have no department). Nothing chosen keeps every collaborative.
 */
export function filterCollaboratives(list: Collaborative[], f: PlaceFilters): Collaborative[] {
  const place = f.district !== ALL || f.facility !== ALL;
  if (!place && f.department === ALL) return list;
  return list.flatMap((c) => {
    const facilities = c.facilities.filter((x) => (f.district === ALL || x.district === f.district) && (f.facility === ALL || x.name === f.facility));
    const projects = filterProjects(c.projects, f);
    if (place && !facilities.length && !projects.length) return [];
    return [{ ...c, facilities: place ? facilities : c.facilities, projects, months: poolMonths(projects) }];
  });
}
