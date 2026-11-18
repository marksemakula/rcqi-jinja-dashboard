'use client';

import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { ChartCard, DataTable, EmptyState, Kpi, SectionTitle, type TableData } from '../ui';
import type { TabProps } from './shared';
import { axisTooltip, barSeries, categoryAxis, FONT, grid, hBarSeries, legend, lineSeries, pctAxis, tooltip, valueAxis, type Opt } from '@/lib/chart';
import { fmtInt, fmtPct, monthKey, monthRange, shortMonth } from '@/lib/format';
import { ordinal5, palette } from '@/lib/palette';
import { ACI_COST, ACI_SCALE, aciBy, aciSummary, aspectSummary } from '@/lib/rcsf';
import { RCSFI, safeUrl, type RcsfiConfig } from '@/lib/rcsfi';

const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
/** Darkest for Excellent, lightest for Poor. */
const SCALE_TONES = [ordinal5[4], ordinal5[2], ordinal5[1], ordinal5[0]];

/**
 * The RCSFI page: links to the RCSFI dashboard and the Assisted Client Interview (ACI) form with its QR code, then the
 * results of the interviews recorded through that form.
 */
export default function Rcsfi(props: TabProps & { config?: RcsfiConfig }) {
  const { data, forms } = props;
  const config = props.config || RCSFI;
  const dashboardUrl = safeUrl(config.dashboardUrl);
  // The ACI form: the address set in lib/rcsfi.ts, or else the live form's own link from the data service.
  const aciUrl = safeUrl(config.aciUrl) || safeUrl(forms.aci?.shortUrl) || safeUrl(forms.aci?.url);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!aciUrl) { setQr(null); return; }
    QRCode.toDataURL(aciUrl, { margin: 2, width: 720, errorCorrectionLevel: 'M', color: { dark: palette.ag900, light: palette.card } }).then(setQr).catch(() => setQr(null));
  }, [aciUrl]);
  const pending = 'The link will appear here once it has been added to the dashboard.';

  const rows = data.aci;
  const s = useMemo(() => aciSummary(rows), [rows]);
  const empty = !rows.length;
  const emptyText = 'No client interviews in this period. Interviews are recorded through the ACI form above.';

  const aspects = useMemo(() => {
    const list = aspectSummary(rows).slice().reverse();
    const option: Opt = {
      tooltip: axisTooltip({ axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => `${Math.round(v)}%` }),
      legend: legend(),
      grid: grid({ top: 32, right: 24 }),
      xAxis: pctAxis(),
      yAxis: categoryAxis(list.map((a) => a.label), { axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 190, overflow: 'truncate' } }),
      series: ACI_SCALE.map((sc, i) => hBarSeries({
        name: sc, stack: 'rating', barMaxWidth: 22,
        data: list.map((a) => (a.answered ? r1((a.counts[sc] / a.answered) * 100) : null)),
        itemStyle: { color: SCALE_TONES[i], borderRadius: 0, borderColor: palette.card, borderWidth: 1 }
      }))
    };
    const table: TableData = {
      columns: ['Aspect of care', ...ACI_SCALE, 'Answered', 'Good or Excellent (%)'],
      rows: aspectSummary(rows).map((a) => [a.label, ...ACI_SCALE.map((sc) => a.counts[sc]), a.answered, r1(a.goodPct)])
    };
    return { option, table };
  }, [rows]);

  const units = useMemo(() => {
    const list = aciBy(rows, (r) => r.serviceUnit).slice().reverse();
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { dataIndex: number }) => { const u = list[p.dataIndex]; return `<b>${u.name}</b><br/>${fmtPct(u.satisfiedPct)} satisfied, ${u.interviews} interview${u.interviews === 1 ? '' : 's'}`; } }),
      grid: grid({ right: 44 }),
      xAxis: pctAxis(),
      yAxis: categoryAxis(list.map((u) => u.name), { axisLabel: { color: palette.inkSoft, fontFamily: FONT, fontSize: 11, width: 150, overflow: 'truncate' } }),
      series: [hBarSeries({ data: list.map((u) => r1(u.satisfiedPct)), label: { show: true, position: 'right', formatter: (x: { value: number | null }) => (x.value === null ? '' : `${Math.round(x.value)}%`), color: palette.inkSoft, fontFamily: FONT, fontSize: 11 } })]
    };
    const table: TableData = { columns: ['Service unit', 'Interviews', 'Satisfied overall (%)', 'Unreceipted payments', 'Told and asked permission (%)'], rows: aciBy(rows, (r) => r.serviceUnit).map((u) => [u.name, u.interviews, r1(u.satisfiedPct), u.bribes, r1(u.informedPct)]) };
    return { option, table, height: Math.max(220, 50 + list.length * 30) };
  }, [rows]);

  const months = useMemo(() => {
    const keys = rows.map((r) => monthKey(r.date)).filter(Boolean).sort();
    const axis = keys.length ? monthRange(keys[0], keys[keys.length - 1]) : [];
    const by = new Map(aciBy(rows, (r) => monthKey(r.date)).map((m) => [m.name, m]));
    const option: Opt = {
      tooltip: axisTooltip({ valueFormatter: (v: number | null) => (v === null || v === undefined ? 'No interviews' : `${Math.round(v)}`) }),
      legend: legend(),
      grid: grid({ top: 36 }),
      xAxis: categoryAxis(axis.map(shortMonth)),
      yAxis: [pctAxis(), valueAxis({ minInterval: 1, position: 'right', splitLine: { show: false } })],
      series: [
        barSeries({ name: 'Interviews', yAxisIndex: 1, data: axis.map((k) => by.get(k)?.interviews ?? 0), itemStyle: { color: palette.ag150, borderRadius: 0 } }),
        lineSeries({ name: 'Satisfied overall (%)', data: axis.map((k) => r1(by.get(k)?.satisfiedPct ?? null)), connectNulls: true }),
        lineSeries({ name: 'Good or Excellent, all aspects (%)', data: axis.map((k) => r1(by.get(k)?.aspectsPct ?? null)), connectNulls: true, lineStyle: { width: 2, color: palette.khakiDark, type: 'dashed' }, itemStyle: { color: palette.khakiDark, borderColor: palette.card, borderWidth: 2 } })
      ]
    };
    const table: TableData = { columns: ['Month', 'Interviews', 'Satisfied overall (%)', 'Good or Excellent, all aspects (%)', 'Unreceipted payments'], rows: axis.map((k) => { const m = by.get(k); return [shortMonth(k), m?.interviews ?? 0, r1(m?.satisfiedPct ?? null), r1(m?.aspectsPct ?? null), m?.bribes ?? 0]; }) };
    return { option, table, empty: !axis.length };
  }, [rows]);

  const cost = useMemo(() => {
    const counts = ACI_COST.map((c) => rows.filter((r) => r.cost === c).length);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const option: Opt = {
      tooltip: tooltip({ formatter: (p: { name: string; value: number }) => `<b>${p.name}</b><br/>${p.value} client${p.value === 1 ? '' : 's'} (${Math.round((p.value / total) * 100)}%)` }),
      grid: grid(),
      xAxis: categoryAxis(ACI_COST, { axisLabel: { color: palette.inkMuted, fontFamily: FONT, fontSize: 11, interval: 0 } }),
      yAxis: valueAxis({ minInterval: 1 }),
      series: [barSeries({ data: counts.map((v, i) => ({ value: v, itemStyle: { color: [ordinal5[1], ordinal5[2], ordinal5[4]][i], borderRadius: 0 } })), label: { show: true, position: 'top', color: palette.inkSoft, fontFamily: FONT } })]
    };
    return { option, table: { columns: ['Cost of the services', 'Clients', 'Share (%)'], rows: ACI_COST.map((c, i) => [c, counts[i], Math.round((counts[i] / total) * 1000) / 10]) } };
  }, [rows]);

  const facilities: TableData = useMemo(() => ({
    columns: ['Facility', 'District', 'Interviews', 'Satisfied overall (%)', 'Good or Excellent, all aspects (%)', 'Unreceipted payments', 'Told and asked permission (%)'],
    rows: aciBy(rows, (r) => r.facility).map((f) => [f.name, rows.find((r) => r.facility === f.name)?.district || null, f.interviews, r1(f.satisfiedPct), r1(f.aspectsPct), f.bribes, r1(f.informedPct)])
  }), [rows]);

  return (
    <div className="tab rcsfi-tab">
      <div className="print-hide">
        <SectionTitle title={config.short} text={`${config.fullName ? `${config.fullName}. ` : ''}The RCSFI dashboard and the Assisted Client Interview (ACI) form for health facilities across Busoga. Scan the QR code with a phone camera to open the ACI form, or print it for the facility.`} />
      </div>
      <div className="rcsfi-grid">
        <section className="card rcsfi-card print-hide" aria-label="RCSFI dashboard">
          <header className="card-head"><div><h3>RCSFI dashboard</h3><p className="card-sub">{config.dashboardAbout || 'Results from the RCSFI client interviews.'}</p></div></header>
          <div className="rcsfi-body">
            {dashboardUrl ? (
              <>
                <div className="form-actions"><a className="btn rcsfi-dashboard" href={dashboardUrl} target="_blank" rel="noopener noreferrer">Open the RCSFI dashboard</a></div>
                {config.signIn && <p className="muted rcsfi-signin">{config.signIn}</p>}
              </>
            ) : <p className="muted rcsfi-pending">{pending}</p>}
          </div>
        </section>
        <section className="card rcsfi-card rcsfi-aci" aria-label="Assisted Client Interview (ACI) form">
          <header className="card-head"><div><h3>Assisted Client Interview (ACI) form</h3><p className="card-sub">The Ministry of Health client feedback tool, asked of each client in private by the facility focal person.</p></div></header>
          <div className="rcsfi-body">
            <div className="rcsfi-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr ? <img src={qr} alt="QR code that opens the Assisted Client Interview (ACI) form" width={240} height={240} /> : <div className="qr-placeholder">QR code</div>}
              <p className="rcsfi-qr-caption">Scan to open the ACI form</p>
            </div>
            {aciUrl ? (
              <div className="form-actions print-hide">
                <a className="btn rcsfi-aci-link" href={aciUrl} target="_blank" rel="noopener noreferrer">Open the ACI form</a>
                <button type="button" className="btn ghost" onClick={() => { navigator.clipboard?.writeText(aciUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }}>{copied ? 'Link copied' : 'Copy link'}</button>
                {qr && <a className="btn ghost" href={qr} download="rcsfi-aci-qr-code.png">Download QR</a>}
                {qr && <button type="button" className="btn ghost" onClick={() => window.print()}>Print QR</button>}
              </div>
            ) : <p className="muted rcsfi-pending print-hide">{pending}</p>}
          </div>
        </section>
      </div>

      <div className="print-hide rcsfi-results">
        <SectionTitle title="Client feedback from the ACI form" text="Interviews recorded through the ACI form above, held in the CQI master sheet. They are separate from the records on the RCSFI dashboard. The period, district and facility filters apply. Clients' suggestions for improvement stay in the master sheet for the facility teams." />
        <div className="kpis">
          <Kpi label="Interviews" value={fmtInt(s.interviews)} sub="In the selected period" />
          <Kpi label="Satisfied overall" value={fmtPct(s.satisfiedPct)} sub="Answered Yes to Q4" />
          <Kpi label="Good or Excellent" value={fmtPct(s.aspectsPct)} sub="Average across the eight aspects of care" />
          <Kpi label="Unreceipted payments" value={fmtInt(s.bribes)} tone={s.bribes ? 'warn' : 'good'} toneLabel={s.bribes ? 'Follow up each one' : 'None reported'} />
          <Kpi label="Told and asked permission" value={fmtPct(s.informedPct)} sub="Answered Yes to Q3" />
        </div>
        <div className="grid">
          <ChartCard span={2} title="Rating of each aspect of care" subtitle="Darker to lighter: Excellent, Good, Fair, Poor. Share of clients answering." option={aspects.option} table={aspects.table} empty={empty} emptyText={emptyText} height={340} />
          <ChartCard title="Satisfied overall by service unit" subtitle="Share answering Yes to Q4." option={units.option} table={units.table} empty={empty} emptyText={emptyText} height={units.height} />
          <ChartCard span={2} title="Client satisfaction by month" subtitle="Bars: interviews. Solid line: satisfied overall. Dashed line: Good or Excellent across the aspects." option={months.option} table={months.table} empty={empty || months.empty} emptyText={emptyText} height={320} />
          <ChartCard title="Cost of the services" subtitle="As the client described it (Q1i)." option={cost.option} table={cost.table} empty={empty} emptyText={emptyText} height={260} />
          <section className="card span-3" aria-label="Client feedback by facility">
            <header className="card-head"><div><h3>Client feedback by facility</h3><p className="card-sub">Facilities with interviews in the selected period, most interviews first.</p></div></header>
            {facilities.rows.length ? <DataTable table={facilities} /> : <EmptyState text={emptyText} />}
          </section>
        </div>
      </div>
    </div>
  );
}
