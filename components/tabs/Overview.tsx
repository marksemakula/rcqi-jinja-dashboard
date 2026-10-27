'use client';

import { useMemo } from 'react';
import { ChartCard, Kpi, SectionTitle } from '../ui';
import type { TabProps } from './shared';
import { FIVE_S_DOMAINS, HFQAP_MODULES, HH_MOMENTS, BASIC_IPC_DOMAINS } from '@/lib/catalogue';
import { categoryAxis, FONT, grid, heatCell, heatVisualMap, tooltip } from '@/lib/chart';
import { countBy, fmtInt, fmtPct, latestBy, mean, monthKey, monthRange, shortMonth } from '@/lib/format';
import { buildJournal, entriesFor, filterProjects } from '@/lib/journal';
import { palette } from '@/lib/palette';
import { hhMoments, hhTotals, scoreBasicIpc, scoreFiveS, scoreHfqap, scoreMohIpc } from '@/lib/scoring';

const TOOLS = [
  { key: 'hsr', label: 'Patient safety reports', tab: 'safety' },
  { key: 'hh', label: 'Hand hygiene sessions', tab: 'hand' },
  { key: 'fives', label: '5S assessments', tab: 'fives' },
  { key: 'ipcBasic', label: 'Basic IPC assessments', tab: 'ipc' },
  { key: 'ipcMoh', label: 'IPC tool (MoH 2024)', tab: 'ipc' },
  { key: 'hfqap', label: 'HFQAP assessments', tab: 'hfqap' },
  { key: 'qij', label: 'QI journal entries', tab: 'journal' }
] as const;

export default function Overview({ data, filters, go }: TabProps) {
  const months = useMemo(() => {
    const keys = [...data.hsr, ...data.hh, ...data.fives, ...data.ipcBasic, ...data.ipcMoh, ...data.hfqap].map((r) => monthKey(r.date)).filter(Boolean).sort();
    // Journal entries are not period-filtered, so they never stretch the month axis beyond the selected period.
    return keys.length ? monthRange(keys[0], keys[keys.length - 1]) : [];
  }, [data]);

  // Journal entries skip the period filter (each project keeps all its months) but follow the district, facility and
  // department filters at project level, as on the QI Journal page.
  const qijEntries = useMemo(() => entriesFor(data.qij, filters), [data.qij, filters]);
  const journal = useMemo(() => filterProjects(buildJournal(data.qij), filters), [data.qij, filters]);

  const kpis = useMemo(() => {
    const hsrByMonth = countBy(data.hsr, (r) => monthKey(r.date));
    const resolved = data.hsr.filter((r) => r.status === 'Resolved').length;
    const hh = hhTotals(data.hh);
    const hhSpark = months.map((m) => hhTotals(data.hh.filter((r) => monthKey(r.date) === m)).compliance ?? 0);
    const fivesLatest = latestBy(data.fives, (r) => `${r.facility}|${r.department}`).map(scoreFiveS);
    const basicLatest = latestBy(data.ipcBasic, (r) => r.facility).map(scoreBasicIpc);
    const mohLatest = latestBy(data.ipcMoh, (r) => r.facility).map(scoreMohIpc);
    const hfqLatest = latestBy(data.hfqap, (r) => r.facility).map(scoreHfqap);
    const green = basicLatest.filter((b) => b.overall === 'Green').length;
    return {
      hsr: { n: data.hsr.length, resolvedPct: data.hsr.length ? (resolved / data.hsr.length) * 100 : null, spark: months.map((m) => hsrByMonth.get(m) || 0) },
      hh: { compliance: hh.compliance, opp: hh.opp, spark: hhSpark },
      fives: { mean: mean(fivesLatest.map((s) => s.pct)), n: fivesLatest.length },
      basic: { green, n: basicLatest.length, mean: mean(basicLatest.map((b) => b.pct ?? 0)) },
      moh: { mean: mean(mohLatest.map((m) => m.pct ?? 0)), n: mohLatest.length },
      hfq: { mean: mean(hfqLatest.map((h) => h.pct ?? 0)), n: hfqLatest.length, stars: mean(hfqLatest.map((h) => h.star ?? 0)) }
    };
  }, [data, months]);

  const heat = useMemo(() => {
    const cells: [number, number, number][] = [];
    let max = 1;
    TOOLS.forEach((t, ti) => {
      const counts = countBy((t.key === 'qij' ? qijEntries : data[t.key]) as { date?: string | null }[], (r) => monthKey(r.date));
      months.forEach((m, mi) => {
        const v = counts.get(m) || 0;
        max = Math.max(max, v);
        cells.push([mi, ti, v]);
      });
    });
    return {
      option: {
        tooltip: tooltip({ formatter: (p: { value: [number, number, number] }) => `<b>${TOOLS[p.value[1]].label}</b><br/>${shortMonth(months[p.value[0]])}: ${p.value[2]} submission${p.value[2] === 1 ? '' : 's'}` }),
        grid: grid({ top: 8, bottom: 56, left: 8 }),
        xAxis: categoryAxis(months.map(shortMonth), { splitArea: { show: false } }),
        yAxis: categoryAxis(TOOLS.map((t) => t.label), { inverse: true }),
        visualMap: heatVisualMap(0, max, { text: [`${max} submissions`, '0'] }),
        series: [{
          type: 'heatmap', data: cells.map(([x, y, v]) => heatCell(x, y, v, 0, max)), label: { show: months.length <= 14, fontFamily: FONT, fontSize: 10, formatter: (p: { value: number[] }) => (p.value[2] ? String(p.value[2]) : '') },
          itemStyle: { borderColor: palette.card, borderWidth: 2, borderRadius: 0 },
          emphasis: { itemStyle: { borderColor: palette.ag900, borderWidth: 2 } }
        }]
      },
      table: { columns: ['Tool', ...months.map(shortMonth)], rows: TOOLS.map((t, ti) => [t.label, ...months.map((_, mi) => cells[ti * months.length + mi][2])]) }
    };
  }, [data, months, qijEntries]);

  const matrix = useMemo(() => {
    const facilities = Array.from(new Set([...data.ipcBasic, ...data.ipcMoh, ...data.hfqap].map((r) => r.facility).filter(Boolean) as string[])).sort();
    const cols = ['Basic IPC core score', 'IPC tool (MoH 2024)', 'HFQAP overall'];
    const basic = new Map(latestBy(data.ipcBasic, (r) => r.facility).map((r) => [r.facility, scoreBasicIpc(r).pct]));
    const moh = new Map(latestBy(data.ipcMoh, (r) => r.facility).map((r) => [r.facility, scoreMohIpc(r).pct]));
    const hfq = new Map(latestBy(data.hfqap, (r) => r.facility).map((r) => [r.facility, scoreHfqap(r).pct]));
    const cells: [number, number, number | '-'][] = [];
    facilities.forEach((f, fi) => {
      [basic, moh, hfq].forEach((m, ci) => {
        const v = m.get(f);
        cells.push([ci, fi, v === null || v === undefined ? '-' : Math.round(v)]);
      });
    });
    return {
      facilities,
      option: {
        tooltip: tooltip({ formatter: (p: { value: [number, number, number | string] }) => `<b>${facilities[p.value[1]]}</b><br/>${cols[p.value[0]]}: ${p.value[2] === '-' ? 'not assessed' : p.value[2] + '%'}` }),
        grid: grid({ top: 8, bottom: 56 }),
        xAxis: categoryAxis(cols, { position: 'top', axisLabel: { color: palette.inkMuted, fontFamily: FONT, fontSize: 11, interval: 0 } }),
        yAxis: categoryAxis(facilities, { inverse: true, axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 190, overflow: 'truncate' } }),
        visualMap: heatVisualMap(0, 100, { text: ['100%', '0%'] }),
        series: [{
          type: 'heatmap', data: cells.map(([x, y, v]) => heatCell(x, y, v, 0, 100)),
          label: { show: true, fontFamily: FONT, fontSize: 11, fontWeight: 700, formatter: (p: { value: (number | string)[] }) => (p.value[2] === '-' ? '' : `${p.value[2]}%`) },
          itemStyle: { borderColor: palette.card, borderWidth: 3, borderRadius: 0 },
          emphasis: { itemStyle: { borderColor: palette.ag900, borderWidth: 2 } }
        }]
      },
      table: { columns: ['Facility', ...cols], rows: facilities.map((f, fi) => [f, ...[0, 1, 2].map((ci) => { const v = cells[fi * 3 + ci][2]; return v === '-' ? null : v; })]) }
    };
  }, [data]);

  const gaps = useMemo(() => {
    const out: { tool: string; area: string; value: string; tab: Parameters<TabProps['go']>[0] }[] = [];
    const hfq = latestBy(data.hfqap, (r) => r.facility).map(scoreHfqap);
    if (hfq.length) {
      const mods = HFQAP_MODULES.map((m) => ({ name: m.name, v: mean(hfq.map((h) => h.modules.find((x) => x.id === m.id)!.pct)) ?? 0 })).sort((a, b) => a.v - b.v);
      out.push({ tool: 'HFQAP', area: mods[0].name, value: fmtPct(mods[0].v), tab: 'hfqap' });
    }
    const basic = latestBy(data.ipcBasic, (r) => r.facility).map(scoreBasicIpc);
    if (basic.length) {
      const doms = BASIC_IPC_DOMAINS.filter((d) => d.core).map((d) => ({ name: d.name, red: basic.filter((b) => b.domains.find((x) => x.code === d.code)?.rag === 'Red').length })).sort((a, b) => b.red - a.red);
      out.push({ tool: 'Basic IPC', area: doms[0].name, value: `${doms[0].red} of ${basic.length} facilities Red`, tab: 'ipc' });
    }
    const moments = hhMoments(data.hh).filter((m) => m.ratio !== null).sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0));
    if (moments.length) out.push({ tool: 'Hand hygiene', area: HH_MOMENTS[moments[0].moment - 1].name, value: fmtPct(moments[0].ratio), tab: 'hand' });
    const fives = latestBy(data.fives, (r) => `${r.facility}|${r.department}`).map(scoreFiveS);
    if (fives.length) {
      const doms = FIVE_S_DOMAINS.map((d) => ({ name: d.name, v: mean(fives.map((f) => f.domains.find((x) => x.code === d.code)!.pct)) ?? 0 })).sort((a, b) => a.v - b.v);
      out.push({ tool: '5S', area: doms[0].name, value: fmtPct(doms[0].v), tab: 'fives' });
    }
    const cats = Array.from(countBy(data.hsr, (r) => r.category).entries()).sort((a, b) => b[1] - a[1]);
    if (cats.length) out.push({ tool: 'Patient safety', area: `Most reported: ${cats[0][0]}`, value: `${cats[0][1]} reports`, tab: 'safety' });
    return out;
  }, [data]);

  return (
    <div className="tab">
      <SectionTitle title="Regional quality at a glance" text="Headline results across all CQI tools for the selected period. Select any tile, cell or bar to explore the detail." />
      <div className="kpis">
        <button type="button" className="kpi-btn" onClick={() => go('safety')}><Kpi label="Patient safety reports" value={fmtInt(kpis.hsr.n)} sub={`${fmtPct(kpis.hsr.resolvedPct)} resolved`} spark={kpis.hsr.spark} /></button>
        <button type="button" className="kpi-btn" onClick={() => go('hand')}><Kpi label="Hand hygiene compliance" value={fmtPct(kpis.hh.compliance)} sub={`${fmtInt(kpis.hh.opp)} opportunities observed`} spark={kpis.hh.spark} /></button>
        <button type="button" className="kpi-btn" onClick={() => go('fives')}><Kpi label="5S average score" value={fmtPct(kpis.fives.mean)} sub={`${kpis.fives.n} departments, latest assessment`} /></button>
        <button type="button" className="kpi-btn" onClick={() => go('ipc')}><Kpi label="Basic IPC rated Green" value={`${kpis.basic.green} of ${kpis.basic.n}`} sub={`Average core score ${fmtPct(kpis.basic.mean)}`} /></button>
        <button type="button" className="kpi-btn" onClick={() => go('ipc')}><Kpi label="IPC tool average (MoH 2024)" value={fmtPct(kpis.moh.mean)} sub={`${kpis.moh.n} facilities, latest assessment`} /></button>
        <button type="button" className="kpi-btn" onClick={() => go('hfqap')}><Kpi label="HFQAP average score" value={fmtPct(kpis.hfq.mean)} sub={kpis.hfq.n ? `Mean star rating ${kpis.hfq.stars?.toFixed(1)} of 5` : 'No assessments'} /></button>
        <button type="button" className="kpi-btn" onClick={() => go('journal')}><Kpi label="QI projects" value={String(journal.length)} sub={`${journal.filter((p) => p.status === 'Active').length} active, ${journal.reduce((n, p) => n + p.changes.length, 0)} changes tested`} /></button>
      </div>
      <div className="grid">
        <ChartCard span={2} title="Data submissions by tool and month" subtitle="Darker cells show more submissions. Select a row to open that tool." option={heat.option} height={300} table={heat.table}
          empty={!months.length} onClick={(p) => { const t = TOOLS[(p.value as number[])[1]]; if (t) go(t.tab); }} />
        <section className="card span-1" aria-label="Priority gaps">
          <header className="card-head"><div><h3>Priority gaps</h3><p className="card-sub">The weakest area in each tool for the selected period.</p></div></header>
          {gaps.length ? (
            <ul className="gap-list">
              {gaps.map((g) => (
                <li key={g.tool}>
                  <button type="button" onClick={() => go(g.tab)}>
                    <span className="gap-tool">{g.tool}</span>
                    <span className="gap-area">{g.area}</span>
                    <span className="gap-value">{g.value}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="card-sub pad">No data for the selected filters.</p>}
        </section>
        <ChartCard span={3} title="Facility quality matrix" subtitle="Latest score per facility in each facility-level tool. Select a facility to open its HFQAP profile." option={matrix.option}
          height={Math.max(220, 64 + matrix.facilities.length * 36)} table={matrix.table} empty={!matrix.facilities.length}
          onClick={(p) => { const f = matrix.facilities[(p.value as number[])[1]]; if (f) go('hfqap', f); }} />
      </div>
    </div>
  );
}
