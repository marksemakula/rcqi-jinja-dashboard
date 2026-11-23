# CQI Dashboard: MoH - Busoga RCQI

Interactive dashboard for Continuous Quality Improvement (CQI) for MoH - Busoga RCQI, Busoga Region, Uganda. Data is collected through nine Google Forms that write to one master Google Sheet. The tools are open to every health facility in Busoga; the JRRH Public Health Department is the secretariat. A Google Apps Script data service publishes de-identified records to this Next.js dashboard, which is hosted on Vercel and deployed automatically from GitHub.

## Live links

- Home page and facility search: https://cqi.inzozi.co (also https://rcqi-jinja-dashboard.vercel.app)
- Dashboard: https://cqi.inzozi.co/dashboard
- Patient Safety Report (HSR): https://forms.gle/arH8fvVAzBxG61iS8
- 5S Monitoring and Evaluation: https://forms.gle/TAKi9NU6GHDZQFBPA
- Hand Hygiene Observation: https://forms.gle/hbudJaqDuijoZ9ob9
- Basic IPC Assessment: https://forms.gle/dWE4j4qkr7EZm4hV9
- IPC Facility Assessment Tool (MoH 2024): https://forms.gle/WmphR6YYddGHrzYq7
- HFQAP Facility Assessment: https://forms.gle/hFs5hkFzZS7WtD398
- QI Documentation Journal: https://forms.gle/BuXfJkM2TPcgZQ346
- QI Collaborative Register: https://forms.gle/EqexqGEKyTAv9TAt9
- Assisted Client Interview (ACI), Routine Client Satisfaction Feedback: https://forms.gle/VEx3fgn9fVwjUNCp6

The master sheet, the forms and the Apps Script project live in the "CQI Jinja RRH" folder of the CQI Google Drive account.

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
| QI collaboratives | Collaborative charter and status | QI Collaborative Register |
| Client satisfaction (RCSFI) | MoH Routine Client Satisfaction Feedback tool (Implementation Guidelines, Appendix 1) | Assisted Client Interview (ACI) |

## Home page

The address root opens a landing page. The left half is a field of Continuous Quality Improvement terms set in blocks whose text runs in two crossing directions (the vocabulary is in `lib/cqi-words.ts`, laid out by a seeded generator so it is identical on every load). The right half carries the Ministry of Health seal, MINISTRY OF HEALTH, Busoga Region and its secretariat (the JRRH Public Health Department), the programme title and a facility search over every DHIS2 facility in Busoga (`data/dhis2-busoga-facilities.json`): choose a district, then type part of a facility name. Open the dashboard goes to `/dashboard?district=<district>&facility=<facility>`; the dashboard keeps these two filters in its address, so a facility's view can be bookmarked. A facility with no entries yet is still applied and labelled as such. Older links to the root with a section, such as `/#journal/<project>` in notification emails or `/#forms`, are forwarded to the same section of `/dashboard`.

Every chart responds to the period, district, facility and department filters. The period can be a quick range (last 3, 6 or 12 months, this or last financial year, all time), a year with all months or one month, a financial year, or a range of months; the district list holds all 12 Busoga districts and the facility search every DHIS2 facility, with those that have entries marked. The period, district and facility are kept in the address. Charts support tooltips, cross-filtering (select a bar or cell), drill-down panels, chart or table views, CSV download and an expanded view.

## How the pieces fit together

```
Google Forms (9) --> CQI Jinja RRH Master Database (Google Sheet, one tab per form)
                          |
                          v
            Apps Script data service (apps-script/Code.gs, deployed as a web app)
                          |  POST {"token": ...}, de-identified JSON
                          v
            Vercel: /api/data (server side, holds the token) --> dashboard in the browser
```

Free text in the six assessment and reporting forms (descriptions, causes, countermeasures, names, phone numbers and comments) never leaves the Google Sheet. The QI Documentation Journal is the deliberate exception: its narrative fields (objective, indicator definitions, problem, changes tested, comments, notes and observed effects) are published so that each journal can be read online, and the form asks teams not to enter patient names, hospital numbers or other identifying details. Team member names and email addresses stay in the sheet; only the team size is published.

## First-time setup

1. Open [script.google.com](https://script.google.com), create a new project named "CQI Jinja RRH" and paste `apps-script/Code.gs` and `apps-script/appsscript.json` (enable "Show appsscript.json" in Project Settings).
2. Run `setupCQI`. Approve the permissions requested by Google. The script creates the "CQI Jinja RRH" Drive folder, the master sheet, the nine forms (with the Ministry of Health seal at the top), the HSR reference-number trigger and an API token. It also loads the DHIS2 facility list into a DHIS2 Facilities tab and creates the QI Notification List and QI Notification Log tabs.
3. Deploy the project: Deploy, New deployment, Web app, Execute as Me, Who has access Anyone. Copy the web app URL (it ends in `/exec`).
4. Run `showLinks` and copy the value after `RCQI_API_TOKEN=` from the execution log.
5. In Vercel, add the environment variables `RCQI_API_URL` (web app URL) and `RCQI_API_TOKEN` (token) for Production, then redeploy.
6. Run `logDiagnostics` at any time to confirm that every expected column is present in every tab.

To add a new form to an existing installation (as was done for the QI Documentation Journal), paste the updated `Code.gs`, run `addMissingForms`, then publish a new version of the existing deployment (Deploy, Manage deployments, edit, Version: New version). The web app URL does not change, so nothing needs updating on Vercel.

To add new questions to a live form (as was done for the journal's team email list), paste the updated `Code.gs` and run `upgradeForms`. It adds only the missing questions and sections in their proper places, reapplies the branching, puts the Ministry of Health seal on every form and creates the notification tabs. Existing questions and responses are never changed, and it stops without changing anything if it cannot recognise most of a form's questions. Then publish a new version of the deployment as above.

The review of 18 November 2026 was applied this way: paste the updated `Code.gs`, run `upgradeForms` (it adds the district and DHIS2 facility pages to the HSR and the collaborative question to the journal; run it again if the log says PAUSED), run `addMissingForms` (it creates the QI Collaborative Register, linked to the master sheet), apply the house theme to the new form (Ubuntu, army green), run `refreshCollaboratives` and `logDiagnostics`, then publish a new version of the deployment.

Until the first submission arrives the dashboard shows clearly labelled demonstration data. It switches to live data automatically.

## Day-to-day use

- Share the form links or print the QR codes from the Forms and Data page.
- Patient safety reports come from any facility in Busoga: the HSR asks for the district, then the facility from DHIS2, before the report itself. The QI Committee records follow-up on the HSR Reports tab using the columns Reference No., QI Review Status, QI Action Taken and Date Closed. The Patient Safety page shows reports by facility, and the district and facility filters apply to it.
- Do not rename tabs, reorder questions or edit question titles once data collection has started. Item codes such as `LD1.` or `ORG3.` must stay at the start of grid rows.
- QI teams register each improvement project once in the QI Documentation Journal form, then record every change tested and each month's numerator and denominator against it. The project list in the form refreshes automatically after each registration. The QI Journal page shows each project's journal with its annotated run chart and prints on A4 landscape.
- Facilities come from DHIS2: every facility form asks for the district first, then lists that district's facilities (all 599 open Busoga facilities, pulled from the DHIS2 test instance at hmis-tests.health.go.ug on 27 October 2026 and kept in `data/dhis2-busoga-facilities.json`). A facility missing from the list is typed on a "not in the list" page. On every submission the script fills the DHIS2 facility, DHIS2 district, DHIS2 UID and Facility match columns: a picked facility is recorded as selected, a typed name is matched to DHIS2 when the match is clear (abbreviations such as HC IV and small spelling slips are allowed, but a different level is not), and anything uncertain is marked "Please confirm" or "Not found". Coordinators resolve those by choosing the facility in the DHIS2 facility column (a drop-down of the DHIS2 Facilities tab); the dashboard always uses that column when it is filled, and the Forms and Data page lists the entries still to review.
- QI collaboratives: the collaborative lead or the secretariat registers each collaborative once in the QI Collaborative Register (aim, lead, secretariat, status, dates, main indicator with numerator, denominator and target, participating facilities and a charter link) and records each later change, such as approval, as an update. Facility teams join by choosing the collaborative when they register their project in the QI Documentation Journal; the list of collaboratives in both forms refreshes after every register entry. The QI Collaboratives page shows each collaborative with its facilities, its projects (each opening the project's journal) and their monthly results against the target, pooled across projects.
- RCSFI (Routine Client Satisfaction Feedback Initiative): the RCSFI page links to the Ministry's Client Satisfaction Feedback dashboard (sign-in required; the secretariat shares the login privately, never on this site) and to the Assisted Client Interview (ACI) form, with a QR code that opens the form (download or print it for facilities). The ACI form follows the MoH tool: the facility focal person interviews each client in private and records the service unit, age, sex, eight aspects of care rated Excellent to Poor, cost, unreceipted payments, information and consent, overall satisfaction and one area to improve. The page then shows the results by aspect, service unit, month, cost and facility; the suggestion for improvement stays in the master sheet. These interviews are held in the CQI master sheet, separately from the Ministry's dashboard. The addresses and the full name are set in `lib/rcsfi.ts`; only https addresses are used.
- To refresh the facility list after DHIS2 changes, pull it again into `data/dhis2-busoga-facilities.json`, push, and run `upgradeForms`: it reloads the DHIS2 Facilities tab (keeping rows added by hand) and refreshes every district list.
- QI Journal notifications: teams list their members' email addresses at registration and can add or remove addresses later with the "Update the team email list" option. After every journal entry (a new or updated registration, a change tested, monthly results or a team list update), each person on the project's team list and each active coordinator on the QI Notification List tab (Facility "All facilities" or the project's facility) receives one email with the Ministry of Health seal, the entry, the result against the target and a link that opens the project's journal. Every send is recorded on the QI Notification Log tab. A personal Gmail account can send to about 100 recipients a day; anything beyond that is logged as not sent. Run `sendTestNotification` to send yourself a sample.
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
