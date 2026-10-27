'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import Chart from '../Chart';
import { ChartCard, DataTable, EmptyState, Kpi, SectionTitle, StatusTag, type TableData } from '../ui';
import type { TabProps } from './shared';
import { axisTooltip, categoryAxis, FONT, grid, hBarSeries, legend, lineSeries, pctAxis, tooltip, type Opt } from '@/lib/chart';
import { fmtDate, fmtPct, shortMonth } from '@/lib/format';
import { buildJournal, filterProjects, type JournalProject } from '@/lib/journal';
import { pair, palette } from '@/lib/palette';

const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

function runChart(p: JournalProject): Opt {
  const byMonth = new Map(p.months.map((m) => [m.key, m]));
  const data = p.axis.map((k) => { const m = byMonth.get(k); return m && m.pct !== null ? r1(m.pct) : null; });
  const changeLines = p.changes.filter((c) => c.monthIndex !== null && c.monthIndex >= 0).map((c) => ({
    xAxis: c.monthIndex,
    lineStyle: { color: palette.ag400, type: 'dashed', width: 1.5 },
    label: { formatter: `C${c.no}`, color: palette.ag800, fontFamily: FONT, fontSize: 11, fontWeight: 700, position: 'end' }
  }));
  const targetLine = p.target !== null ? [{
    yAxis: p.target,
    lineStyle: { color: palette.khakiDark, type: 'dashed', width: 1.5 },
    label: { formatter: `Target\n${p.target}%`, color: palette.khakiDark, fontFamily: FONT, fontSize: 11, lineHeight: 14, position: 'end', distance: 16 }
  }] : [];
  return {
    tooltip: axisTooltip({
      formatter: (ps: { dataIndex: number }[]) => {
        const i = ps[0].dataIndex;
        const key = p.axis[i];
        const m = byMonth.get(key);
        const started = p.changes.filter((c) => c.monthIndex === i).map((c) => `C${c.no}: ${c.change}`);
        return `<b>Month ${i} (${shortMonth(key)})</b><br/>${m ? `${m.numerator} of ${m.denominator} = ${fmtPct(m.pct, 1)}` : 'No result recorded'}${started.length ? `<br/><br/>Change started:<br/>${started.join('<br/>')}` : ''}`;
      }
    }),
    // The target label sits in the right margin so it never covers the latest data label.
    grid: grid({ top: 36, right: p.target !== null ? 76 : 24 }),
    xAxis: categoryAxis(p.axis.map((k, i) => `M${i}\n${shortMonth(k)}`), { boundaryGap: false, axisLabel: { color: palette.inkMuted, fontFamily: FONT, fontSize: 10.5, interval: 0 } }),
    yAxis: pctAxis(),
    series: [lineSeries({
      name: p.indicator || 'Indicator', data, connectNulls: true,
      label: { show: true, formatter: (x: { value: number | null }) => (x.value === null ? '' : `${Math.round(x.value)}%`), position: 'top', color: palette.inkSoft, fontFamily: FONT, fontSize: 10.5 },
      markLine: { silent: true, symbol: 'none', data: [...changeLines, ...targetLine] }
    })]
  };
}

export default function Journal({ all, filters, forms, focus }: TabProps) {
  const projects = useMemo(() => filterProjects(buildJournal(all.qij), filters), [all.qij, filters]);
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => { if (focus) setLabel(focus); }, [focus]);
  const sel = projects.find((p) => p.label === label) || projects[0] || null;
  const formUrl = forms.qij?.shortUrl || forms.qij?.url || '';

  const kpi = useMemo(() => {
    const changes = projects.flatMap((p) => p.changes);
    const improved = changes.filter((c) => c.improved === 'Yes').length;
    const meeting = projects.filter((p) => p.target !== null && p.latestPct !== null && p.latestPct >= p.target).length;
    return { n: projects.length, active: projects.filter((p) => p.status === 'Active').length, changes: changes.length, improved, meeting, withTarget: projects.filter((p) => p.target !== null).length };
  }, [projects]);

  const portfolio = useMemo(() => {
    const ps = projects.slice().reverse();
    const option: Opt = {
      tooltip: axisTooltip({ axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => fmtPct(v) }),
      legend: legend(),
      grid: grid({ top: 32, right: 40 }),
      xAxis: pctAxis(),
      yAxis: categoryAxis(ps.map((p) => p.title), { axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 190, overflow: 'truncate' } }),
      series: [
        hBarSeries({ name: 'Baseline', data: ps.map((p) => r1(p.baselinePct)), itemStyle: { color: pair[1] } }),
        hBarSeries({ name: 'Latest month', data: ps.map((p) => r1(p.latestPct)), itemStyle: { color: pair[0] } }),
        { type: 'scatter', name: 'Target', symbol: 'rect', symbolSize: [3, 22], itemStyle: { color: palette.khakiDark }, data: ps.map((p) => p.target), z: 5 }
      ]
    };
    const table: TableData = {
      columns: ['Project', 'Facility', 'Start', 'Status', 'Months', 'Changes', 'Baseline (%)', 'Latest (%)', 'Target (%)'],
      rows: projects.map((p) => [p.title, p.facility, fmtDate(p.startDate), p.status, p.months.length, p.changes.length, r1(p.baselinePct), r1(p.latestPct), p.target])
    };
    return { option, table, ps, height: Math.max(220, 70 + ps.length * 56) };
  }, [projects]);

  const monthTable: TableData | null = sel ? {
    columns: ['', ...sel.axis.map((k, i) => `M${i} ${shortMonth(k)}`)],
    rows: (() => {
      const byMonth = new Map(sel.months.map((m) => [m.key, m]));
      return [
        ['Numerator', ...sel.axis.map((k) => byMonth.get(k)?.numerator ?? null)],
        ['Denominator', ...sel.axis.map((k) => byMonth.get(k)?.denominator ?? null)],
        ['%', ...sel.axis.map((k) => { const m = byMonth.get(k); return m && m.pct !== null ? r1(m.pct) : null; })]
      ];
    })()
  } : null;

  const empty = !projects.length;

  return (
    <div className="tab journal-tab">
      <div className="print-hide">
        <SectionTitle title="QI Documentation Journal" text="The online Documentation Journal for QI activities. Each project shows its objective and problem (Part 1), the changes tested (Part 2) and the monthly results graph annotated with every change (Part 3). Choose a project, or print its journal for a learning session." />
        <div className="toolbar">
          {!empty && (
            <label className="select wide">
              <span>Project</span>
              <select value={sel?.label || ''} onChange={(e) => setLabel(e.target.value)}>
                {projects.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
              </select>
            </label>
          )}
          {formUrl && <a className="btn" href={formUrl} target="_blank" rel="noopener noreferrer">Add a journal entry</a>}
          {sel && <button type="button" className="btn ghost" onClick={() => window.print()}>Print this journal</button>}
        </div>
        <p className="muted journal-note">Everyone on a project&apos;s team email list, and the CQI coordinators, receive an email after every entry for that project. Teams add or remove addresses with the &ldquo;Update the team email list&rdquo; option in the form; addresses are never shown here.</p>
        <div className="kpis">
          <Kpi label="QI projects" value={String(kpi.n)} sub={`${kpi.active} active`} />
          <Kpi label="Changes tested" value={String(kpi.changes)} sub={`${kpi.improved} registered an improvement`} />
          <Kpi label="Meeting their target" value={`${kpi.meeting} of ${kpi.withTarget}`} sub="Latest month against the project target" />
        </div>
        {!empty && (
          <div className="grid">
            <ChartCard span={2} title="Baseline and latest result by project" subtitle="Lighter bar: first month recorded. Darker bar: latest month. Marker: target. Select a project to open its journal." option={portfolio.option} table={portfolio.table} height={portfolio.height}
              onClick={(p) => { const proj = portfolio.ps[p.dataIndex as number]; if (proj) setLabel(proj.label); }} />
            <section className="card span-1" aria-label="Project list">
              <header className="card-head"><div><h3>Projects</h3><p className="card-sub">Select a row to open the journal.</p></div></header>
              <DataTable table={{ columns: ['Project', 'Status'], rows: projects.map((p) => [p.title, p.status]) }}
                onRowClick={(row) => { const proj = projects.find((p) => p.title === row[0]); if (proj) setLabel(proj.label); }} />
            </section>
          </div>
        )}
      </div>

      {empty ? (
        <section className="card span-3"><EmptyState text={`No QI projects have been registered yet${formUrl ? `. Register one at ${formUrl}` : ''}.`} /></section>
      ) : sel && (
        <article className="journal-sheet" aria-label={`Documentation journal: ${sel.title}`}>
          <header className="journal-head">
            <Image src="/uganda-coat-of-arms.png" alt="Coat of arms of the Republic of Uganda" width={424} height={459} className="journal-logo" />
            <div className="journal-titles">
              <p className="journal-kicker">Ministry of Health</p>
              <h2>Documentation Journal for QI activities</h2>
              {!sel.registered && <StatusTag tone="warn" label="Entries found but the project has not been registered yet" />}
            </div>
            <div className="objective-box">
              <span>Improvement objective</span>
              <b>{sel.title}</b>
            </div>
          </header>

          <dl className="journal-meta">
            <div><dt>Name of the facility</dt><dd>{sel.facility}</dd></div>
            <div><dt>District</dt><dd>{sel.district || 'Not recorded'}</dd></div>
            <div><dt>Region</dt><dd>{sel.region || 'Not recorded'}</dd></div>
            <div><dt>Department or unit</dt><dd>{sel.department || 'Not applicable'}</dd></div>
            <div><dt>Team</dt><dd>{sel.teamSize ? `${sel.teamSize} member${sel.teamSize === 1 ? '' : 's'} (names held in the master sheet)` : 'Names held in the master sheet'}</dd></div>
            <div><dt>Start date</dt><dd>{fmtDate(sel.startDate) || 'Not recorded'}</dd></div>
            <div><dt>End date</dt><dd>{fmtDate(sel.endDate) || 'Not set'}</dd></div>
            <div><dt>Status</dt><dd>{sel.status}</dd></div>
          </dl>

          <h3 className="journal-part">Part 1: Improvement objective and problem</h3>
          <div className="journal-boxes">
            <div className="jbox"><h4>Improvement objective</h4><p>{sel.objective || 'Not recorded'}</p></div>
            <div className="jbox">
              <h4>Indicator for the objective</h4>
              <p>{sel.indicator || 'Not recorded'}</p>
              <p className="jsmall"><b>Numerator:</b> {sel.numeratorDef || 'Not recorded'}<br /><b>Denominator:</b> {sel.denominatorDef || 'Not recorded'}{sel.target !== null && <><br /><b>Target:</b> {sel.target}%</>}</p>
            </div>
            <div className="jbox full"><h4>Description of the problem</h4><p>{sel.problem || 'Not recorded'}</p></div>
          </div>

          <h3 className="journal-part">Part 2: Changes worksheet</h3>
          {sel.changes.length ? (
            <DataTable table={{ columns: ['No.', 'Planned and tested change', 'Start date', 'End date', 'Improvement registered?', 'Comments'], rows: sel.changes.map((c) => [`C${c.no}`, c.change, fmtDate(c.start), fmtDate(c.end) || '', c.improved, c.comments || '']) }} />
          ) : <p className="card-sub pad">No changes have been recorded for this project yet.</p>}

          <h3 className="journal-part">Part 3: Annotated results</h3>
          <p className="journal-graph-title"><b>{sel.indicator || sel.title}</b>{sel.baselinePct !== null && sel.latestPct !== null && <span className="muted">  Baseline {fmtPct(sel.baselinePct)}, latest {fmtPct(sel.latestPct)}</span>}</p>
          {sel.months.length ? (
            <>
              <Chart option={runChart(sel)} height={340} ariaLabel={`Monthly results for ${sel.title}, annotated with the changes tested`} />
              {monthTable && <DataTable table={monthTable} />}
            </>
          ) : <p className="card-sub pad">No monthly results have been recorded for this project yet.</p>}

          <div className="journal-boxes notes">
            <div className="jbox">
              <h4>Notes on the indicator</h4>
              {sel.months.some((m) => m.notes) ? <ul>{sel.months.filter((m) => m.notes).map((m) => <li key={m.key}><b>{shortMonth(m.key)}:</b> {m.notes}</li>)}</ul> : <p className="muted">No notes recorded yet.</p>}
            </div>
            <div className="jbox">
              <h4>Notes on other observed effects (lessons learnt)</h4>
              {sel.months.some((m) => m.effects) ? <ul>{sel.months.filter((m) => m.effects).map((m) => <li key={m.key}><b>{shortMonth(m.key)}:</b> {m.effects}</li>)}</ul> : <p className="muted">No observations recorded yet.</p>}
            </div>
          </div>
          <p className="journal-foot">Generated from the CQI QI Documentation Journal form. Printed journals follow the layout of the MoH Documentation Journal for QI activities.</p>
        </article>
      )}
    </div>
  );
}
