'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChartCard, DataTable, Drawer, Kpi, RagPill, SectionTitle, Segmented, Select, StatusTag } from '../ui';
import type { TabProps } from './shared';
import { BASIC_IPC_DOMAINS, MOH_IPC_AREAS, PPE_ITEMS } from '@/lib/catalogue';
import { categoryAxis, FONT, grid, hBarSeries, legend, lineSeries, pctAxis, tooltip, valueAxis, axisTooltip, type Opt } from '@/lib/chart';
import { fmtDate, fmtPct, latestBy, mean, quarterKey } from '@/lib/format';
import { pair, palette, rag as ragColour } from '@/lib/palette';
import { scoreBasicIpc, scoreMohIpc, type Rag } from '@/lib/scoring';

const RAG_VALUE: Record<Rag, number> = { Red: 1, Amber: 2, Green: 3 };
const RAG_LETTER = ['', 'R', 'A', 'G'];

export default function Ipc({ data, all, forms, focus }: TabProps) {
  const [view, setView] = useState<'basic' | 'moh'>('basic');
  const [drawer, setDrawer] = useState<string | null>(null);
  const [mohFacility, setMohFacility] = useState<string>('All');

  const basicLatest = useMemo(() => latestBy(data.ipcBasic, (r) => r.facility).sort((a, b) => (a.facility || '').localeCompare(b.facility || '')), [data.ipcBasic]);
  const basicScores = useMemo(() => basicLatest.map((r) => ({ rec: r, s: scoreBasicIpc(r) })), [basicLatest]);
  const mohLatest = useMemo(() => latestBy(data.ipcMoh, (r) => r.facility).sort((a, b) => (a.facility || '').localeCompare(b.facility || '')), [data.ipcMoh]);
  const mohScores = useMemo(() => mohLatest.map((r) => ({ rec: r, s: scoreMohIpc(r) })), [mohLatest]);

  useEffect(() => { if (focus) setDrawer(focus); }, [focus]);

  /* Basic IPC ------------------------------------------------------------------ */
  const counts = { Green: 0, Amber: 0, Red: 0 } as Record<Rag, number>;
  basicScores.forEach(({ s }) => { if (s.overall) counts[s.overall] += 1; });

  const matrix = useMemo(() => {
    const facilities = basicScores.map((b) => b.rec.facility || 'Unknown');
    const cells = basicScores.flatMap((b, fi) => b.s.domains.map((d, di) => {
      const v = d.rag ? RAG_VALUE[d.rag] : 0;
      return { value: [di, fi, v], label: { color: v === 2 ? palette.ink : palette.onDark } };
    }));
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { value: number[] }) => { const b = basicScores[p.value[1]]; const d = b.s.domains[p.value[0]]; return `<b>${b.rec.facility}</b><br/>${d.name}: ${d.score} of ${d.applicable} applicable<br/>RAG: ${d.rag || 'Not rated'}${d.core ? '' : ' (not in overall)'}`; } }),
      grid: grid({ top: 8, bottom: 40 }),
      xAxis: categoryAxis(BASIC_IPC_DOMAINS.map((d) => d.name), { position: 'top', axisLabel: { color: palette.inkMuted, fontFamily: FONT, fontSize: 10, interval: 0, rotate: 35 } }),
      yAxis: categoryAxis(facilities, { inverse: true, axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 180, overflow: 'truncate' } }),
      visualMap: {
        type: 'piecewise', orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 14, itemHeight: 10,
        textStyle: { fontFamily: FONT, color: palette.inkSoft, fontSize: 11 },
        pieces: [{ value: 3, label: 'G  Green', color: ragColour.Green }, { value: 2, label: 'A  Amber', color: ragColour.Amber }, { value: 1, label: 'R  Red', color: ragColour.Red }, { value: 0, label: 'Not rated', color: palette.ag50 }]
      },
      series: [{
        type: 'heatmap', data: cells,
        label: { show: true, fontFamily: FONT, fontSize: 11, fontWeight: 700, formatter: (p: { value: number[] }) => RAG_LETTER[p.value[2]] },
        itemStyle: { borderColor: palette.card, borderWidth: 3, borderRadius: 0 },
        emphasis: { itemStyle: { borderColor: palette.ag900, borderWidth: 2 } }
      }]
    };
    return { facilities, option, table: { columns: ['Facility', 'Date', 'Overall', ...BASIC_IPC_DOMAINS.map((d) => d.name)], rows: basicScores.map((b) => [b.rec.facility, fmtDate(b.rec.date), b.s.overall || 'Not rated', ...b.s.domains.map((d) => d.rag || 'Not rated')]) } };
  }, [basicScores]);

  const domainAvg = useMemo(() => {
    const vals = BASIC_IPC_DOMAINS.map((d) => ({ d, v: mean(basicScores.map((b) => b.s.domains.find((x) => x.code === d.code)!).filter((x) => x.applicable).map((x) => (x.score / x.applicable) * 100)) }))
      .sort((a, b) => (a.v ?? 0) - (b.v ?? 0));
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { dataIndex: number }) => `<b>${vals[p.dataIndex].d.name}</b><br/>Average ${fmtPct(vals[p.dataIndex].v)} across ${basicScores.length} facilities` }),
      grid: grid({ right: 48 }),
      xAxis: pctAxis(),
      yAxis: categoryAxis(vals.map((x) => x.d.name)),
      series: [hBarSeries({ data: vals.map((x) => ({ value: x.v === null ? 0 : Math.round(x.v), itemStyle: { color: x.d.core ? palette.ag600 : palette.ag300 } })), label: { show: true, position: 'right', formatter: '{c}%', color: palette.inkSoft, fontFamily: FONT, fontSize: 11 } })]
    };
    return { option, table: { columns: ['Standard', 'Average score (%)', 'Core standard'], rows: vals.map((x) => [x.d.name, x.v === null ? null : Math.round(x.v), x.d.core ? 'Yes' : 'No']) } };
  }, [basicScores]);

  const basicTrend = useMemo(() => {
    const quarters = Array.from(new Set(data.ipcBasic.map((r) => quarterKey(r.date)))).filter(Boolean).sort();
    const avg = quarters.map((q) => mean(data.ipcBasic.filter((r) => quarterKey(r.date) === q).map((r) => scoreBasicIpc(r).pct ?? 0)));
    const option: Opt = {
      tooltip: axisTooltip({ valueFormatter: (v: number) => fmtPct(v) }),
      grid: grid({ top: 28 }),
      xAxis: categoryAxis(quarters),
      yAxis: pctAxis(),
      series: [lineSeries({ name: 'Average core score', data: avg.map((v) => (v === null ? null : Math.round(v))), label: { show: true, formatter: '{c}%', position: 'top', color: palette.inkSoft, fontFamily: FONT, fontSize: 11 } })]
    };
    return { option, table: { columns: ['Quarter', 'Average core score (%)', 'Assessments'], rows: quarters.map((q, i) => [q, avg[i] === null ? null : Math.round(avg[i]!), data.ipcBasic.filter((r) => quarterKey(r.date) === q).length]) } };
  }, [data.ipcBasic]);

  const drawerData = useMemo(() => {
    if (!drawer) return null;
    const hist = all.ipcBasic.filter((r) => r.facility === drawer).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const latest = hist[hist.length - 1];
    if (!latest) return null;
    const s = scoreBasicIpc(latest);
    const option: Opt = {
      tooltip: axisTooltip({ valueFormatter: (v: number) => fmtPct(v) }),
      grid: grid({ top: 24 }),
      xAxis: categoryAxis(hist.map((h) => fmtDate(h.date))),
      yAxis: pctAxis(),
      series: [lineSeries({ name: 'Core score', data: hist.map((h) => Math.round(scoreBasicIpc(h).pct ?? 0)) })]
    };
    return { latest, s, option, hist };
  }, [drawer, all.ipcBasic]);

  /* MoH IPC tool ---------------------------------------------------------------- */
  const mohOptions = mohScores.map((m) => m.rec.facility || 'Unknown');
  const selectedMoh = mohScores.find((m) => m.rec.facility === mohFacility) || null;
  const regionalAreas = MOH_IPC_AREAS.map((a) => mean(mohScores.map((m) => m.s.areas.find((x) => x.id === a.id)!.pct).filter((v): v is number => v !== null)));

  const radar = useMemo(() => {
    const series: Opt[] = [{
      type: 'radar',
      data: [
        { name: 'Regional average', value: regionalAreas.map((v) => Math.round(v ?? 0)), lineStyle: { color: pair[1], width: 2, type: 'dashed' }, itemStyle: { color: pair[1] }, areaStyle: { color: 'rgba(194,165,90,0.12)' } },
        ...(selectedMoh ? [{ name: selectedMoh.rec.facility, value: selectedMoh.s.areas.map((a) => Math.round(a.pct ?? 0)), lineStyle: { color: pair[0], width: 2 }, itemStyle: { color: pair[0] }, areaStyle: { color: 'rgba(63,90,30,0.18)' } }] : [])
      ]
    }];
    return {
      option: {
        tooltip: tooltip(),
        legend: legend({ top: 'auto', bottom: 0, left: 'center', right: 'auto' }),
        radar: {
          radius: '58%', center: ['50%', '48%'], indicator: MOH_IPC_AREAS.map((a) => ({ name: a.short, max: 100 })),
          axisName: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11 }, splitLine: { lineStyle: { color: palette.grid } },
          splitArea: { areaStyle: { color: [palette.card, palette.ag50] } }, axisLine: { lineStyle: { color: palette.border } }
        },
        series
      } as Opt,
      table: { columns: ['Thematic area', 'Regional average (%)', ...(selectedMoh ? [`${selectedMoh.rec.facility} (%)`] : [])], rows: MOH_IPC_AREAS.map((a, i) => [a.name, regionalAreas[i] === null ? null : Math.round(regionalAreas[i]!), ...(selectedMoh ? [Math.round(selectedMoh.s.areas[i].pct ?? 0)] : [])]) }
    };
  }, [mohScores, selectedMoh]); // eslint-disable-line react-hooks/exhaustive-deps

  const mohRank = useMemo(() => {
    const sorted = mohScores.slice().sort((a, b) => (a.s.pct ?? 0) - (b.s.pct ?? 0));
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { dataIndex: number }) => { const m = sorted[p.dataIndex]; return `<b>${m.rec.facility}</b><br/>Overall ${fmtPct(m.s.pct)}<br/>Assessed ${fmtDate(m.rec.date)}`; } }),
      grid: grid({ right: 48 }),
      xAxis: pctAxis(),
      yAxis: categoryAxis(sorted.map((m) => m.rec.facility || ''), { axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 180, overflow: 'truncate' } }),
      series: [hBarSeries({ data: sorted.map((m) => ({ value: Math.round(m.s.pct ?? 0), itemStyle: { color: mohFacility === 'All' || mohFacility === m.rec.facility ? palette.ag600 : palette.ag150 } })), label: { show: true, position: 'right', formatter: '{c}%', color: palette.inkSoft, fontFamily: FONT, fontSize: 11 } })]
    };
    return { option, sorted, height: Math.max(200, 50 + sorted.length * 30), table: { columns: ['Facility', 'Date', 'Overall (%)', ...MOH_IPC_AREAS.map((a) => a.name)], rows: mohScores.map((m) => [m.rec.facility, fmtDate(m.rec.date), Math.round(m.s.pct ?? 0), ...m.s.areas.map((a) => (a.pct === null ? null : Math.round(a.pct)))]) } };
  }, [mohScores, mohFacility]);

  const ppe = useMemo(() => {
    const keys = Object.keys(PPE_ITEMS);
    const cells = mohScores.flatMap((m, fi) => keys.map((k, ki) => {
      const v = m.rec.items[`B8${k}`];
      const val = v === 'Yes' ? 2 : v === 'No' ? 1 : 0;
      return { value: [ki, fi, val], label: { color: val === 2 ? palette.onDark : palette.ink } };
    }));
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { value: number[] }) => `<b>${mohScores[p.value[1]].rec.facility}</b><br/>${PPE_ITEMS[keys[p.value[0]]]}: ${['not recorded', 'not available', 'available'][p.value[2]]}` }),
      grid: grid({ top: 8, bottom: 40 }),
      xAxis: categoryAxis(keys.map((k) => PPE_ITEMS[k]), { position: 'top', axisLabel: { color: palette.inkMuted, fontFamily: FONT, fontSize: 10, interval: 0, rotate: 35 } }),
      yAxis: categoryAxis(mohOptions, { inverse: true, axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 170, overflow: 'truncate' } }),
      visualMap: { type: 'piecewise', orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 14, itemHeight: 10, textStyle: { fontFamily: FONT, color: palette.inkSoft, fontSize: 11 }, pieces: [{ value: 2, label: 'Available', color: palette.ag600 }, { value: 1, label: 'Not available', color: palette.sand }, { value: 0, label: 'Not recorded', color: palette.ag50 }] },
      series: [{ type: 'heatmap', data: cells, label: { show: true, fontFamily: FONT, fontSize: 10, formatter: (p: { value: number[] }) => ['', 'No', 'Yes'][p.value[2]] }, itemStyle: { borderColor: palette.card, borderWidth: 3, borderRadius: 0 } }]
    };
    return { option, table: { columns: ['Facility', ...keys.map((k) => PPE_ITEMS[k])], rows: mohScores.map((m) => [m.rec.facility, ...keys.map((k) => m.rec.items[`B8${k}`] || '')]) } };
  }, [mohScores, mohOptions]);

  const coverage = useMemo(() => {
    const rows = mohScores.filter((m) => m.s.hhCoverage !== null || m.s.binCoverage !== null);
    const option: Opt = {
      tooltip: axisTooltip({ axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => fmtPct(v) }),
      legend: legend(),
      grid: grid({ top: 32, right: 40 }),
      xAxis: pctAxis(),
      yAxis: categoryAxis(rows.map((m) => m.rec.facility || ''), { axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 170, overflow: 'truncate' } }),
      series: [
        hBarSeries({ name: 'Hand hygiene stations', data: rows.map((m) => Math.round(m.s.hhCoverage ?? 0)), itemStyle: { color: pair[0], borderRadius: 0 } }),
        hBarSeries({ name: 'Colour-coded bins', data: rows.map((m) => Math.round(m.s.binCoverage ?? 0)), itemStyle: { color: pair[1], borderRadius: 0 } })
      ]
    };
    return { option, height: Math.max(220, 60 + rows.length * 44), empty: !rows.length, table: { columns: ['Facility', 'Service points', 'Hand hygiene station coverage (%)', 'Bin coverage (%)', 'Self-reported HH compliance (%)'], rows: rows.map((m) => [m.rec.facility, m.rec.sdp ?? null, Math.round(m.s.hhCoverage ?? 0), Math.round(m.s.binCoverage ?? 0), m.rec.hhRate ?? null]) } };
  }, [mohScores]);

  const disposal = useMemo(() => {
    const methods = ['Incinerator', 'Autoclave', 'Placenta pit', 'Burn pit', 'Transported offsite for disposal'];
    const counts = methods.map((m) => mohScores.filter((x) => (x.rec.disposal || []).includes(m)).length);
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { name: string; value: number }) => `<b>${p.name}</b><br/>${p.value} of ${mohScores.length} facilities` }),
      grid: grid({ right: 32 }),
      xAxis: valueAxis({ minInterval: 1 }),
      yAxis: categoryAxis(methods),
      series: [hBarSeries({ data: counts, label: { show: true, position: 'right', color: palette.inkSoft, fontFamily: FONT, fontSize: 11 } })]
    };
    return { option, table: { columns: ['Disposal method', 'Facilities'], rows: methods.map((m, i) => [m, counts[i]]) } };
  }, [mohScores]);

  const basicEmpty = !basicScores.length;
  const mohEmpty = !mohScores.length;

  return (
    <div className="tab">
      <SectionTitle title="Infection prevention and control" text="Two complementary tools: the Basic IPC Assessment with Red, Amber and Green ratings, and the Ministry of Health IPC Facility Assessment Tool (May 2024). Each chart uses the latest assessment per facility in the selected period." />
      <div className="toolbar">
        <Segmented label="IPC tool" value={view} onChange={setView} options={[{ id: 'basic', label: 'Basic IPC (RAG)' }, { id: 'moh', label: 'IPC tool (MoH 2024)' }]} />
        {view === 'moh' && <Select label="Compare facility" value={mohFacility} options={mohOptions} onChange={setMohFacility} allLabel="Regional average only" />}
      </div>

      {view === 'basic' ? (
        <>
          <div className="kpis">
            <Kpi label="Facilities assessed" value={String(basicScores.length)} sub="Latest assessment each" />
            <div className="kpi"><span className="kpi-label">Overall rating</span><span className="kpi-tags"><StatusTag tone="good" label={`${counts.Green} Green`} /><StatusTag tone="warn" label={`${counts.Amber} Amber`} /><StatusTag tone="bad" label={`${counts.Red} Red`} /></span><span className="kpi-sub">Colour with the highest count; ties take the lower colour</span></div>
            <Kpi label="Average core score" value={fmtPct(mean(basicScores.map((b) => b.s.pct ?? 0)))} sub="Linen excluded, as in the tool" />
          </div>
          <div className="grid">
            <ChartCard span={3} title="RAG status by standard" subtitle="Each cell shows the rating for one standard. Select a facility to open its profile." option={matrix.option} table={matrix.table}
              height={Math.max(260, 150 + matrix.facilities.length * 34)} empty={basicEmpty} emptyText={`No Basic IPC assessments in this period${forms.ipcBasic?.shortUrl ? `. Submit at ${forms.ipcBasic.shortUrl}` : ''}.`}
              onClick={(p) => { const f = matrix.facilities[(p.value as number[])[1]]; if (f) setDrawer(f); }} />
            <ChartCard span={2} title="Average score by standard" subtitle="Lowest standards first. Lighter bar: linen, which is not a core standard." option={domainAvg.option} table={domainAvg.table} height={380} empty={basicEmpty} />
            <ChartCard title="Average core score by quarter" subtitle="All facilities, Uganda financial year quarters." option={basicTrend.option} table={basicTrend.table} height={380} empty={basicEmpty} />
          </div>
        </>
      ) : (
        <>
          <div className="kpis">
            <Kpi label="Facilities assessed" value={String(mohScores.length)} sub="Latest assessment each" />
            <Kpi label="Average overall score" value={fmtPct(mean(mohScores.map((m) => m.s.pct ?? 0)))} sub="Across eight thematic areas" />
            <Kpi label="Hand hygiene station coverage" value={fmtPct(mean(mohScores.map((m) => m.s.hhCoverage).filter((v): v is number => v !== null)))} sub="Functional stations per service point" />
            <Kpi label="Colour-coded bin coverage" value={fmtPct(mean(mohScores.map((m) => m.s.binCoverage).filter((v): v is number => v !== null)))} sub="Service points fully equipped" />
          </div>
          <div className="grid">
            <ChartCard title="Thematic area profile" subtitle={selectedMoh ? `${selectedMoh.rec.facility} against the regional average.` : 'Regional average. Choose a facility above or select a bar to compare.'} option={radar.option} table={radar.table} height={380} empty={mohEmpty}
              emptyText={`No IPC Facility Assessment Tool submissions in this period${forms.ipcMoh?.shortUrl ? `. Submit at ${forms.ipcMoh.shortUrl}` : ''}.`} />
            <ChartCard span={2} title="Overall score by facility" subtitle="Select a facility to compare it on the profile." option={mohRank.option} table={mohRank.table} height={Math.max(380, mohRank.height)} empty={mohEmpty}
              onClick={(p) => { const m = mohRank.sorted[p.dataIndex as number]; if (m?.rec.facility) setMohFacility(mohFacility === m.rec.facility ? 'All' : m.rec.facility); }} />
            <ChartCard span={2} title="PPE available at the time of assessment" subtitle="Item B8 of the tool, by facility." option={ppe.option} table={ppe.table} height={Math.max(240, 150 + mohScores.length * 32)} empty={mohEmpty} />
            <ChartCard title="Infectious waste disposal" subtitle="Methods in use (a facility may use several)." option={disposal.option} table={disposal.table} height={260} empty={mohEmpty} />
            <ChartCard span={3} title="Hand hygiene stations and colour-coded bins" subtitle="Share of service delivery points covered, by facility." option={coverage.option} table={coverage.table} height={coverage.height} empty={mohEmpty || coverage.empty} emptyText="Service point counts have not been recorded yet." />
          </div>
        </>
      )}

      <Drawer open={!!drawerData} title={drawer || ''} subtitle={drawerData ? `Basic IPC Assessment, latest on ${fmtDate(drawerData.latest.date)}` : ''} onClose={() => setDrawer(null)}>
        {drawerData && (
          <>
            <div className="drawer-kpis">
              <div><span className="kpi-label">Overall</span><RagPill rag={drawerData.s.overall} /></div>
              <div><span className="kpi-label">Core score</span><b>{fmtPct(drawerData.s.pct)}</b></div>
              <div><span className="kpi-label">Assessments</span><b>{drawerData.hist.length}</b></div>
            </div>
            <DataTable table={{ columns: ['Standard', 'Score', 'Applicable', 'RAG'], rows: drawerData.s.domains.map((d) => [d.name + (d.core ? '' : ' (not core)'), d.score, d.applicable, d.rag || 'Not rated']) }} />
            {drawerData.hist.length > 1 && <ChartCard title="Core score over time" option={drawerData.option} height={220} />}
          </>
        )}
      </Drawer>
    </div>
  );
}
