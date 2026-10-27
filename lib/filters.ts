import type { BaseRec, Dataset } from './types';

export type Preset = 'last3' | 'last6' | 'last12' | 'fy' | 'prevfy' | 'all';

export interface Filters {
  preset: Preset;
  district: string;
  facility: string;
  department: string;
}

export const ALL = 'All';

export const DEFAULT_FILTERS: Filters = { preset: 'last12', district: ALL, facility: ALL, department: ALL };

export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'last3', label: 'Last 3 months' },
  { id: 'last6', label: 'Last 6 months' },
  { id: 'last12', label: 'Last 12 months' },
  { id: 'fy', label: 'This financial year' },
  { id: 'prevfy', label: 'Last financial year' },
  { id: 'all', label: 'All time' }
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Date window for a preset. Uganda's financial year runs from 1 July to 30 June. */
export function windowFor(preset: Preset, today = new Date()): { from: string | null; to: string | null } {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const monthsBack = (n: number) => iso(new Date(Date.UTC(y, m - n + 1, 1)));
  switch (preset) {
    case 'last3': return { from: monthsBack(3), to: iso(today) };
    case 'last6': return { from: monthsBack(6), to: iso(today) };
    case 'last12': return { from: monthsBack(12), to: iso(today) };
    case 'fy': {
      const start = m >= 6 ? y : y - 1;
      return { from: `${start}-07-01`, to: iso(today) };
    }
    case 'prevfy': {
      const start = (m >= 6 ? y : y - 1) - 1;
      return { from: `${start}-07-01`, to: `${start + 1}-06-30` };
    }
    default: return { from: null, to: null };
  }
}

const recDate = (r: BaseRec) => r.date || (r.ts ? r.ts.slice(0, 10) : null);

export function applyFilters<T extends BaseRec>(rows: T[], f: Filters, deptField?: string, today = new Date()): T[] {
  const w = windowFor(f.preset, today);
  return rows.filter((r) => {
    const d = recDate(r);
    if (w.from && (!d || d < w.from)) return false;
    if (w.to && (!d || d > w.to)) return false;
    if (f.district !== ALL && r.district !== f.district) return false;
    if (f.facility !== ALL && r.facility !== f.facility) return false;
    if (deptField && f.department !== ALL && (r as unknown as Record<string, unknown>)[deptField] !== f.department) return false;
    return true;
  });
}

export function filterDataset(data: Dataset, f: Filters, today = new Date()): Dataset {
  return {
    hsr: applyFilters(data.hsr, f, 'department', today),
    fives: applyFilters(data.fives, f, 'department', today),
    hh: applyFilters(data.hh, f, 'ward', today),
    ipcBasic: applyFilters(data.ipcBasic, f, undefined, today),
    ipcMoh: applyFilters(data.ipcMoh, f, undefined, today),
    hfqap: applyFilters(data.hfqap, f, undefined, today),
    // Journal entries are filtered at project level on the QI Journal page, so every month stays in each journal.
    qij: data.qij
  };
}

export function optionsFrom(data: Dataset) {
  const districts = new Set<string>();
  const facilities = new Set<string>();
  const departments = new Set<string>();
  const all: BaseRec[] = [...data.hsr, ...data.fives, ...data.hh, ...data.ipcBasic, ...data.ipcMoh, ...data.hfqap, ...data.qij];
  for (const r of all) {
    if (r.district) districts.add(r.district);
    if (r.facility) facilities.add(r.facility);
  }
  for (const r of data.hsr) if (r.department) departments.add(r.department);
  for (const r of data.fives) if (r.department) departments.add(r.department);
  for (const r of data.hh) if (r.ward) departments.add(r.ward);
  for (const r of data.qij) if (r.department) departments.add(r.department);
  const sort = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b));
  // Each facility's district (the DHIS2 district when the entry was matched), for the searchable facility filter.
  const facilityDistricts: Record<string, string> = {};
  for (const r of all) if (r.facility && r.district && !facilityDistricts[r.facility]) facilityDistricts[r.facility] = r.district;
  return { districts: sort(districts), facilities: sort(facilities), departments: sort(departments), facilityDistricts };
}

export const emptyDataset = (): Dataset => ({ hsr: [], fives: [], hh: [], ipcBasic: [], ipcMoh: [], hfqap: [], qij: [] });

export function normaliseDataset(data?: Partial<Dataset>): Dataset {
  const e = emptyDataset();
  if (!data) return e;
  const fix = <T extends BaseRec>(rows?: T[]) => (rows || []).map((r) => ({ ...r, items: r.items || {}, facility: r.facility ? r.facility.trim() : r.facility }));
  return {
    hsr: fix(data.hsr), fives: fix(data.fives), hh: fix(data.hh),
    ipcBasic: fix(data.ipcBasic), ipcMoh: fix(data.ipcMoh), hfqap: fix(data.hfqap), qij: fix(data.qij)
  };
}

export const datasetSize = (d: Dataset) =>
  d.hsr.length + d.fives.length + d.hh.length + d.ipcBasic.length + d.ipcMoh.length + d.hfqap.length + d.qij.length;
