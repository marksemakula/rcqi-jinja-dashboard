/**
 * Demonstration data. Clearly labelled in the interface and never mixed with live data.
 * At Mark's request the facilities are real Busoga facilities from the DHIS2 list; every figure is invented, and the
 * banner says so, so that no facility is misrepresented.
 */
import {
  BASIC_IPC_DOMAINS, FIVE_S_DOMAINS, HFQAP_M5_PARTS, HFQAP_MODULES, HFQAP_STANDARDS, HH_MOMENTS, HOSPITAL,
  HSR_OUTCOMES, HSR_STATUSES, HSR_TIMEFRAMES, MOH_IPC_AREAS, MOH_IPC_GRADED, MOH_IPC_REVERSE
} from './catalogue';
import { expectedFor, levelKey } from './scoring';
import { JOURNAL_ENTRY_TYPES, projectLabel } from './journal';
import type { Dataset, FiveSRec, HfqapRec, HhRec, HsrRec, IpcBasicRec, IpcMohRec, QijRec } from './types';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEPARTMENTS = ['Medical unit', 'Surgical unit', 'OBGY', 'Paediatrics', 'Casualty and OPD', 'Operating theatre',
  'Laboratory', 'ICU/HDU', 'NICU', 'Radiology', 'Pharmacy', 'Orthopaedic', 'Eye unit', 'Dental Unit'];

export const DEMO_FACILITIES = [
  { facility: HOSPITAL, district: 'Jinja City', level: 'Regional Referral Hospital', ownership: 'Government (Public)', p: 0.8 },
  { facility: 'Namwendwa Health Centre IV', district: 'Kamuli', level: 'HC IV', ownership: 'Government (Public)', p: 0.66 },
  { facility: 'Iganga General Hospital', district: 'Iganga', level: 'General Hospital', ownership: 'Government (Public)', p: 0.72 },
  { facility: 'Bukatube Health Centre III', district: 'Mayuge', level: 'HC III', ownership: 'Government (Public)', p: 0.55 },
  { facility: 'Iwemba Health Centre III', district: 'Bugiri', level: 'HC III', ownership: 'Government (Public)', p: 0.62 },
  { facility: 'Kiyunga Health Centre IV', district: 'Luuka', level: 'HC IV', ownership: 'Government (Public)', p: 0.58 },
  { facility: 'Kaiti Health Centre II', district: 'Namutumba', level: 'HC II', ownership: 'Government (Public)', p: 0.47 },
  { facility: 'St. Francis Budini Health Centre III', district: 'Kaliro', level: 'HC III', ownership: 'Private Not for Profit (PNFP or Faith based)', p: 0.6 }
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function buildDemo(today = new Date()): Dataset {
  const rnd = mulberry32(20261026);
  const pick = <T,>(arr: T[], weights?: number[]): T => {
    if (!weights) return arr[Math.floor(rnd() * arr.length)];
    const total = weights.reduce((a, b) => a + b, 0);
    let x = rnd() * total;
    for (let i = 0; i < arr.length; i++) { x -= weights[i]; if (x <= 0) return arr[i]; }
    return arr[arr.length - 1];
  };
  const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
  const monthDate = (m: number, day: number) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + m, day));
  const quarterDates = [1, 4, 7, 10].map((m) => monthDate(m, 12 + Math.floor(rnd() * 8)));

  /* HSR reports */
  const hsr: HsrRec[] = [];
  let seq = 0;
  for (let m = 0; m < 12; m++) {
    const n = 14 + Math.floor(rnd() * 10) + Math.round(m * 0.8);
    for (let i = 0; i < n; i++) {
      const date = monthDate(m, 1 + Math.floor(rnd() * 27));
      if (date > today) continue;
      seq += 1;
      const ageDays = (today.getTime() - date.getTime()) / 86400000;
      const status = ageDays > 75 ? pick(HSR_STATUSES, [0.05, 0.1, 0.05, 0.8]) : ageDays > 30 ? pick(HSR_STATUSES, [0.2, 0.3, 0.15, 0.35]) : pick(HSR_STATUSES, [0.6, 0.2, 0.1, 0.1]);
      const closed = status === 'Resolved' ? iso(new Date(date.getTime() + (5 + rnd() * 40) * 86400000)) : null;
      hsr.push({
        id: `hsr-demo-${seq}`, ts: date.toISOString(), date: iso(date), facility: HOSPITAL, district: 'Jinja City', items: {},
        cadre: pick(['Medical doctor', 'Nurse/Midwife', 'Pharmacist', 'Allied health professional', 'Intern/Trainee', 'Administrative staff', 'Engineer or workshop staff', 'Support staff'], [12, 40, 6, 9, 14, 4, 3, 6]),
        department: pick(DEPARTMENTS.concat(['Administration and management', 'Maintenance workshop', 'Laundry']), [10, 9, 12, 8, 11, 7, 5, 4, 5, 3, 6, 3, 2, 1, 2, 2, 1]),
        timeframe: pick(HSR_TIMEFRAMES, [55, 25, 20]),
        location: pick(['OPD', 'Casualty', 'Theatre', 'Delivery room', 'Ward', 'ICU', 'NICU', 'Pharmacy', 'Laboratory', 'Washroom', 'Corridor/Stairs/Hallway', 'Workshop', 'Others (inside)', 'Others (outside)'], [10, 9, 6, 9, 30, 4, 5, 6, 6, 4, 4, 1, 3, 2]),
        harmed: rnd() < 0.15 ? ['Patient(s)', 'Hospital staff'] : [pick(['Patient(s)', 'Hospital staff', 'Others (attendants or visitors)'], [70, 20, 10])],
        category: pick(['Medication', 'HCAI (Health care-associated infection)', 'Anaesthesia', 'Surgical/invasive care', 'Blood transfusion', 'Diagnostics', 'Handover process', 'Laboratory', 'Fall', 'Documentation', 'Other medical services', 'Other non-medical services', 'Physical environment'], [24, 8, 3, 6, 5, 5, 9, 7, 8, 12, 4, 3, 6]),
        eventType: pick(['Unsafe act', 'Unsafe equipment (condition of the equipment itself)', 'Unsafe condition (physical environment)', 'Unsafe use of equipment (issue of the user)'], [45, 18, 22, 15]),
        outcome: pick(HSR_OUTCOMES, [52, 33, 15]),
        ref: `HSR-${date.getUTCFullYear()}-${String(seq).padStart(4, '0')}`,
        status, closed
      });
    }
  }

  /* 5S assessments: JRRH departments, quarterly */
  const fives: FiveSRec[] = [];
  DEPARTMENTS.forEach((dept, di) => {
    const base = 0.35 + rnd() * 0.4;
    quarterDates.forEach((qd, q) => {
      if (qd > today) return;
      const items: Record<string, string> = {};
      for (const d of FIVE_S_DOMAINS) {
        const bias = d.code === 'ST' ? -0.12 : d.code === 'SH' ? 0.08 : d.code === 'LD' ? 0.04 : 0;
        for (const code of d.items) {
          const p = clamp(base + bias + q * 0.06 + (rnd() - 0.5) * 0.3);
          items[code] = code === 'SO3' ? (rnd() < p ? '3' : '0') : String(Math.round(p * 3));
        }
      }
      fives.push({ id: `fives-demo-${di}-${q}`, ts: qd.toISOString(), date: iso(new Date(qd.getTime() + di * 86400000)), facility: HOSPITAL, district: 'Jinja City', department: dept, items });
    });
  });

  /* Hand hygiene sessions: monthly by ward and cadre */
  const hh: HhRec[] = [];
  const wards = ['Medical unit', 'Surgical unit', 'OBGY', 'Paediatrics', 'Casualty and OPD', 'ICU/HDU', 'NICU', 'Operating theatre'];
  const cadres: [string, number][] = [['Nurse', 0.62], ['Midwife', 0.66], ['Medical doctor (internal medicine)', 0.48], ['Surgeon', 0.44], ['Auxiliary', 0.38], ['Technician', 0.5], ['Student nurse or midwife', 0.57]];
  let sid = 0;
  for (let m = 0; m < 12; m++) {
    const sessions = 6 + Math.floor(rnd() * 4);
    for (let s = 0; s < sessions; s++) {
      const date = monthDate(m, 2 + Math.floor(rnd() * 25));
      if (date > today) continue;
      sid += 1;
      const ward = pick(wards);
      const [profCat, base] = pick(cadres);
      const compliance = clamp(base + m * 0.015 + (rnd() - 0.5) * 0.2, 0.15, 0.97);
      const opp = 8 + Math.floor(rnd() * 18);
      const actions = Math.round(opp * compliance);
      const hr = Math.round(actions * (0.45 + rnd() * 0.35));
      const rec: HhRec = {
        id: `hh-demo-${sid}`, ts: date.toISOString(), date: iso(date), facility: HOSPITAL, district: 'Jinja City', items: {},
        ward, deptType: ward === 'Paediatrics' || ward === 'NICU' ? 'Paediatrics' : ward === 'OBGY' ? 'Obstetrics and gynaecology' : ward === 'ICU/HDU' ? 'Intensive care and resuscitation' : ward === 'Surgical unit' || ward === 'Operating theatre' ? 'Surgical' : ward === 'Casualty and OPD' ? 'Emergency unit' : 'Medical',
        period: m < 3 ? 'Baseline (pre-intervention)' : 'Routine monitoring', session: sid, duration: 15 + Math.floor(rnd() * 15),
        profCat, hcws: 1 + Math.floor(rnd() * 4), opp, hr, hw: actions - hr, gloves: Math.floor((opp - actions) * rnd() * 0.5)
      };
      const momentBase = [0.55, 0.62, 0.85, 0.82, 0.48];
      HH_MOMENTS.forEach((mo, i) => {
        const ind = Math.max(1, Math.round(opp * [0.3, 0.12, 0.15, 0.28, 0.25][i]));
        (rec as unknown as Record<string, unknown>)[`m${mo.id}i`] = ind;
        (rec as unknown as Record<string, unknown>)[`m${mo.id}a`] = Math.round(ind * clamp(momentBase[i] * (compliance / 0.6) + (rnd() - 0.5) * 0.15, 0, 1));
      });
      hh.push(rec);
    }
  }

  /* Basic IPC, MoH IPC and HFQAP: facility level, quarterly */
  const ipcBasic: IpcBasicRec[] = [];
  const ipcMoh: IpcMohRec[] = [];
  const hfqap: HfqapRec[] = [];
  DEMO_FACILITIES.forEach((f, fi) => {
    quarterDates.forEach((qd, q) => {
      if (qd > today) return;
      const date = iso(new Date(qd.getTime() + fi * 2 * 86400000));
      const p = clamp(f.p + q * 0.035);
      const items: Record<string, string> = {};
      for (const d of BASIC_IPC_DOMAINS) {
        const dp = clamp(p + (d.code === 'SCI' ? -0.15 : d.code === 'HAI' ? -0.2 : d.code === 'SHP' ? 0.12 : 0) + (rnd() - 0.5) * 0.15);
        for (let i = 1; i <= d.items; i++) {
          const code = d.code + i;
          if ((code === 'DEQ4' && !/Hospital/.test(f.level)) || (code === 'WST6' && f.level === 'HC II')) { items[code] = 'N/A'; continue; }
          const good = rnd() < dp;
          items[code] = d.reverse && d.reverse.includes(code) ? (good ? 'No' : 'Yes') : good ? 'Yes' : 'No';
        }
      }
      ipcBasic.push({ id: `ipcb-demo-${fi}-${q}`, ts: qd.toISOString(), date, facility: f.facility, district: f.district, items, facType: /Hospital/.test(f.level) ? 'Hospital' : 'Health centre', ownership: /Private/.test(f.ownership) ? 'Faith based' : 'Government', beds: /Regional/.test(f.level) ? 450 : /Hospital/.test(f.level) ? 120 : /IV/.test(f.level) ? 40 : 12 });

      if (q % 2 === 1) {
        const mi: Record<string, string> = {};
        for (const a of MOH_IPC_AREAS) {
          const ap = clamp(p + (a.id === 4 ? -0.3 : a.id === 5 ? -0.15 : a.id === 7 ? -0.1 : 0) + (rnd() - 0.5) * 0.15);
          for (const code of a.codes) {
            if (MOH_IPC_GRADED[code]) {
              const opts = Object.keys(MOH_IPC_GRADED[code]);
              mi[code] = rnd() < ap ? opts[0] : opts[1 + Math.floor(rnd() * (opts.length - 1))];
              if (code === 'P2' && mi[code].startsWith('N/A')) mi[code] = opts[1];
            } else if ((code.startsWith('G3') || code.startsWith('H1')) && /HC II|HC III/.test(f.level)) {
              mi[code] = 'N/A';
            } else {
              const good = rnd() < ap;
              mi[code] = MOH_IPC_REVERSE.has(code) ? (good ? 'No' : 'Yes') : good ? 'Yes' : 'No';
            }
          }
        }
        const sdp = /Regional/.test(f.level) ? 38 : /Hospital/.test(f.level) ? 22 : /IV/.test(f.level) ? 14 : 7;
        ipcMoh.push({
          id: `ipcm-demo-${fi}-${q}`, ts: qd.toISOString(), date, facility: f.facility, district: f.district, items: mi,
          level: f.level, ownership: f.ownership, assessType: fi === 0 ? 'Internal (self-assessment)' : 'External (support supervision)',
          hhRate: Math.round(40 + p * 45 + (rnd() - 0.5) * 10), sdp, hhStations: Math.round(sdp * clamp(p + 0.1)), sdpBins: Math.round(sdp * clamp(p + 0.05)),
          monitored: ['Hand hygiene', 'Environmental cleaning'].filter(() => rnd() < p + 0.2),
          disposal: ['Incinerator', 'Placenta pit', 'Burn pit', 'Transported offsite for disposal'].filter((_, i) => rnd() < [0.5, 0.7, 0.4, 0.3][i])
        });
      }

      const rec: HfqapRec = { id: `hfq-demo-${fi}-${q}`, ts: qd.toISOString(), date, facility: f.facility, district: f.district, items: {}, level: f.level, ownership: f.ownership, assessType: fi === 0 ? 'Internal (self-assessment)' : 'External (district or regional support supervision)', notMet: [] };
      const lk = levelKey(f.level);
      const priv = /Private/.test(f.ownership);
      const r = rec as unknown as Record<string, unknown>;
      for (const m of HFQAP_MODULES) {
        const mp = clamp(p + (m.id === 'm9' ? -0.12 : m.id === 'm4' ? 0.05 : m.id === 'm6' ? -0.08 : 0) + (rnd() - 0.5) * 0.18);
        if (m.id === 'm5') for (const part of HFQAP_M5_PARTS) r[part.field] = Math.round(part.expected[lk] * mp);
        else r[m.fields[0]] = Math.round(expectedFor(m.id, lk, priv) * mp);
      }
      for (const code of Object.keys(HFQAP_STANDARDS)) if (rnd() > p + 0.12) rec.notMet!.push(code);
      hfqap.push(rec);
    });
  });

  /* QI Documentation Journal: three illustrative improvement projects */
  const qij: QijRec[] = [];
  const DEMO_PROJECTS = [
    {
      facility: HOSPITAL, district: 'Jinja City', department: 'NICU', title: 'Reduce hypothermia on admission to NICU', teamSize: 6, startBack: 11, endAhead: 1, target: 80,
      objective: 'Increase the proportion of neonates admitted to NICU with a normal axillary temperature (36.5 to 37.5 C) from 40% to 80% within twelve months.',
      indicator: 'Neonates admitted to NICU with a normal temperature (%)', numeratorDef: 'Neonates with an axillary temperature of 36.5 to 37.5 C on admission', denominatorDef: 'All neonates admitted to NICU in the month',
      problem: 'Most neonates arrive in NICU cold after delivery and transfer from theatre and the labour suite. The MoH standard is to keep newborns warm from birth through the warm chain, but skin-to-skin contact, drying and covering are not done consistently and the transport cot is often cold.',
      start: 41, end: 79,
      changes: [
        [1, 'Skin-to-skin contact for stable babies in theatre and the delivery room', 'Yes', 'Midwives champion the practice on every shift.'],
        [3, 'Pre-warmed transport incubator kept ready at the labour suite', 'Yes', 'Fewer cold arrivals from the labour suite.'],
        [5, 'Admission temperature recorded within 30 minutes on a wall chart', 'Yes', 'Visible results motivated the team.'],
        [8, 'Hats and socks issued from NICU stock at every delivery', 'Too early to tell', null]
      ]
    },
    {
      facility: HOSPITAL, district: 'Jinja City', department: 'Casualty and OPD', title: 'Triage emergency patients within 15 minutes', teamSize: 5, startBack: 8, endAhead: 4, target: 90,
      objective: 'Ensure that 90% of patients arriving at Casualty are triaged within 15 minutes of arrival.',
      indicator: 'Patients triaged within 15 minutes of arrival (%)', numeratorDef: 'Sampled patients triaged within 15 minutes', denominatorDef: 'Patients sampled at Casualty in the month',
      problem: 'Patients wait at the Casualty entrance without assessment, especially at shift changes. The MoH emergency care standard expects immediate triage, but there is no dedicated triage nurse and the arrival time is not recorded.',
      start: 34, end: 71,
      changes: [
        [1, 'Dedicated triage nurse allocated on the duty roster for every shift', 'Yes', 'Largest single gain.'],
        [3, 'Arrival time stamped on every Casualty card at the gate', 'Yes', null],
        [5, 'Triage desk moved to the main entrance', 'No', 'Flow improved but staffing gaps at night remained.']
      ]
    },
    {
      facility: 'Namwendwa Health Centre IV', district: 'Kamuli', department: null, title: 'Early first antenatal visit', teamSize: 4, startBack: 10, endAhead: -1, target: 45,
      objective: 'Increase the share of first antenatal visits made in the first trimester from 20% to 45%.',
      indicator: 'First antenatal visits within the first trimester (%)', numeratorDef: 'ANC first visits before 12 weeks of gestation', denominatorDef: 'All ANC first visits in the month',
      problem: 'Most mothers start antenatal care late, after the first trimester, missing early screening and counselling recommended by the MoH guidelines. Village health teams do not routinely identify newly pregnant women.',
      start: 22, end: 43,
      changes: [
        [1, 'Village health teams refer newly pregnant women identified during home visits', 'Yes', null],
        [4, 'Radio talk show on early antenatal care', 'No', 'Few mothers reported hearing it.'],
        [6, 'Free pregnancy testing at outreach clinics', 'Yes', 'Mothers come early once the test is positive.']
      ]
    }
  ];
  DEMO_PROJECTS.forEach((p, pi) => {
    const startMonth = start.getUTCMonth() + (11 - p.startBack);
    const reg = new Date(Date.UTC(start.getUTCFullYear(), startMonth, 3));
    const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + p.endAhead, 28));
    const label = projectLabel({ facility: p.facility, projectTitle: p.title });
    qij.push({
      id: `qij-demo-${pi}-reg`, ts: reg.toISOString(), date: iso(reg), facility: p.facility, district: p.district, items: {},
      entryType: JOURNAL_ENTRY_TYPES[0], region: 'Busoga', department: p.department, projectTitle: p.title, teamSize: p.teamSize,
      startDate: iso(reg), endDate: iso(endDate), objective: p.objective, indicator: p.indicator, numeratorDef: p.numeratorDef,
      denominatorDef: p.denominatorDef, target: p.target, problem: p.problem
    });
    p.changes.forEach(([m, change, improved, comments], ci) => {
      const d = new Date(Date.UTC(start.getUTCFullYear(), startMonth + Number(m), 6 + ci));
      if (d > today) return;
      qij.push({ id: `qij-demo-${pi}-c${ci}`, ts: d.toISOString(), date: iso(d), items: {}, entryType: JOURNAL_ENTRY_TYPES[1], project: label,
        change: String(change), changeStart: iso(d), changeEnd: null, improved: String(improved), changeComments: comments ? String(comments) : null });
    });
    const span = Math.min(p.startBack + p.endAhead, p.startBack);
    for (let m = 0; m <= span; m++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), startMonth + m, 26));
      if (d > today) break;
      const denominator = 30 + Math.floor(rnd() * 25);
      const pct = clamp((p.start + ((p.end - p.start) * m) / Math.max(1, span) + (rnd() - 0.5) * 8) / 100);
      const notes = m === 0 ? 'Baseline month before any change was tested.' : m === span ? 'Latest month: gains sustained.' : null;
      const effects = m === Math.floor(span / 2) ? 'Staff report better teamwork and pride in the results shown at the monthly review.' : null;
      qij.push({ id: `qij-demo-${pi}-m${m}`, ts: d.toISOString(), date: iso(d), items: {}, entryType: JOURNAL_ENTRY_TYPES[2], project: label,
        month: iso(d), numerator: Math.round(denominator * pct), denominator, indicatorNotes: notes, effects });
    }
  });

  // DHIS2 matching as the data service reports it: nearly all picked from the lists, a few typed names matched, and two
  // that a coordinator still needs to review, so the Forms page shows how review works.
  const mapped = [...fives, ...hh, ...ipcBasic, ...ipcMoh, ...hfqap, ...qij.filter((r) => r.facility)];
  mapped.forEach((r) => { r.facilityMatch = 'selected'; r.facilityEntered = r.facility; });
  const typed: [typeof mapped[number] | undefined, string][] = [[ipcBasic[2], 'Iganga Hosp'], [hfqap[1], 'kiyunga hc 4']];
  typed.forEach(([r, entered]) => { if (r) { r.facilityMatch = 'matched'; r.facilityEntered = entered; } });
  if (hh[5]) Object.assign(hh[5], { facility: 'Bulidha HC', district: 'Bugiri', facilityMatch: 'review', facilityEntered: 'Bulidha HC', facilitySuggestion: 'Bulidha Health Centre III' });
  if (fives[3]) Object.assign(fives[3], { facility: 'Kyabirwa Surgical Centre', district: 'Jinja City', facilityMatch: 'unmatched', facilityEntered: 'Kyabirwa Surgical Centre' });

  return { hsr, fives, hh, ipcBasic, ipcMoh, hfqap, qij };
}
