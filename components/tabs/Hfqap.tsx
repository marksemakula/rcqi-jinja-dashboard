'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChartCard, DataTable, Kpi, SectionTitle, Select, Stars } from '../ui';
import type { TabProps } from './shared';
import { HFQAP_M5_PARTS, HFQAP_MODULES, HFQAP_STANDARDS, STAR_BANDS } from '@/lib/catalogue';
import { axisTooltip, barSeries, categoryAxis, FONT, grid, hBarSeries, heatCell, heatVisualMap, legend, lineSeries, pctAxis, tooltip, valueAxis, type Opt } from '@/lib/chart';
import { fmtDate, fmtPct, latestBy, mean, quarterKey } from '@/lib/format';
import { context, ordinal5, pair, palette } from '@/lib/palette';
import { levelKey, scoreHfqap } from '@/lib/scoring';
import type { HfqapRec } from '@/lib/types';

const STAR_COLOURS = [palette.ag150, ...ordinal5];

export default function Hfqap({ data, all, forms, focus }: TabProps) {
  const [facility, setFacility] = useState('All');
  const [standard, setStandard] = useState<string | null>(null);
  useEffect(() => { if (focus) setFacility(focus); }, [focus]);

  const latest = useMemo(() => latestBy(data.hfqap, (r) => r.facility).map((r) => ({ rec: r, s: scoreHfqap(r) })), [data.hfqap]);
  const facilities = useMemo(() => latest.map((l) => l.rec.facility || 'Unknown').sort(), [latest]);
  const sel = latest.find((l) => l.rec.facility === facility) || null;
  const regional = HFQAP_MODULES.map((m) => mean(latest.map((l) => l.s.modules.find((x) => x.id === m.id)!.pct)));
  const empty = !latest.length;
  const emptyText = `No HFQAP assessments in this period${forms.hfqap?.shortUrl ? `. Submit at ${forms.hfqap.shortUrl}` : ''}.`;

  const stars = useMemo(() => {
    const counts = STAR_BANDS.map((b) => latest.filter((l) => l.s.star === b.star).length);
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { dataIndex: number }) => `<b>Star ${p.dataIndex}</b> (${STAR_BANDS[p.dataIndex].label})<br/>${counts[p.dataIndex]} facilit${counts[p.dataIndex] === 1 ? 'y' : 'ies'}` }),
      grid: grid(),
      xAxis: categoryAxis(STAR_BANDS.map((b) => `Star ${b.star}`)),
      yAxis: valueAxis({ minInterval: 1 }),
      series: [barSeries({ data: counts.map((c, i) => ({ value: c, itemStyle: { color: STAR_COLOURS[i], borderRadius: 0 } })), label: { show: true, position: 'top', color: palette.inkSoft, fontFamily: FONT } })]
    };
    return { option, table: { columns: ['Star rating', 'Score band', 'Facilities'], rows: STAR_BANDS.map((b, i) => [`Star ${b.star}`, b.label, counts[i]]) } };
  }, [latest]);

  const ranking = useMemo(() => {
    const sorted = latest.slice().sort((a, b) => (a.s.pct ?? 0) - (b.s.pct ?? 0));
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { dataIndex: number }) => { const l = sorted[p.dataIndex]; return `<b>${l.rec.facility}</b> (${l.rec.level || 'level not stated'})<br/>${l.s.total} of ${l.s.expected} criteria, ${fmtPct(l.s.pct)}<br/>Star ${l.s.star}<br/>Assessed ${fmtDate(l.rec.date)}`; } }),
      grid: grid({ right: 64 }),
      xAxis: pctAxis(),
      yAxis: categoryAxis(sorted.map((l) => l.rec.facility || ''), { axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 180, overflow: 'truncate' } }),
      series: [hBarSeries({
        data: sorted.map((l) => ({ value: Math.round(l.s.pct ?? 0), star: l.s.star, itemStyle: { color: facility === 'All' || facility === l.rec.facility ? STAR_COLOURS[l.s.star ?? 0] : context } })),
        label: { show: true, position: 'right', color: palette.inkSoft, fontFamily: FONT, fontSize: 11, formatter: (p: { value: number; data: { star: number } }) => `${p.value}%  ★${p.data.star}` }
      })]
    };
    return { option, sorted, height: Math.max(240, 50 + sorted.length * 32), table: { columns: ['Facility', 'Level', 'District', 'Date', 'Criteria met', 'Expected', 'Score (%)', 'Star'], rows: sorted.slice().reverse().map((l) => [l.rec.facility, l.rec.level, l.rec.district, fmtDate(l.rec.date), l.s.total, l.s.expected, Math.round(l.s.pct ?? 0), l.s.star]) } };
  }, [latest, facility]);

  const heat = useMemo(() => {
    const sorted = latest.slice().sort((a, b) => (b.s.pct ?? 0) - (a.s.pct ?? 0));
    const cells = sorted.flatMap((l, fi) => l.s.modules.map((m, mi) => heatCell(mi, fi, Math.round(m.pct), 0, 100)));
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { value: number[] }) => { const l = sorted[p.value[1]]; const m = l.s.modules[p.value[0]]; return `<b>${l.rec.facility}</b><br/>${m.name}<br/>${m.score} of ${m.expected} criteria (${m.pct.toFixed(0)}%)`; } }),
      grid: grid({ top: 8, bottom: 56 }),
      xAxis: categoryAxis(HFQAP_MODULES.map((m) => m.short), { position: 'top', axisLabel: { color: palette.inkMuted, fontFamily: FONT, fontSize: 10, interval: 0, rotate: 30 } }),
      yAxis: categoryAxis(sorted.map((l) => l.rec.facility || ''), { inverse: true, axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 170, overflow: 'truncate' } }),
      visualMap: heatVisualMap(0, 100, { text: ['100%', '0%'] }),
      series: [{ type: 'heatmap', data: cells, label: { show: true, fontFamily: FONT, fontSize: 10, fontWeight: 700 }, itemStyle: { borderColor: palette.card, borderWidth: 3, borderRadius: 0 }, emphasis: { itemStyle: { borderColor: palette.ag900, borderWidth: 2 } } }]
    };
    return { option, sorted, table: { columns: ['Facility', ...HFQAP_MODULES.map((m) => `${m.short} (%)`)], rows: sorted.map((l) => [l.rec.facility, ...l.s.modules.map((m) => Math.round(m.pct))]) } };
  }, [latest]);

  const radar = useMemo(() => {
    const option: Opt = {
      tooltip: tooltip(),
      legend: legend({ top: 'auto', bottom: 0, left: 'center', right: 'auto' }),
      radar: {
        radius: '56%', center: ['50%', '47%'], indicator: HFQAP_MODULES.map((m) => ({ name: m.short, max: 100 })),
        axisName: { color: palette.inkSoft, fontFamily: FONT, fontSize: 10.5 }, splitLine: { lineStyle: { color: palette.grid } },
        splitArea: { areaStyle: { color: [palette.card, palette.ag50] } }, axisLine: { lineStyle: { color: palette.border } }
      },
      series: [{
        type: 'radar',
        data: [
          { name: 'Regional average', value: regional.map((v) => Math.round(v ?? 0)), lineStyle: { color: pair[1], width: 2, type: 'dashed' }, itemStyle: { color: pair[1] }, areaStyle: { color: 'rgba(194,165,90,0.12)' } },
          ...(sel ? [{ name: sel.rec.facility, value: sel.s.modules.map((m) => Math.round(m.pct)), lineStyle: { color: pair[0], width: 2 }, itemStyle: { color: pair[0] }, areaStyle: { color: 'rgba(63,90,30,0.18)' } }] : [])
        ]
      }]
    };
    return { option, table: { columns: ['Module', 'Regional average (%)', ...(sel ? [`${sel.rec.facility} (%)`] : [])], rows: HFQAP_MODULES.map((m, i) => [m.name, regional[i] === null ? null : Math.round(regional[i]!), ...(sel ? [Math.round(sel.s.modules[i].pct)] : [])]) } };
  }, [regional, sel]);

  const unmet = useMemo(() => {
    const counts = new Map<string, number>();
    latest.forEach((l) => (l.rec.notMet || []).forEach((c) => counts.set(c, (counts.get(c) || 0) + 1)));
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12).reverse();
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { dataIndex: number }) => `<b>${top[p.dataIndex][0]} ${HFQAP_STANDARDS[top[p.dataIndex][0]] || ''}</b><br/>Not met in ${top[p.dataIndex][1]} of ${latest.length} facilities<br/>Select to list the facilities` }),
      grid: grid({ right: 40 }),
      xAxis: valueAxis({ minInterval: 1 }),
      yAxis: categoryAxis(top.map(([c]) => `${c} ${HFQAP_STANDARDS[c] || ''}`), { axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 230, overflow: 'truncate' } }),
      series: [hBarSeries({ data: top.map(([c, v]) => ({ value: v, itemStyle: { color: !standard || standard === c ? palette.ag600 : context } })), label: { show: true, position: 'right', color: palette.inkSoft, fontFamily: FONT, fontSize: 11 } })]
    };
    return { option, top, height: Math.max(260, 40 + top.length * 28), table: { columns: ['Standard', 'Description', 'Facilities not meeting it'], rows: Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, HFQAP_STANDARDS[c] || '', v]) } };
  }, [latest, standard]);

  const trend = useMemo(() => {
    const target = facility === 'All' ? null : facility;
    const bands = { silent: true, itemStyle: { color: palette.ag50 }, data: STAR_BANDS.filter((b) => b.star % 2 === 1).map((b) => [{ yAxis: b.min, name: `Star ${b.star}`, label: { color: palette.inkMuted, fontFamily: FONT, fontSize: 10, position: 'insideLeft' } }, { yAxis: b.star === 5 ? 100 : b.min + 10 }]) };
    const label = { show: true, formatter: '{c}%', color: palette.inkSoft, fontFamily: FONT, fontSize: 11, position: 'top' };
    if (!target) {
      const quarters = Array.from(new Set(all.hfqap.map((r) => quarterKey(r.date)))).filter(Boolean).sort();
      const avg = quarters.map((q) => mean(all.hfqap.filter((r) => quarterKey(r.date) === q).map((r) => scoreHfqap(r).pct ?? 0)));
      const n = quarters.map((q) => all.hfqap.filter((r) => quarterKey(r.date) === q).length);
      const option: Opt = {
        tooltip: axisTooltip({ formatter: (ps: { dataIndex: number }[]) => `<b>${quarters[ps[0].dataIndex]}</b><br/>Average ${fmtPct(avg[ps[0].dataIndex])} across ${n[ps[0].dataIndex]} assessments` }),
        grid: grid({ top: 24 }),
        xAxis: categoryAxis(quarters),
        yAxis: pctAxis(),
        series: [lineSeries({ name: 'Regional average', data: avg.map((v) => (v === null ? null : Math.round(v))), label, markArea: bands })]
      };
      return { option, count: quarters.length, table: { columns: ['Quarter', 'Assessments', 'Average score (%)'], rows: quarters.map((q, i) => [q, n[i], avg[i] === null ? null : Math.round(avg[i]!)]) } };
    }
    const hist: HfqapRec[] = all.hfqap.filter((r) => r.facility === target).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const option: Opt = {
      tooltip: axisTooltip({ formatter: (ps: { dataIndex: number }[]) => { const r = hist[ps[0].dataIndex]; const s = scoreHfqap(r); return `<b>${fmtDate(r.date)}</b><br/>${fmtPct(s.pct)}, Star ${s.star}<br/>${r.assessType || ''}`; } }),
      grid: grid({ top: 24 }),
      xAxis: categoryAxis(hist.map((r) => fmtDate(r.date))),
      yAxis: pctAxis(),
      series: [lineSeries({ name: 'Overall score', data: hist.map((r) => Math.round(scoreHfqap(r).pct ?? 0)), label, markArea: bands })]
    };
    return { option, count: hist.length, table: { columns: ['Date', 'Type', 'Score (%)', 'Star'], rows: hist.map((r) => { const s = scoreHfqap(r); return [fmtDate(r.date), r.assessType, Math.round(s.pct ?? 0), s.star]; }) } };
  }, [all.hfqap, facility]);

  const district = useMemo(() => {
    const ds = Array.from(new Set(latest.map((l) => l.rec.district || 'Not stated'))).sort();
    const vals = ds.map((d) => ({ d, v: mean(latest.filter((l) => (l.rec.district || 'Not stated') === d).map((l) => l.s.pct ?? 0)), n: latest.filter((l) => (l.rec.district || 'Not stated') === d).length }));
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { dataIndex: number }) => `<b>${vals[p.dataIndex].d}</b><br/>Average ${fmtPct(vals[p.dataIndex].v)} across ${vals[p.dataIndex].n} facilit${vals[p.dataIndex].n === 1 ? 'y' : 'ies'}` }),
      grid: grid(),
      xAxis: categoryAxis(ds, { axisLabel: { color: palette.inkMuted, fontFamily: FONT, fontSize: 11, interval: 0, rotate: ds.length > 6 ? 30 : 0 } }),
      yAxis: pctAxis(),
      series: [barSeries({ data: vals.map((x) => Math.round(x.v ?? 0)), label: { show: true, position: 'top', formatter: '{c}%', color: palette.inkSoft, fontFamily: FONT, fontSize: 11 } })]
    };
    return { option, table: { columns: ['District', 'Facilities', 'Average score (%)'], rows: vals.map((x) => [x.d, x.n, x.v === null ? null : Math.round(x.v)]) } };
  }, [latest]);

  const missing = standard ? latest.filter((l) => (l.rec.notMet || []).includes(standard)).map((l) => l.rec.facility) : [];
  const avgPct = mean(latest.map((l) => l.s.pct ?? 0));
  const modAvg = HFQAP_MODULES.map((m, i) => ({ m, v: regional[i] ?? 0 })).sort((a, b) => a.v - b.v);

  return (
    <div className="tab">
      <SectionTitle title="Health Facility Quality of Care Assessment Program" text="Module scores against the criteria expected for each facility level, overall percentage and star rating (MoH HFQAP Facility Assessment Tool). Each chart uses the latest assessment per facility." />
      <div className="toolbar"><Select label="Focus facility" value={facility} options={facilities} onChange={setFacility} allLabel="All facilities" /></div>
      <div className="kpis">
        <Kpi label="Facilities assessed" value={String(latest.length)} sub="Latest assessment each" />
        <Kpi label="Average overall score" value={fmtPct(avgPct)} sub={avgPct === null ? undefined : `Equivalent to Star ${STAR_BANDS.filter((b) => avgPct >= b.min).pop()?.star}`} />
        <Kpi label="Strongest module" value={empty ? 'No data' : modAvg[modAvg.length - 1].m.short} sub={empty ? undefined : `Regional average ${fmtPct(modAvg[modAvg.length - 1].v)}`} />
        <Kpi label="Weakest module" value={empty ? 'No data' : modAvg[0].m.short} sub={empty ? undefined : `Regional average ${fmtPct(modAvg[0].v)}`} />
      </div>
      {sel && (
        <div className="focus-band">
          <div><span className="kpi-label">{sel.rec.facility}</span><Stars star={sel.s.star} /></div>
          <div><span className="kpi-label">Overall</span><b>{fmtPct(sel.s.pct)}</b> <span className="muted">({sel.s.total} of {sel.s.expected} criteria, {sel.rec.level})</span></div>
          <div><span className="kpi-label">Module 5 detail</span><span className="muted">{HFQAP_M5_PARTS.map((p) => `${p.name.split(' ')[0]} ${Number((sel.rec as unknown as Record<string, unknown>)[p.field] ?? 0)}/${p.expected[levelKey(sel.rec.level)]}`).join(', ')}</span></div>
        </div>
      )}
      <div className="grid">
        <ChartCard title="Star rating distribution" subtitle="Facilities by star band." option={stars.option} table={stars.table} height={Math.max(300, ranking.height)} empty={empty} emptyText={emptyText} />
        <ChartCard span={2} title="Overall score and star rating by facility" subtitle="Bar shade follows the star rating. Select a facility to focus every chart." option={ranking.option} table={ranking.table} height={Math.max(300, ranking.height)} empty={empty} emptyText={emptyText}
          onClick={(p) => { const l = ranking.sorted[p.dataIndex as number]; if (l?.rec.facility) setFacility(facility === l.rec.facility ? 'All' : l.rec.facility); }} />
        <ChartCard span={2} title="Module scores by facility" subtitle="Percentage of the expected criteria for the facility level." option={heat.option} table={heat.table} height={Math.max(300, 120 + heat.sorted.length * 34)} empty={empty} emptyText={emptyText}
          onClick={(p) => { const l = heat.sorted[(p.value as number[])[1]]; if (l?.rec.facility) setFacility(l.rec.facility); }} />
        <ChartCard title="Module profile" subtitle={sel ? `${sel.rec.facility} against the regional average.` : 'Regional average. Select a facility to compare.'} option={radar.option} table={radar.table} height={Math.max(360, 120 + heat.sorted.length * 34)} empty={empty} emptyText={emptyText} />
        <ChartCard span={2} title="Standards most often not met" subtitle="Select a standard to see which facilities need support." option={unmet.option} table={unmet.table} height={unmet.height} empty={empty || !unmet.top.length} emptyText={empty ? emptyText : 'No unmet standards have been recorded.'}
          onClick={(p) => { const c = unmet.top[p.dataIndex as number]?.[0]; if (c) setStandard(standard === c ? null : c); }} />
        <section className="card span-1" aria-label="Facilities not meeting the selected standard">
          <header className="card-head"><div><h3>{standard ? `${standard} ${HFQAP_STANDARDS[standard]}` : 'Facilities needing support'}</h3><p className="card-sub">{standard ? `${missing.length} of ${latest.length} facilities did not meet this standard.` : 'Select a standard on the left to list the facilities that did not meet it.'}</p></div></header>
          {standard && <DataTable table={{ columns: ['Facility'], rows: missing.map((f) => [f]) }} onRowClick={(r) => setFacility(String(r[0]))} />}
        </section>
        <ChartCard span={2} title={facility === 'All' ? 'Score history' : `Score history: ${facility}`} subtitle={facility === 'All' ? 'Regional average by quarter. Select a facility to see its own assessments. Shaded bands mark Stars 1, 3 and 5.' : 'All assessments on record for this facility. Shaded bands mark Stars 1, 3 and 5.'} option={trend.option} table={trend.table} height={280} empty={!trend.count} emptyText="No assessments on record." />
        <ChartCard title="Average score by district" subtitle="Latest assessment per facility." option={district.option} table={district.table} height={280} empty={empty} emptyText={emptyText} />
      </div>
    </div>
  );
}
