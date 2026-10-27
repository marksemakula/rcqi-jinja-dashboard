/**
 * QI Documentation Journal: turns the three kinds of journal entry (project registrations, changes tested and
 * monthly results) into one journal per project, mirroring the paper Documentation Journal for QI activities.
 */
import { ALL, type Filters } from './filters';
import type { QijRec } from './types';

export type EntryKind = 'project' | 'change' | 'month' | 'team' | 'unknown';

export interface JournalChange {
  no: number;
  change: string;
  start: string | null;
  end: string | null;
  improved: string | null;
  comments: string | null;
  /** Index of the month in the project's month axis at which the change started (for graph annotation). */
  monthIndex: number | null;
}

export interface JournalMonth {
  key: string;
  numerator: number;
  denominator: number;
  pct: number | null;
  notes: string | null;
  effects: string | null;
}

export interface JournalProject {
  label: string;
  registered: boolean;
  facility: string;
  district: string | null;
  region: string | null;
  department: string | null;
  title: string;
  teamSize: number | null;
  startDate: string | null;
  endDate: string | null;
  objective: string | null;
  indicator: string | null;
  numeratorDef: string | null;
  denominatorDef: string | null;
  target: number | null;
  problem: string | null;
  changes: JournalChange[];
  months: JournalMonth[];
  /** Every month from the first record or start date to the last record, so gaps show on the graph. */
  axis: string[];
  baselinePct: number | null;
  latestPct: number | null;
  status: 'Active' | 'Completed';
}

export const JOURNAL_ENTRY_TYPES = ['Register a new QI project', 'Record a change tested', 'Record monthly results', 'Update the team email list'];

export function entryKind(r: QijRec): EntryKind {
  const t = (r.entryType || '').toLowerCase();
  if (t.startsWith('register')) return 'project';
  if (t.startsWith('record a change')) return 'change';
  if (t.startsWith('record monthly')) return 'month';
  if (t.startsWith('update the team')) return 'team'; // changes who is notified; nothing to show on the journal page
  return 'unknown';
}

/** The label teams choose in the form: "Facility: Short project title" (matches projectLabel_ in Code.gs). */
export const projectLabel = (r: Pick<QijRec, 'facility' | 'projectTitle'>) =>
  `${(r.facility || 'Unknown facility').trim()}: ${(r.projectTitle || 'Untitled project').trim()}`;

const monthOf = (d?: string | null) => (d && /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : null);

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const ty = Number(to.slice(0, 4));
  const tm = Number(to.slice(5, 7));
  while ((y < ty || (y === ty && m <= tm)) && out.length < 120) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

const newer = (a: QijRec, b: QijRec) => (a.ts || '') >= (b.ts || '');

export function buildJournal(records: QijRec[], today = new Date().toISOString().slice(0, 10)): JournalProject[] {
  const regs = new Map<string, QijRec>();
  const changes = new Map<string, QijRec[]>();
  const months = new Map<string, Map<string, QijRec>>();

  for (const r of records) {
    const kind = entryKind(r);
    if (kind === 'project') {
      const label = projectLabel(r);
      const prev = regs.get(label);
      if (!prev || newer(r, prev)) regs.set(label, r);
    } else if (kind === 'change' && r.project && r.change) {
      changes.set(r.project, [...(changes.get(r.project) || []), r]);
    } else if (kind === 'month' && r.project) {
      const key = monthOf(r.month);
      if (!key) continue;
      const byMonth = months.get(r.project) || new Map<string, QijRec>();
      const prev = byMonth.get(key);
      if (!prev || newer(r, prev)) byMonth.set(key, r); // a later entry for the same month corrects the earlier one
      months.set(r.project, byMonth);
    }
  }

  const labels = new Set<string>([...regs.keys(), ...changes.keys(), ...months.keys()]);
  const out: JournalProject[] = [];
  for (const label of labels) {
    const reg = regs.get(label);
    const split = label.indexOf(': ');
    const monthRecs = Array.from((months.get(label) || new Map<string, QijRec>()).entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const monthList: JournalMonth[] = monthRecs.map(([key, r]) => {
      const n = Number(r.numerator ?? 0);
      const d = Number(r.denominator ?? 0);
      return { key, numerator: n, denominator: d, pct: d > 0 ? (n / d) * 100 : null, notes: r.indicatorNotes || null, effects: r.effects || null };
    });
    const changeRecs = (changes.get(label) || []).slice().sort((a, b) => (a.changeStart || '').localeCompare(b.changeStart || '') || (a.ts || '').localeCompare(b.ts || ''));
    const keys = [monthOf(reg?.startDate), ...monthList.map((m) => m.key), ...changeRecs.map((c) => monthOf(c.changeStart))].filter((k): k is string => !!k).sort();
    const axis = keys.length ? monthsBetween(keys[0], keys[keys.length - 1]) : [];
    const valued = monthList.filter((m) => m.pct !== null);
    out.push({
      label,
      registered: !!reg,
      facility: reg?.facility || (split > 0 ? label.slice(0, split) : 'Unknown facility'),
      district: reg?.district || null,
      region: reg?.region || null,
      department: reg?.department || null,
      title: reg?.projectTitle || (split > 0 ? label.slice(split + 2) : label),
      teamSize: reg?.teamSize ?? null,
      startDate: reg?.startDate || null,
      endDate: reg?.endDate || null,
      objective: reg?.objective || null,
      indicator: reg?.indicator || null,
      numeratorDef: reg?.numeratorDef || null,
      denominatorDef: reg?.denominatorDef || null,
      target: reg?.target ?? null,
      problem: reg?.problem || null,
      changes: changeRecs.map((c, i) => {
        const mk = monthOf(c.changeStart);
        return {
          no: i + 1, change: c.change || '', start: c.changeStart || null, end: c.changeEnd || null,
          improved: c.improved || null, comments: c.changeComments || null, monthIndex: mk ? axis.indexOf(mk) : null
        };
      }),
      months: monthList,
      axis,
      baselinePct: valued.length ? valued[0].pct : null,
      latestPct: valued.length ? valued[valued.length - 1].pct : null,
      status: reg?.endDate && reg.endDate < today ? 'Completed' : 'Active'
    });
  }
  return out.sort((a, b) => a.facility.localeCompare(b.facility) || a.title.localeCompare(b.title));
}

type PlaceFilters = Pick<Filters, 'district' | 'facility' | 'department'>;

/** True when a district, facility or department is chosen (the period never hides a project's months). */
export const placeFiltered = (f: PlaceFilters) => f.district !== ALL || f.facility !== ALL || f.department !== ALL;

/** The projects whose registration matches the chosen district, facility and department. */
export function filterProjects(projects: JournalProject[], f: PlaceFilters): JournalProject[] {
  return projects.filter((p) =>
    (f.district === ALL || p.district === f.district) &&
    (f.facility === ALL || p.facility === f.facility) &&
    (f.department === ALL || p.department === f.department));
}

/** The journal entries for the chosen district, facility and department: every entry that belongs to a matching project. */
export function entriesFor(records: QijRec[], f: PlaceFilters): QijRec[] {
  if (!placeFiltered(f)) return records;
  const keep = new Set(filterProjects(buildJournal(records), f).map((p) => p.label));
  return records.filter((r) => {
    const label = entryKind(r) === 'project' ? projectLabel(r) : r.project;
    return !!label && keep.has(label);
  });
}
