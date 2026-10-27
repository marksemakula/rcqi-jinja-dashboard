# RCQI Dashboard: Jinja Regional Referral Hospital

Interactive dashboard for Regional Continuous Quality Improvement (RCQI) at Jinja Regional Referral Hospital (JRRH), Busoga Region, Uganda. Data is collected through seven Google Forms that write to one master Google Sheet. A Google Apps Script data service publishes de-identified records to this Next.js dashboard, which is hosted on Vercel and deployed automatically from GitHub.

## Live links

- Dashboard: https://rcqi-jinja-dashboard.vercel.app
- Patient Safety Report (HSR): https://forms.gle/arH8fvVAzBxG61iS8
- 5S Monitoring and Evaluation: https://forms.gle/TAKi9NU6GHDZQFBPA
- Hand Hygiene Observation: https://forms.gle/hbudJaqDuijoZ9ob9
- Basic IPC Assessment: https://forms.gle/dWE4j4qkr7EZm4hV9
- IPC Facility Assessment Tool (MoH 2024): https://forms.gle/WmphR6YYddGHrzYq7
- HFQAP Facility Assessment: https://forms.gle/hFs5hkFzZS7WtD398
- QI Documentation Journal: https://forms.gle/BuXfJkM2TPcgZQ346

The master sheet, the forms and the Apps Script project live in the "RCQI Jinja RRH" folder of the RCQI Google Drive account.

## What the dashboard covers

| Area | Source tool | Google Form |
| --- | --- | --- |
| Patient safety | Health Facility Patient Safety Report (HSR) | Patient Safety Report (HSR) |
| Hand hygiene | WHO Hand Hygiene Observation Form | Hand Hygiene Observation (WHO Five Moments) |
| Infection prevention and control | Basic IPC Assessment (RAG) | Basic IPC Assessment |
| Infection prevention and control | MoH IPC Facility Assessment Tool, May 2024 | IPC Facility Assessment Tool |
| 5S-CQI-TQM | 5S Monitoring and Evaluation Sheet | 5S Monitoring and Evaluation |
| Quality of care | MoH HFQAP Facility Assessment Tool | HFQAP Facility Assessment |
| Quality improvement projects | Documentation Journal for QI activities | QI Documentation Journal |

Every chart responds to the period, district, facility and department filters. Charts support tooltips, cross-filtering (select a bar or cell), drill-down panels, chart or table views, CSV download and an expanded view.

## How the pieces fit together

```
Google Forms (7) --> RCQI Jinja RRH Master Database (Google Sheet, one tab per form)
                          |
                          v
            Apps Script data service (apps-script/Code.gs, deployed as a web app)
                          |  POST {"token": ...}, de-identified JSON
                          v
            Vercel: /api/data (server side, holds the token) --> dashboard in the browser
```

Free text in the six assessment and reporting forms (descriptions, causes, countermeasures, names, phone numbers and comments) never leaves the Google Sheet. The QI Documentation Journal is the deliberate exception: its narrative fields (objective, indicator definitions, problem, changes tested, comments, notes and observed effects) are published so that each journal can be read online, and the form asks teams not to enter patient names, hospital numbers or other identifying details. Team member names and email addresses stay in the sheet; only the team size is published.

## First-time setup

1. Open [script.google.com](https://script.google.com), create a new project named "RCQI Jinja RRH" and paste `apps-script/Code.gs` and `apps-script/appsscript.json` (enable "Show appsscript.json" in Project Settings).
2. Run `setupRCQI`. Approve the permissions requested by Google. The script creates the "RCQI Jinja RRH" Drive folder, the master sheet, the seven forms (with the Uganda coat of arms at the top), the HSR reference-number trigger and an API token. It also loads the DHIS2 facility list into a DHIS2 Facilities tab and creates the QI Notification List and QI Notification Log tabs.
3. Deploy the project: Deploy, New deployment, Web app, Execute as Me, Who has access Anyone. Copy the web app URL (it ends in `/exec`).
4. Run `showLinks` and copy the value after `RCQI_API_TOKEN=` from the execution log.
5. In Vercel, add the environment variables `RCQI_API_URL` (web app URL) and `RCQI_API_TOKEN` (token) for Production, then redeploy.
6. Run `logDiagnostics` at any time to confirm that every expected column is present in every tab.

To add a new form to an existing installation (as was done for the QI Documentation Journal), paste the updated `Code.gs`, run `addMissingForms`, then publish a new version of the existing deployment (Deploy, Manage deployments, edit, Version: New version). The web app URL does not change, so nothing needs updating on Vercel.

To add new questions to a live form (as was done for the journal's team email list), paste the updated `Code.gs` and run `upgradeForms`. It adds only the missing questions and sections in their proper places, reapplies the branching, puts the coat of arms on every form and creates the notification tabs. Existing questions and responses are never changed, and it stops without changing anything if it cannot recognise most of a form's questions. Then publish a new version of the deployment as above.

Until the first submission arrives the dashboard shows clearly labelled demonstration data. It switches to live data automatically.

## Day-to-day use

- Share the form links or print the QR codes from the Forms and Data page.
- The QI Committee records follow-up on the HSR Reports tab using the columns Reference No., QI Review Status, QI Action Taken and Date Closed.
- Do not rename tabs, reorder questions or edit question titles once data collection has started. Item codes such as `LD1.` or `ORG3.` must stay at the start of grid rows.
- QI teams register each improvement project once in the QI Documentation Journal form, then record every change tested and each month's numerator and denominator against it. The project list in the form refreshes automatically after each registration. The QI Journal page shows each project's journal with its annotated run chart and prints on A4 landscape.
- Facilities come from DHIS2: every facility form asks for the district first, then lists that district's facilities (all 599 open Busoga facilities, pulled from the DHIS2 test instance at hmis-tests.health.go.ug on 27 October 2026 and kept in `data/dhis2-busoga-facilities.json`). A facility missing from the list is typed on a "not in the list" page. On every submission the script fills the DHIS2 facility, DHIS2 district, DHIS2 UID and Facility match columns: a picked facility is recorded as selected, a typed name is matched to DHIS2 when the match is clear (abbreviations such as HC IV and small spelling slips are allowed, but a different level is not), and anything uncertain is marked "Please confirm" or "Not found". Coordinators resolve those by choosing the facility in the DHIS2 facility column (a drop-down of the DHIS2 Facilities tab); the dashboard always uses that column when it is filled, and the Forms and Data page lists the entries still to review.
- To refresh the facility list after DHIS2 changes, pull it again into `data/dhis2-busoga-facilities.json`, push, and run `upgradeForms`: it reloads the DHIS2 Facilities tab (keeping rows added by hand) and refreshes every district list.
- QI Journal notifications: teams list their members' email addresses at registration and can add or remove addresses later with the "Update the team email list" option. After every journal entry (a new or updated registration, a change tested, monthly results or a team list update), each person on the project's team list and each active coordinator on the QI Notification List tab (Facility "All facilities" or the project's facility) receives one email with the coat of arms, the entry, the result against the target and a link that opens the project's journal. Every send is recorded on the QI Notification Log tab. A personal Gmail account can send to about 100 recipients a day; anything beyond that is logged as not sent. Run `sendTestNotification` to send yourself a sample.
- To rotate the API token, run `rotateApiToken` and update `RCQI_API_TOKEN` on Vercel.

## Scoring rules

- **Hand hygiene:** actions (hand rub plus hand wash) divided by opportunities, with actions capped at opportunities. Moment ratios divide actions by indications.
- **5S:** eighteen items scored 0 to 3 (waste segregation 0 or 3); maxima 12, 9, 15, 9 and 9, total 54.
- **Basic IPC:** Yes 1, No 0; soap and water interruptions (HHY4, HHY5) are scored in reverse; N/A is excluded and thresholds are scaled. Overall RAG is the colour with the highest count across the eleven core standards; ties take the lower colour. Linen is excluded from the overall rating, as instructed in the tool.
- **IPC tool (MoH 2024):** compliant answers 1; graded answers 1, 0.5 or 0; PPE stockout items in reverse; N/A excluded.
- **HFQAP:** criteria met divided by criteria expected for the level (HC II 211, HC III 249, HC IV 283, General Hospital and RRH 290; private facilities score health financing out of 7). Star 0 below 55%, Star 1 55 to 64%, Star 2 65 to 74%, Star 3 75 to 84%, Star 4 85 to 94%, Star 5 95% and above.

## Local development

```bash
npm install
cp .env.example .env.local   # add the web app URL and token, or leave blank for demonstration data
npm run dev
```

Requires Node.js 18.18 or later. `npm run build` produces the production build that Vercel runs.

## Design

Army green palette (`lib/palette.ts`, mirrored in `app/globals.css`), Ubuntu for all text (dashboard, charts and the master sheet) and square corners on every box and chart mark. Red and amber appear only as reserved RAG status colours and are always paired with an icon and a label.
