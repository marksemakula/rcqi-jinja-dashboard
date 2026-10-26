'use client';

import { useMemo, useState } from 'react';
import { ChartCard, Chips, DataTable, Kpi, SectionTitle, type TableData } from '../ui';
import type { TabProps } from './shared';
import { HSR_OUTCOMES, HSR_STATUSES, HSR_TIMEFRAMES } from '@/lib/catalogue';
import { axisTooltip, barSeries, categoryAxis, dataZoom, FONT, grid, hBarSeries, heatCell, heatVisualMap, legend, selColour, tooltip, valueAxis, type Opt } from '@/lib/chart';
import { countBy, daysBetween, fmtDate, fmtInt, fmtPct, median, monthKey, monthRange, shortMonth } from '@/lib/format';
import { ordinal5, palette } from '@/lib/palette';
import type { HsrRec } from '@/lib/types';

type Dim = 'category' | 'location' | 'timeframe' | 'department' | 'eventType' | 'outcome' | 'status' | 'cadre' | 'harmed';
const DIM_LABEL: Record<Dim, string> = {
  category: 'Category', location: 'Location', timeframe: 'Timeframe', department: 'Department', eventType: 'Event type',
  outcome: 'Outcome', status: 'QI status', cadre: 'Reporter cadre', harmed: 'Who was harmed'
};
const OUTCOME_SHORT: Record<string, string> = {
  [HSR_OUTCOMES[0]]: 'Near miss', [HSR_OUTCOMES[1]]: 'Adverse event, no harm', [HSR_OUTCOMES[2]]: 'Adverse event, harm'
};
const statusOf = (r: HsrRec) => r.status || 'Pending review';

function valueOf(r: HsrRec, d: Dim): string[] {
  if (d === 'harmed') return r.harmed || [];
  if (d === 'status') return [statusOf(r)];
  const v = (r as unknown as Record<string, unknown>)[d];
  return v ? [String(v)] : [];
}

function hbar(rows: HsrRec[], dim: Dim, sel: string | null, limit = 14, order?: string[]) {
  const counts = new Map<string, number>();
  rows.forEach((r) => valueOf(r, dim).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1)));
  let entries = Array.from(counts.entries());
  entries = order ? order.filter((o) => counts.has(o)).map((o) => [o, counts.get(o)!] as [string, number]) : entries.sort((a, b) => b[1] - a[1]).slice(0, limit);
  const names = entries.map((e) => e[0]).reverse();
  const values = entries.map((e) => e[1]).reverse();
  const total = rows.length || 1;
  const option: Opt = {
    tooltip: tooltip({ formatter: (p: { name: string; value: number }) => `<b>${p.name}</b><br/>${p.value} report${p.value === 1 ? '' : 's'} (${((p.value / total) * 100).toFixed(0)}%)` }),
    grid: grid({ right: 40 }),
    xAxis: valueAxis({ minInterval: 1, splitNumber: 4 }),
    yAxis: categoryAxis(names, { axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 170, overflow: 'truncate' } }),
    series: [hBarSeries({
      data: names.map((n, i) => ({ value: values[i], itemStyle: { color: selColour(sel, n) } })),
      label: { show: true, position: 'right', color: palette.inkSoft, fontFamily: FONT, fontSize: 11 }
    })]
  };
  const table: TableData = { columns: [DIM_LABEL[dim], 'Reports', 'Share (%)'], rows: entries.map(([n, v]) => [n, v, Math.round((v / total) * 1000) / 10]) };
  return { option, table, height: Math.max(180, 40 + names.length * 26) };
}

export default function Safety({ data, forms }: TabProps) {
  const [sel, setSel] = useState<Partial<Record<Dim, string>>>({});
  const toggle = (d: Dim, v: string) => setSel((s) => ({ ...s, [d]: s[d] === v ? undefined : v }));
  const rowsExcept = (except?: Dim) => data.hsr.filter((r) => (Object.entries(sel) as [Dim, string | undefined][]).every(([d, v]) => !v || d === except || valueOf(r, d).includes(v)));
  const rows = useMemo(() => rowsExcept(), [data.hsr, sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date().toISOString().slice(0, 10);
  const kpi = useMemo(() => {
    const near = rows.filter((r) => r.outcome === HSR_OUTCOMES[0]).length;
    const harm = rows.filter((r) => r.outcome === HSR_OUTCOMES[2]).length;
    const open = rows.filter((r) => statusOf(r) !== 'Resolved').length;
    const days = rows.filter((r) => r.status === 'Resolved' && r.closed && r.date).map((r) => daysBetween(r.date!, r.closed!)).filter((d) => d >= 0);
    return { n: rows.length, near: rows.length ? (near / rows.length) * 100 : null, harm, open, days: median(days) };
  }, [rows]);

  const trend = useMemo(() => {
    const src = rowsExcept('outcome');
    const keys = src.map((r) => monthKey(r.date)).filter(Boolean).sort();
    const months = keys.length ? monthRange(keys[0], keys[keys.length - 1]) : [];
    const series = HSR_OUTCOMES.map((o, i) => {
      const c = countBy(src.filter((r) => r.outcome === o), (r) => monthKey(r.date));
      return barSeries({
        name: OUTCOME_SHORT[o], stack: 'outcome', data: months.map((m) => c.get(m) || 0),
        itemStyle: { color: sel.outcome && sel.outcome !== o ? palette.ag100 : [ordinal5[0], ordinal5[2], ordinal5[4]][i], borderRadius: i === 2 ? [4, 4, 0, 0] : 0, borderColor: palette.card, borderWidth: 1 }
      });
    });
    return {
      option: {
        tooltip: axisTooltip({ axisPointer: { type: 'shadow' } }),
        legend: legend(),
        grid: grid({ top: 32, bottom: 40 }),
        xAxis: categoryAxis(months.map(shortMonth)),
        yAxis: valueAxis({ minInterval: 1 }),
        dataZoom: months.length > 12 ? dataZoom(30) : undefined,
        series
      },
      table: { columns: ['Month', ...HSR_OUTCOMES.map((o) => OUTCOME_SHORT[o]), 'Total'], rows: months.map((m, mi) => [shortMonth(m), ...series.map((s) => (s.data as number[])[mi]), series.reduce((a, s) => a + (s.data as number[])[mi], 0)]) },
      empty: !months.length
    };
  }, [data.hsr, sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const heat = useMemo(() => {
    const src = rowsExcept('location').filter((r) => !sel.timeframe || r.timeframe === sel.timeframe);
    const locs = Array.from(countBy(src, (r) => r.location).entries()).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    const cells: [number, number, number][] = [];
    let max = 1;
    HSR_TIMEFRAMES.forEach((t, ti) => locs.forEach((l, li) => {
      const v = src.filter((r) => r.timeframe === t && r.location === l).length;
      max = Math.max(max, v);
      cells.push([ti, li, v]);
    }));
    return {
      locs,
      option: {
        tooltip: tooltip({ formatter: (p: { value: number[] }) => `<b>${locs[p.value[1]]}</b>, ${HSR_TIMEFRAMES[p.value[0]]}<br/>${p.value[2]} report${p.value[2] === 1 ? '' : 's'}` }),
        grid: grid({ top: 28, bottom: 56 }),
        xAxis: categoryAxis(HSR_TIMEFRAMES, { position: 'top' }),
        yAxis: categoryAxis(locs, { inverse: true }),
        visualMap: heatVisualMap(0, max, { text: [`${max}`, '0'] }),
        series: [{
          type: 'heatmap', data: cells.map(([x, y, v]) => heatCell(x, y, v, 0, max)),
          label: { show: true, fontFamily: FONT, fontSize: 11, formatter: (p: { value: number[] }) => (p.value[2] ? String(p.value[2]) : '') },
          itemStyle: { borderColor: palette.card, borderWidth: 2, borderRadius: 4 }
        }]
      },
      table: { columns: ['Location', ...HSR_TIMEFRAMES], rows: locs.map((l, li) => [l, ...HSR_TIMEFRAMES.map((_, ti) => cells[ti * locs.length + li][2])]) }
    };
  }, [data.hsr, sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const ageing = useMemo(() => {
    const bands = ['Up to 30 days', '31 to 60 days', '61 to 90 days', 'Over 90 days'];
    const open = rows.filter((r) => statusOf(r) !== 'Resolved' && r.date);
    const counts = bands.map(() => 0);
    open.forEach((r) => {
      const d = daysBetween(r.date!, today);
      counts[d <= 30 ? 0 : d <= 60 ? 1 : d <= 90 ? 2 : 3] += 1;
    });
    return {
      option: {
        tooltip: tooltip({ formatter: (p: { name: string; value: number }) => `<b>${p.name}</b><br/>${p.value} open report${p.value === 1 ? '' : 's'}` }),
        grid: grid(),
        xAxis: categoryAxis(bands, { axisLabel: { color: palette.inkMuted, fontFamily: FONT, fontSize: 10.5, interval: 0 } }),
        yAxis: valueAxis({ minInterval: 1 }),
        series: [barSeries({ data: counts.map((v, i) => ({ value: v, itemStyle: { color: ordinal5[i + 1], borderRadius: [4, 4, 0, 0] } })), label: { show: true, position: 'top', color: palette.inkSoft, fontFamily: FONT } })]
      },
      table: { columns: ['Age of open report', 'Reports'], rows: bands.map((b, i) => [b, counts[i]]) }
    };
  }, [rows, today]);

  const register: TableData = useMemo(() => ({
    columns: ['Reference', 'Date', 'Department', 'Category', 'Outcome', 'QI status', 'Days open'],
    rows: rows.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((r) => [
      r.ref || r.id, fmtDate(r.date), r.department, r.category, OUTCOME_SHORT[r.outcome || ''] || r.outcome, statusOf(r),
      statusOf(r) === 'Resolved' ? null : r.date ? daysBetween(r.date, today) : null
    ])
  }), [rows, today]);

  const chips = (Object.entries(sel) as [Dim, string | undefined][]).filter(([, v]) => v).map(([d, v]) => ({ key: d, label: `${DIM_LABEL[d]}: ${OUTCOME_SHORT[v!] || v}`, onRemove: () => toggle(d, v!) }));
  const cat = hbar(rowsExcept('category'), 'category', sel.category || null);
  const dept = hbar(rowsExcept('department'), 'department', sel.department || null, 12);
  const type = hbar(rowsExcept('eventType'), 'eventType', sel.eventType || null);
  const cadre = hbar(rowsExcept('cadre'), 'cadre', sel.cadre || null);
  const harmed = hbar(rowsExcept('harmed'), 'harmed', sel.harmed || null);
  const status = hbar(rowsExcept('status'), 'status', sel.status || null, 10, HSR_STATUSES);
  const empty = !data.hsr.length;
  const emptyText = `No patient safety reports in this period. Reports are submitted through the HSR form${forms.hsr?.shortUrl ? ` (${forms.hsr.shortUrl})` : ''}.`;

  return (
    <div className="tab">
      <SectionTitle title="Patient safety reporting" text="Near misses and adverse events reported through the Health Facility Patient Safety Report (HSR). Select any bar or cell to filter every chart on this page; select it again to clear." />
      <Chips chips={chips} onClear={() => setSel({})} />
      <div className="kpis">
        <Kpi label="Reports" value={fmtInt(kpi.n)} sub="In the selected period" />
        <Kpi label="Near misses" value={fmtPct(kpi.near)} sub="Share that did not reach the person" />
        <Kpi label="Adverse events with harm" value={fmtInt(kpi.harm)} tone={kpi.harm ? 'warn' : 'good'} toneLabel={kpi.harm ? 'Review each case' : 'None reported'} />
        <Kpi label="Open reports" value={fmtInt(kpi.open)} sub="Not yet resolved by the QI Committee" />
        <Kpi label="Median days to resolve" value={kpi.days === null ? 'No data' : `${Math.round(kpi.days)} days`} sub="From occurrence to closure" />
      </div>
      <div className="grid">
        <ChartCard span={2} title="Reports by month and outcome" subtitle="Lighter to darker: near miss, adverse event without harm, adverse event with harm. Select a segment to filter by outcome." option={trend.option} table={trend.table} empty={empty || trend.empty} emptyText={emptyText} height={320}
          onClick={(p) => toggle('outcome', HSR_OUTCOMES.find((o) => OUTCOME_SHORT[o] === p.seriesName) || '')} />
        <ChartCard title="QI review status" subtitle="Follow-up status recorded by the QI Committee in the master sheet." option={status.option} table={status.table} empty={empty} emptyText={emptyText} height={status.height}
          onClick={(p) => toggle('status', p.name)} />
        <ChartCard title="Event category" subtitle="What the event related to." option={cat.option} table={cat.table} empty={empty} emptyText={emptyText} height={cat.height} onClick={(p) => toggle('category', p.name)} />
        <ChartCard title="Where and when" subtitle="Location by timeframe of occurrence." option={heat.option} table={heat.table} empty={empty} emptyText={emptyText} height={Math.max(260, 90 + heat.locs.length * 26)}
          onClick={(p) => { const v = p.value as number[]; toggle('location', heat.locs[v[1]]); }} />
        <ChartCard title="Reporting department" subtitle="Top departments by number of reports." option={dept.option} table={dept.table} empty={empty} emptyText={emptyText} height={dept.height} onClick={(p) => toggle('department', p.name)} />
        <ChartCard title="Type of event" subtitle="Unsafe acts, conditions and equipment." option={type.option} table={type.table} empty={empty} emptyText={emptyText} height={type.height} onClick={(p) => toggle('eventType', p.name)} />
        <ChartCard title="Reporter cadre" subtitle="Who is reporting: a marker of safety culture." option={cadre.option} table={cadre.table} empty={empty} emptyText={emptyText} height={cadre.height} onClick={(p) => toggle('cadre', p.name)} />
        <ChartCard title="Who was harmed or at risk" subtitle="A report can involve more than one group." option={harmed.option} table={harmed.table} empty={empty} emptyText={emptyText} height={harmed.height} onClick={(p) => toggle('harmed', p.name)} />
        <ChartCard title="Open reports by age" subtitle="Time since occurrence for reports not yet resolved." option={ageing.option} table={ageing.table} empty={empty} emptyText={emptyText} height={240} />
        <section className="card span-2" aria-label="Report register">
          <header className="card-head"><div><h3>Report register</h3><p className="card-sub">Structured fields only. Descriptions, causes and countermeasures remain in the master sheet for the QI Committee.</p></div></header>
          {register.rows.length ? <DataTable table={register} maxRows={25} /> : <p className="card-sub pad">{emptyText}</p>}
        </section>
      </div>
    </div>
  );
}
