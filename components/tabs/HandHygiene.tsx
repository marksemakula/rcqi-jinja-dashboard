'use client';

import { useMemo, useState } from 'react';
import { ChartCard, Kpi, SectionTitle, Segmented, StatusTag } from '../ui';
import type { TabProps } from './shared';
import { HH_MOMENTS } from '@/lib/catalogue';
import { axisTooltip, barSeries, categoryAxis, dataZoom, FONT, grid, hBarSeries, legend, lineSeries, pctAxis, targetLine, tooltip, valueAxis, type Opt } from '@/lib/chart';
import { fmtInt, fmtPct, monthKey, monthRange, shortMonth } from '@/lib/format';
import { pair, palette } from '@/lib/palette';
import { cadreGroup, hhMoments, hhTotals } from '@/lib/scoring';
import type { HhRec } from '@/lib/types';

type Group = 'cadre' | 'profCat' | 'ward' | 'deptType' | 'period';
const GROUPS: { id: Group; label: string }[] = [
  { id: 'cadre', label: 'WHO cadre' },
  { id: 'profCat', label: 'Professional category' },
  { id: 'ward', label: 'Ward or unit' },
  { id: 'deptType', label: 'Department type' },
  { id: 'period', label: 'Period' }
];

const groupKey = (r: HhRec, g: Group) => (g === 'cadre' ? cadreGroup(r.profCat) : ((r as unknown as Record<string, unknown>)[g] as string) || 'Not stated');

export default function HandHygiene({ data, forms }: TabProps) {
  const [target, setTarget] = useState(80);
  const [group, setGroup] = useState<Group>('cadre');
  const rows = data.hh;
  const t = useMemo(() => hhTotals(rows), [rows]);
  const empty = !rows.length;
  const emptyText = `No hand hygiene observation sessions in this period${forms.hh?.shortUrl ? `. Submit sessions at ${forms.hh.shortUrl}` : ''}.`;
  const tone = t.compliance === null ? null : t.compliance >= target ? 'good' : t.compliance >= target - 15 ? 'warn' : 'bad';

  const trend = useMemo(() => {
    const keys = rows.map((r) => monthKey(r.date)).filter(Boolean).sort();
    const months = keys.length ? monthRange(keys[0], keys[keys.length - 1]) : [];
    const per = months.map((m) => hhTotals(rows.filter((r) => monthKey(r.date) === m)));
    const option: Opt = {
      tooltip: axisTooltip({ formatter: (ps: { dataIndex: number }[]) => { const i = ps[0].dataIndex; const x = per[i]; return `<b>${shortMonth(months[i])}</b><br/>Compliance ${fmtPct(x.compliance)}<br/>${x.actions} actions of ${x.opp} opportunities<br/>${x.sessions} session${x.sessions === 1 ? '' : 's'}`; } }),
      grid: grid({ top: 28, bottom: months.length > 12 ? 40 : 8 }),
      xAxis: categoryAxis(months.map(shortMonth), { boundaryGap: false }),
      yAxis: pctAxis(),
      dataZoom: months.length > 12 ? dataZoom(30) : undefined,
      series: [lineSeries({
        name: 'Compliance', data: per.map((x) => (x.compliance === null ? null : Math.round(x.compliance * 10) / 10)), connectNulls: true,
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(75,83,32,0.22)' }, { offset: 1, color: 'rgba(75,83,32,0)' }] } },
        itemStyle: { color: palette.ag600, borderColor: palette.card, borderWidth: 2 },
        markLine: targetLine(target)
      })]
    };
    return { option, table: { columns: ['Month', 'Opportunities', 'Hand rub', 'Hand wash', 'Compliance (%)', 'Sessions'], rows: months.map((m, i) => [shortMonth(m), per[i].opp, per[i].hr, per[i].hw, per[i].compliance === null ? null : Math.round(per[i].compliance! * 10) / 10, per[i].sessions]) } };
  }, [rows, target]);

  const byGroup = useMemo(() => {
    const groups = Array.from(new Set(rows.map((r) => groupKey(r, group))));
    const stats = groups.map((g) => ({ g, ...hhTotals(rows.filter((r) => groupKey(r, group) === g)) })).sort((a, b) => (a.compliance ?? 0) - (b.compliance ?? 0));
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { dataIndex: number }) => { const s = stats[p.dataIndex]; return `<b>${s.g}</b><br/>Compliance ${fmtPct(s.compliance)}<br/>${s.actions} of ${s.opp} opportunities`; } }),
      grid: grid({ right: 48 }),
      xAxis: pctAxis(),
      yAxis: categoryAxis(stats.map((s) => s.g), { axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 170, overflow: 'truncate' } }),
      series: [hBarSeries({
        data: stats.map((s) => ({ value: s.compliance === null ? 0 : Math.round(s.compliance * 10) / 10, itemStyle: { color: (s.compliance ?? 0) >= target ? palette.ag700 : palette.ag300 } })),
        label: { show: true, position: 'right', formatter: '{c}%', color: palette.inkSoft, fontFamily: FONT, fontSize: 11 },
        markLine: { ...targetLine(target), data: [{ xAxis: target }], label: { formatter: `Target ${target}%`, color: palette.khakiDark, fontFamily: FONT, fontSize: 11, position: 'end' } }
      })]
    };
    return { option, height: Math.max(200, 50 + stats.length * 30), table: { columns: [GROUPS.find((x) => x.id === group)!.label, 'Opportunities', 'Actions', 'Compliance (%)'], rows: stats.map((s) => [s.g, s.opp, s.actions, s.compliance === null ? null : Math.round(s.compliance * 10) / 10]) } };
  }, [rows, group, target]);

  const moments = useMemo(() => {
    const m = hhMoments(rows);
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { dataIndex: number }) => { const x = m[p.dataIndex]; return `<b>Moment ${x.moment}: ${HH_MOMENTS[x.moment - 1].name}</b><br/>${x.actions} actions for ${x.indications} indications<br/>Ratio ${fmtPct(x.ratio)}`; } }),
      grid: grid(),
      xAxis: categoryAxis(HH_MOMENTS.map((x) => `M${x.id}`)),
      yAxis: pctAxis(),
      series: [barSeries({
        data: m.map((x) => ({ value: x.ratio === null ? 0 : Math.round(x.ratio * 10) / 10, itemStyle: { color: (x.ratio ?? 0) >= target ? palette.ag700 : palette.ag300, borderRadius: [4, 4, 0, 0] } })),
        label: { show: true, position: 'top', formatter: '{c}%', color: palette.inkSoft, fontFamily: FONT, fontSize: 11 },
        markLine: targetLine(target)
      })]
    };
    return { option, empty: !m.some((x) => x.indications > 0), table: { columns: ['Moment', 'Indications', 'Actions', 'Ratio (%)'], rows: m.map((x) => [`${x.moment}. ${HH_MOMENTS[x.moment - 1].name}`, x.indications, x.actions, x.ratio === null ? null : Math.round(x.ratio * 10) / 10]) } };
  }, [rows, target]);

  const mix = useMemo(() => {
    const keys = rows.map((r) => monthKey(r.date)).filter(Boolean).sort();
    const months = keys.length ? monthRange(keys[0], keys[keys.length - 1]) : [];
    const per = months.map((mm) => hhTotals(rows.filter((r) => monthKey(r.date) === mm)));
    const option: Opt = {
      tooltip: axisTooltip({ axisPointer: { type: 'shadow' } }),
      legend: legend(),
      grid: grid({ top: 32 }),
      xAxis: categoryAxis(months.map(shortMonth)),
      yAxis: valueAxis({ minInterval: 1 }),
      series: [
        barSeries({ name: 'Hand rub', stack: 'mix', data: per.map((x) => x.hr), itemStyle: { color: pair[0], borderColor: palette.card, borderWidth: 1 } }),
        barSeries({ name: 'Hand wash', stack: 'mix', data: per.map((x) => x.hw), itemStyle: { color: pair[1], borderRadius: [4, 4, 0, 0], borderColor: palette.card, borderWidth: 1 } })
      ]
    };
    return { option, table: { columns: ['Month', 'Hand rub', 'Hand wash'], rows: months.map((mm, i) => [shortMonth(mm), per[i].hr, per[i].hw]) } };
  }, [rows]);

  return (
    <div className="tab">
      <SectionTitle title="Hand hygiene compliance" text="WHO five moments observations. Compliance is hand hygiene actions divided by opportunities. Adjust the target to see which groups and moments fall short." />
      <div className="toolbar">
        <label className="slider">
          <span>Target compliance <b>{target}%</b></span>
          <input type="range" min={50} max={100} step={5} value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="Target compliance percentage" />
        </label>
        <div className="toolbar-field"><span>Compare compliance by</span><Segmented label="Group by" value={group} options={GROUPS} onChange={setGroup} /></div>
      </div>
      <div className="kpis">
        <Kpi label="Overall compliance" value={fmtPct(t.compliance)} tone={tone} toneLabel={tone === 'good' ? 'At or above target' : tone === 'warn' ? 'Within 15 points of target' : tone === 'bad' ? 'Well below target' : undefined} />
        <Kpi label="Opportunities observed" value={fmtInt(t.opp)} sub={`${fmtInt(t.sessions)} session entries`} />
        <Kpi label="Missed opportunities" value={fmtInt(t.missed)} sub={`${fmtInt(t.gloves)} missed while wearing gloves`} />
        <Kpi label="Hand rub share" value={fmtPct(t.actions ? (t.hr / Math.max(1, t.hr + t.hw)) * 100 : null)} sub="Of all hand hygiene actions" />
      </div>
      <div className="grid">
        <ChartCard span={2} title="Compliance trend" subtitle="Monthly compliance against the target line." option={trend.option} table={trend.table} empty={empty} emptyText={emptyText} height={320} />
        <ChartCard title="Compliance by moment" subtitle="Actions per indication for each of the five moments." option={moments.option} table={moments.table} empty={empty || moments.empty} emptyText={empty ? emptyText : 'Moment breakdowns have not been recorded yet.'} height={320} />
        <ChartCard span={2} title={`Compliance by ${GROUPS.find((g) => g.id === group)!.label.toLowerCase()}`} subtitle="Darker bars meet the target. Change the grouping above the charts." option={byGroup.option} table={byGroup.table} empty={empty} emptyText={emptyText} height={byGroup.height} />
        <ChartCard title="Hand rub and hand wash" subtitle="Actions performed each month by method." option={mix.option} table={mix.table} empty={empty} emptyText={emptyText} height={280} />
      </div>
      {!empty && tone && <p className="footnote"><StatusTag tone={tone} label={`Overall ${fmtPct(t.compliance)} against a ${target}% target`} /></p>}
    </div>
  );
}
