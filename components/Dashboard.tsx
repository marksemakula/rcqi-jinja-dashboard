'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Overview from './tabs/Overview';
import Safety from './tabs/Safety';
import HandHygiene from './tabs/HandHygiene';
import Ipc from './tabs/Ipc';
import FiveS from './tabs/FiveS';
import Hfqap from './tabs/Hfqap';
import Forms from './tabs/Forms';
import Journal from './tabs/Journal';
import { TABS, type TabId, type TabProps } from './tabs/shared';
import { Select } from './ui';
import { buildDemo } from '@/lib/demo';
import { ALL, DEFAULT_FILTERS, datasetSize, filterDataset, normaliseDataset, optionsFrom, PRESETS, type Filters, type Preset } from '@/lib/filters';
import type { Mode, Payload } from '@/lib/types';

const ICONS: Record<TabId, string> = {
  overview: 'M3 13h6V3H3zm0 8h6v-6H3zm8 0h6V11h-6zm0-18v6h6V3z',
  safety: 'M10 2l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V5zm0 5v4m0 3v.5',
  hand: 'M6 10V5a1.5 1.5 0 013 0v4m0-5a1.5 1.5 0 013 0v5m0-4a1.5 1.5 0 013 0v6c0 3.3-2.2 6-5.5 6S5 15.5 4 13l-1.5-3a1.5 1.5 0 012.6-1.4L6 10',
  ipc: 'M3 3h14v14H3zM10 6v8M6 10h8',
  fives: 'M3 4h14M3 8h10M3 12h14M3 16h8',
  hfqap: 'M10 2l2.4 5 5.6.8-4 3.9.9 5.5L10 14.6l-4.9 2.6.9-5.5-4-3.9 5.6-.8z',
  journal: 'M4 2h11v16H4zM7 2v16M10 6h3M10 9h3',
  forms: 'M5 2h7l4 4v12H5zm7 0v4h4M8 10h5M8 13h5'
};

const REFRESH_MS = 5 * 60 * 1000;

export default function Dashboard() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [forceDemo, setForceDemo] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [focus, setFocus] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      const json = (await res.json()) as Payload;
      setPayload(json);
      setFailed(!json.ok && json.configured !== false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace('#', '') as TabId;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  const live = useMemo(() => normaliseDataset(payload?.data), [payload]);
  const demo = useMemo(() => buildDemo(), []);
  const liveCount = datasetSize(live);
  const connected = !!payload?.ok;
  const mode: Mode = forceDemo === true ? 'demo' : forceDemo === false && connected ? 'live' : connected && liveCount > 0 ? 'live' : 'demo';
  const dataset = mode === 'live' ? live : demo;
  const filtered = useMemo(() => filterDataset(dataset, filters), [dataset, filters]);
  const opts = useMemo(() => optionsFrom(dataset), [dataset]);

  const go = useCallback((t: TabId, f?: string) => {
    setTab(t);
    setFocus(f ?? null);
    setMenuOpen(false);
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', `#${t}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const props: TabProps = { data: filtered, all: dataset, filters, forms: payload?.forms || {}, mode, go, focus, generatedAt: payload?.generatedAt || null };
  const setF = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const changed = filters.preset !== DEFAULT_FILTERS.preset || filters.district !== ALL || filters.facility !== ALL || filters.department !== ALL;

  let banner: { tone: 'info' | 'warn'; text: string; action?: { label: string; run: () => void } } | null = null;
  if (!loading || payload) {
    if (mode === 'demo') {
      if (failed) banner = { tone: 'warn', text: 'The live RCQI Google Sheet could not be reached, so demonstration data is shown.', action: { label: 'Try again', run: load } };
      else if (forceDemo) banner = { tone: 'info', text: 'You are viewing demonstration data for training purposes.', action: connected ? { label: 'Show live data', run: () => setForceDemo(false) } : undefined };
      else if (connected) banner = { tone: 'info', text: 'The forms are live and connected. No submissions have been received yet, so illustrative demonstration data is shown. Live results replace it automatically after the first submission.' };
      else banner = { tone: 'info', text: 'Demonstration data: the live RCQI Google Sheet has not been connected to this deployment yet.' };
    }
  }

  const ActiveTab = { overview: Overview, safety: Safety, hand: HandHygiene, ipc: Ipc, fives: FiveS, hfqap: Hfqap, journal: Journal, forms: Forms }[tab];
  const updated = payload?.generatedAt ? new Date(payload.generatedAt).toLocaleTimeString('en-GB', { timeZone: 'Africa/Kampala', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="shell">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="brand">
          <Image src="/jrrh-logo.png" alt="Ministry of Health, Jinja Regional Referral Hospital logo" width={68} height={68} priority className="brand-logo" />
          <div>
            <span className="brand-title">RCQI</span>
            <span className="brand-sub">Jinja Regional Referral Hospital</span>
          </div>
        </div>
        <nav aria-label="Dashboard sections">
          {TABS.map((t) => (
            <button type="button" key={t.id} className={`nav-item${tab === t.id ? ' active' : ''}`} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d={ICONS[t.id]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" /></svg>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p>Regional Continuous Quality Improvement</p>
          <p className="muted-dark">Busoga Region, Uganda</p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="menu-btn" onClick={() => setMenuOpen((m) => !m)} aria-label="Open navigation" aria-expanded={menuOpen}>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" /></svg>
          </button>
          <Image src="/jrrh-logo.png" alt="" width={40} height={40} className="top-logo" aria-hidden="true" />
          <div className="title-block">
            <h1>Regional Continuous Quality Improvement</h1>
            <p>RCQI dashboard, Jinja Regional Referral Hospital</p>
          </div>
          <div className="top-actions">
            <span className={`mode-pill ${mode}`} title={mode === 'live' ? 'Live data from the RCQI Google Sheet' : 'Demonstration data'}>
              <span className="dot" aria-hidden="true" />{mode === 'live' ? 'Live data' : 'Demonstration'}
            </span>
            {updated && mode === 'live' && <span className="updated">Updated {updated} EAT</span>}
            <button type="button" className="btn ghost small" onClick={load} disabled={loading} aria-label="Refresh data">{loading ? 'Refreshing' : 'Refresh'}</button>
            {connected && liveCount > 0 && (
              <button type="button" className="btn ghost small" onClick={() => setForceDemo(mode === 'live')}>{mode === 'live' ? 'View demo' : 'View live'}</button>
            )}
          </div>
        </header>

        {banner && (
          <div className={`banner ${banner.tone}`} role="status">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2.5" y="2.5" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10 9v5M10 6.2v.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" /></svg>
            <span>{banner.text}</span>
            {banner.action && <button type="button" className="btn small" onClick={banner.action.run}>{banner.action.label}</button>}
          </div>
        )}

        {tab !== 'forms' && (
          <div className="filters" role="search" aria-label="Filters">
            <label className="select">
              <span>Period</span>
              <select value={filters.preset} onChange={(e) => setF({ preset: e.target.value as Preset })}>
                {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <Select label="District" value={filters.district} options={opts.districts} onChange={(v) => setF({ district: v })} allLabel="All districts" />
            <Select label="Facility" value={filters.facility} options={opts.facilities} onChange={(v) => setF({ facility: v })} allLabel="All facilities" />
            <Select label="Department or ward" value={filters.department} options={opts.departments} onChange={(v) => setF({ department: v })} allLabel="All departments" />
            {changed && <button type="button" className="btn ghost small reset" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</button>}
          </div>
        )}

        <main id="content">
          <ActiveTab {...props} />
        </main>

        <footer className="footer">
          <p>RCQI, Jinja Regional Referral Hospital. Data collected through Google Forms and held in the RCQI master Google Sheet. Free-text fields are never published here.</p>
        </footer>
      </div>
      {menuOpen && <button type="button" className="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
