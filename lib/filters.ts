import type { BaseRec, Dataset } from './types';

export type Preset = 'last3' | 'last6' | 'last12' | 'fy' | 'prevfy' | 'all' | 'calendar' | 'fyear' | 'range';

export interface Filters {
  preset: Preset;
  district: string;
  facility: string;
  department: string;
  /** For 'calendar': the year (null means the current year) and the month, 1 to 12, or 0 for the whole year. */
  year: number | null;
  month: number;
  /** For 'fyear': the year in which the financial year starts (2025 for 2025/26; null means the current one). */
  fyStart: number | null;
  /** For 'range': the first and last month as YYYY-MM (in either order). */
  from: string | null;
  to: string | null;
}

export type PeriodFilter = Pick<Filters, 'preset' | 'year' | 'month' | 'fyStart' | 'from' | 'to'>;

export const ALL = 'All';

export const DEFAULT_FILTERS: Filters = { preset: 'last12', district: ALL, facility: ALL, department: ALL, year: null, month: 0, fyStart: null, from: null, to: null };

export const PRESETS: { id: Preset; label: string; group: 'quick' | 'choose' }[] = [
  { id: 'last3', label: 'Last 3 months', group: 'quick' },
  { id: 'last6', label: 'Last 6 months', group: 'quick' },
  { id: 'last12', label: 'Last 12 months', group: 'quick' },
  { id: 'fy', label: 'This financial year', group: 'quick' },
  { id: 'prevfy', label: 'Last financial year', group: 'quick' },
  { id: 'all', label: 'All time', group: 'quick' },
  { id: 'calendar', label: 'Year and month', group: 'choose' },
  { id: 'fyear', label: 'A financial year', group: 'choose' },
  { id: 'range', label: 'A range of months', group: 'choose' }
];

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, '0');
const ym = (y: number, m0: number) => { const d = new Date(Date.UTC(y, m0, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };
/** The last day of a month given as YYYY-MM. */
const monthEnd = (key: string) => {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  return `${key}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
};
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The year in which the current financial year started (Uganda's financial year runs from 1 July to 30 June). */
export const currentFyStart = (today = new Date()) => (today.getUTCMonth() >= 6 ? today.getUTCFullYear() : today.getUTCFullYear() - 1);
export const fyLabel = (start: number) => `${start}/${String(start + 1).slice(2)}`;

/** Sensible values for a period choice when it is first picked. */
export function periodDefaults(preset: Preset, today = new Date()): Partial<Filters> {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  switch (preset) {
    case 'calendar': return { year: y, month: 0 };
    case 'fyear': return { fyStart: currentFyStart(today) };
    case 'range': return { from: ym(y, m - 5), to: ym(y, m) };
    default: return {};
  }
}

/** Date window for a period. Uganda's financial year runs from 1 July to 30 June. */
export function windowFor(period: Preset | PeriodFilter, today = new Date()): { from: string | null; to: string | null } {
  const p: PeriodFilter = typeof period === 'string' ? { preset: period, year: null, month: 0, fyStart: null, from: null, to: null } : period;
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const monthsBack = (n: number) => iso(new Date(Date.UTC(y, m - n + 1, 1)));
  switch (p.preset) {
    case 'last3': return { from: monthsBack(3), to: iso(today) };
    case 'last6': return { from: monthsBack(6), to: iso(today) };
    case 'last12': return { from: monthsBack(12), to: iso(today) };
    case 'fy': return { from: `${currentFyStart(today)}-07-01`, to: iso(today) };
    case 'prevfy': {
      const start = currentFyStart(today) - 1;
      return { from: `${start}-07-01`, to: `${start + 1}-06-30` };
    }
    case 'calendar': {
      const yr = p.year ?? y;
      if (!p.month) return { from: `${yr}-01-01`, to: `${yr}-12-31` };
      const key = `${yr}-${pad(p.month)}`;
      return { from: `${key}-01`, to: monthEnd(key) };
    }
    case 'fyear': {
      const start = p.fyStart ?? currentFyStart(today);
      return { from: `${start}-07-01`, to: `${start + 1}-06-30` };
    }
    case 'range': {
      const d = periodDefaults('range', today);
      let a = p.from && MONTH_KEY.test(p.from) ? p.from : (d.from as string);
      let b = p.to && MONTH_KEY.test(p.to) ? p.to : (d.to as string);
      if (a > b) [a, b] = [b, a];
      return { from: `${a}-01`, to: monthEnd(b) };
    }
    default: return { from: null, to: null };
  }
}

const recDate = (r: BaseRec) => r.date || (r.ts ? r.ts.slice(0, 10) : null);

export function applyFilters<T extends BaseRec>(rows: T[], f: Filters, deptField?: string, today = new Date()): T[] {
  const w = windowFor(f, today);
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
    qij: data.qij,
    // A collaborative spans several facilities: its facilities and projects are narrowed on the Collaboratives page.
    collab: data.collab,
    aci: applyFilters(data.aci, f, undefined, today)
  };
}

export function optionsFrom(data: Dataset) {
  const districts = new Set<string>();
  const facilities = new Set<string>();
  const departments = new Set<string>();
  const all: BaseRec[] = [...data.hsr, ...data.fives, ...data.hh, ...data.ipcBasic, ...data.ipcMoh, ...data.hfqap, ...data.qij, ...data.aci];
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

export const emptyDataset = (): Dataset => ({ hsr: [], fives: [], hh: [], ipcBasic: [], ipcMoh: [], hfqap: [], qij: [], collab: [], aci: [] });

export function normaliseDataset(data?: Partial<Dataset>): Dataset {
  const e = emptyDataset();
  if (!data) return e;
  const fix = <T extends BaseRec>(rows?: T[]) => (rows || []).map((r) => ({ ...r, items: r.items || {}, facility: r.facility ? r.facility.trim() : r.facility }));
  return {
    hsr: fix(data.hsr), fives: fix(data.fives), hh: fix(data.hh),
    ipcBasic: fix(data.ipcBasic), ipcMoh: fix(data.ipcMoh), hfqap: fix(data.hfqap), qij: fix(data.qij), collab: fix(data.collab), aci: fix(data.aci)
  };
}

export const datasetSize = (d: Dataset) =>
  d.hsr.length + d.fives.length + d.hh.length + d.ipcBasic.length + d.ipcMoh.length + d.hfqap.length + d.qij.length + d.collab.length + d.aci.length;

const fromAddress = (v: string | null) => {
  const t = (v || '').trim();
  return t && t.length <= 160 ? t : ALL;
};
const intIn = (v: string | null, lo: number, hi: number) => (v && /^\d+$/.test(v) && Number(v) >= lo && Number(v) <= hi ? Number(v) : null);

/**
 * The filters given in a dashboard address, such as ?district=Kamuli&facility=Namwendwa+Health+Centre+IV or
 * ?period=calendar&year=2026&month=9. Anything missing or invalid keeps its default.
 */
export function filtersFromSearch(search: string): Partial<Filters> & Pick<Filters, 'district' | 'facility'> {
  const q = new URLSearchParams(search);
  const out: Partial<Filters> & Pick<Filters, 'district' | 'facility'> = { district: fromAddress(q.get('district')), facility: fromAddress(q.get('facility')) };
  const preset = q.get('period') as Preset | null;
  if (!preset || !PRESETS.some((p) => p.id === preset)) return out;
  out.preset = preset;
  if (preset === 'calendar') {
    out.year = intIn(q.get('year'), 2000, 2100);
    out.month = intIn(q.get('month'), 1, 12) ?? 0;
  } else if (preset === 'fyear') {
    out.fyStart = intIn(q.get('fy'), 2000, 2100);
  } else if (preset === 'range') {
    const f = q.get('from'); const t = q.get('to');
    out.from = f && MONTH_KEY.test(f) ? f : null;
    out.to = t && MONTH_KEY.test(t) ? t : null;
  }
  return out;
}

/** The query string for the period, district and facility ('' for the defaults: the last 12 months and the whole region). */
export function searchFromFilters(partial: Partial<Filters>): string {
  const f = { ...DEFAULT_FILTERS, ...partial };
  const q = new URLSearchParams();
  if (f.preset !== DEFAULT_FILTERS.preset) {
    q.set('period', f.preset);
    if (f.preset === 'calendar') { if (f.year) q.set('year', String(f.year)); if (f.month) q.set('month', String(f.month)); }
    if (f.preset === 'fyear' && f.fyStart) q.set('fy', String(f.fyStart));
    if (f.preset === 'range') { if (f.from) q.set('from', f.from); if (f.to) q.set('to', f.to); }
  }
  if (f.district !== ALL) q.set('district', f.district);
  if (f.facility !== ALL) q.set('facility', f.facility);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Years to offer in the period controls: from the earliest entry (or two years back) to the current year, newest first. */
export function periodYears(dates: (string | null | undefined)[], today = new Date()): number[] {
  const y = today.getUTCFullYear();
  let first = y - 2;
  for (const d of dates) if (d && /^\d{4}/.test(d)) first = Math.min(first, Number(d.slice(0, 4)));
  first = Math.max(first, y - 15);
  const out: number[] = [];
  for (let yr = y; yr >= first; yr--) out.push(yr);
  return out;
}

/** Months as YYYY-MM from January of the earliest offered year to the current month, newest first. */
export function periodMonths(years: number[], today = new Date()): string[] {
  const out: string[] = [];
  const last = ym(today.getUTCFullYear(), today.getUTCMonth());
  for (let y = years[0]; y >= years[years.length - 1]; y--) {
    for (let m = 12; m >= 1; m--) { const key = `${y}-${pad(m)}`; if (key <= last) out.push(key); }
  }
  return out;
}
