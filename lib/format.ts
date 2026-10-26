const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const fmtPct = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !Number.isFinite(v) ? 'No data' : `${v.toFixed(digits)}%`;

export const fmtInt = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? 'No data' : Math.round(v).toLocaleString('en-GB');

export const monthKey = (date?: string | null) => (date ? date.slice(0, 7) : '');

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

export const shortMonth = (key: string) => {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
};

export const quarterKey = (date?: string | null) => {
  if (!date) return '';
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  // Uganda financial year runs July to June; Q1 is July to September.
  const fyStart = m >= 7 ? y : y - 1;
  const q = m >= 7 ? Math.ceil((m - 6) / 3) : Math.ceil((m + 6) / 3);
  return `FY${String(fyStart).slice(2)}/${String(fyStart + 1).slice(2)} Q${q}`;
};

export const fmtDate = (date?: string | null) => {
  if (!date) return '';
  const [y, m, d] = date.slice(0, 10).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
};

/** Every month between two YYYY-MM keys, inclusive. */
export function monthRange(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  if (!fromKey || !toKey) return out;
  let y = Number(fromKey.slice(0, 4));
  let m = Number(fromKey.slice(5, 7));
  const ty = Number(toKey.slice(0, 4));
  const tm = Number(toKey.slice(5, 7));
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    if (out.length > 240) break;
  }
  return out;
}

export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export function countBy<T>(rows: T[], key: (r: T) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

export function toCsv(columns: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

/** Latest record per key (by date). */
export function latestBy<T extends { date?: string | null }>(rows: T[], key: (r: T) => string | null | undefined): T[] {
  const m = new Map<string, T>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const prev = m.get(k);
    if (!prev || (r.date || '') > (prev.date || '')) m.set(k, r);
  }
  return Array.from(m.values());
}
