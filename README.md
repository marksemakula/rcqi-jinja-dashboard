# RCQI Dashboard: Jinja Regional Referral Hospital

Interactive dashboard for Regional Continuous Quality Improvement (RCQI) at Jinja Regional Referral Hospital (JRRH), Busoga Region, Uganda. Data is collected through six Google Forms that write to one master Google Sheet. A Google Apps Script data service publishes de-identified records to this Next.js dashboard, which is hosted on Vercel and deployed automatically from GitHub.

## Live links

- Dashboard: https://rcqi-jinja-dashboard.vercel.app
- Patient Safety Report (HSR): https://forms.gle/arH8fvVAzBxG61iS8
- 5S Monitoring and Evaluation: https://forms.gle/TAKi9NU6GHDZQFBPA
- Hand Hygiene Observation: https://forms.gle/hbudJaqDuijoZ9ob9
- Basic IPC Assessment: https://forms.gle/dWE4j4qkr7EZm4hV9
- IPC Facility Assessment Tool (MoH 2024): https://forms.gle/WmphR6YYddGHrzYq7
- HFQAP Facility Assessment: https://forms.gle/hFs5hkFzZS7WtD398

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

Every chart responds to the period, district, facility and department filters. Charts support tooltips, cross-filtering (select a bar or cell), drill-down panels, chart or table views, CSV download and an expanded view.

## How the pieces fit together

```
Google Forms (6) --> RCQI Jinja RRH Master Database (Google Sheet, one tab per form)
                          |
                          v
            Apps Script data service (apps-script/Code.gs, deployed as a web app)
                          |  POST {"token": ...}, de-identified JSON
                          v
            Vercel: /api/data (server side, holds the token) --> dashboard in the browser
```

Free text (descriptions, causes, countermeasures, names, phone numbers and comments) never leaves the Google Sheet.

## First-time setup

1. Open [script.google.com](https://script.google.com), create a new project named "RCQI Jinja RRH" and paste `apps-script/Code.gs` and `apps-script/appsscript.json` (enable "Show appsscript.json" in Project Settings).
2. Run `setupRCQI`. Approve the permissions requested by Google. The script creates the "RCQI Jinja RRH" Drive folder, the master sheet, the six forms (with the JRRH logo), the HSR reference-number trigger and an API token.
3. Deploy the project: Deploy, New deployment, Web app, Execute as Me, Who has access Anyone. Copy the web app URL (it ends in `/exec`).
4. Run `showLinks` and copy the value after `RCQI_API_TOKEN=` from the execution log.
5. In Vercel, add the environment variables `RCQI_API_URL` (web app URL) and `RCQI_API_TOKEN` (token) for Production, then redeploy.
6. Run `logDiagnostics` at any time to confirm that every expected column is present in every tab.

Until the first submission arrives the dashboard shows clearly labelled demonstration data. It switches to live data automatically.

## Day-to-day use

- Share the form links or print the QR codes from the Forms and Data page.
- The QI Committee records follow-up on the HSR Reports tab using the columns Reference No., QI Review Status, QI Action Taken and Date Closed.
- Do not rename tabs, reorder questions or edit question titles once data collection has started. Item codes such as `LD1.` or `ORG3.` must stay at the start of grid rows.
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
