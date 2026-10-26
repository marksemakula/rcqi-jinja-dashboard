'use client';

import { useMemo, useState } from 'react';
import { ChartCard, Kpi, SectionTitle, Select } from '../ui';
import type { TabProps } from './shared';
import { FIVE_S_DOMAINS, FIVE_S_ITEMS } from '@/lib/catalogue';
import { axisTooltip, categoryAxis, FONT, grid, hBarSeries, heatCell, heatVisualMap, legend, lineSeries, pctAxis, tooltip, type Opt } from '@/lib/chart';
import { fmtDate, fmtPct, latestBy, mean, quarterKey } from '@/lib/format';
import { context, pair, palette } from '@/lib/palette';
import { scoreFiveS } from '@/lib/scoring';

const unitOf = (r: { facility?: string | null; department?: string | null }) => r.department || 'Not stated';

export default function FiveS({ data, forms }: TabProps) {
  const [unit, setUnit] = useState('All');
  const latest = useMemo(() => latestBy(data.fives, (r) => `${r.facility}|${unitOf(r)}`).map((r) => ({ rec: r, s: scoreFiveS(r) })), [data.fives]);
  const units = useMemo(() => Array.from(new Set(latest.map((l) => unitOf(l.rec)))).sort(), [latest]);
  const sel = latest.find((l) => unitOf(l.rec) === unit) || null;
  const avgDomains = FIVE_S_DOMAINS.map((d) => mean(latest.map((l) => l.s.domains.find((x) => x.code === d.code)!.pct)));
  const empty = !latest.length;
  const emptyText = `No 5S assessments in this period${forms.fives?.shortUrl ? `. Submit at ${forms.fives.shortUrl}` : ''}.`;

  const ranking = useMemo(() => {
    const sorted = latest.slice().sort((a, b) => a.s.pct - b.s.pct);
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { dataIndex: number }) => { const l = sorted[p.dataIndex]; return `<b>${unitOf(l.rec)}</b><br/>${l.s.total} of ${l.s.max} marks (${fmtPct(l.s.pct)})<br/>Assessed ${fmtDate(l.rec.date)}`; } }),
      grid: grid({ right: 48 }),
      xAxis: pctAxis(),
      yAxis: categoryAxis(sorted.map((l) => unitOf(l.rec)), { axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 160, overflow: 'truncate' } }),
      series: [hBarSeries({ data: sorted.map((l) => ({ value: Math.round(l.s.pct), itemStyle: { color: unit === 'All' || unit === unitOf(l.rec) ? palette.ag600 : context } })), label: { show: true, position: 'right', formatter: '{c}%', color: palette.inkSoft, fontFamily: FONT, fontSize: 11 } })]
    };
    return { option, sorted, height: Math.max(260, 50 + sorted.length * 28), table: { columns: ['Department or unit', 'Date', 'Marks (of 54)', 'Score (%)', ...FIVE_S_DOMAINS.map((d) => `${d.name} (%)`)], rows: latest.map((l) => [unitOf(l.rec), fmtDate(l.rec.date), l.s.total, Math.round(l.s.pct), ...l.s.domains.map((d) => Math.round(d.pct))]) } };
  }, [latest, unit]);

  const radar = useMemo(() => {
    const option: Opt = {
      tooltip: tooltip(),
      legend: legend({ top: 'auto', bottom: 0, left: 'center', right: 'auto' }),
      radar: {
        radius: '60%', center: ['50%', '47%'], indicator: FIVE_S_DOMAINS.map((d) => ({ name: d.name, max: 100 })),
        axisName: { color: palette.inkSoft, fontFamily: FONT, fontSize: 12 }, splitLine: { lineStyle: { color: palette.grid } },
        splitArea: { areaStyle: { color: [palette.card, palette.ag50] } }, axisLine: { lineStyle: { color: palette.border } }
      },
      series: [{
        type: 'radar',
        data: [
          { name: 'Hospital average', value: avgDomains.map((v) => Math.round(v ?? 0)), lineStyle: { color: pair[1], width: 2, type: 'dashed' }, itemStyle: { color: pair[1] }, areaStyle: { color: 'rgba(194,165,90,0.12)' } },
          ...(sel ? [{ name: unitOf(sel.rec), value: sel.s.domains.map((d) => Math.round(d.pct)), lineStyle: { color: pair[0], width: 2 }, itemStyle: { color: pair[0] }, areaStyle: { color: 'rgba(63,90,30,0.18)' } }] : [])
        ]
      }]
    };
    return { option, table: { columns: ['Domain', 'Average (%)', ...(sel ? [`${unitOf(sel.rec)} (%)`] : [])], rows: FIVE_S_DOMAINS.map((d, i) => [d.name, avgDomains[i] === null ? null : Math.round(avgDomains[i]!), ...(sel ? [Math.round(sel.s.domains[i].pct)] : [])]) } };
  }, [avgDomains, sel]);

  const heat = useMemo(() => {
    const sorted = latest.slice().sort((a, b) => b.s.pct - a.s.pct);
    const cells = sorted.flatMap((l, ui) => l.s.domains.map((d, di) => heatCell(di, ui, Math.round(d.pct), 0, 100)));
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { value: number[] }) => { const l = sorted[p.value[1]]; const d = l.s.domains[p.value[0]]; return `<b>${unitOf(l.rec)}</b><br/>${d.name}: ${d.score} of ${d.max} (${d.pct.toFixed(0)}%)`; } }),
      grid: grid({ top: 28, bottom: 56 }),
      xAxis: categoryAxis(FIVE_S_DOMAINS.map((d) => d.name), { position: 'top' }),
      yAxis: categoryAxis(sorted.map((l) => unitOf(l.rec)), { inverse: true, axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 150, overflow: 'truncate' } }),
      visualMap: heatVisualMap(0, 100, { text: ['100%', '0%'] }),
      series: [{ type: 'heatmap', data: cells, label: { show: true, formatter: (p: { value: number[] }) => `${p.value[2]}%`, fontFamily: FONT, fontSize: 11, fontWeight: 700 }, itemStyle: { borderColor: palette.card, borderWidth: 3, borderRadius: 6 }, emphasis: { itemStyle: { borderColor: palette.ag900, borderWidth: 2 } } }]
    };
    return { option, sorted };
  }, [latest]);

  const trend = useMemo(() => {
    const quarters = Array.from(new Set(data.fives.map((r) => quarterKey(r.date)))).filter(Boolean).sort();
    const avg = quarters.map((q) => mean(data.fives.filter((r) => quarterKey(r.date) === q).map((r) => scoreFiveS(r).pct)));
    const mine = quarters.map((q) => { const rs = data.fives.filter((r) => quarterKey(r.date) === q && unitOf(r) === unit); return rs.length ? mean(rs.map((r) => scoreFiveS(r).pct)) : null; });
    const option: Opt = {
      tooltip: axisTooltip({ valueFormatter: (v: number) => fmtPct(v) }),
      legend: legend(),
      grid: grid({ top: 32 }),
      xAxis: categoryAxis(quarters),
      yAxis: pctAxis(),
      series: [
        lineSeries({ name: 'Hospital average', data: avg.map((v) => (v === null ? null : Math.round(v))), lineStyle: { width: 2, color: pair[1], type: 'dashed' }, itemStyle: { color: pair[1], borderColor: palette.card, borderWidth: 2 } }),
        ...(unit !== 'All' ? [lineSeries({ name: unit, data: mine.map((v) => (v === null ? null : Math.round(v))), connectNulls: true, lineStyle: { width: 2.5, color: pair[0] }, itemStyle: { color: pair[0], borderColor: palette.card, borderWidth: 2 } })] : [])
      ]
    };
    return { option, table: { columns: ['Quarter', 'Hospital average (%)', ...(unit !== 'All' ? [`${unit} (%)`] : [])], rows: quarters.map((q, i) => [q, avg[i] === null ? null : Math.round(avg[i]!), ...(unit !== 'All' ? [mine[i] === null ? null : Math.round(mine[i]!)] : [])]) } };
  }, [data.fives, unit]);

  const items = useMemo(() => {
    const codes = Object.keys(FIVE_S_ITEMS);
    const vals = codes.map((c) => ({ c, v: mean(latest.map((l) => Number(l.rec.items[c] ?? 0) / 3 * 100)) ?? 0 })).sort((a, b) => a.v - b.v).slice(0, 8);
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { dataIndex: number }) => `<b>${vals[p.dataIndex].c}. ${FIVE_S_ITEMS[vals[p.dataIndex].c]}</b><br/>Average ${vals[p.dataIndex].v.toFixed(0)}% of the maximum` }),
      grid: grid({ right: 48 }),
      xAxis: pctAxis(),
      yAxis: categoryAxis(vals.map((x) => FIVE_S_ITEMS[x.c]).reverse(), { axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 200, overflow: 'truncate' } }),
      series: [hBarSeries({ data: vals.map((x) => Math.round(x.v)).reverse(), itemStyle: { color: palette.ag500, borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', formatter: '{c}%', color: palette.inkSoft, fontFamily: FONT, fontSize: 11 } })]
    };
    return { option, table: { columns: ['Item', 'Description', 'Average (% of maximum)'], rows: vals.map((x) => [x.c, FIVE_S_ITEMS[x.c], Math.round(x.v)]) } };
  }, [latest]);

  const best = latest.slice().sort((a, b) => b.s.pct - a.s.pct)[0];
  const weakest = FIVE_S_DOMAINS.map((d, i) => ({ d, v: avgDomains[i] ?? 0 })).sort((a, b) => a.v - b.v)[0];

  return (
    <div className="tab">
      <SectionTitle title="5S-CQI-TQM" text="Sort, Set, Shine and Standardise, with leadership for continuous quality improvement. Scores are out of 54; each chart uses the latest assessment of each department or unit." />
      <div className="toolbar"><Select label="Focus department" value={unit} options={units} onChange={setUnit} allLabel="All departments" /></div>
      <div className="kpis">
        <Kpi label="Departments assessed" value={String(latest.length)} sub="Latest assessment each" />
        <Kpi label="Average 5S score" value={fmtPct(mean(latest.map((l) => l.s.pct)))} sub="Grand total out of 54" />
        <Kpi label="Highest scoring unit" value={best ? fmtPct(best.s.pct) : 'No data'} sub={best ? unitOf(best.rec) : undefined} />
        <Kpi label="Weakest domain" value={empty ? 'No data' : weakest.d.name} sub={empty ? undefined : `Average ${fmtPct(weakest.v)}`} />
      </div>
      <div className="grid">
        <ChartCard span={2} title="5S score by department" subtitle="Select a department to focus the profile and trend." option={ranking.option} table={ranking.table} height={ranking.height} empty={empty} emptyText={emptyText}
          onClick={(p) => { const l = ranking.sorted[p.dataIndex as number]; if (l) setUnit(unit === unitOf(l.rec) ? 'All' : unitOf(l.rec)); }} />
        <ChartCard title="Domain profile" subtitle={sel ? `${unitOf(sel.rec)} against the hospital average.` : 'Hospital average. Select a department to compare.'} option={radar.option} table={radar.table} height={Math.max(360, ranking.height)} empty={empty} emptyText={emptyText} />
        <ChartCard span={2} title="Department by domain" subtitle="Percentage of the domain maximum. Select a cell to focus that department." option={heat.option} height={Math.max(260, 110 + heat.sorted.length * 30)} empty={empty} emptyText={emptyText}
          onClick={(p) => { const l = heat.sorted[(p.value as number[])[1]]; if (l) setUnit(unitOf(l.rec)); }} />
        <ChartCard title="Lowest scoring items" subtitle="Average across departments, as a share of the 3 mark maximum." option={items.option} table={items.table} height={Math.max(300, 110 + heat.sorted.length * 30)} empty={empty} emptyText={emptyText} />
        <ChartCard span={3} title="5S score by quarter" subtitle={unit === 'All' ? 'Hospital average. Choose a department to add its trend.' : `${unit} against the hospital average.`} option={trend.option} table={trend.table} height={280} empty={empty} emptyText={emptyText} />
      </div>
    </div>
  );
}
