'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChartCard, DataTable, EmptyState, Kpi, SectionTitle, StatusTag, type TableData } from '../ui';
import type { TabProps } from './shared';
import { axisTooltip, categoryAxis, FONT, grid, legend, lineSeries, pctAxis, type Opt } from '@/lib/chart';
import { buildCollaboratives, filterCollaboratives, type Collaborative } from '@/lib/collaboratives';
import { fmtDate, fmtPct, monthRange, shortMonth } from '@/lib/format';
import { buildJournal } from '@/lib/journal';
import { palette } from '@/lib/palette';

const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
/** Project lines in muted army green and khaki tones; the pooled line is the darkest. */
const PROJECT_TONES = [palette.ag300, palette.khaki, palette.olive, palette.khakiDark, palette.ag400, palette.ag200];

function StatusPill({ status }: { status: string }) {
  if (status === 'Active' || status === 'Approved') return <StatusTag tone="good" label={status} />;
  if (status === 'Awaiting approval' || status === 'Being developed' || status === 'Not in the register') return <StatusTag tone="warn" label={status} />;
  return <span className="status status-none">{status}</span>;
}

const latestOf = (c: Collaborative) => { const v = c.months.filter((m) => m.pct !== null); return v.length ? v[v.length - 1] : null; };
const isRunning = (s: string) => s === 'Active' || s === 'Approved';
const isPreparing = (s: string) => s === 'Awaiting approval' || s === 'Being developed';

/** Each project's monthly result, the pooled result across projects and the target, on one month axis. */
function resultsChart(c: Collaborative): { option: Opt; table: TableData } | null {
  const keys = c.projects.flatMap((p) => p.months.map((m) => m.key)).sort();
  if (!keys.length) return null;
  const axis = monthRange(keys[0], keys[keys.length - 1]);
  const pooled = new Map(c.months.map((m) => [m.key, m]));
  const many = c.projects.length > 1;
  const projectSeries = c.projects.map((p, i) => {
    const byMonth = new Map(p.months.map((m) => [m.key, m]));
    const tone = many ? PROJECT_TONES[i % PROJECT_TONES.length] : palette.ag600;
    return lineSeries({
      name: p.facility, data: axis.map((k) => { const m = byMonth.get(k); return m && m.pct !== null ? r1(m.pct) : null; }), connectNulls: true,
      lineStyle: { width: many ? 1.5 : 2, color: tone }, itemStyle: { color: tone, borderColor: palette.card, borderWidth: 2 }, symbolSize: many ? 6 : 8,
      label: many ? undefined : { show: true, formatter: (x: { value: number | null }) => (x.value === null ? '' : `${Math.round(x.value)}%`), position: 'top', color: palette.inkSoft, fontFamily: FONT, fontSize: 10.5 }
    });
  });
  const series: Opt[] = [...projectSeries];
  if (many) {
    series.push(lineSeries({
      name: 'All projects together', data: axis.map((k) => { const m = pooled.get(k); return m && m.pct !== null ? r1(m.pct) : null; }), connectNulls: true,
      lineStyle: { width: 3, color: palette.ag900 }, itemStyle: { color: palette.ag900, borderColor: palette.card, borderWidth: 2 }, z: 5
    }));
  }
  if (c.target !== null) {
    series[series.length - 1] = {
      ...series[series.length - 1],
      markLine: {
        silent: true, symbol: 'none',
        data: [{ yAxis: c.target, lineStyle: { color: palette.khakiDark, type: 'dashed', width: 1.5 }, label: { formatter: `Target\n${c.target}%`, color: palette.khakiDark, fontFamily: FONT, fontSize: 11, lineHeight: 14, position: 'end', distance: 16 } }]
      }
    };
  }
  const option: Opt = {
    tooltip: axisTooltip({ valueFormatter: (v: number | null) => (v === null || v === undefined ? 'No result' : fmtPct(v, 1)) }),
    legend: many ? legend() : undefined,
    grid: grid({ top: many ? 40 : 30, right: c.target !== null ? 76 : 24 }),
    xAxis: categoryAxis(axis.map(shortMonth), { boundaryGap: false }),
    yAxis: pctAxis(),
    series
  };
  const table: TableData = {
    columns: ['Month', ...c.projects.map((p) => `${p.facility} (%)`), ...(many ? ['All projects: numerator', 'All projects: denominator', 'All projects (%)'] : []), 'Target (%)'],
    rows: axis.map((k) => {
      const m = pooled.get(k);
      return [
        shortMonth(k),
        ...c.projects.map((p) => { const x = p.months.find((pm) => pm.key === k); return x ? r1(x.pct) : null; }),
        ...(many ? [m ? m.numerator : null, m ? m.denominator : null, m ? r1(m.pct) : null] : []),
        c.target
      ];
    })
  };
  return { option, table };
}

export default function Collaboratives({ all, filters, forms, focus, go, directory }: TabProps) {
  const every = useMemo(() => buildCollaboratives(all.collab, buildJournal(all.qij), directory), [all.collab, all.qij, directory]);
  const list = useMemo(() => filterCollaboratives(every, filters), [every, filters]);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => { if (focus) setName(focus); }, [focus]);
  const sel = list.find((c) => c.name === name) || list[0] || null;
  const formUrl = forms.collab?.shortUrl || forms.collab?.url || '';
  const journalUrl = forms.qij?.shortUrl || forms.qij?.url || '';

  const kpi = useMemo(() => {
    const facilities = new Set(list.flatMap((c) => c.facilities.map((f) => f.name)));
    return {
      n: list.length,
      running: list.filter((c) => isRunning(c.status)).length,
      preparing: list.filter((c) => isPreparing(c.status)).length,
      facilities: facilities.size,
      projects: list.reduce((a, c) => a + c.projects.length, 0)
    };
  }, [list]);

  const overview: TableData = useMemo(() => ({
    columns: ['Collaborative', 'Status', 'Lead', 'Facilities', 'QI projects', 'Latest result (%)', 'Target (%)'],
    rows: list.map((c) => { const l = latestOf(c); return [c.name, c.status, c.lead, c.facilities.length, c.projects.length, l ? r1(l.pct) : null, c.target]; })
  }), [list]);

  const chart = useMemo(() => (sel ? resultsChart(sel) : null), [sel]);
  const filtered = list.length !== every.length || (sel && every.find((c) => c.name === sel.name)?.facilities.length !== sel.facilities.length);
  const register = formUrl ? <a className="btn" href={formUrl} target="_blank" rel="noopener noreferrer">Register or update a collaborative</a> : null;

  if (!every.length) {
    return (
      <div className="tab collab-tab">
        <SectionTitle title="QI collaboratives" text="Collaboratives bring several facilities together on one shared aim and indicator, with a common charter and regular learning sessions." />
        <section className="card span-3 collab-empty">
          <EmptyState text="No collaboratives have been registered yet. The collaborative lead or the regional CQI secretariat registers each one, once, in the QI Collaborative Register form. Facility teams then join it by choosing it when they register their project in the QI Documentation Journal, and their monthly results appear here together." />
          <div className="toolbar">{register}{journalUrl && <a className="btn ghost" href={journalUrl} target="_blank" rel="noopener noreferrer">Open the QI Documentation Journal</a>}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="tab collab-tab">
      <SectionTitle title="QI collaboratives" text="Collaboratives bring several facilities together on one shared aim and indicator. Each is registered in the QI Collaborative Register; facility teams join by choosing it when they register their project in the QI Documentation Journal. The district and facility filters narrow the facilities and projects shown." />
      <div className="toolbar">
        {list.length > 0 && (
          <label className="select wide">
            <span>Collaborative</span>
            <select value={sel?.name || ''} onChange={(e) => setName(e.target.value)}>
              {list.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </label>
        )}
        {register}
      </div>
      <div className="kpis">
        <Kpi label="Collaboratives" value={String(kpi.n)} sub={`${kpi.running} approved or active, ${kpi.preparing} in preparation`} />
        <Kpi label="Facilities taking part" value={String(kpi.facilities)} sub="Listed at registration or with a QI project" />
        <Kpi label="QI projects" value={String(kpi.projects)} sub="Registered under a collaborative in the QI Journal" />
      </div>

      {!list.length ? (
        <section className="card span-3"><EmptyState text="No collaborative includes a facility in the chosen district or facility. Clear the place filters to see every collaborative." /></section>
      ) : (
        <div className="grid">
          <section className="card span-3" aria-label="All collaboratives">
            <header className="card-head"><div><h3>All collaboratives</h3><p className="card-sub">Select a row to show that collaborative below.{filtered ? ' Counts are for the chosen district or facility.' : ''}</p></div></header>
            <DataTable table={overview} onRowClick={(row) => setName(String(row[0]))} />
          </section>

          {sel && (
            <article className="card span-3 collab-sheet" aria-label={`Collaborative: ${sel.name}`}>
              <header className="collab-head">
                <div>
                  <p className="journal-kicker">QI collaborative</p>
                  <h2>{sel.name}</h2>
                </div>
                <StatusPill status={sel.status} />
              </header>
              {!sel.registered && <p className="muted">QI projects name this collaborative, but it has not been registered in the QI Collaborative Register yet.</p>}

              <dl className="journal-meta">
                <div><dt>Collaborative lead</dt><dd>{sel.lead || 'Not recorded'}</dd></div>
                <div><dt>Secretariat</dt><dd>{sel.secretariat || 'Not recorded'}</dd></div>
                <div><dt>Start date</dt><dd>{fmtDate(sel.startDate) || 'Not set'}</dd></div>
                <div><dt>Planned end date</dt><dd>{fmtDate(sel.endDate) || 'Not set'}</dd></div>
                <div><dt>Registered</dt><dd>{fmtDate(sel.registeredOn) || 'Not yet'}</dd></div>
                <div><dt>Facilities</dt><dd>{sel.facilities.length}</dd></div>
                <div><dt>QI projects</dt><dd>{sel.projects.length}</dd></div>
                <div><dt>Charter</dt><dd>{sel.charter && /^https?:\/\//i.test(sel.charter) ? <a href={sel.charter} target="_blank" rel="noopener noreferrer">Open the charter</a> : sel.charter || 'No link recorded'}</dd></div>
              </dl>

              <div className="journal-boxes">
                <div className="jbox"><h4>Aim</h4><p>{sel.aim || 'Not recorded'}</p></div>
                <div className="jbox">
                  <h4>Main indicator</h4>
                  <p>{sel.indicator || 'Not recorded'}</p>
                  <p className="jsmall"><b>Numerator:</b> {sel.numeratorDef || 'Not recorded'}<br /><b>Denominator:</b> {sel.denominatorDef || 'Not recorded'}{sel.target !== null && <><br /><b>Target:</b> {sel.target}%</>}</p>
                </div>
              </div>

              <h3 className="journal-part">Facilities taking part</h3>
              {sel.facilities.length ? (
                <DataTable table={{
                  columns: ['Facility', 'District', 'How it joined', 'QI projects'],
                  rows: sel.facilities.map((f) => [f.name, f.district || 'Not matched to DHIS2', f.planned && f.projects ? 'Listed at registration, with a QI project' : f.planned ? 'Listed at registration' : 'Through a QI project', f.projects])
                }} />
              ) : <p className="muted">No facilities yet. They are listed when the collaborative is registered, and join when a facility team registers a QI project under it.</p>}

              <h3 className="journal-part">QI projects</h3>
              {sel.projects.length ? (
                <ul className="collab-projects">
                  {sel.projects.map((p) => (
                    <li key={p.label}>
                      <button type="button" className="link-button" onClick={() => go('journal', p.label)}>{p.title}</button>
                      <span>{p.facility}{p.district ? `, ${p.district}` : ''}. {p.months.length} month{p.months.length === 1 ? '' : 's'} recorded{p.latestPct !== null ? `, latest ${fmtPct(p.latestPct)}` : ''}{p.target !== null ? ` against a target of ${p.target}%` : ''}.</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">No QI projects yet. A facility team joins by choosing &ldquo;{sel.name}&rdquo; when it registers its project in the QI Documentation Journal.</p>}

              {sel.updates.length > 0 && (
                <>
                  <h3 className="journal-part">Status updates</h3>
                  <DataTable table={{ columns: ['Date', 'New status', 'Notes'], rows: sel.updates.slice().reverse().map((u) => [fmtDate(u.date), u.status, u.notes]) }} />
                </>
              )}
            </article>
          )}

          {sel && chart && (
            <ChartCard span={3} title={`Monthly results: ${sel.name}`}
              subtitle={sel.projects.length > 1 ? 'Thin lines: each facility project. Thick line: all projects together (numerators and denominators added). Dashed line: the collaborative target.' : 'The monthly result of its QI project, from the QI Documentation Journal. Dashed line: the collaborative target.'}
              option={chart.option} table={chart.table} height={340} />
          )}
          {sel && !chart && sel.projects.length > 0 && (
            <section className="card span-3"><EmptyState text="Results appear here once facility teams record monthly results for their projects in the QI Documentation Journal." /></section>
          )}
        </div>
      )}
    </div>
  );
}
