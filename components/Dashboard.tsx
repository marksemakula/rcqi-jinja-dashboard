'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import FacilitySearch from './FacilitySearch';
import { buildDemo } from '@/lib/demo';
import { ALL, DEFAULT_FILTERS, datasetSize, filterDataset, filtersFromSearch, currentFyStart, fyLabel, MONTH_NAMES, normaliseDataset, optionsFrom, periodDefaults, periodMonths, periodYears, PRESETS, searchFromFilters, type Filters, type Preset } from '@/lib/filters';
import { buildJournal, filterProjects } from '@/lib/journal';
import type { DirectoryFacility, Mode, Payload } from '@/lib/types';
import type { FacilityOption } from './FacilitySearch';

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

/**
 * directory: every DHIS2 facility in Busoga; busoga: its districts. Both come from the server page, so the place filters
 * list every district and facility, not only those with entries.
 */
export default function Dashboard({ directory = [], busoga = [] }: { directory?: DirectoryFacility[]; busoga?: string[] }) {
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
    // #journal opens a tab; #journal/<project label> (the link in notification emails) also opens that project.
    const fromHash = () => {
      const raw = window.location.hash.replace(/^#/, '');
      const slash = raw.indexOf('/');
      const id = (slash > -1 ? raw.slice(0, slash) : raw) as TabId;
      if (!TABS.some((t) => t.id === id)) return;
      setTab(id);
      if (slash > -1) {
        try { setFocus(decodeURIComponent(raw.slice(slash + 1))); } catch { setFocus(null); }
      }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  // The landing page (and any bookmark) passes the filters in the address: /dashboard?period=..&district=..&facility=..
  const addressRead = useRef(false);
  useEffect(() => {
    if (window.location.search) setFilters((f) => ({ ...f, ...filtersFromSearch(window.location.search) }));
  }, []);
  // The address follows the period, district and facility filters, so a filtered view can be bookmarked or shared.
  useEffect(() => {
    if (!addressRead.current) { addressRead.current = true; return; }
    const search = searchFromFilters(filters);
    if (search === window.location.search) return;
    history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
  }, [filters]);

  const live = useMemo(() => normaliseDataset(payload?.data), [payload]);
  const demo = useMemo(() => buildDemo(), []);
  const liveCount = datasetSize(live);
  const connected = !!payload?.ok;
  const mode: Mode = forceDemo === true ? 'demo' : forceDemo === false && connected ? 'live' : connected && liveCount > 0 ? 'live' : 'demo';
  const dataset = mode === 'live' ? live : demo;
  const filtered = useMemo(() => filterDataset(dataset, filters), [dataset, filters]);
  const opts = useMemo(() => optionsFrom(dataset), [dataset]);
  // A district or facility chosen on the landing page may have no entries yet; it still appears in the filters.
  // Every Busoga district from DHIS2, any other district found in the entries, and a district chosen in the address.
  const districtOptions = useMemo(() => {
    const set = new Set<string>([...busoga, ...opts.districts]);
    if (filters.district !== ALL) set.add(filters.district);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [busoga, opts, filters.district]);
  // The districts a facility belongs to (names can repeat across districts).
  const districtsOf = useCallback((name: string) => {
    const out = directory.filter((f) => f.name === name).map((f) => f.district);
    if (opts.facilityDistricts[name]) out.push(opts.facilityDistricts[name]);
    return out;
  }, [directory, opts]);
  // The facility search lists every DHIS2 facility in the chosen district (all districts when none is chosen), marks those
  // with entries, and adds entered facilities that are not in DHIS2 so their entries can still be filtered.
  const facilityOptions = useMemo(() => {
    const inScope = (d: string | null) => filters.district === ALL || d === filters.district;
    const withEntries = new Set(opts.facilities);
    const list: FacilityOption[] = directory.filter((f) => inScope(f.district))
      .map((f) => ({ id: f.id, name: f.name, district: f.district, level: f.level, tag: withEntries.has(f.name) ? 'Has entries' : undefined }));
    const known = new Set(directory.map((f) => f.name));
    for (const name of opts.facilities) {
      const d = opts.facilityDistricts[name] || null;
      if (!known.has(name) && inScope(d)) list.push({ id: `entered:${name}`, name, district: d, level: 'Not in DHIS2', tag: 'Has entries' });
    }
    if (filters.facility !== ALL && !list.some((f) => f.name === filters.facility)) list.push({ id: `chosen:${filters.facility}`, name: filters.facility, district: filters.district === ALL ? null : filters.district });
    return list;
  }, [directory, opts, filters.district, filters.facility]);
  const selectedFacilityId = useMemo(() => facilityOptions.find((o) => o.name === filters.facility && (filters.district === ALL || o.district === filters.district))?.id, [facilityOptions, filters.facility, filters.district]);
  // Years and months offered by the period controls.
  const years = useMemo(() => periodYears([...dataset.hsr, ...dataset.fives, ...dataset.hh, ...dataset.ipcBasic, ...dataset.ipcMoh, ...dataset.hfqap, ...dataset.qij].map((r) => r.date || r.ts)), [dataset]);
  const months = useMemo(() => periodMonths(years), [years]);
  const fyStarts = useMemo(() => {
    const out: number[] = [];
    for (let y = currentFyStart(); y >= years[years.length - 1] - 1; y--) out.push(y);
    return out;
  }, [years]);
  const monthName = (key: string) => `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  // Entries for the chosen facility in the selected period (journal projects count at project level).
  const facilityEntries = useMemo(() => {
    if (filters.facility === ALL) return null;
    return datasetSize({ ...filtered, qij: [] }) + filterProjects(buildJournal(dataset.qij), filters).length;
  }, [filtered, dataset, filters]);

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
  const setPeriod = (p: Preset) => setF({ preset: p, ...(p === filters.preset ? {} : periodDefaults(p)) });
  const changed = filters.preset !== DEFAULT_FILTERS.preset || filters.district !== ALL || filters.facility !== ALL || filters.department !== ALL;

  let banner: { tone: 'info' | 'warn'; text: string; action?: { label: string; run: () => void } } | null = null;
  const DEMO_NOTE = ' Facility names are real Busoga facilities from DHIS2, but every figure is invented and does not describe them.';
  if (!loading || payload) {
    if (mode === 'demo') {
      if (failed) banner = { tone: 'warn', text: 'The live CQI Google Sheet could not be reached, so demonstration data is shown.' + DEMO_NOTE, action: { label: 'Try again', run: load } };
      else if (forceDemo) banner = { tone: 'info', text: 'You are viewing demonstration data for training purposes.' + DEMO_NOTE, action: connected ? { label: 'Show live data', run: () => setForceDemo(false) } : undefined };
      else if (connected) banner = { tone: 'info', text: 'The forms are live and connected. No submissions have been received yet, so illustrative demonstration data is shown. Live results replace it automatically after the first submission.' + DEMO_NOTE };
      else banner = { tone: 'info', text: 'Demonstration data: the live CQI Google Sheet has not been connected to this deployment yet.' + DEMO_NOTE };
    }
  }

  const ActiveTab = { overview: Overview, safety: Safety, hand: HandHygiene, ipc: Ipc, fives: FiveS, hfqap: Hfqap, journal: Journal, forms: Forms }[tab];
  const updated = payload?.generatedAt ? new Date(payload.generatedAt).toLocaleTimeString('en-GB', { timeZone: 'Africa/Kampala', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="shell">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <Link href="/" className="brand" title="Back to the CQI home page">
          <Image src="/uganda-coat-of-arms.png" alt="Coat of arms of the Republic of Uganda" width={424} height={459} priority className="brand-logo" />
          <div>
            <span className="brand-title">CQI</span>
            <span className="brand-sub">MoH - Busoga RCQI</span>
          </div>
        </Link>
        <nav aria-label="Dashboard sections">
          {TABS.map((t) => (
            <button type="button" key={t.id} className={`nav-item${tab === t.id ? ' active' : ''}`} onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d={ICONS[t.id]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" /></svg>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p>Continuous Quality Improvement</p>
          <p className="muted-dark">Busoga Region, Uganda</p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="menu-btn" onClick={() => setMenuOpen((m) => !m)} aria-label="Open navigation" aria-expanded={menuOpen}>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" /></svg>
          </button>
          <Image src="/uganda-coat-of-arms.png" alt="" width={424} height={459} className="top-logo" aria-hidden="true" />
          <div className="title-block">
            <h1>Continuous Quality Improvement</h1>
            <p>CQI dashboard, MoH - Busoga RCQI</p>
          </div>
          <div className="top-actions">
            <span className={`mode-pill ${mode}`} title={mode === 'live' ? 'Live data from the CQI Google Sheet' : 'Demonstration data'}>
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
            <label className="select period-select">
              <span>Period</span>
              <select value={filters.preset} onChange={(e) => setPeriod(e.target.value as Preset)}>
                <optgroup label="Quick ranges">
                  {PRESETS.filter((p) => p.group === 'quick').map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </optgroup>
                <optgroup label="Choose a period">
                  {PRESETS.filter((p) => p.group === 'choose').map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </optgroup>
              </select>
            </label>
            {filters.preset === 'calendar' && (
              <>
                <label className="select narrow period-year">
                  <span>Year</span>
                  <select value={filters.year ?? years[0]} onChange={(e) => setF({ year: Number(e.target.value) })}>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
                <label className="select narrow period-month">
                  <span>Month</span>
                  <select value={filters.month} onChange={(e) => setF({ month: Number(e.target.value) })}>
                    <option value={0}>All months</option>
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </label>
              </>
            )}
            {filters.preset === 'fyear' && (
              <label className="select narrow period-fy">
                <span>Financial year</span>
                <select value={filters.fyStart ?? ''} onChange={(e) => setF({ fyStart: Number(e.target.value) })}>
                  {fyStarts.map((y) => <option key={y} value={y}>{fyLabel(y)}</option>)}
                </select>
              </label>
            )}
            {filters.preset === 'range' && (
              <>
                <label className="select narrow period-from">
                  <span>From</span>
                  <select value={filters.from ?? ''} onChange={(e) => setF({ from: e.target.value })}>
                    {months.map((k) => <option key={k} value={k}>{monthName(k)}</option>)}
                  </select>
                </label>
                <label className="select narrow period-to">
                  <span>To</span>
                  <select value={filters.to ?? ''} onChange={(e) => setF({ to: e.target.value })}>
                    {months.map((k) => <option key={k} value={k}>{monthName(k)}</option>)}
                  </select>
                </label>
              </>
            )}
            <Select label="District" value={filters.district} options={districtOptions} allLabel="All districts"
              onChange={(v) => setF({ district: v, facility: filters.facility === ALL || v === ALL || districtsOf(filters.facility).includes(v) ? filters.facility : ALL })} />
            <FacilitySearch value={filters.facility} options={facilityOptions} selectedId={selectedFacilityId} allLabel="All facilities"
              onChange={(v, option) => setF(option ? { facility: v, district: option.district || filters.district } : { facility: ALL })} />
            <Select label="Department or ward" value={filters.department} options={opts.departments} onChange={(v) => setF({ department: v })} allLabel="All departments" />
            {changed && <button type="button" className="btn ghost small reset" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</button>}
          </div>
        )}

        {tab !== 'forms' && facilityEntries === 0 && (
          <div className="banner info no-entries" role="status">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2.5" y="2.5" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10 9v5M10 6.2v.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" /></svg>
            <span>
              {mode === 'demo' ? 'The demonstration data has no entries for ' : 'No entries have been received from '}<strong>{filters.facility}</strong>
              {' '}in the selected period. Results appear here once its team submits a CQI form.
            </span>
            <button type="button" className="btn small" onClick={() => setFilters(DEFAULT_FILTERS)}>Show the whole region</button>
          </div>
        )}

        <main id="content">
          <ActiveTab {...props} />
        </main>

        <footer className="footer">
          <p>CQI, MoH - Busoga RCQI. Data collected through Google Forms and held in the CQI master Google Sheet. Free-text fields are never published here.</p>
        </footer>
      </div>
      {menuOpen && <button type="button" className="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
