'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Chart from './Chart';
import type { Opt } from '@/lib/chart';
import { toCsv } from '@/lib/format';
import type { Rag } from '@/lib/scoring';

export type Cell = string | number | null | undefined;
export interface TableData { columns: string[]; rows: Cell[][] }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function downloadCsv(name: string, table: TableData) {
  const blob = new Blob([toCsv(table.columns, table.rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug(name)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataTable({ table, maxRows = 200, onRowClick }: { table: TableData; maxRows?: number; onRowClick?: (row: Cell[]) => void }) {
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const rows = useMemo(() => {
    if (!sort) return table.rows;
    return table.rows.slice().sort((a, b) => {
      const x = a[sort.col]; const y = b[sort.col];
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir;
      return String(x ?? '').localeCompare(String(y ?? ''), 'en-GB', { numeric: true }) * sort.dir;
    });
  }, [table, sort]);
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {table.columns.map((c, i) => (
              <th key={c} scope="col">
                <button type="button" onClick={() => setSort((s) => (s && s.col === i ? { col: i, dir: (s.dir * -1) as 1 | -1 } : { col: i, dir: 1 }))}>
                  {c}{sort && sort.col === i ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, maxRows).map((r, i) => (
            <tr key={i} onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? 'clickable' : undefined}>
              {r.map((v, j) => <td key={j}>{typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString('en-GB') : v.toFixed(1)) : v ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && <p className="table-note">Showing {maxRows} of {rows.length} rows. Download the CSV for the full list.</p>}
    </div>
  );
}

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  option?: Opt;
  height?: number;
  onClick?: (p: Opt) => void;
  table?: TableData;
  span?: 1 | 2 | 3;
  empty?: boolean;
  emptyText?: string;
  actions?: ReactNode;
  children?: ReactNode;
  hint?: string;
}

export function ChartCard({ title, subtitle, option, height = 300, onClick, table, span = 1, empty, emptyText, actions, children, hint }: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const body = empty ? (
    <EmptyState text={emptyText || 'No submissions match the current filters.'} />
  ) : view === 'table' && table ? (
    <DataTable table={table} />
  ) : option ? (
    <Chart option={option} height={expanded ? 560 : height} onClick={onClick} ariaLabel={`${title}. ${subtitle || ''}`} />
  ) : (
    children
  );

  const card = (
    <section className={`card span-${span}${expanded ? ' expanded' : ''}`} aria-label={title}>
      <header className="card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="card-sub">{subtitle}</p>}
        </div>
        <div className="card-actions">
          {actions}
          {table && option && !empty && (
            <div className="seg small" role="group" aria-label="View">
              <button type="button" className={view === 'chart' ? 'on' : ''} onClick={() => setView('chart')}>Chart</button>
              <button type="button" className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button>
            </div>
          )}
          {table && !empty && (
            <button type="button" className="icon-btn" onClick={() => downloadCsv(title, table)} title="Download CSV" aria-label={`Download ${title} as CSV`}>
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 3v9m0 0l-4-4m4 4l4-4M4 15h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
          {option && !empty && (
            <button type="button" className="icon-btn" onClick={() => setExpanded((x) => !x)} title={expanded ? 'Close' : 'Expand'} aria-label={expanded ? 'Close expanded view' : `Expand ${title}`}>
              {expanded ? (
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              ) : (
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </button>
          )}
        </div>
      </header>
      {body}
      {hint && !empty && <p className="card-hint">{hint}</p>}
    </section>
  );

  if (!expanded) return card;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}>
      {card}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><rect x="8" y="10" width="32" height="28" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M14 30l6-7 5 5 9-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <p>{text}</p>
    </div>
  );
}

export interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'warn' | 'bad' | null;
  toneLabel?: string;
  spark?: number[];
}

export function Kpi({ label, value, sub, tone, toneLabel, spark }: KpiProps) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
      {tone && <StatusTag tone={tone} label={toneLabel || ''} />}
      {spark && spark.length > 1 && <Sparkline values={spark} />}
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const w = 120; const h = 28;
  const max = Math.max(...values, 1); const min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 4) - 2}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function StatusTag({ tone, label }: { tone: 'good' | 'warn' | 'bad'; label: string }) {
  return (
    <span className={`status status-${tone}`}>
      <StatusIcon tone={tone} />
      {label}
    </span>
  );
}

function StatusIcon({ tone }: { tone: 'good' | 'warn' | 'bad' }) {
  if (tone === 'good') return <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="currentColor" /><path d="M3.5 6.2l1.7 1.6 3.3-3.4" stroke="#FFFFFF" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>;
  if (tone === 'warn') return <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M6 1l5 9.5H1z" fill="currentColor" /></svg>;
  return <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="currentColor" /></svg>;
}

export function RagPill({ rag }: { rag: Rag | null }) {
  if (!rag) return <span className="status status-none">Not rated</span>;
  const tone = rag === 'Green' ? 'good' : rag === 'Amber' ? 'warn' : 'bad';
  return <StatusTag tone={tone} label={rag} />;
}

export function Stars({ star }: { star: number | null }) {
  if (star === null) return <span className="stars muted">No rating</span>;
  return (
    <span className="stars" aria-label={`Star ${star} of 5`}>
      {Array.from({ length: 5 }, (_, i) => <span key={i} className={i < star ? 'on' : 'off'}>{'★'}</span>)}
      <span className="stars-label">Star {star}</span>
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)} aria-pressed={value === o.id}>{o.label}</button>
      ))}
    </div>
  );
}

export function Select({ label, value, options, onChange, allLabel = 'All' }: { label: string; value: string; options: string[]; onChange: (v: string) => void; allLabel?: string }) {
  return (
    <label className="select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="All">{allLabel}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function Chips({ chips, onClear }: { chips: { key: string; label: string; onRemove: () => void }[]; onClear?: () => void }) {
  if (!chips.length) return null;
  return (
    <div className="chips" aria-label="Active selections">
      <span className="chips-label">Selected:</span>
      {chips.map((c) => (
        <button type="button" key={c.key} className="chip" onClick={c.onRemove} aria-label={`Remove ${c.label}`}>
          {c.label}
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      ))}
      {onClear && chips.length > 1 && <button type="button" className="chip-clear" onClick={onClear}>Clear all</button>}
    </div>
  );
}

export function Drawer({ open, title, subtitle, onClose, children }: { open: boolean; title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header className="drawer-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close panel">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function SectionTitle({ title, text }: { title: string; text?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}
