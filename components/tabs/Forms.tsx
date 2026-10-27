'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { SectionTitle } from '../ui';
import type { TabProps } from './shared';
import { fmtDate } from '@/lib/format';
import { palette } from '@/lib/palette';
import { FORM_KEYS, type BaseRec, type FacilityMatch, type FormKey } from '@/lib/types';

const ABOUT: Record<FormKey, { name: string; who: string; when: string; text: string }> = {
  hsr: { name: 'Patient Safety Report (HSR)', who: 'Any member of staff', when: 'Whenever a near miss or adverse event occurs', text: 'Captures near misses and adverse events: cadre, department, date and timeframe, location, who was harmed, category, type of event and outcome. Descriptions stay in the master sheet.' },
  fives: { name: '5S Monitoring and Evaluation', who: 'Work Improvement Teams and QI focal persons', when: 'Quarterly per department or unit', text: 'Eighteen items scored 0 to 3 across Leadership, Sort, Set, Shine and Standardise (maximum 54).' },
  hh: { name: 'Hand Hygiene Observation', who: 'Trained IPC observers', when: 'At least monthly per ward', text: 'Totals from a WHO five moments observation session for one professional category, with optional moment breakdown.' },
  ipcBasic: { name: 'Basic IPC Assessment', who: 'IPC focal persons and supervisors', when: 'Quarterly per facility', text: 'Seventy-seven Yes or No items across twelve standards, each rated Red, Amber or Green, with an overall RAG rating.' },
  ipcMoh: { name: 'IPC Facility Assessment Tool (MoH 2024)', who: 'Facility IPC team or external assessors', when: 'Quarterly per facility', text: 'Eight thematic areas from IPC programme to built environment, including PPE availability, waste management and device processing.' },
  hfqap: { name: 'HFQAP Facility Assessment', who: 'District and regional supervisors', when: 'Quarterly or at each assessment round', text: 'Module scores from the MoH HFQAP Facility Assessment Tool and the standards not met, giving the overall percentage and star rating.' },
  qij: { name: 'QI Documentation Journal', who: 'QI teams and work improvement teams', when: 'Register once; record each change and every month', text: 'The online Documentation Journal for QI activities: project header and Part 1, the changes worksheet (Part 2), monthly numerator and denominator (Part 3) and the team email list for notifications.' }
};

const METHODS = [
  ['Patient safety', 'Counts of reports by structured field. QI review status is updated by the QI Committee in the master sheet; blank status counts as Pending review. Days to resolve run from the date of occurrence to the date closed.'],
  ['Hand hygiene', 'WHO basic compliance: hand hygiene actions (hand rub plus hand wash) divided by opportunities, with actions capped at opportunities. Moment ratios divide actions by indications.'],
  ['5S', 'Sum of eighteen items scored 0 to 3 (waste segregation scored 0 or 3). Domain and grand total percentages use the maximum marks of the sheet: 12, 9, 15, 9 and 9, total 54.'],
  ['Basic IPC', 'Yes scores 1 and No scores 0, except soap and water interruptions where No is the desirable answer. N/A items are excluded and thresholds scaled. Overall RAG is the colour with the highest count across the eleven core standards; ties take the lower colour. Linen is shown but excluded, as instructed in the tool.'],
  ['IPC tool (MoH 2024)', 'Compliant answers score 1. Graded answers score 1, 0.5 or 0 (for example, IPC on the management agenda at most meetings scores 0.5). PPE stockout items score in reverse. N/A items are excluded. Area and overall scores are the share of points available.'],
  ['QI Journal', 'Each month the indicator is the numerator divided by the denominator. If a month is entered twice, the later entry replaces the earlier one. Changes are numbered by start date and marked on the graph in the month they started. Baseline is the first month recorded. Team names and email addresses stay in the master sheet.'],
  ['Facility matching', 'Facility forms ask for the district first, then list that district\'s facilities from DHIS2 (all 599 open Busoga facilities, pulled from the DHIS2 test instance on 27 October 2026). A name typed on the "not in the list" page is matched to DHIS2 by its words, allowing for abbreviations such as HC IV and small spelling slips, and is accepted only when the match is clear and the stated level agrees. Anything uncertain is flagged for a coordinator, whose choice in the DHIS2 facility column of the master sheet always wins.'],
  ['Notifications', 'After every QI Journal entry, the project\'s team email list and the active RCQI coordinators on the QI Notification List tab receive one email each, with the entry, the result against the target and a link to the project journal. Every send is recorded on the QI Notification Log tab.'],
  ['HFQAP', 'Module percentage is the criteria met divided by the criteria expected for the facility level (HC II 211, HC III 249, HC IV 283, General Hospital and RRH 290; private facilities score health financing out of 7). Star 0 below 55%, Star 1 55 to 64%, Star 2 65 to 74%, Star 3 75 to 84%, Star 4 85 to 94%, Star 5 95% and above.']
];

function QrCard({ k, url, responses, last }: { k: FormKey; url: string; responses: number; last: string | null }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!url) { setQr(null); return; }
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: palette.ag900, light: palette.card } }).then(setQr).catch(() => setQr(null));
  }, [url]);
  const a = ABOUT[k];
  return (
    <article className="form-card">
      <div className="form-info">
        <h3>{a.name}</h3>
        <p>{a.text}</p>
        <dl>
          <div><dt>Completed by</dt><dd>{a.who}</dd></div>
          <div><dt>Frequency</dt><dd>{a.when}</dd></div>
          <div><dt>Responses</dt><dd>{responses}{last ? `, latest ${fmtDate(last)}` : ''}</dd></div>
        </dl>
        {url ? (
          <div className="form-actions">
            <a className="btn" href={url} target="_blank" rel="noopener noreferrer">Open form</a>
            <button type="button" className="btn ghost" onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }}>{copied ? 'Link copied' : 'Copy link'}</button>
            {qr && <a className="btn ghost" href={qr} download={`${k}-qr-code.png`}>Download QR</a>}
          </div>
        ) : (
          <p className="muted">The form link appears here once the dashboard is connected to the RCQI Google Sheet.</p>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div className="form-qr">{qr ? <img src={qr} alt={`QR code for the ${a.name} form`} width={150} height={150} /> : <div className="qr-placeholder">QR code</div>}</div>
    </article>
  );
}

const MATCH_LABEL: Record<FacilityMatch, string> = {
  selected: 'Picked from the DHIS2 list', matched: 'Typed name matched', confirmed: 'Confirmed by a coordinator',
  review: 'Needs review', unmatched: 'Not in the DHIS2 list'
};
const FACILITY_FORMS: FormKey[] = ['fives', 'hh', 'ipcBasic', 'ipcMoh', 'hfqap', 'qij'];

/** How each entry's facility was matched to DHIS2, and the entries a coordinator still needs to resolve. */
function FacilityReview({ all }: { all: TabProps['all'] }) {
  const rows = FACILITY_FORMS.flatMap((k) => (all[k] as BaseRec[]).filter((r) => r.facilityMatch).map((r) => ({ k, r })));
  const count = (m: FacilityMatch) => rows.filter((x) => x.r.facilityMatch === m).length;
  const needs = rows.filter((x) => x.r.facilityMatch === 'review' || x.r.facilityMatch === 'unmatched');
  return (
    <section className="card span-3 facility-review" aria-label="Facility matching with DHIS2">
      <header className="card-head"><div><h3>Facility matching with DHIS2</h3>
        <p className="card-sub">Every entry&apos;s facility is matched to the DHIS2 list for Busoga. Entries listed below need a coordinator to choose the right facility in the DHIS2 facility column of the master sheet.</p></div></header>
      <dl className="match-stats">
        {(Object.keys(MATCH_LABEL) as FacilityMatch[]).map((m) => <div key={m} className={`match-stat ${m}`}><dt>{MATCH_LABEL[m]}</dt><dd>{count(m).toLocaleString('en-GB')}</dd></div>)}
      </dl>
      {needs.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Form</th><th scope="col">Facility as entered</th><th scope="col">District</th><th scope="col">Closest DHIS2 facility</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {needs.map(({ k, r }) => (
                <tr key={r.id}><td>{ABOUT[k].name}</td><td>{r.facilityEntered || r.facility}</td><td>{r.district || 'Not given'}</td><td>{r.facilitySuggestion || 'None found'}</td><td>{MATCH_LABEL[r.facilityMatch as FacilityMatch]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="card-sub pad">All entries are matched to a DHIS2 facility.</p>}
    </section>
  );
}

export default function Forms({ all, forms, mode, generatedAt }: TabProps) {
  return (
    <div className="tab">
      <SectionTitle title="Forms and data" text="Every chart is fed by these Google Forms through the RCQI master Google Sheet. Share the links or print the QR codes for wards and supervision teams." />
      <div className="forms-grid">
        {FORM_KEYS.map((k) => {
          const rows = all[k] as { date?: string | null }[];
          const last = rows.map((r) => r.date || '').sort().pop() || null;
          const url = forms[k]?.shortUrl || forms[k]?.url || '';
          return <QrCard key={k} k={k} url={url} responses={mode === 'live' ? rows.length : forms[k]?.responses ?? 0} last={mode === 'live' ? last : null} />;
        })}
      </div>
      <FacilityReview all={all} />
      <section className="card span-3 method" aria-label="How the scores are calculated">
        <header className="card-head"><div><h3>How the scores are calculated</h3><p className="card-sub">Scoring follows the source tools held by the RCQI team at Jinja RRH.</p></div></header>
        <dl className="method-list">
          {METHODS.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
        </dl>
        <p className="card-sub pad">Data source: {mode === 'live' ? `RCQI master Google Sheet, refreshed ${generatedAt ? new Date(generatedAt).toLocaleString('en-GB', { timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short' }) : 'recently'} (East Africa Time).` : 'demonstration data. No live submissions are shown.'} Free text such as descriptions, names and phone numbers is never published to this dashboard.</p>
      </section>
    </div>
  );
}
