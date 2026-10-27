/**
 * RCQI Jinja RRH: Google Forms, master Google Sheet and dashboard data service.
 *
 * Regional Continuous Quality Improvement (RCQI), Jinja Regional Referral Hospital.
 *
 * How to use
 *   1. Run setupRCQI() once. It creates a Drive folder, the master spreadsheet,
 *      seven Google Forms linked to their own tabs, the HSR reference trigger and
 *      an API token, loads the DHIS2 facility list and the notification tabs. On an existing installation,
 *      run addMissingForms() to add a new form or upgradeForms() to add new
 *      questions to a live form, then publish a new version of the web app.
 *   2. Deploy this project as a web app (Execute as: Me, Who has access: Anyone).
 *   3. Give the web app URL and the token (run showLinks() to print them) to the
 *      dashboard as RCQI_API_URL and RCQI_API_TOKEN. The dashboard reads data by
 *      POSTing {"token": "..."}; run logDiagnostics() to check the column mapping.
 *
 * Please do not rename the response tabs or edit question titles once data
 * collection has started: the data service maps columns by their titles and
 * item codes (for example "LD1." or "ORG3.").
 */

var RCQI = {
  folderName: 'RCQI Jinja RRH',
  sheetName: 'RCQI Jinja RRH Master Database',
  hospital: 'Jinja Regional Referral Hospital',
  timezone: 'Africa/Kampala',
  schema: 1,
  headerColour: '#3B4420',
  headerText: '#F4F5EC',
  font: 'Ubuntu',
  // Coat of arms of the Republic of Uganda (transparent background) from the public GitHub repository.
  // Shown at the top of every form and in every notification email.
  logoUrl: 'https://raw.githubusercontent.com/marksemakula/rcqi-jinja-dashboard/main/public/uganda-coat-of-arms.png',
  // A 144 px copy for email (shown at 48 px), so each notification stays small on mobile data.
  emailLogoUrl: 'https://raw.githubusercontent.com/marksemakula/rcqi-jinja-dashboard/main/public/uganda-coat-of-arms-email.png',
  logoWidth: 130,
  dashboardUrl: 'https://rcqi-jinja-dashboard.vercel.app',
  mailName: 'RCQI Jinja RRH',
  notifyTab: 'QI Notification List',
  notifyLogTab: 'QI Notification Log',
  // Busoga facility list pulled from the DHIS2 test instance (hmis-tests.health.go.ug), kept in the public repository.
  facilitiesUrl: 'https://raw.githubusercontent.com/marksemakula/rcqi-jinja-dashboard/main/data/dhis2-busoga-facilities.json',
  facilitiesTab: 'DHIS2 Facilities'
};

var LISTS = {
  districts: ['Bugiri', 'Bugweri', 'Buyende', 'Iganga', 'Jinja', 'Jinja City', 'Kaliro', 'Kamuli', 'Luuka',
    'Mayuge', 'Namayingo', 'Namutumba', 'Other (outside Busoga)'],
  levels: ['HC II', 'HC III', 'HC IV', 'General Hospital', 'Regional Referral Hospital'],
  ownership: ['Government (Public)', 'Private Not for Profit (PNFP or Faith based)', 'Private for Profit (PFP)'],
  departments: ['Administration and management', 'Surgical unit', 'Medical unit', 'OBGY', 'Paediatrics',
    'Casualty and OPD', 'Operating theatre', 'Laboratory', 'ICU/HDU', 'NICU', 'Radiology',
    'Occupational Therapy/Physiotherapy', 'Orthopaedic', 'Dental Unit', 'Endoscopy/Colonoscopy', 'Eye unit',
    'Mental unit', 'Pharmacy', 'Store', 'Maintenance workshop', 'Laundry', 'Kitchen/Canteen'],
  yn: ['Yes', 'No'],
  ynna: ['Yes', 'No', 'N/A'],
  score03: ['0', '1', '2', '3'],
  hsrStatus: ['Pending review', 'Follow up required by the department', 'Support required by the QI committee',
    'Resolved']
};

/* ------------------------------------------------------------------------ */
/* Form definitions                                                          */
/* ------------------------------------------------------------------------ */

function rows_(list) {
  return list.map(function (r) { return { code: r[0], text: r[1] }; });
}

var NOT_LISTED_ = 'My facility is not in this list';
var BUSOGA_ = LISTS.districts.filter(function (d) { return !/^Other/.test(d); });

function slug_(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_'); }
function districtLabel_(d) { return d === 'Jinja City' ? d : d + ' District'; }

/** Page 1 of every facility form: the district, which sends the respondent to that district's DHIS2 facility list. */
function facilityBlock_() {
  return [
    { type: 'dropdown', key: 'district', title: 'District', required: true, options: LISTS.districts,
      routes: LISTS.districts.map(function (d) { return /^Other/.test(d) ? 'sec_fac_other' : 'sec_fac_' + slug_(d); }),
      help: 'Choose the district or city first. The next page lists its health facilities from DHIS2.' }
  ];
}

/**
 * One page per Busoga district listing its DHIS2 facilities (filled from the DHIS2 Facilities tab), then a page for a
 * facility that is not listed. Every listed facility continues to the section next; "not listed" goes to the typed name.
 */
function facilityPages_(next) {
  var items = [];
  BUSOGA_.forEach(function (d) {
    items.push({ type: 'section', key: 'sec_fac_' + slug_(d), title: 'Health facility: ' + districtLabel_(d),
      help: 'Health facilities registered in DHIS2 for ' + districtLabel_(d) + '.' });
    items.push({ type: 'dropdown', key: 'fac_' + slug_(d), as: 'facilityPick', facilities: d, required: true,
      title: 'Health facility in ' + districtLabel_(d), options: [NOT_LISTED_], routeAll: next, routeOther: 'sec_fac_other',
      help: 'Choose the facility. If it is not in the list, choose "' + NOT_LISTED_ + '" and type its name on the next page.' });
  });
  items.push({ type: 'section', key: 'sec_fac_other', title: 'Health facility not in the list',
    help: 'For a facility outside Busoga or one missing from the DHIS2 list. The RCQI team matches the name to DHIS2.' });
  items.push({ type: 'text', key: 'facilityTyped', exportField: true, title: 'Name of the health facility', required: true,
    help: 'Type the full official name, for example Nankoma Health Centre IV.' });
  return items;
}

/** Inserts the facility pages after page 1 (before the first section), continuing to that section. */
function withFacilityPages_(items) {
  var at = -1;
  for (var i = 0; i < items.length; i++) { if (items[i].type === 'section') { at = i; break; } }
  if (at < 0) return items.concat(facilityPages_('SUBMIT'));
  return items.slice(0, at).concat(facilityPages_(items[at].key || items[at].title), items.slice(at));
}

/** The typed facility question the district-first lists replace. Kept readable for older rows; removed from forms with no responses. */
var RETIRED_FACILITY_ = [{ title: 'Health facility', type: 'mc', as: 'facilityLegacy' }];

/** Columns the submit trigger fills on each facility tab; a coordinator corrects a facility by choosing it in DHIS2 facility. */
var FACILITY_EXTRAS_ = [
  { header: 'DHIS2 facility', key: 'dhis2Facility', exportField: false },
  { header: 'DHIS2 district', key: 'dhis2District', exportField: false },
  { header: 'DHIS2 UID', key: 'dhis2Uid', exportField: false },
  { header: 'Facility match', key: 'facilityMatchNote', exportField: false }
];

var FORM_DEFS = [
  /* 1. Patient safety report ------------------------------------------- */
  {
    key: 'hsr',
    tab: 'HSR Reports',
    short: 'Patient Safety Report (HSR)',
    title: 'Patient Safety Report (HSR): Jinja Regional Referral Hospital',
    description: 'Safety is everyone\'s responsibility. Use this form to report any near miss or adverse event that you ' +
      'observed or were involved in. Reports are reviewed by the Quality Improvement Committee to strengthen systems, ' +
      'not to apportion blame. Please do not enter patient names, hospital numbers or the names of colleagues.',
    confirmation: 'Thank you. Your report has been received by the Quality Improvement Committee. Safety is everyone\'s responsibility.',
    extras: [
      { header: 'Reference No.', key: 'ref' },
      { header: 'QI Review Status', key: 'status' },
      { header: 'QI Action Taken', key: 'action', exportField: false },
      { header: 'Date Closed', key: 'closed', kind: 'date' }
    ],
    items: [
      { type: 'mc', key: 'cadre', title: 'Your cadre', required: true, help: 'Please select one.',
        options: ['Medical doctor', 'Nurse/Midwife', 'Pharmacist', 'Allied health professional', 'Intern/Trainee',
          'Administrative staff', 'Engineer or workshop staff', 'Support staff'] },
      { type: 'mc', key: 'department', title: 'Your department/unit', required: true,
        help: 'Please select the department or unit to which you belong.', options: LISTS.departments, other: true },
      { type: 'date', key: 'date', title: 'Date of occurrence', required: true },
      { type: 'dropdown', key: 'timeframe', title: 'Timeframe of occurrence', required: true,
        help: 'Please select the timeframe in which it happened or in which you observed it.',
        options: ['Day', 'Evening', 'Night'] },
      { type: 'dropdown', key: 'location', title: 'Location of occurrence', required: true,
        options: ['OPD', 'Casualty', 'Theatre', 'Delivery room', 'Ward', 'ICU', 'NICU', 'Pharmacy', 'Laboratory',
          'Washroom', 'Corridor/Stairs/Hallway', 'Workshop', 'Others (inside)', 'Others (outside)'] },
      { type: 'checkbox', key: 'harmed', title: 'Who was harmed or about to be harmed?', required: true,
        help: 'Select all that apply.', options: ['Patient(s)', 'Hospital staff', 'Others (attendants or visitors)'] },
      { type: 'mc', key: 'category', title: 'Category that the event is related to', required: true,
        help: 'Please select one.',
        options: ['Medication', 'HCAI (Health care-associated infection)', 'Anaesthesia', 'Surgical/invasive care',
          'Blood transfusion', 'Diagnostics', 'Handover process', 'Laboratory', 'Fall', 'Documentation',
          'Other medical services', 'Other non-medical services', 'Physical environment'] },
      { type: 'mc', key: 'eventType', title: 'Type of near miss or adverse event', required: true,
        help: 'Please tick the single most applicable option.',
        options: ['Unsafe act', 'Unsafe equipment (condition of the equipment itself)',
          'Unsafe condition (physical environment)', 'Unsafe use of equipment (issue of the user)'] },
      { type: 'mc', key: 'outcome', title: 'Did the event reach the patient or person?', required: true,
        options: ['Near miss (did not reach the patient or person)', 'Adverse event without harm',
          'Adverse event with harm'] },
      { type: 'paragraph', key: 'description', title: 'Description of the near miss or incident', required: true,
        help: 'Please describe in detail what happened or what you observed. Do not include names or hospital numbers.' },
      { type: 'paragraph', key: 'causes', title: 'Possible causes', required: true,
        help: 'What do you think caused the near miss or incident? Why did it occur?' },
      { type: 'paragraph', key: 'countermeasures', title: 'Countermeasures', required: false,
        help: 'What should be done to prevent a recurrence? Have you already taken any countermeasures? (if any)' }
    ]
  },

  /* 2. 5S monitoring and evaluation ------------------------------------ */
  {
    key: 'fives',
    tab: '5S Assessments',
    short: '5S Monitoring and Evaluation',
    title: '5S Monitoring and Evaluation Sheet: Jinja RRH QI Initiative',
    description: 'Monitoring and evaluation of 5S activities in a department or unit: leadership for 5S-CQI-TQM, Sort, ' +
      'Set, Shine and Standardise. Score each item from 0 (poor) to 3 (good). Sub-totals and percentages are ' +
      'calculated automatically on the dashboard (full mark 54).',
    facilityMapped: true,
    retired: RETIRED_FACILITY_,
    extras: FACILITY_EXTRAS_,
    items: withFacilityPages_([].concat(facilityBlock_(), [
      { type: 'mc', key: 'department', title: 'Department/Unit', required: true, options: LISTS.departments, other: true },
      { type: 'date', key: 'date', title: 'Date of assessment', required: true },
      { type: 'text', key: 'evaluator', title: 'Name of evaluator', required: true },
      { type: 'section', title: '1. Leadership', help: 'Dedication of the in-charge and the Work Improvement Team (WIT) to 5S-CQI-TQM. Full mark 12. Score 0 (poor) to 3 (good).' },
      { type: 'grid', key: 'g_ld', title: 'Leadership: dedication of the in-charge and WIT to 5S-CQI-TQM', required: true,
        columns: LISTS.score03, rows: rows_([
          ['LD1', 'The WIT has its own work plan for 5S-CQI-TQM'],
          ['LD2', 'The WIT holds meetings regularly'],
          ['LD3', 'Orientation and training on 5S-CQI have been conducted in the department or unit'],
          ['LD4', '5S-CQI-TQM guidelines, the 5S handbook and other relevant materials are available in the department or unit']
        ]) },
      { type: 'section', title: '2. Sort', help: 'Status of unnecessary items in the workplace. Full mark 9.' },
      { type: 'grid', key: 'g_so', title: 'Sort: status of unnecessary items in the health facility', required: true,
        columns: LISTS.score03, rows: rows_([
          ['SO1', 'Unnecessary items are removed from the workplace'],
          ['SO2', 'Old posters and notices are removed from the walls and notice boards']
        ]) },
      { type: 'mc', key: 'SO3', code: 'SO3', title: 'SO3. Waste segregation is properly implemented', required: true,
        options: ['0', '3'], help: 'This item is scored 0 (not implemented) or 3 (properly implemented).' },
      { type: 'section', title: '3. Set', help: 'Orderliness of necessary items. Full mark 15.' },
      { type: 'grid', key: 'g_se', title: 'Set: orderliness of necessary items in the health facility', required: true,
        columns: LISTS.score03, rows: rows_([
          ['SE1', 'The easy to see, easy to take out and easy to return principle is applied to arrange all items'],
          ['SE2', 'Items are aligned along the X and Y axes and in parallel'],
          ['SE3', 'Zoning is used to fix appropriate home positions for items'],
          ['SE4', 'Colour coding, alphabetical coding, numbering, labelling and symbols are used'],
          ['SE5', 'Signboards, door plates and maps are displayed']
        ]) },
      { type: 'section', title: '4. Shine', help: 'Cleanliness of the workplace. Full mark 9.' },
      { type: 'grid', key: 'g_sh', title: 'Shine: status of cleanliness in the health facility', required: true,
        columns: LISTS.score03, rows: rows_([
          ['SH1', 'Floors, walls, windows, toilets and changing rooms are clean'],
          ['SH2', 'Appropriate cleaning tools are available and stored properly'],
          ['SH3', 'A cleaning checklist is used to make sure the workplace is properly cleaned']
        ]) },
      { type: 'section', title: '5. Standardise', help: 'Norms and mechanisms that maintain Sort, Set and Shine. Full mark 9.' },
      { type: 'grid', key: 'g_st', title: 'Standardise: norms and mechanisms to maintain Sort, Set and Shine', required: true,
        columns: LISTS.score03, rows: rows_([
          ['ST1', 'A checklist is used to maintain the status of S1 to S3 (Sort, Set and Shine)'],
          ['ST2', 'SOPs for S1 to S3 are available'],
          ['ST3', 'Photographs are used as evidence of 5S activities']
        ]) },
      { type: 'paragraph', key: 'comments', title: 'Comments and recommendations', required: false }
    ]))
  },

  /* 3. Hand hygiene observation ---------------------------------------- */
  {
    key: 'hh',
    tab: 'Hand Hygiene',
    short: 'Hand Hygiene Observation',
    title: 'Hand Hygiene Observation (WHO Five Moments): Session Summary',
    description: 'Enter the totals from one WHO hand hygiene observation session for one professional category. ' +
      'Observe openly for about 20 minutes (plus or minus 10 minutes), record each opportunity on the paper ' +
      'observation form, then submit the totals here. Submit one response for each professional category observed ' +
      'in the session. Compliance is calculated as hand hygiene actions divided by opportunities.',
    facilityMapped: true,
    retired: RETIRED_FACILITY_,
    extras: FACILITY_EXTRAS_,
    items: withFacilityPages_([].concat(facilityBlock_(), [
      { type: 'mc', key: 'ward', title: 'Ward/Unit observed', required: true, options: LISTS.departments, other: true },
      { type: 'dropdown', key: 'deptType', title: 'Department type (WHO classification)', required: true,
        options: ['Medical', 'Surgical', 'Mixed (medical and surgical)', 'Obstetrics and gynaecology', 'Paediatrics',
          'Intensive care and resuscitation', 'Emergency unit', 'Long term care and rehabilitation', 'Ambulatory care',
          'Other'] },
      { type: 'dropdown', key: 'period', title: 'Observation period', required: true,
        options: ['Baseline (pre-intervention)', 'Follow-up (post-intervention)', 'Routine monitoring'] },
      { type: 'date', key: 'date', title: 'Date of observation', required: true },
      { type: 'number', key: 'session', title: 'Session number', required: false, min: 1, max: 9999 },
      { type: 'number', key: 'duration', title: 'Session duration (minutes)', required: true, min: 1, max: 120 },
      { type: 'text', key: 'observer', title: 'Observer initials', required: true },
      { type: 'section', title: 'Professional category and totals', help: 'Totals for the professional category observed in this session.' },
      { type: 'dropdown', key: 'profCat', title: 'Professional category', required: true,
        options: ['Nurse', 'Midwife', 'Student nurse or midwife', 'Auxiliary', 'Medical doctor (internal medicine)',
          'Surgeon', 'Anaesthetist or emergency physician', 'Paediatrician', 'Gynaecologist', 'Consultant',
          'Medical student', 'Therapist', 'Technician', 'Other health worker', 'Other student'] },
      { type: 'number', key: 'hcws', title: 'Number of health workers observed in this category', required: false, min: 1, max: 200 },
      { type: 'number', key: 'opp', title: 'Total hand hygiene opportunities observed (n)', required: true, min: 1, max: 1000,
        help: 'An opportunity is defined by at least one indication (one of the five moments).' },
      { type: 'number', key: 'hr', title: 'Hand rub actions performed (HR, alcohol-based hand rub) (n)', required: true, min: 0, max: 1000 },
      { type: 'number', key: 'hw', title: 'Hand wash actions performed (HW, soap and water) (n)', required: true, min: 0, max: 1000 },
      { type: 'number', key: 'gloves', title: 'Missed actions where the health worker was wearing gloves (n)', required: false, min: 0, max: 1000 },
      { type: 'section', title: 'Breakdown by the five moments', help: 'Optional but recommended. Where several indications fall in one opportunity, record each indication separately.' },
      { type: 'number', key: 'm1i', title: 'Moment 1, before touching a patient: indications (n)', required: false, min: 0, max: 1000 },
      { type: 'number', key: 'm1a', title: 'Moment 1, before touching a patient: actions performed (n)', required: false, min: 0, max: 1000 },
      { type: 'number', key: 'm2i', title: 'Moment 2, before a clean or aseptic procedure: indications (n)', required: false, min: 0, max: 1000 },
      { type: 'number', key: 'm2a', title: 'Moment 2, before a clean or aseptic procedure: actions performed (n)', required: false, min: 0, max: 1000 },
      { type: 'number', key: 'm3i', title: 'Moment 3, after body fluid exposure risk: indications (n)', required: false, min: 0, max: 1000 },
      { type: 'number', key: 'm3a', title: 'Moment 3, after body fluid exposure risk: actions performed (n)', required: false, min: 0, max: 1000 },
      { type: 'number', key: 'm4i', title: 'Moment 4, after touching a patient: indications (n)', required: false, min: 0, max: 1000 },
      { type: 'number', key: 'm4a', title: 'Moment 4, after touching a patient: actions performed (n)', required: false, min: 0, max: 1000 },
      { type: 'number', key: 'm5i', title: 'Moment 5, after touching patient surroundings: indications (n)', required: false, min: 0, max: 1000 },
      { type: 'number', key: 'm5a', title: 'Moment 5, after touching patient surroundings: actions performed (n)', required: false, min: 0, max: 1000 }
    ]))
  },

  /* 4. Basic IPC assessment -------------------------------------------- */
  {
    key: 'ipcBasic',
    tab: 'Basic IPC',
    short: 'Basic IPC Assessment',
    title: 'Basic IPC Assessment (RAG Scoring)',
    description: 'Facility-level infection prevention and control (IPC) assessment. Answer each question Yes or No ' +
      'after checking the evidence listed for the standard. Use N/A only where an item genuinely does not apply. ' +
      'The dashboard calculates the score and the Red, Amber or Green (RAG) status of each standard, and the overall ' +
      'RAG status (the colour with the highest count; where counts tie, the lower colour applies).',
    facilityMapped: true,
    retired: RETIRED_FACILITY_,
    extras: FACILITY_EXTRAS_,
    items: withFacilityPages_([].concat(facilityBlock_(), [
      { type: 'date', key: 'date', title: 'Date of assessment', required: true },
      { type: 'text', key: 'village', title: 'City/Village', required: false },
      { type: 'text', key: 'assessor', title: 'Name of person conducting the assessment', required: true },
      { type: 'text', key: 'assessorPhone', title: 'Assessor phone number', required: false },
      { type: 'mc', key: 'facType', title: 'Type of facility', required: true, options: ['Hospital', 'Health centre'] },
      { type: 'mc', key: 'ownership', title: 'Ownership', required: true, options: ['Government', 'Private', 'Faith based'] },
      { type: 'number', key: 'beds', title: 'Bed capacity', required: false, min: 0, max: 5000 },
      { type: 'number', key: 'occupancy', title: 'Bed occupancy (%)', required: false, min: 0, max: 300 },
      { type: 'number', key: 'hws', title: 'Number of health workers', required: false, min: 0, max: 10000 },
      { type: 'number', key: 'ipd', title: 'Monthly inpatients', required: false, min: 0, max: 100000 },
      { type: 'number', key: 'opd', title: 'Monthly outpatients', required: false, min: 0, max: 1000000 },
      { type: 'text', key: 'inCharge', title: 'Name of person in charge', required: false },
      { type: 'section', title: 'Standard 1. Organisation and monitoring of the IPC programme',
        help: 'Evidence: appointment letter for the IPC focal person or committee members; training certificates or participant lists; IPC meeting minutes; IPC work plan signed and approved by management; approved IPC budget and invoices for IPC supplies; timely feedback (within one month for quarterly audits and within 7 days for monthly audits). RAG: Green 8 to 9, Amber 5 to 7, Red 0 to 4.' },
      { type: 'grid', key: 'g_org', title: 'Standard 1. Organisation and monitoring of the IPC programme', required: true,
        columns: LISTS.ynna, rows: rows_([
          ['ORG1', 'Is there an IPC focal person appointed for the facility?'],
          ['ORG2', 'Has the IPC focal person received training based on the national IPC guidelines?'],
          ['ORG3', 'Is there an IPC committee constituted and appointed by the facility?'],
          ['ORG4', 'Are all members of the facility IPC committee trained on the national IPC guidelines?'],
          ['ORG5', 'Does the IPC committee meet regularly over facility IPC issues?'],
          ['ORG6', 'Does the IPC committee have a work plan to guide facility IPC activities?'],
          ['ORG7', 'Have resources been allocated by facility management to fund the IPC budget?'],
          ['ORG8', 'Does the facility regularly monitor or audit IPC practices?'],
          ['ORG9', 'Was there timely feedback to staff and management after the last audit or monitoring exercise?']
        ]) },
      { type: 'section', title: 'Standard 2. Education and training',
        help: 'Evidence: training schedule and records; CME schedule and records; competence assessment plan and records. RAG: Green 3, Amber 2, Red 0 to 1.' },
      { type: 'grid', key: 'g_edu', title: 'Standard 2. Education and training', required: true,
        columns: LISTS.ynna, rows: rows_([
          ['EDU1', 'Does the facility have an IPC training programme based on the national IPC guidelines for staff, interns and trainees?'],
          ['EDU2', 'Does the facility have a Continuous Medical Education (CME) programme for staff, interns and trainees?'],
          ['EDU3', 'Does the facility have an IPC competence assessment programme?']
        ]) },
      { type: 'section', title: 'Standard 3. IPC supplies',
        help: 'Evidence: updated inventory of IPC supply stock; internal requisition tools; updated buffer stock list for critical supplies; updated list of emergency supplies for outbreak response. RAG: Green 4, Amber 3, Red 0 to 2.' },
      { type: 'grid', key: 'g_sup', title: 'Standard 3. IPC supplies', required: true,
        columns: LISTS.ynna, rows: rows_([
          ['SUP1', 'Does the facility have an updated inventory reflecting the stock status of all IPC supplies?'],
          ['SUP2', 'Does the facility have a functional internal stock ordering system serving all units?'],
          ['SUP3', 'Does the facility have provision for buffer stock in case of stockouts of critical IPC supplies?'],
          ['SUP4', 'Does the facility have a repository of emergency IPC supplies prioritised for outbreak response?']
        ]) },
      { type: 'section', title: 'Standard 4C. Hand hygiene',
        help: 'Evidence: functional hand hygiene stations; soap; clearly displayed IEC materials; hand hygiene compliance monitoring records. For HHY4 and HHY5 (supply interruptions) the desirable answer is No; the dashboard scores these items in reverse. RAG: Green 6 to 7, Amber 4 to 5, Red 0 to 3.' },
      { type: 'grid', key: 'g_hhy', title: 'Standard 4C. Hand hygiene', required: true,
        columns: LISTS.ynna, rows: rows_([
          ['HHY1', 'Are there functional hand hygiene stations in all clinical areas including clinics, labour rooms and laboratories?'],
          ['HHY2', 'Is soap available at all hand hygiene stations?'],
          ['HHY3', 'Is water available at all hand hygiene stations?'],
          ['HHY4', 'Has there been an interruption in soap supply for 1 day or more in the last 3 months?'],
          ['HHY5', 'Has there been an interruption in water supply for 1 day or more in the last 3 months?'],
          ['HHY6', 'Are there hand washing IEC materials at all hand hygiene stations?'],
          ['HHY7', 'Does the facility have a documented system for monitoring staff compliance with hand washing?']
        ]) },
      { type: 'section', title: 'Standard 4D. Personal protective equipment (PPE)',
        help: 'Evidence: procedures for donning and doffing PPE; records of monitoring staff compliance with PPE standard precautions. Verify stock with the store. RAG: Green 5, Amber 3 to 4, Red 0 to 2.' },
      { type: 'grid', key: 'g_ppe', title: 'Standard 4D. Personal protective equipment (PPE)', required: true,
        columns: LISTS.ynna, rows: rows_([
          ['PPE1', 'Are critical PPE supplies always in stock?'],
          ['PPE2', 'Are PPE supplies in the stores accessible at all times?'],
          ['PPE3', 'Are PPE supplies in clinical areas and laboratories available to all staff at all times?'],
          ['PPE4', 'Are procedures (or IEC materials) on donning and doffing PPE available in all clinical areas and laboratories?'],
          ['PPE5', 'Is there a documented system for monitoring staff compliance with PPE standard precautions?']
        ]) },
      { type: 'section', title: 'Standard 4E. Waste management',
        help: 'Evidence: colour-coded bins; correct colour-coded bin liners; waste segregation posters; compliance records; restricted access to waste storage areas. Verify same-day collection at the service delivery point. RAG: Green 5 to 7, Amber 3 to 4, Red 0 to 2.' },
      { type: 'grid', key: 'g_wst', title: 'Standard 4E. Waste management', required: true,
        columns: LISTS.ynna, rows: rows_([
          ['WST1', 'Are colour-coded bins available in every area?'],
          ['WST2', 'Are the right colour-coded bin liners available and used in the right colour-coded bins?'],
          ['WST3', 'Are waste segregation posters or IEC materials clearly displayed above every waste bin?'],
          ['WST4', 'Is there a documented system for monitoring staff compliance with waste segregation?'],
          ['WST5', 'Is all infectious and sharps waste collected and destroyed on the day it is generated?'],
          ['WST6', 'Is there a placenta pit?'],
          ['WST7', 'Are waste storage and disposal areas secured?']
        ]) },
      { type: 'section', title: 'Standard 4F. Sharps safety',
        help: 'Evidence: sharps containers; sharps posters. Observe syringe disposal. RAG: Green 3, Amber 2, Red 0 to 1.' },
      { type: 'grid', key: 'g_shp', title: 'Standard 4F. Sharps safety', required: true,
        columns: LISTS.ynna, rows: rows_([
          ['SHP1', 'Are sharps containers available in every clinical area and laboratory?'],
          ['SHP2', 'Is a sharps poster clearly displayed where sharps are used or prepared?'],
          ['SHP3', 'Are syringes always discarded after single use?']
        ]) },
      { type: 'section', title: 'Standard 4G. Decontamination of medical equipment',
        help: 'Evidence: decontamination SOPs (three bucket system); functional sterilisation equipment; sterilisation logs; safe storage for sterilised instruments. RAG: Green 7 to 8, Amber 5 to 6, Red 0 to 4.' },
      { type: 'grid', key: 'g_deq', title: 'Standard 4G. Decontamination of medical equipment', required: true,
        columns: LISTS.ynna, rows: rows_([
          ['DEQ1', 'Are there SOPs for decontamination of all medical instruments and devices in all clinical areas and laboratories?'],
          ['DEQ2', 'Does the facility have functional sterilisation equipment?'],
          ['DEQ3', 'Is there a means to steam sterilise critical instruments such as forceps and scissors?'],
          ['DEQ4', 'For hospitals, does the facility have a sterilisation unit for medical instruments?'],
          ['DEQ5', 'Are there updated logs for use and decontamination of all medical instruments and devices?'],
          ['DEQ6', 'Is there clear separation of clean and contaminated instruments and devices?'],
          ['DEQ7', 'Are decontaminated instruments and devices stored safely, off the floor and covered?'],
          ['DEQ8', 'Are there enough delivery sets for the number of deliveries each day?']
        ]) },
      { type: 'section', title: 'Standard 4H. Decontamination of linen',
        help: 'Not a core standard: recorded for information and excluded from the overall RAG. Evidence: linen SOPs; sterilisation equipment; logs; designated laundry area; safe storage. RAG: Green 6 to 7, Amber 4 to 5, Red 0 to 3.' },
      { type: 'grid', key: 'g_lin', title: 'Standard 4H. Decontamination of linen', required: true,
        columns: LISTS.ynna, rows: rows_([
          ['LIN1', 'Are there SOPs for decontamination of linen in all clinical areas and laboratories?'],
          ['LIN2', 'Does the facility have functional sterilisation equipment for linen?'],
          ['LIN3', 'Is there a designated laundry area?'],
          ['LIN4', 'Are there updated logs for use and decontamination of all linen?'],
          ['LIN5', 'Is there clear separation of clean and contaminated or used linen?'],
          ['LIN6', 'Is contaminated linen (blood and body fluids) handled separately from used linen?'],
          ['LIN7', 'Is decontaminated linen stored safely, off the floor and covered?']
        ]) },
      { type: 'section', title: 'Standard 4I. Decontamination of the environment',
        help: 'Evidence: SOPs for preparing decontaminating agents; cleaning logs; spill management posters; mattresses with intact waterproof covers. RAG: Green 5 to 6, Amber 3 to 4, Red 0 to 2.' },
      { type: 'grid', key: 'g_env', title: 'Standard 4I. Decontamination of the environment', required: true,
        columns: LISTS.ynna, rows: rows_([
          ['ENV1', 'Are there SOPs for preparation of all decontamination agents in all clinical and laboratory areas?'],
          ['ENV2', 'Is the environment kept tidy and free from clutter?'],
          ['ENV3', 'Is there a regular cleaning schedule for clinical and laboratory areas?'],
          ['ENV4', 'Are posters on handling blood and body fluid spills displayed in clinical areas?'],
          ['ENV5', 'Do all mattresses have intact waterproof covers that can be easily cleaned?'],
          ['ENV6', 'Are there cleaning logs for all clinical and laboratory areas (walls, floors and mattress covers)?']
        ]) },
      { type: 'section', title: 'Standard 5. Screening and isolation',
        help: 'Evidence: screening station at the facility entrance; screening SOPs; isolation SOPs and criteria; hand hygiene station; designated isolation area. RAG: Green 11 to 13, Amber 7 to 10, Red 0 to 6.' },
      { type: 'grid', key: 'g_sci', title: 'Standard 5. Screening and isolation', required: true,
        columns: LISTS.ynna, rows: rows_([
          ['SCI1', 'Is there a screening station that meets IPC standards at the facility?'],
          ['SCI2', 'Are there SOPs on screening of patients at the screening station?'],
          ['SCI3', 'Does the screening station have a single entrance?'],
          ['SCI4', 'Are there SOPs and criteria for isolation of high risk patients at the screening area?'],
          ['SCI5', 'Is there a hand hygiene station with soap and water at the screening station?'],
          ['SCI6', 'Is there a staff rota so that the screening station is always staffed?'],
          ['SCI7', 'Is there a system for screening patients in the wards?'],
          ['SCI8', 'Is there a designated isolation area?'],
          ['SCI9', 'Are there SOPs for transfer of patients between the isolation area and other areas?'],
          ['SCI10', 'Is the isolation area separated from other patient areas?'],
          ['SCI11', 'Is the isolation space a permanent structure?'],
          ['SCI12', 'Is there a system for screening staff for infectious diseases while on duty?'],
          ['SCI13', 'Is there an SOP for management of staff diagnosed with infectious diseases while on duty?']
        ]) },
      { type: 'section', title: 'Standard 6. HAI monitoring, outbreak investigation and response',
        help: 'There should be an HAI monitoring structure and an SOP to follow in case of an outbreak within the facility. RAG: Green 5, Amber 3 to 4, Red 0 to 2.' },
      { type: 'grid', key: 'g_hai', title: 'Standard 6. HAI monitoring, outbreak investigation and response', required: true,
        columns: LISTS.ynna, rows: rows_([
          ['HAI1', 'Is there a written protocol for HAI surveillance?'],
          ['HAI2', 'Is there a documented HAI monitoring programme?'],
          ['HAI3', 'Is there a protocol for HAI outbreak notification and investigation?'],
          ['HAI4', 'Is there a documented system for screening staff for HAIs?'],
          ['HAI5', 'Is there a written protocol for HAI outbreak response?']
        ]) },
      { type: 'paragraph', key: 'comments', title: 'Comments and agreed actions', required: false }
    ]))
  },

  /* 5. MoH IPC facility assessment tool -------------------------------- */
  {
    key: 'ipcMoh',
    tab: 'IPC Facility Assessment',
    short: 'IPC Facility Assessment (MoH 2024)',
    title: 'IPC Facility Assessment Tool (MoH Uganda, May 2024)',
    description: 'Assesses infection prevention and control capacity across eight thematic areas. The tool may be ' +
      'self-administered by the facility IPC team (internal) or completed by an external assessor during support ' +
      'supervision. Verify each response against the evidence indicated. The dashboard scores each thematic area: ' +
      'a compliant answer scores 1, graded answers score 1, 0.5 or 0, and N/A items are excluded.',
    facilityMapped: true,
    retired: RETIRED_FACILITY_,
    extras: FACILITY_EXTRAS_,
    items: withFacilityPages_([].concat(facilityBlock_(), [
      { type: 'dropdown', key: 'level', title: 'Facility level', required: true, options: LISTS.levels },
      { type: 'dropdown', key: 'ownership', title: 'Facility ownership', required: true, options: LISTS.ownership },
      { type: 'mc', key: 'assessType', title: 'Type of assessment', required: true,
        options: ['Internal (self-assessment)', 'External (support supervision)'] },
      { type: 'date', key: 'date', title: 'Date of assessment', required: true },
      { type: 'text', key: 'assessor', title: 'Name of assessor', required: true },
      { type: 'text', key: 'assessorPhone', title: 'Phone contact of assessor', required: false },
      { type: 'text', key: 'focalPerson', title: 'Institutional IPC focal person: name and contact details', required: false },
      { type: 'section', title: 'Area 1. IPC programme' },
      { type: 'grid', key: 'g_p', title: 'Area 1. IPC programme', required: true, columns: LISTS.yn,
        help: 'Focal person training: certified IPC training at General Hospital and above; MoH structured training at lower levels.',
        rows: rows_([
          ['P1a', 'At least one dedicated IPC focal person is in charge of IPC activities'],
          ['P1b', 'The IPC focal person is trained'],
          ['P1c', 'Terms of reference for the IPC focal person are available'],
          ['P2m', 'Minutes of the last quarter\'s facility management meeting are available (verify IPC agenda item)'],
          ['P3', 'The facility IPC committee meets at least monthly'],
          ['P3m', 'Minutes for the last three IPC committee meetings are available']
        ]) },
      { type: 'mc', key: 'P2', code: 'P2', title: 'P2. Is IPC part of the quarterly facility management meeting agenda?', required: true,
        options: ['Yes, every meeting', 'Yes, most or at least half of the meetings', 'Yes, but only once a year or rarely',
          'No, IPC is not part of the facility meeting agenda', 'N/A, the facility has no quarterly management meetings'],
        help: 'If No, the IPC focal person should ask facility leadership to add IPC as an agenda item for the next meeting.' },
      { type: 'section', title: 'Area 2. IPC training' },
      { type: 'mc', key: 'T1', code: 'T1', title: 'T1. Does the facility have ongoing or continuous IPC education or training at least annually?', required: true,
        options: ['Yes, monthly', 'Yes, quarterly', 'No, IPC education and training is given as needed (not on a regular basis)',
          'No, none currently scheduled or planned'] },
      { type: 'grid', key: 'g_t', title: 'Area 2. Orientation', required: true, columns: LISTS.yn, rows: rows_([
        ['T2', 'All health workers receive orientation on IPC SOPs and guidelines upon deployment'],
        ['T3', 'All new cleaning staff receive orientation on IPC SOPs and guidelines upon deployment']
      ]) },
      { type: 'section', title: 'Area 3. IPC guidelines, SOPs and IEC materials', help: 'Ask to see each document.' },
      { type: 'grid', key: 'g_g1', title: 'Area 3. National guidelines', required: true, columns: LISTS.yn, rows: rows_([
        ['G1', 'Up-to-date national IPC guidelines are available']
      ]) },
      { type: 'grid', key: 'g_g2', title: 'G2. Locally adapted or developed SOPs or guidelines are available for', required: true,
        columns: LISTS.yn, rows: rows_([
          ['G2a', 'Hand hygiene'], ['G2b', 'Decontamination of medical devices'], ['G2c', 'Environmental cleaning'],
          ['G2d', 'Healthcare waste management'], ['G2e', 'Donning and doffing of PPE'], ['G2f', 'Linen management'],
          ['G2g', 'Injection safety'], ['G2h', 'Healthcare worker protection and safety'], ['G2i', 'Aseptic techniques'],
          ['G2j', 'Isolation of patients with infectious diseases including multidrug resistant organisms and outbreak prone diseases'],
          ['G2k', 'Triage of infectious patients'], ['G2l', 'Transmission-based precautions'],
          ['G2m', 'Management of staff with an infectious occupational exposure at the facility']
        ]) },
      { type: 'grid', key: 'g_g3', title: 'G3. SOPs or guidelines for prevention of each healthcare associated infection', required: true,
        columns: LISTS.ynna, help: 'Tailored to facility level: HC IV and above. Use N/A for lower levels.', rows: rows_([
          ['G3a', 'Surgical site infection (SSI)'], ['G3b', 'Catheter associated urinary tract infection (CAUTI)'],
          ['G3c', 'Ventilator associated pneumonia (VAP)'], ['G3d', 'Bloodstream infection (BSI)']
        ]) },
      { type: 'section', title: 'Area 4. Healthcare associated infection (HAI) surveillance' },
      { type: 'grid', key: 'g_h1', title: 'H1. HAI surveillance is conducted according to national plans for', required: true,
        columns: LISTS.ynna, help: 'Tailored to facility level: HC IV and above. Use N/A for lower levels.', rows: rows_([
          ['H1a', 'Surgical site infection (SSI)'], ['H1b', 'Catheter associated urinary tract infection (CAUTI)'],
          ['H1c', 'Ventilator associated pneumonia (VAP)'], ['H1d', 'Bloodstream infection (BSI)']
        ]) },
      { type: 'section', title: 'Area 5. Multimodal strategies',
        help: 'Multimodal strategies combine measures such as system change, training and education, monitoring and feedback, reminders and communication, and a culture of safety. Review reports of interventions for verification.' },
      { type: 'grid', key: 'g_m1', title: 'M1. Multimodal strategies are used to implement IPC interventions that improve', required: true,
        columns: LISTS.yn, rows: rows_([
          ['M1a', 'Hand hygiene'], ['M1b', 'Safe injection practices'],
          ['M1c', 'Decontamination of medical instruments and devices'], ['M1d', 'Environmental cleaning']
        ]) },
      { type: 'section', title: 'Area 6. Monitoring of IPC practices' },
      { type: 'grid', key: 'g_o', title: 'Area 6. Monitoring and feedback', required: true, columns: LISTS.yn, rows: rows_([
        ['O1', 'The facility monitors the implementation of staff IPC practices at least quarterly (report of monitoring and feedback)'],
        ['O5', 'Timely and regular feedback of audit reports is given to key stakeholders (verify feedback reports)']
      ]) },
      { type: 'checkbox', key: 'monitored', title: 'O2. Which IPC practices are monitored?', required: false,
        options: ['Hand hygiene', 'PPE donning and doffing demonstrations', 'Environmental cleaning'] },
      { type: 'mc', key: 'O3', code: 'O3', title: 'O3. Is hand hygiene compliance monitored using the WHO hand hygiene observation tool or an equivalent?',
        required: true, options: LISTS.ynna, help: 'Choose N/A if hand hygiene is not monitored.' },
      { type: 'number', key: 'hhRate', title: 'O4. Hand hygiene compliance rate from the last quarter\'s WHO assessment (%)', required: false, min: 0, max: 100 },
      { type: 'section', title: 'Area 7. Workload, staffing and bed occupancy' },
      { type: 'grid', key: 'g_w', title: 'Area 7. Workload, staffing and bed occupancy', required: true, columns: LISTS.yn, rows: rows_([
        ['W1', 'Screening and triage are done according to existing guidelines and SOPs to prioritise care and isolation'],
        ['W2', 'Staffing is sufficient to provide clinical services safely (1 nurse per 4 patients with basic needs)'],
        ['W3', 'Bed occupancy is kept to one patient per bed'],
        ['W4', 'Adequate spacing of at least one metre between patient beds is ensured']
      ]) },
      { type: 'section', title: 'Area 8. Built environment, materials and equipment for IPC' },
      { type: 'grid', key: 'g_b1', title: 'Area 8a. Water, hand hygiene and power', required: true, columns: LISTS.yn, rows: rows_([
        ['B1', 'Water is available at all times and in sufficient quantity for all uses'],
        ['B3', 'There is a reservoir to supply water to the facility for at least 48 hours'],
        ['B4', 'Functional hand hygiene stations are available at all service points (hand rub or soap and water with clean single use towels)'],
        ['B5', 'The facility has continuous power'],
        ['B6', 'There is a power back-up']
      ]) },
      { type: 'paragraph', key: 'waterWhy', title: 'If water is not available at all times, explain why', required: false },
      { type: 'number', key: 'hhStations', title: 'Number of functional hand hygiene stations', required: false, min: 0, max: 5000 },
      { type: 'number', key: 'sdp', title: 'Number of service delivery points', required: false, min: 0, max: 5000 },
      { type: 'text', key: 'hhMissing', title: 'If hand hygiene stations are not functional everywhere, what is missing?', required: false },
      { type: 'mc', key: 'B7', code: 'B7', title: 'B7. Has there been any stockout of PPE in the last quarter?', required: true,
        options: LISTS.yn, help: 'For this item No is the desirable answer and it is scored in reverse.' },
      { type: 'grid', key: 'g_b8', title: 'B8. Appropriate PPE is available for all health staff including cleaners at the time of assessment', required: true,
        columns: LISTS.yn, rows: rows_([
          ['B8a', 'Gloves'], ['B8b', 'Surgical masks'], ['B8c', 'Respirators (N95)'], ['B8d', 'Eye protection'],
          ['B8e', 'Gowns (delivery and theatre)'], ['B8f', 'Plastic aprons'], ['B8g', 'Heavy duty gloves'],
          ['B8h', 'Heavy duty aprons'], ['B8i', 'Gum boots']
        ]) },
      { type: 'grid', key: 'g_b9', title: 'B9. There has been a stockout lasting over one week during the last quarter', required: true,
        columns: LISTS.yn, help: 'For these items No is the desirable answer and they are scored in reverse.', rows: rows_([
          ['B9a', 'Gloves'], ['B9b', 'Surgical masks'], ['B9c', 'Respirators (N95)'], ['B9d', 'Eye protection'],
          ['B9e', 'Gowns (delivery and theatre)'], ['B9f', 'Plastic aprons'], ['B9g', 'Heavy duty gloves'],
          ['B9h', 'Heavy duty aprons'], ['B9i', 'Gum boots']
        ]) },
      { type: 'grid', key: 'g_b10', title: 'Area 8c. Waste management', required: true, columns: LISTS.yn,
        help: 'The assessor should check segregation practice at the point of generation.', rows: rows_([
          ['B10', 'Colour-coded bins and liners for infectious and non-infectious waste and puncture-proof sharps boxes are available at all waste generation points'],
          ['B11', 'Waste is segregated appropriately (infectious, non-infectious and sharps) at the point of generation'],
          ['B12', 'Waste segregation job aids are visible at all locations where bins are placed'],
          ['B14', 'A secure, lockable waste storage area protected from animals is available'],
          ['B15', 'Sharps containers are sealed and disposed of when three quarters full'],
          ['B16', 'Sharps are placed into a sharps container immediately after use']
        ]) },
      { type: 'number', key: 'sdpBins', title: 'Number of service delivery points with correctly colour-coded bins, liners and sharps boxes', required: false, min: 0, max: 5000 },
      { type: 'checkbox', key: 'disposal', title: 'B13. How is infectious waste disposed of?', required: false,
        help: 'Select all that apply.', options: ['Incinerator', 'Autoclave', 'Placenta pit', 'Burn pit', 'Transported offsite for disposal'] },
      { type: 'grid', key: 'g_b17', title: 'B17. Cleaning and disinfection supplies are available', required: true, columns: LISTS.yn, rows: rows_([
        ['B17a', 'At least 4 buckets'], ['B17b', 'Mop and squeezer (one per area)'], ['B17c', 'Towels'],
        ['B17d', 'Cleaning solution (detergent)'], ['B17e', 'Stirring stick for chlorine preparation'],
        ['B17f', 'Chlorine (liquid or crystal form)']
      ]) },
      { type: 'grid', key: 'g_b18', title: 'Area 8d. Environmental cleaning', required: true, columns: LISTS.yn, rows: rows_([
        ['B18', 'Cleaning buckets are clearly labelled and arranged in the correct order for cleaning and disinfection'],
        ['B19', 'Cleaning staff (including contracted staff) are trained in proper cleaning upon employment and at least quarterly']
      ]) },
      { type: 'mc', key: 'B20', code: 'B20', title: 'B20. Is there an accessible, up-to-date and properly completed cleaning schedule or record for general cleaning in all areas?',
        required: true, options: ['Yes, available, up to date and properly completed', 'No, available and up to date but not properly completed',
          'No, available but not up to date', 'No, not available'] },
      { type: 'mc', key: 'B21', code: 'B21', title: 'B21. Is there an accessible, up-to-date and properly completed cleaning schedule or record for high-touch cleaning in all areas?',
        required: true, help: 'Answer Yes if high-touch cleaning is included in the main cleaning schedule.',
        options: ['Yes, available, up to date and properly completed', 'No, available and up to date but not properly completed',
          'No, available but not up to date', 'No, not available'] },
      { type: 'grid', key: 'g_b22', title: 'Area 8e. Medical device processing', required: true, columns: LISTS.yn, rows: rows_([
        ['B22', 'There is a dedicated, identified clean area for decontamination and sterilisation of medical devices'],
        ['B23', 'There is a functional sterilisation mechanism for medical instruments (check for a working autoclave)'],
        ['B24', 'Mechanical or chemical indicators are used to monitor sterilisation at least daily'],
        ['B25', 'Biological indicators are used to monitor sterilisation at least weekly'],
        ['B26', 'Disinfected and sterile medical equipment is readily available for use']
      ]) },
      { type: 'paragraph', key: 'sterileWhy', title: 'If sterile equipment is not readily available, explain why and the plan to make it available', required: false },
      { type: 'grid', key: 'g_b28', title: 'Area 8f. Isolation facilities', required: true, columns: LISTS.yn,
        help: 'District hospital and above: at least 2 beds with a hand hygiene facility, dedicated sanitary facilities and space for donning and doffing PPE. HC IV and below: an identified space for temporarily holding a patient awaiting transfer.', rows: rows_([
          ['B28', 'The facility has an identified safe isolation area where patients with highly infectious diseases can be kept']
        ]) },
      { type: 'paragraph', key: 'actions', title: 'Action points for the next quarter', required: false }
    ]))
  },

  /* 6. HFQAP facility assessment summary ------------------------------- */
  {
    key: 'hfqap',
    tab: 'HFQAP',
    short: 'HFQAP Facility Assessment',
    title: 'HFQAP Facility Assessment: Score Summary (MoH Uganda)',
    description: 'Health Facility Quality of Care Assessment Program (HFQAP), Facility Assessment Tool. After completing ' +
      'the paper tool, enter the score achieved in each module (the number of criteria answered Yes) and tick the ' +
      'standards that were not met. The dashboard calculates module percentages, the overall percentage and the star ' +
      'rating for the facility level (Star 0 below 55%, Star 1 55 to 64%, Star 2 65 to 74%, Star 3 75 to 84%, ' +
      'Star 4 85 to 94%, Star 5 95% and above).',
    facilityMapped: true,
    retired: RETIRED_FACILITY_,
    extras: FACILITY_EXTRAS_,
    items: withFacilityPages_([].concat(facilityBlock_(), [
      { type: 'dropdown', key: 'level', title: 'Facility level', required: true, options: LISTS.levels },
      { type: 'dropdown', key: 'ownership', title: 'Facility ownership', required: true, options: LISTS.ownership,
        help: 'Health financing is scored out of 9 for public facilities and out of 7 for private facilities.' },
      { type: 'text', key: 'facilityCode', title: 'Facility code', required: false },
      { type: 'mc', key: 'assessType', title: 'Type of assessment', required: true,
        options: ['Internal (self-assessment)', 'External (district or regional support supervision)', 'National assessment'] },
      { type: 'date', key: 'date', title: 'Date of assessment', required: true },
      { type: 'paragraph', key: 'supervisors', title: 'Supervisors (names and designations)', required: false },
      { type: 'text', key: 'inCharge', title: 'Name of facility in-charge', required: false },
      { type: 'section', title: 'Module 1. Leadership and governance', help: 'Criteria to score: 14 at every level.' },
      { type: 'number', key: 's_m1', title: 'Module 1 score: criteria met', required: true, min: 0, max: 14 },
      { type: 'checkbox', key: 'nm_m1', codes: true, mergeInto: 'notMet', title: 'Module 1 standards not met', required: false, options: [
        '1.1 Posters with the health sector vision and mission statement', '1.2 Client charter key messages displayed',
        '1.3 Meetings held and action points monitored', '1.4 Current catchment map and disaggregated population',
        '1.5 Joint planning meetings held as scheduled', '1.6 Annual and quarterly work plans and budgets communicated',
        '1.7 Support supervision findings and actions recorded', '1.8 Community involvement'] },
      { type: 'section', title: 'Module 2. Human resources for health', help: 'Criteria to score: HC II and HC III 19; HC IV, General Hospital and RRH 20.' },
      { type: 'number', key: 's_m2', title: 'Module 2 score: criteria met', required: true, min: 0, max: 20 },
      { type: 'checkbox', key: 'nm_m2', codes: true, mergeInto: 'notMet', title: 'Module 2 standards not met', required: false, options: [
        '2.1 Availability of qualified health workers', '2.2 Guidelines on human resource management procedures',
        '2.3 Up-to-date written job descriptions', '2.4 Scheduled CPD and CME', '2.5 Up-to-date training database',
        '2.6 Functional library', '2.7 Functional staff appraisal system', '2.8 Health workers welfare such as break teas and resting rooms',
        '2.9 System of recognition of performance'] },
      { type: 'section', title: 'Module 3. Health financing', help: 'Criteria to score: 9 for public facilities and 7 for private facilities.' },
      { type: 'number', key: 's_m3', title: 'Module 3 score: criteria met', required: true, min: 0, max: 9 },
      { type: 'checkbox', key: 'nm_m3', codes: true, mergeInto: 'notMet', title: 'Module 3 standards not met', required: false, options: [
        '3.1 Availability of financial guidelines', '3.2 Financial guidelines followed', '3.3 Procurement'] },
      { type: 'section', title: 'Module 4. Health information', help: 'Criteria to score: HC II 21; HC III 29; HC IV, General Hospital and RRH 32.' },
      { type: 'number', key: 's_m4', title: 'Module 4 score: criteria met', required: true, min: 0, max: 32 },
      { type: 'checkbox', key: 'nm_m4', codes: true, mergeInto: 'notMet', title: 'Module 4 standards not met', required: false, options: [
        '4.1 System for accurate data collection plus storage and retrieval', '4.2 Alignment of diseases and birth outcomes to ICD',
        '4.3 Death and birth registration system', '4.4 Patient cards for follow up and continuity',
        '4.5 HMIS registers correctly filled', '4.6 HMIS reports compiled and submitted on time',
        '4.7 Accuracy of HMIS reports', '4.8 SOPs for data quality assessment', '4.9 Key performance indicators displayed',
        '4.10 HMIS data analysed and used', '4.11 Computers for data management', '4.12 Functional disease surveillance system'] },
      { type: 'section', title: 'Module 5. Medicines, health supplies, vaccines and equipment',
        help: 'Criteria to score. 5a management: HC II 15, HC III 17, HC IV and above 20. 5b vaccines and tracer medicines: HC II 13, HC III 19, HC IV 25, General Hospital and RRH 26. 5c tracer equipment: HC II 5, HC III 10, HC IV 13, General Hospital and RRH 15. 5d equipment inventory and tracer diagnostics: HC II and HC III 3, HC IV 5, General Hospital and RRH 6.' },
      { type: 'number', key: 's_m5a', title: 'Module 5a score: medicines and supplies management, criteria met', required: true, min: 0, max: 20 },
      { type: 'number', key: 's_m5b', title: 'Module 5b score: vaccines and tracer medicines, criteria met', required: true, min: 0, max: 26 },
      { type: 'number', key: 's_m5c', title: 'Module 5c score: tracer equipment, criteria met', required: true, min: 0, max: 15 },
      { type: 'number', key: 's_m5d', title: 'Module 5d score: equipment inventory and tracer diagnostics, criteria met', required: true, min: 0, max: 6 },
      { type: 'checkbox', key: 'nm_m5', codes: true, mergeInto: 'notMet', title: 'Module 5 standards not met', required: false, options: [
        '5.1 Functional supply chain management system', '5.2 Current medicines and health supplies management tools',
        '5.3 Proper space for storage of medicines and supplies', '5.4 Proper cold chain for vaccines',
        '5.5 Correct storage procedures for medicines and supplies', '5.5.1 Vaccines registered in the vaccine control book',
        '5.5.2 Tracer commodities for family planning', '5.5.3 Tracer commodities for nutrition management',
        '5.5.4 Tracer medicines for antenatal care', '5.5.5 Tracer medicines for basic obstetric care',
        '5.5.6 Tracer medicines for newborn care', '5.5.7 Tracer medicines for child health',
        '5.5.8 Tracer medicines for adolescent health', '5.5.9 Tracer medicines for STD management',
        '5.5.10 Tracer medicines for malaria management', '5.5.11 Tracer medicines for HIV and AIDS management',
        '5.5.12 Tracer medicines for TB management', '5.5.13 Tracer medicines for NCDs',
        '5.5.14 Tracer medicines for basic surgery', '5.5.15 Tracer medicines for comprehensive surgery',
        '5.5.16 Diagnostic kits and reagents for basic investigations', '5.6.1 Tracer equipment for OPD',
        '5.6.2 Tracer equipment for immunisation', '5.6.3 Tracer equipment for family planning',
        '5.6.4 Tracer equipment for antenatal care', '5.6.5 Tracer equipment for basic obstetric care',
        '5.6.6 Tracer equipment for surgery', '5.6.7 Tracer equipment for general inpatient services',
        '5.6.8 Tracer laboratory equipment', '5.7 Tracer laboratory and radiology diagnostics',
        '5.8 Up-to-date inventory for tracer equipment'] },
      { type: 'section', title: 'Module 6. Health infrastructure', help: 'Criteria to score: HC II 20; HC III 21; HC IV, General Hospital and RRH 24.' },
      { type: 'number', key: 's_m6', title: 'Module 6 score: criteria met', required: true, min: 0, max: 24 },
      { type: 'checkbox', key: 'nm_m6', codes: true, mergeInto: 'notMet', title: 'Module 6 standards not met', required: false, options: [
        '6.1 Land title available', '6.2 Signage', '6.3 List of available services displayed',
        '6.4 Clean and protected external environment and service areas', '6.5 Comfort (ambience) for clients',
        '6.6 Private area for service delivery', '6.7 Changing rooms', '6.8 Reliable and clean water supply',
        '6.9 Reliable power supply', '6.10 Clean sanitary facilities for staff and clients', '6.11 Communication equipment',
        '6.12 Functional transport system'] },
      { type: 'section', title: 'Module 7. Reproductive, maternal, newborn, child and adolescent health', help: 'Criteria to score: HC II 32; HC III and above 38.' },
      { type: 'number', key: 's_m7', title: 'Module 7 score: criteria met', required: true, min: 0, max: 38 },
      { type: 'checkbox', key: 'nm_m7', codes: true, mergeInto: 'notMet', title: 'Module 7 standards not met', required: false, options: [
        '7.1 Health education programme in RMNCAH', '7.3 In-service training in RMNCAH in the last two years',
        '7.4 Guidelines for RMNCAH', '7.5 Technically appropriate services in RMNCAH', '7.6 Maternal and perinatal death reviews'] },
      { type: 'section', title: 'Module 8. Outreach, clinical care, surgical care, referral and emergency', help: 'Criteria to score: HC II and HC III 37; HC IV and above 48.' },
      { type: 'number', key: 's_m8', title: 'Module 8 score: criteria met', required: true, min: 0, max: 48 },
      { type: 'checkbox', key: 'nm_m8', codes: true, mergeInto: 'notMet', title: 'Module 8 standards not met', required: false, options: [
        '8.1 Functional outreach programme', '8.2 Functional health education programme in OPD',
        '8.3 OPD staff trained in management of common diseases including NCDs', '8.4 Current guidelines for common conditions',
        '8.5 Technically appropriate services in OPD', '8.6 Clinical audits',
        '8.7 Staff trained in emergency and essential surgical care', '8.8 Functional theatre',
        '8.9 Functional patient referral system', '8.10 Functional emergency unit or service'] },
      { type: 'section', title: 'Module 9. Diagnostic services', help: 'Criteria to score: HC II 1; HC III 9; HC IV 10; General Hospital and RRH 13.' },
      { type: 'number', key: 's_m9', title: 'Module 9 score: criteria met', required: true, min: 0, max: 13 },
      { type: 'checkbox', key: 'nm_m9', codes: true, mergeInto: 'notMet', title: 'Module 9 standards not met', required: false, options: [
        '9.1 Laboratory staff who received in-service training in the last two years', '9.2 Current laboratory guidelines and SOPs',
        '9.3 Radiology and imaging staff trained in the last two years', '9.4 Current radiology and imaging guidelines and SOPs',
        '9.5 Functional laboratory referral mechanism', '9.6 Laboratory quality management system'] },
      { type: 'section', title: 'Module 10. Client centred care and safety', help: 'Criteria to score: HC II 22; HC III 24; HC IV, General Hospital and RRH 25.' },
      { type: 'number', key: 's_m10', title: 'Module 10 score: criteria met', required: true, min: 0, max: 25 },
      { type: 'checkbox', key: 'nm_m10', codes: true, mergeInto: 'notMet', title: 'Module 10 standards not met', required: false, options: [
        '10.1 Effective interaction with clients and family members', '10.2 Health workers know the client rights',
        '10.3 Client feedback mechanism', '10.4 Triage system', '10.5 Guidelines for infection prevention and control',
        '10.6 Supplies and equipment for IPC', '10.7 Proper storage for sterile equipment', '10.8 Adequate area for hand washing',
        '10.9 Guidelines for healthcare waste management', '10.10 In-service training in HCWM in the last two years',
        '10.11 Adequate waste disposal supplies and materials', '10.12 Refuse and medical waste disposal facilities',
        '10.13 Reporting system for adverse events and medical errors', '10.14 Occupational health and safety programme'] },
      { type: 'paragraph', key: 'gaps', title: 'Key gaps and agreed improvement actions', required: false }
    ]))
  },

  /* 7. QI documentation journal ---------------------------------------- */
  {
    key: 'qij',
    tab: 'QI Journal',
    short: 'QI Documentation Journal',
    title: 'QI Documentation Journal: Jinja RRH and Busoga Region',
    description: 'Online version of the Documentation Journal for QI activities. Register each improvement project once, ' +
      'then record every change the team tests (Part 2) and the indicator numerator and denominator each month (Part 3). ' +
      'The RCQI dashboard turns the entries into the journal page and its annotated graph. Text entered here is shown ' +
      'on the dashboard, so please do not include patient names, hospital numbers or other identifying details. Team ' +
      'names and email addresses are kept in the master sheet only. Everyone on a project\'s team email list receives a ' +
      'short email after each entry for that project.',
    confirmation: 'Thank you. Your journal entry has been recorded and will appear on the RCQI dashboard shortly.',
    facilityMapped: true,
    retired: [{ title: 'Name of the facility', type: 'mc', as: 'facilityLegacy' }],
    extras: FACILITY_EXTRAS_,
    items: [
      { type: 'mc', key: 'entryType', title: 'What would you like to record?', required: true,
        options: ['Register a new QI project', 'Record a change tested', 'Record monthly results', 'Update the team email list'],
        routes: ['sec_reg', 'sec_change', 'sec_month', 'sec_team'],
        help: 'Register a project once (journal header and Part 1). Record each change tested (Part 2) and each month of results (Part 3) against the registered project. To update a project\'s details, register it again with the same facility and short title. Use the team email list option to add or remove people who receive notifications.' },
      { type: 'section', key: 'sec_reg', title: 'Register a QI project',
        help: 'Journal header and Part 1: the improvement objective, its indicator and the problem being addressed.' }
    ].concat(facilityBlock_(), [
      { type: 'mc', key: 'region', title: 'Region', required: true, options: ['Busoga'], other: true }
    ], facilityPages_('sec_reg_details'), [
      { type: 'section', key: 'sec_reg_details', title: 'Project details',
        help: 'Journal header and Part 1: the team, the improvement objective, its indicator and the problem being addressed.' },
      { type: 'mc', key: 'department', title: 'Department or unit (for hospital projects)', required: false, options: LISTS.departments, other: true },
      { type: 'text', key: 'projectTitle', exportField: true, title: 'Short project title', required: true,
        help: 'For example: Reduce hypothermia on admission to NICU. Teams choose this title when recording changes and monthly results, so please keep it unique within the facility.' },
      { type: 'text', key: 'teamLeader', title: 'Team leader', required: true },
      { type: 'paragraph', key: 'teamMembers', countAs: 'teamSize', title: 'Team members', required: false, help: 'One name per line. Names stay in the master sheet; the dashboard shows only the team size.' },
      { type: 'paragraph', key: 'teamEmails', emails: true, title: 'Team member email addresses for notifications', required: false,
        help: 'One address per line, or separated by commas. Everyone listed receives an email when this project is registered or updated and after every change or monthly result recorded for it. Addresses stay in the master sheet and are never shown on the dashboard.' },
      { type: 'date', key: 'startDate', title: 'Start date for the improvement project', required: true },
      { type: 'date', key: 'endDate', title: 'Planned end date', required: false },
      { type: 'paragraph', key: 'objective', exportField: true, title: 'Improvement objective', required: true },
      { type: 'text', key: 'indicator', exportField: true, title: 'Indicator for the objective', required: true },
      { type: 'text', key: 'numeratorDef', exportField: true, title: 'Numerator: what is counted', required: true },
      { type: 'text', key: 'denominatorDef', exportField: true, title: 'Denominator: counted out of what', required: true },
      { type: 'number', key: 'target', title: 'Target for the indicator (%)', required: false, min: 0, max: 100 },
      { type: 'paragraph', key: 'problem', exportField: true, title: 'Description of the problem', required: true,
        help: 'Briefly describe the problem being addressed and the gaps between the current situation and your improvement objective. State the differences between the MoH standard of care and current practice, and describe some of the challenges with the current situation.' },
      { type: 'section', key: 'sec_change', goTo: 'SUBMIT', title: 'Part 2: Changes worksheet',
        help: 'Record each change the team has tried in order to achieve the improvement objective, whether effective or not, with its start and end dates so that the results can be annotated.' },
      { type: 'dropdown', key: 'project_c', as: 'project', dynamic: 'projects', title: 'Which QI project is this change for?', required: true, options: ['No projects registered yet'] },
      { type: 'paragraph', key: 'change', exportField: true, title: 'Planned and tested change', required: true, help: 'Use one or two sentences to describe the change tested.' },
      { type: 'date', key: 'changeStart', title: 'Start date of the change', required: true },
      { type: 'date', key: 'changeEnd', title: 'End date of the change (if applicable)', required: false },
      { type: 'mc', key: 'improved', title: 'Was any improvement registered?', required: true, options: ['Yes', 'No', 'Too early to tell'] },
      { type: 'paragraph', key: 'changeComments', exportField: true, title: 'Comments on the change', required: false, help: 'Note any potential reasons why the change did or did not yield improvement.' },
      { type: 'section', key: 'sec_month', goTo: 'SUBMIT', title: 'Part 3: Monthly results',
        help: 'Record the numerator and denominator of the indicator for one month. The dashboard plots the percentage and annotates the graph with the changes tested.' },
      { type: 'dropdown', key: 'project_m', as: 'project', dynamic: 'projects', title: 'Which QI project are these results for?', required: true, options: ['No projects registered yet'] },
      { type: 'date', key: 'month', title: 'Month of measurement', required: true, help: 'Any date within the month.' },
      { type: 'number', key: 'numerator', title: 'Numerator for the month', required: true, min: 0, max: 100000 },
      { type: 'number', key: 'denominator', title: 'Denominator for the month', required: true, min: 1, max: 100000 },
      { type: 'paragraph', key: 'indicatorNotes', exportField: true, title: 'Notes on the indicator', required: false,
        help: 'Any additional comments on the performance of the indicator, including anything from the changes worksheet or the graph that might explain the trend.' },
      { type: 'paragraph', key: 'effects', exportField: true, title: 'Other observed effects and lessons learnt', required: false,
        help: 'Effects, positive or negative, observed as a result of the QI effort: feedback from patients, changes in performance or motivation, improved efficiency, or the story of a patient helped. Do not include names or identifying details.' },
      { type: 'section', key: 'sec_team', goTo: 'SUBMIT', title: 'Team email list',
        help: 'Add or remove the email addresses that receive notifications for a registered project. Addresses stay in the master sheet and are never shown on the dashboard.' },
      { type: 'dropdown', key: 'project_t', as: 'project', dynamic: 'projects', title: 'Which QI project is this team update for?', required: true, options: ['No projects registered yet'] },
      { type: 'paragraph', key: 'emailsAdd', emails: true, title: 'Email addresses to add', required: false, help: 'One address per line, or separated by commas.' },
      { type: 'paragraph', key: 'emailsRemove', emails: true, title: 'Email addresses to remove', required: false, help: 'These people stop receiving notifications for this project.' }
    ])
  }
];

/* ------------------------------------------------------------------------ */
/* Setup                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Creates the folder, the master spreadsheet, the seven forms and the trigger.
 * Safe to run twice: a second run only prints the existing links.
 */
function setupRCQI() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SPREADSHEET_ID')) {
    Logger.log('RCQI is already set up. Printing the existing links instead.');
    showLinks();
    return;
  }
  var folder = DriveApp.createFolder(RCQI.folderName);
  var ss = SpreadsheetApp.create(RCQI.sheetName);
  ss.setSpreadsheetTimeZone(RCQI.timezone);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  var readMe = ss.getSheets()[0];
  readMe.setName('Read Me');

  var directory = loadFacilityDirectory(SpreadsheetApp.openById(ss.getId()));
  var links = {};
  FORM_DEFS.forEach(function (def) {
    links[def.key] = createLinkedForm_(def, ss.getId(), folder, directory);
  });

  props.setProperties({
    SPREADSHEET_ID: ss.getId(),
    FOLDER_ID: folder.getId(),
    FORM_LINKS: JSON.stringify(links),
    API_TOKEN: Utilities.getUuid().replace(/-/g, ''),
    HSR_SEQ: '0'
  });

  writeReadMe_(SpreadsheetApp.openById(ss.getId()), links);
  setupNotifications();
  ScriptApp.newTrigger('onRcqiFormSubmit').forSpreadsheet(ss.getId()).onFormSubmit().create();
  Logger.log('Setup complete.');
  showLinks();
}

/** Creates one form, links it to the master sheet in its own named tab and returns its links. */
function createLinkedForm_(def, ssId, folder, directory) {
  var form = buildForm_(def, directory || []);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ssId);
  DriveApp.getFileById(form.getId()).moveTo(folder);
  var sheet = waitForFormSheet_(ssId, [form.getId(), form.getPublishedUrl().split('/d/e/')[1].split('/')[0]]);
  sheet.setName(def.tab);
  styleHeader_(sheet);
  if (def.extras) addExtraColumns_(sheet, def.extras);
  if (def.facilityMapped) ensureFacilityColumns_(sheet, SpreadsheetApp.openById(ssId));
  var published = form.getPublishedUrl();
  var shortUrl = published;
  try { shortUrl = form.shortenFormUrl(published); } catch (err) { Logger.log('Short link unavailable: ' + err); }
  Logger.log('Created form: ' + def.title);
  return { id: form.getId(), url: published, shortUrl: shortUrl, editUrl: form.getEditUrl() };
}

/**
 * Adds any form defined in FORM_DEFS that does not exist yet (for example the QI Documentation Journal)
 * without touching the existing forms or their data. Safe to run more than once.
 */
function addMissingForms() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('SPREADSHEET_ID');
  if (!ssId) throw new Error('Run setupRCQI first.');
  var folder = DriveApp.getFolderById(props.getProperty('FOLDER_ID'));
  var links = JSON.parse(props.getProperty('FORM_LINKS') || '{}');
  var ss = SpreadsheetApp.openById(ssId);
  var directory = facilityDirectory_(ss);
  if (!directory.length) directory = loadFacilityDirectory(ss);
  var added = [];
  FORM_DEFS.forEach(function (def) {
    if (links[def.key]) return;
    links[def.key] = createLinkedForm_(def, ssId, folder, directory);
    added.push(def.short);
  });
  props.setProperty('FORM_LINKS', JSON.stringify(links));
  if (added.length) {
    writeReadMe_(SpreadsheetApp.openById(ssId), links);
    CacheService.getScriptCache().remove('payload');
  }
  Logger.log(added.length ? 'Added: ' + added.join(', ') : 'No missing forms.');
  showLinks();
}

function buildForm_(def, directory) {
  var form = FormApp.create(def.title);
  addLogo_(form);
  form.setDescription(def.description);
  form.setConfirmationMessage(def.confirmation || 'Thank you. Your submission has been recorded for the RCQI dashboard.');
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(true);
  var created = {};
  def.items.forEach(function (it) { created[it.key || it.title] = addItem_(form, it); });
  applyRoutes_(def, created, directory || []);
  return form;
}

/**
 * Branching and DHIS2 lists: routes each answer of a routing question to its section, fills each district's facility
 * list from the directory (every facility continues, "not listed" goes to the typed name) and ends sections with Submit.
 * Items read back from a form are generic and need converting; items just created are already typed.
 */
function applyRoutes_(def, found, directory) {
  var asPage = function (item) { return item.asPageBreakItem ? item.asPageBreakItem() : item; };
  var asChoice = function (item, type) {
    if (type === 'dropdown') return item.asListItem ? item.asListItem() : item;
    return item.asMultipleChoiceItem ? item.asMultipleChoiceItem() : item;
  };
  var target = function (key) { return key === 'SUBMIT' ? FormApp.PageNavigationType.SUBMIT : asPage(found[key]); };
  def.items.forEach(function (it) {
    var k = it.key || it.title;
    if (!found[k]) return;
    if (it.type === 'section' && it.goTo === 'SUBMIT') asPage(found[k]).setGoToPage(FormApp.PageNavigationType.SUBMIT);
    if (it.routes) {
      var router = asChoice(found[k], it.type);
      router.setChoices(it.options.map(function (label, i) { return router.createChoice(label, target(it.routes[i])); }));
    }
    if (it.facilities) {
      var list = asChoice(found[k], it.type);
      list.setChoices(facilityOptions_(directory, it.facilities).map(function (name) {
        return list.createChoice(name, target(name === NOT_LISTED_ ? it.routeOther : it.routeAll));
      }));
    }
  });
}

/** Fetches the coat of arms of Uganda (transparent PNG), full size or the small email copy. Returns null if it cannot be fetched. */
function fetchLogo_(url) {
  url = url || RCQI.logoUrl;
  if (!url) return null;
  try {
    return UrlFetchApp.fetch(url).getBlob().setName('uganda-coat-of-arms.png');
  } catch (err) {
    Logger.log('Coat of arms could not be fetched: ' + err);
    return null;
  }
}

/** Places the coat of arms at the top of a form. Skipped quietly if the image cannot be fetched. */
function addLogo_(form, blob) {
  blob = blob || fetchLogo_();
  if (!blob) return false;
  var img = form.addImageItem().setImage(blob).setAlignment(FormApp.Alignment.CENTER).setWidth(RCQI.logoWidth);
  form.moveItem(img.getIndex(), 0);
  return true;
}

/**
 * Puts the coat of arms at the top of every form: replaces the image already there (keeping its place)
 * or adds one. Safe to run more than once.
 */
function replaceFormLogos() {
  var links = JSON.parse(PropertiesService.getScriptProperties().getProperty('FORM_LINKS') || '{}');
  var blob = fetchLogo_();
  if (!blob) throw new Error('The coat of arms could not be fetched from ' + RCQI.logoUrl);
  FORM_DEFS.forEach(function (def) {
    if (!links[def.key]) return;
    var form = FormApp.openById(links[def.key].id);
    var images = form.getItems(FormApp.ItemType.IMAGE);
    if (images.length) {
      images[0].asImageItem().setImage(blob).setAlignment(FormApp.Alignment.CENTER).setWidth(RCQI.logoWidth);
      if (images[0].getIndex() !== 0) form.moveItem(images[0].getIndex(), 0);
      Logger.log(def.short + ': coat of arms replaced');
    } else {
      addLogo_(form, blob);
      Logger.log(def.short + ': coat of arms added');
    }
  });
}

/** Kept for older instructions: same as replaceFormLogos. */
function addLogoToForms() { replaceFormLogos(); }

function addItem_(form, it) {
  var item;
  switch (it.type) {
    case 'section':
      item = form.addPageBreakItem().setTitle(it.title);
      if (it.help) item.setHelpText(it.help);
      // goTo SUBMIT ends the previous section with Submit instead of running on into this one.
      if (it.goTo === 'SUBMIT') item.setGoToPage(FormApp.PageNavigationType.SUBMIT);
      return item;
    case 'mc':
      item = form.addMultipleChoiceItem().setTitle(it.title).setChoiceValues(it.options);
      if (it.other) item.showOtherOption(true);
      break;
    case 'checkbox':
      item = form.addCheckboxItem().setTitle(it.title).setChoiceValues(it.options);
      if (it.other) item.showOtherOption(true);
      break;
    case 'dropdown':
      item = form.addListItem().setTitle(it.title).setChoiceValues(it.options);
      break;
    case 'text':
      item = form.addTextItem().setTitle(it.title);
      break;
    case 'number':
      item = form.addTextItem().setTitle(it.title);
      var rule = FormApp.createTextValidation()
        .setHelpText('Please enter a number from ' + (it.min || 0) + ' to ' + it.max + '.')
        .requireNumberBetween(it.min || 0, it.max)
        .build();
      item.setValidation(rule);
      break;
    case 'paragraph':
      item = form.addParagraphTextItem().setTitle(it.title);
      if (it.emails) {
        item.setValidation(FormApp.createParagraphTextValidation()
          .setHelpText('Please enter valid email addresses, one per line or separated by commas.')
          .requireTextMatchesPattern(EMAIL_LIST_PATTERN)
          .build());
      }
      break;
    case 'date':
      item = form.addDateItem().setTitle(it.title);
      break;
    case 'time':
      item = form.addTimeItem().setTitle(it.title);
      break;
    case 'grid':
      item = form.addGridItem().setTitle(it.title)
        .setRows(it.rows.map(function (r) { return r.code + '. ' + r.text; }))
        .setColumns(it.columns);
      break;
    default:
      throw new Error('Unknown item type: ' + it.type);
  }
  if (it.help) item.setHelpText(it.help);
  if (it.required) item.setRequired(true);
  return item;
}

function waitForFormSheet_(ssId, formIds) {
  for (var attempt = 0; attempt < 20; attempt++) {
    SpreadsheetApp.flush();
    var sheets = SpreadsheetApp.openById(ssId).getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var url = sheets[i].getFormUrl();
      if (!url) continue;
      for (var j = 0; j < formIds.length; j++) {
        if (formIds[j] && url.indexOf(formIds[j]) > -1) return sheets[i];
      }
    }
    Utilities.sleep(1500);
  }
  throw new Error('The response tab for form ' + formIds[0] + ' did not appear. Please run setupRCQI again.');
}

function styleHeader_(sheet) {
  var width = Math.max(sheet.getLastColumn(), 1);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setFontFamily(RCQI.font);
  sheet.getRange(1, 1, 1, width)
    .setBackground(RCQI.headerColour).setFontColor(RCQI.headerText).setFontWeight('bold').setWrap(true);
  sheet.setFrozenRows(1);
}

/** Applies the Ubuntu typeface to every tab of the master sheet. Safe to run at any time. */
function applyBrandFont() {
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  ss.getSheets().forEach(function (sheet) {
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setFontFamily(RCQI.font);
  });
  Logger.log('Font set to ' + RCQI.font + ' on ' + ss.getSheets().length + ' tabs.');
}

function addExtraColumns_(sheet, extras) {
  var start = sheet.getLastColumn() + 1;
  extras.forEach(function (ex, i) { sheet.getRange(1, start + i).setValue(ex.header); });
  styleHeader_(sheet);
  sheet.getRange(1, start, 1, extras.length).setBackground('#6F823B');
  var statusIndex = extras.map(function (e) { return e.key; }).indexOf('status');
  if (statusIndex > -1) {
    var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(LISTS.hsrStatus, true)
      .setAllowInvalid(false).build();
    sheet.getRange(2, start + statusIndex, sheet.getMaxRows() - 1, 1).setDataValidation(statusRule);
  }
  var closedIndex = extras.map(function (e) { return e.key; }).indexOf('closed');
  if (closedIndex > -1) {
    var dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build();
    sheet.getRange(2, start + closedIndex, sheet.getMaxRows() - 1, 1).setDataValidation(dateRule).setNumberFormat('yyyy-mm-dd');
  }
}

function writeReadMe_(ss, links) {
  var sh = ss.getSheetByName('Read Me');
  var rows = [
    ['RCQI Jinja RRH Master Database', ''],
    ['Purpose', 'Single source for the Regional Continuous Quality Improvement (RCQI) dashboard of Jinja Regional Referral Hospital.'],
    ['Important', 'Do not rename tabs, reorder form questions or edit question titles once data collection has started. The dashboard reads columns by their titles and item codes.'],
    ['HSR follow-up', 'The QI Committee updates the columns Reference No., QI Review Status, QI Action Taken and Date Closed on the HSR Reports tab. New reports receive a reference number automatically.'],
    ['Privacy', 'Free text from the HSR and the assessment forms (descriptions, causes, comments), all names, phone numbers and email addresses stay in this sheet and are never sent to the dashboard. QI Journal narratives (objective, problem, changes and notes) are published on the dashboard QI Journal page; team names and email addresses are not.'],
    ['QI Journal notifications', 'Every QI Journal entry emails the project\'s team list (addresses from the registration and from any "Update the team email list" entries) and each person on the ' + RCQI.notifyTab + ' tab whose Active column is Yes and whose Facility is "All facilities" or the project\'s facility. Every send is recorded on the ' + RCQI.notifyLogTab + ' tab. A personal Gmail account can send to about 100 recipients a day.'],
    ['DHIS2 facilities', 'Facility forms ask for the district first, then list that district\'s facilities from the ' + RCQI.facilitiesTab + ' tab (pulled from the DHIS2 test instance). On each submission the DHIS2 facility, DHIS2 district, DHIS2 UID and Facility match columns are filled. Names typed on the "not in the list" page are matched automatically; any marked "Please confirm" or "Not found" are corrected by choosing the facility in the DHIS2 facility column. The dashboard always uses that column when it is filled.'],
    ['', ''],
    ['Form', 'Share link']
  ];
  var formRow = rows.length;
  FORM_DEFS.forEach(function (def) { rows.push([def.short, links[def.key].shortUrl]); });
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setFontFamily(RCQI.font);
  sh.getRange(1, 1).setFontSize(14).setFontWeight('bold').setFontColor(RCQI.headerColour);
  sh.getRange(formRow, 1, 1, 2).setBackground(RCQI.headerColour).setFontColor(RCQI.headerText).setFontWeight('bold');
  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 760);
  sh.getRange(1, 2, rows.length, 1).setWrap(true);
}

/** Prints the form links, the spreadsheet link and the API token to the execution log. */
function showLinks() {
  var props = PropertiesService.getScriptProperties();
  var links = JSON.parse(props.getProperty('FORM_LINKS') || '{}');
  Logger.log('Spreadsheet: https://docs.google.com/spreadsheets/d/' + props.getProperty('SPREADSHEET_ID'));
  FORM_DEFS.forEach(function (def) {
    if (links[def.key]) Logger.log(def.short + ': ' + links[def.key].shortUrl + ' (edit: ' + links[def.key].editUrl + ')');
  });
  Logger.log('RCQI_API_TOKEN=' + props.getProperty('API_TOKEN'));
}

/** Issues a new API token. Update RCQI_API_TOKEN on Vercel afterwards. */
function rotateApiToken() {
  var token = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', token);
  CacheService.getScriptCache().remove('payload');
  Logger.log('RCQI_API_TOKEN=' + token);
}

/** Installable trigger: numbers each new HSR report and marks it Pending review. */
function onRcqiFormSubmit(e) {
  if (!e || !e.range) return;
  CacheService.getScriptCache().remove('payload');
  var sheet = e.range.getSheet();
  var tabDef = FORM_DEFS.filter(function (d) { return d.tab === sheet.getName(); })[0];
  if (tabDef && tabDef.facilityMapped) {
    try { writeFacilityMapping_(sheet, e.range.getRow(), tabDef, facilityDirectory_(sheet.getParent())); } catch (err) { Logger.log('Facility mapping failed: ' + err); }
  }
  if (sheet.getName() === 'QI Journal') {
    try { refreshJournalProjects(); } catch (err) { Logger.log('Project list not refreshed: ' + err); }
    try { notifyJournalEntry_(sheet, e.range.getRow()); } catch (err) { Logger.log('Notification failed: ' + err); }
    return;
  }
  if (sheet.getName() !== 'HSR Reports') return;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var refCol = headers.indexOf('Reference No.') + 1;
    var statusCol = headers.indexOf('QI Review Status') + 1;
    var row = e.range.getRow();
    var props = PropertiesService.getScriptProperties();
    if (refCol > 0 && !sheet.getRange(row, refCol).getValue()) {
      var seq = Number(props.getProperty('HSR_SEQ') || '0') + 1;
      props.setProperty('HSR_SEQ', String(seq));
      var year = Utilities.formatDate(new Date(), RCQI.timezone, 'yyyy');
      sheet.getRange(row, refCol).setValue('HSR-' + year + '-' + ('0000' + seq).slice(-4));
    }
    if (statusCol > 0 && !sheet.getRange(row, statusCol).getValue()) {
      sheet.getRange(row, statusCol).setValue('Pending review');
    }
  } finally {
    lock.releaseLock();
  }
}

/** The label teams pick for a registered project: "Facility: Short project title". */
function projectLabel_(rec) {
  return String(rec.facility || 'Unknown facility').trim() + ': ' + String(rec.projectTitle || 'Untitled project').trim();
}

/** Rebuilds the project drop-down lists in the QI Journal form from the registered projects. */
function refreshJournalProjects() {
  var props = PropertiesService.getScriptProperties();
  var links = JSON.parse(props.getProperty('FORM_LINKS') || '{}');
  var def = FORM_DEFS.filter(function (d) { return d.key === 'qij'; })[0];
  if (!links.qij || !def) return;
  var ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
  var sheet = ss.getSheetByName(def.tab);
  var values = sheet ? sheet.getDataRange().getValues() : [[]];
  var records = applyFacilityMapping_(def, values, parseValues_(def, values, RCQI.timezone).records, facilityDirectory_(ss));
  var labels = [];
  records.forEach(function (r) {
    if (String(r.entryType || '').indexOf('Register') === 0) {
      var label = projectLabel_(r);
      if (labels.indexOf(label) === -1) labels.push(label);
    }
  });
  labels.sort();
  var form = FormApp.openById(links.qij.id);
  def.items.forEach(function (it) {
    if (it.dynamic !== 'projects') return;
    form.getItems(FormApp.ItemType.LIST).forEach(function (item) {
      if (item.getTitle() === it.title) item.asListItem().setChoiceValues(labels.length ? labels : it.options);
    });
  });
  Logger.log('QI Journal project list: ' + labels.length + ' project(s).');
}

/* ------------------------------------------------------------------------ */
/* DHIS2 facility directory and matching                                     */
/* ------------------------------------------------------------------------ */

/** Display labels: the facility name, with the district added only where two districts share a name. */
function facilityLabels_(facilities) {
  var count = {};
  facilities.forEach(function (f) { var k = f.name.toLowerCase(); count[k] = (count[k] || 0) + 1; });
  return facilities.map(function (f) { return count[f.name.toLowerCase()] > 1 ? f.name + ' (' + f.district + ')' : f.name; });
}

var FACILITY_HEADER_ = ['Label', 'Facility', 'District', 'Sub-county', 'Local government', 'Level', 'Ownership', 'Functional', 'DHIS2 UID'];

/**
 * Writes the DHIS2 facility list into the DHIS2 Facilities tab from the repository copy. Rows a coordinator added by hand
 * (no UID, or a UID not in the new list) are kept below. Safe to run more than once.
 */
function loadFacilityDirectory(ss) {
  ss = ss || SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  var json = JSON.parse(UrlFetchApp.fetch(RCQI.facilitiesUrl).getContentText());
  var labels = facilityLabels_(json.facilities);
  var rows = json.facilities.map(function (f, i) {
    return [labels[i], f.name, f.district, f.subcounty, f.dlg, f.level || '', f.ownership || '', f.functional ? 'Yes' : 'No', f.uid];
  });
  var sh = ss.getSheetByName(RCQI.facilitiesTab);
  var kept = [];
  if (sh) {
    var known = {};
    json.facilities.forEach(function (f) { known[f.uid] = true; });
    sh.getDataRange().getValues().slice(1).forEach(function (r) {
      if (String(r[1]).trim() && !known[String(r[8]).trim()]) kept.push(r.slice(0, FACILITY_HEADER_.length));
    });
    sh.clearContents();
  } else {
    sh = ss.insertSheet(RCQI.facilitiesTab);
  }
  var all = [FACILITY_HEADER_].concat(rows, kept);
  sh.getRange(1, 1, all.length, FACILITY_HEADER_.length).setValues(all);
  styleHeader_(sh);
  sh.setColumnWidth(1, 320); sh.setColumnWidth(2, 300);
  Logger.log('DHIS2 Facilities: ' + rows.length + ' facilities from DHIS2 (' + json.pulled + ')' + (kept.length ? ' and ' + kept.length + ' added by hand' : '') + '.');
  return facilityDirectory_(ss);
}

/** The facility directory from the DHIS2 Facilities tab: [{label, name, district, subcounty, dlg, level, ownership, functional, uid}]. */
function facilityDirectory_(ss) {
  var sh = ss.getSheetByName(RCQI.facilitiesTab);
  if (!sh) return [];
  return directoryFromRows_(sh.getDataRange().getValues());
}

function directoryFromRows_(values) {
  return (values || []).slice(1).filter(function (r) { return String(r[1]).trim(); }).map(function (r) {
    return { label: String(r[0]).trim() || String(r[1]).trim(), name: String(r[1]).trim(), district: String(r[2]).trim(), subcounty: String(r[3]).trim(),
      dlg: String(r[4]).trim(), level: String(r[5]).trim() || null, ownership: String(r[6]).trim() || null, functional: String(r[7]).trim() !== 'No', uid: String(r[8]).trim() };
  });
}

/** Builds directory rows (as the tab holds them) from the repository JSON; used by tests and fresh set-ups. */
function directoryFromJson_(json) {
  var labels = facilityLabels_(json.facilities);
  return directoryFromRows_([FACILITY_HEADER_].concat(json.facilities.map(function (f, i) {
    return [labels[i], f.name, f.district, f.subcounty, f.dlg, f.level || '', f.ownership || '', f.functional ? 'Yes' : 'No', f.uid];
  })));
}

/** Facility names offered for one district, in alphabetical order, followed by the not-listed answer. */
function facilityOptions_(directory, district) {
  var names = directory.filter(function (f) { return f.district === district; }).map(function (f) { return f.name; });
  names.sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0); });
  return names.concat([NOT_LISTED_]);
}

var FAC_GENERIC_ = { hc: 1, ii: 1, iii: 1, iv: 1, hospital: 1, general: 1, medical: 1, centre: 1, clinic: 1, health: 1, regional: 1,
  referral: 1, government: 1, ngo: 1, saint: 1, community: 1, care: 1, unit: 1, services: 1, domiciliary: 1, maternity: 1 };
var FAC_WORDS_ = { hosp: 'hospital', hospitals: 'hospital', gen: 'general', med: 'medical', center: 'centre', ctr: 'centre', cntr: 'centre',
  clinc: 'clinic', cinic: 'clinic', clinics: 'clinic', govt: 'government', gvt: 'government', gov: 'government', st: 'saint', prison: 'prisons',
  domicilliary: 'domiciliary', domicilary: 'domiciliary' };
var FAC_STOP_ = { the: 1, of: 1, and: 1 };

/** Lower-case word tokens with health-facility abbreviations expanded: "Nankoma H/C 4" becomes nankoma hc iv. */
function facilityTokens_(s) {
  var raw = String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/h\/c/g, ' hc ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ');
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var t = raw[i];
    if (!t || FAC_STOP_[t]) continue;
    if (t === 'jrrh') { out.push('jinja', 'regional', 'referral', 'hospital'); continue; }
    if (t === 'rrh') { out.push('regional', 'referral', 'hospital'); continue; }
    if (t === 'h' && raw[i + 1] === 'c') { out.push('hc'); i += 1; continue; }
    if (t === 'health' && /^cent(re|er)$/.test(raw[i + 1] || '')) { out.push('hc'); i += 1; continue; }
    var m = t.match(/^hc(ii|iii|iv|[234])$/);
    if (m) { out.push('hc', ({ '2': 'ii', '3': 'iii', '4': 'iv' })[m[1]] || m[1]); continue; }
    if (/^[234]$/.test(t) && out[out.length - 1] === 'hc') { out.push(({ '2': 'ii', '3': 'iii', '4': 'iv' })[t]); continue; }
    out.push(FAC_WORDS_[t] || t);
  }
  return out;
}

/** HC II, HC III, HC IV, Hospital or RRH when the name states it. */
function facilityLevelOf_(tokens) {
  var s = ' ' + tokens.join(' ') + ' ';
  if (/ regional referral hospital /.test(s)) return 'RRH';
  var m = s.match(/ hc (ii|iii|iv) /);
  if (m) return 'HC ' + m[1].toUpperCase();
  if (/ hospital /.test(s)) return 'Hospital';
  return null;
}

function levelOfDirectory_(level) {
  if (!level) return null;
  if (level === 'General Hospital') return 'Hospital';
  return /^(HC II|HC III|HC IV|RRH)$/.test(level) ? level : null;
}

function editDistance_(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  var prev = [], cur, i, j;
  for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    cur = [i];
    for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** How alike two words are: identical 1, a small slip in a longer word 0.85 or 0.7, otherwise 0. */
function wordSim_(a, b) {
  if (a === b) return 1;
  var n = Math.min(a.length, b.length);
  if (n < 4) return 0;
  var d = editDistance_(a, b);
  if (d === 1) return 0.85;
  if (d === 2 && n >= 7) return 0.7;
  return 0;
}

function bagSim_(x, y) {
  if (!x.length && !y.length) return 1;
  if (!x.length || !y.length) return 0;
  var best = function (from, to) {
    var sum = 0;
    from.forEach(function (w) { var b = 0; to.forEach(function (v) { b = Math.max(b, wordSim_(w, v)); }); sum += b; });
    return sum;
  };
  return (best(x, y) + best(y, x)) / (x.length + y.length);
}

/** Similarity of a typed name to a directory facility, 0 to 1. Distinctive words count most; a different stated level is penalised. */
function facilityScore_(typed, fac) {
  var a = facilityTokens_(typed), b = facilityTokens_(fac.name);
  if (a.join(' ') === b.join(' ')) return 1;
  var core = function (t) { return t.filter(function (w) { return !FAC_GENERIC_[w]; }); };
  var gen = function (t) { return t.filter(function (w) { return FAC_GENERIC_[w]; }); };
  var score = 0.85 * bagSim_(core(a), core(b)) + 0.15 * bagSim_(gen(a), gen(b));
  var la = facilityLevelOf_(a), lb = levelOfDirectory_(fac.level) || facilityLevelOf_(b);
  var hospitals = { Hospital: 1, RRH: 1 };
  if (la && lb && la !== lb && !(hospitals[la] && hospitals[lb])) score *= 0.6;
  return Math.round(score * 1000) / 1000;
}

/**
 * Matches one entry to the directory. input: {district, picked, typed}.
 * Returns {status, fac, score, entered, note}: selected (picked from the list), matched (typed name, confident),
 * review (a likely facility that needs a person to confirm), unmatched, or none (no facility answered).
 */
function matchFacility_(input, directory) {
  var district = String(input.district || '').trim();
  var picked = String(input.picked || '').trim();
  var typed = String(input.typed || '').trim();
  if (picked && picked !== NOT_LISTED_) {
    var exact = directory.filter(function (f) { return f.district === district && f.name === picked; })[0] ||
      directory.filter(function (f) { return f.name === picked || f.label === picked; })[0];
    if (exact) return { status: 'selected', fac: exact, score: 1, entered: picked };
    if (!typed) typed = picked;
  }
  if (!typed) return { status: 'none', fac: null, score: 0, entered: '' };
  var inDistrict = BUSOGA_.indexOf(district) > -1;
  var rank = function (list) {
    return list.map(function (f) { return { f: f, s: facilityScore_(typed, f) }; }).sort(function (x, y) { return y.s - x.s; });
  };
  var local = inDistrict ? rank(directory.filter(function (f) { return f.district === district; })) : [];
  var all = rank(directory);
  var top = local[0], second = local[1];
  var unique = function (x, y) { return x.s === 1 ? (!y || y.s < 1) : (!y || x.s - y.s >= 0.06); };
  if (top && top.s >= 0.85 && unique(top, second)) {
    return { status: 'matched', fac: top.f, score: top.s, entered: typed };
  }
  var best = all[0];
  if (top && top.s >= 0.6) {
    return { status: 'review', fac: top.f, score: top.s, entered: typed, note: top.s >= 0.85 && !unique(top, second) ? 'Two facilities are equally close.' : '' };
  }
  if (best && best.s >= 0.85) {
    var other = inDistrict && best.f.district !== district;
    if (!inDistrict && unique(best, all[1])) return { status: 'matched', fac: best.f, score: best.s, entered: typed };
    return { status: 'review', fac: best.f, score: best.s, entered: typed, note: other ? 'Registered in ' + districtLabel_(best.f.district) + ', not ' + districtLabel_(district) + '.' : '' };
  }
  if (best && best.s >= 0.6) return { status: 'review', fac: best.f, score: best.s, entered: typed, note: '' };
  return { status: 'unmatched', fac: null, score: best ? best.s : 0, entered: typed };
}

/** The four mapping cells written to a facility tab: DHIS2 facility, DHIS2 district, DHIS2 UID, Facility match. */
function facilityMappingCells_(m) {
  if (!m || m.status === 'none') return null;
  var pct = Math.round(m.score * 100) + '%';
  if (m.status === 'selected' || m.status === 'matched' || m.status === 'confirmed') {
    var how = m.status === 'selected' ? 'Selected from the DHIS2 list' : (m.status === 'confirmed' ? 'Confirmed by a coordinator' : 'Matched from the typed name "' + m.entered + '" (' + pct + ')');
    return [m.fac.label, m.fac.district, m.fac.uid, how];
  }
  if (m.status === 'review') {
    return ['', '', '', 'Please confirm: "' + m.entered + '" is closest to ' + m.fac.label + ' (' + districtLabel_(m.fac.district) + ', ' + pct + '). ' +
      (m.note ? m.note + ' ' : '') + 'Choose the right facility in the DHIS2 facility column.'];
  }
  return ['', '', '', 'Not found in the DHIS2 list: "' + m.entered + '". Choose the right facility in the DHIS2 facility column, or add it to the ' + RCQI.facilitiesTab + ' tab.'];
}

/**
 * Replaces each record's facility answers with the DHIS2 facility (name, district, sub-county, level, UID) and a match status.
 * A label chosen by a coordinator in the tab's DHIS2 facility column always wins. Pure: values is the response tab.
 */
function applyFacilityMapping_(def, values, records, directory) {
  if (!def.facilityMapped) return records;
  var head = values && values.length ? values[0].map(function (h) { return String(h).trim(); }) : [];
  var col = head.indexOf('DHIS2 facility');
  var byLabel = {};
  directory.forEach(function (f) { byLabel[f.label.toLowerCase()] = f; });
  records.forEach(function (rec) {
    var rowIdx = Number(String(rec.id).split('-').pop()) - 1;
    var override = col > -1 && values[rowIdx] ? String(values[rowIdx][col] || '').trim() : '';
    var m = matchFacility_({ district: rec.district, picked: rec.facilityPick, typed: rec.facilityTyped || rec.facilityLegacy }, directory);
    if (override && byLabel[override.toLowerCase()]) m = { status: 'confirmed', fac: byLabel[override.toLowerCase()], score: 1, entered: m.entered || override };
    delete rec.facilityPick; delete rec.facilityTyped; delete rec.facilityLegacy;
    if (m.status === 'none') return;
    rec.facilityEntered = m.entered;
    rec.facilityMatch = m.status;
    if (m.status === 'selected' || m.status === 'matched' || m.status === 'confirmed') {
      rec.facility = m.fac.name;
      rec.district = m.fac.district;
      rec.subcounty = m.fac.subcounty;
      rec.facilityUid = m.fac.uid;
      rec.facilityLevel = m.fac.level;
      rec.facilityOwnership = m.fac.ownership;
    } else {
      rec.facility = m.entered;
      if (m.fac) rec.facilitySuggestion = m.fac.name;
    }
  });
  return records;
}

/** Called by the submit trigger: writes the mapping cells for one new row, unless a coordinator has already set them. */
function writeFacilityMapping_(sheet, rowNumber, def, directory) {
  var values = sheet.getDataRange().getValues();
  var head = values[0].map(function (h) { return String(h).trim(); });
  var cols = FACILITY_EXTRAS_.map(function (ex) { return head.indexOf(ex.header); });
  if (cols[0] < 0 || !values[rowNumber - 1] || String(values[rowNumber - 1][cols[0]]).trim()) return null;
  var rec = parseValues_(def, values, RCQI.timezone).records.filter(function (r) { return r.id === def.key + '-' + rowNumber; })[0];
  if (!rec) return null;
  var m = matchFacility_({ district: rec.district, picked: rec.facilityPick, typed: rec.facilityTyped || rec.facilityLegacy }, directory);
  var cells = facilityMappingCells_(m);
  if (!cells) return null;
  cols.forEach(function (c, i) { if (c > -1) sheet.getRange(rowNumber, c + 1).setValue(cells[i]); });
  return m;
}

/** Adds the mapping columns (with a DHIS2 facility drop-down) to a facility tab that lacks them. */
function ensureFacilityColumns_(sheet, ss) {
  var head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(function (h) { return String(h).trim(); });
  var missing = FACILITY_EXTRAS_.filter(function (ex) { return head.indexOf(ex.header) < 0; });
  if (missing.length) addExtraColumns_(sheet, missing);
  head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var facCol = head.indexOf('DHIS2 facility') + 1;
  var dir = ss.getSheetByName(RCQI.facilitiesTab);
  if (facCol > 0 && dir) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInRange(dir.getRange('A2:A'), true).setAllowInvalid(false)
      .setHelpText('Choose the facility from the DHIS2 Facilities tab.').build();
    sheet.getRange(2, facCol, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  }
  return missing.length;
}

/* ------------------------------------------------------------------------ */
/* Upgrading live forms in place                                             */
/* ------------------------------------------------------------------------ */

/** Forms that upgradeForms() may change. Other forms (the HSR) are left exactly as they are. */
var FORM_UPGRADE_KEYS = ['fives', 'hh', 'ipcBasic', 'ipcMoh', 'hfqap', 'qij'];

var ITEM_TYPE_FOR_ = {
  section: 'PAGE_BREAK', mc: 'MULTIPLE_CHOICE', checkbox: 'CHECKBOX', dropdown: 'LIST', text: 'TEXT',
  number: 'TEXT', paragraph: 'PARAGRAPH_TEXT', date: 'DATE', time: 'TIME', grid: 'GRID'
};

/**
 * Brings an existing form up to date with its definition without touching its responses:
 * adds any question or section that is missing (in its proper place), refreshes help text and description,
 * and reapplies the branching. Existing questions are matched by title and type and never removed or renamed.
 * Returns the titles added. With dryRun nothing is changed.
 */
function syncFormItems_(form, def, dryRun, directory) {
  var removed = [], kept = [];
  var questionCount = form.getItems().filter(function (item) { return item.getType() != FormApp.ItemType.IMAGE; }).length;
  // Retired questions are removed only while the form has no responses; otherwise they stay, so nothing is lost.
  if ((def.retired || []).length) {
    var noResponses = form.getResponses().length === 0;
    def.retired.forEach(function (r) {
      form.getItems().forEach(function (item) {
        if (item.getTitle() !== r.title || item.getType() != FormApp.ItemType[ITEM_TYPE_FOR_[r.type]]) return;
        if (!noResponses) { kept.push(r.title); return; }
        removed.push(r.title);
        if (!dryRun) form.deleteItem(item);
      });
    });
  }
  var items = form.getItems();
  var match = function (it) {
    var type = FormApp.ItemType[ITEM_TYPE_FOR_[it.type]];
    for (var i = 0; i < items.length; i++) {
      if (items[i].getTitle() === it.title && items[i].getType() == type) return items[i];
    }
    return null;
  };
  var found = {};
  var added = [];
  var matched = 0;
  var cursor = 0;
  items.forEach(function (item) {
    if (item.getType() == FormApp.ItemType.IMAGE && item.getIndex() === 0) cursor = 1; // keep the coat of arms first
  });
  def.items.forEach(function (it) {
    var existing = match(it);
    if (existing) {
      matched += 1;
      found[it.key || it.title] = existing;
      cursor = Math.max(cursor, existing.getIndex() + 1);
      if (!dryRun && it.help && existing.getHelpText() !== it.help) existing.setHelpText(it.help);
      return;
    }
    added.push(it.title);
    if (dryRun) return;
    var item = addItem_(form, it);
    form.moveItem(item.getIndex(), cursor);
    found[it.key || it.title] = item;
    cursor += 1;
  });
  var result = { added: added, removed: removed, kept: kept, matched: matched, existing: questionCount };
  if (dryRun) return result;
  if (def.description && form.getDescription() !== def.description) form.setDescription(def.description);
  applyRoutes_(def, found, directory || []);
  return result;
}

/**
 * Run from the editor after pasting a new Code.gs: adds new questions to the live forms listed in
 * FORM_UPGRADE_KEYS, puts the coat of arms on every form, creates the notification tabs and refreshes the
 * journal project lists. Responses and existing questions are never changed. Safe to run more than once.
 */
function upgradeForms() {
  var props = PropertiesService.getScriptProperties();
  var links = JSON.parse(props.getProperty('FORM_LINKS') || '{}');
  var ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
  var directory = loadFacilityDirectory(ss);
  // Check every form first, so a problem with one changes none of them.
  var plans = FORM_DEFS.filter(function (def) { return links[def.key] && FORM_UPGRADE_KEYS.indexOf(def.key) > -1; }).map(function (def) {
    var form = FormApp.openById(links[def.key].id);
    var plan = syncFormItems_(form, def, true, directory);
    // Safety: if most of the form's questions are not recognised, the matching is wrong; change nothing.
    if (plan.matched < plan.existing / 2) {
      throw new Error(def.short + ': only ' + plan.matched + ' of ' + plan.existing + ' questions were recognised, so nothing was changed.');
    }
    return { def: def, form: form };
  });
  plans.forEach(function (p) {
    var res = syncFormItems_(p.form, p.def, false, directory);
    Logger.log(p.def.short + ': ' + (res.added.length ? 'added ' + res.added.length + ' (' + res.added.slice(0, 3).join(' | ') + (res.added.length > 3 ? ' ...' : '') + ')' : 'nothing to add') +
      (res.removed.length ? '; removed ' + res.removed.join(' | ') : '') + (res.kept.length ? '; kept (has responses) ' + res.kept.join(' | ') : '') + '; lists refreshed');
    var tab = ss.getSheetByName(p.def.tab);
    if (tab) {
      SpreadsheetApp.flush();
      styleHeader_(tab);
      if (p.def.facilityMapped) ensureFacilityColumns_(tab, ss);
    }
  });
  replaceFormLogos();
  setupNotifications();
  refreshJournalProjects();
  writeReadMe_(ss, links);
  CacheService.getScriptCache().remove('payload');
  Logger.log('UPGRADE COMPLETE');
}

/* ------------------------------------------------------------------------ */
/* QI Journal notifications                                                  */
/* ------------------------------------------------------------------------ */

var EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
/** Google Forms validation for a list of addresses separated by commas, semicolons, spaces or new lines. */
var EMAIL_LIST_PATTERN = "^[\\s,;]*[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}" +
  "([\\s,;]+[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,})*[\\s,;]*$";
var MONTH_NAMES_ = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var NO_PROJECT_ = 'No projects registered yet';

/** Splits free text into unique, valid, lower-case email addresses. */
function splitEmails_(text) {
  var out = [];
  String(text || '').split(/[\s,;]+/).forEach(function (raw) {
    var e = raw.trim().replace(/^<|>$/g, '').toLowerCase();
    if (e && EMAIL_RE.test(e) && out.indexOf(e) === -1) out.push(e);
  });
  return out;
}

function union_(a, b) {
  var out = a.slice();
  b.forEach(function (x) { if (out.indexOf(x) === -1) out.push(x); });
  return out;
}

function defByKey_(key) {
  return FORM_DEFS.filter(function (d) { return d.key === key; })[0];
}

/** project, change, month or team, matching entryKind in the dashboard. */
function entryKind_(rec) {
  var t = String(rec.entryType || '').toLowerCase();
  if (t.indexOf('register') === 0) return 'project';
  if (t.indexOf('record a change') === 0) return 'change';
  if (t.indexOf('record monthly') === 0) return 'month';
  if (t.indexOf('update the team') === 0) return 'team';
  return 'unknown';
}

/** A project's team email list after the records up to and including index upto (registrations add, team updates add then remove). */
function teamEmailsFor_(records, label, upto) {
  var list = [];
  records.forEach(function (r, i) {
    if (i > upto) return;
    var kind = entryKind_(r);
    if (kind === 'project' && projectLabel_(r) === label) list = union_(list, splitEmails_(r.teamEmails));
    if (kind === 'team' && r.project === label) {
      list = union_(list, splitEmails_(r.emailsAdd));
      var gone = splitEmails_(r.emailsRemove);
      list = list.filter(function (e) { return gone.indexOf(e) === -1; });
    }
  });
  return list;
}

/** Active coordinators for a facility from the QI Notification List tab (header row plus rows). */
function coordinatorEmails_(rows, facility) {
  if (!rows || rows.length < 2) return [];
  var head = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var ce = head.indexOf('email'), cf = head.indexOf('facility'), ca = head.indexOf('active');
  if (ce < 0) return [];
  var want = String(facility || '').trim().toLowerCase();
  var out = [];
  rows.slice(1).forEach(function (r) {
    var active = ca < 0 ? 'yes' : String(r[ca]).trim().toLowerCase();
    var fac = cf < 0 ? '' : String(r[cf]).trim().toLowerCase();
    if (active !== 'yes') return;
    if (fac && fac !== 'all facilities' && fac !== want) return;
    out = union_(out, splitEmails_(r[ce]));
  });
  return out;
}

function monthName_(key) {
  var m = String(key || '').match(/^(\d{4})-(\d{2})/);
  return m ? MONTH_NAMES_[Number(m[2]) - 1] + ' ' + m[1] : '';
}

function fmtPct_(v) { return (Math.round(v * 10) / 10).toFixed(1) + '%'; }
function fmtPts_(v) { var x = Math.round(Math.abs(v) * 10) / 10; return x.toFixed(1) + (x === 1 ? ' point' : ' points'); }
function fmtDate_(iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Number(m[3]) + ' ' + MONTH_NAMES_[Number(m[2]) - 1] + ' ' + m[1] : '';
}

/**
 * Builds the notification for the journal entry on sheet row rowNumber (1-based, header is row 1).
 * Pure: values is the QI Journal tab, coordRows the QI Notification List tab. Returns null for rows it cannot describe.
 */
function journalNotification_(def, values, rowNumber, coordRows, opts) {
  opts = opts || {};
  var records = applyFacilityMapping_(def, values, parseValues_(def, values, opts.tz || RCQI.timezone, { includePrivate: true }).records, opts.directory || []);
  var idx = -1;
  records.forEach(function (r, i) { if (r.id === def.key + '-' + rowNumber) idx = i; });
  if (idx < 0) return null;
  var rec = records[idx];
  var kind = entryKind_(rec);
  if (kind === 'unknown') return null;
  var label = kind === 'project' ? projectLabel_(rec) : String(rec.project || NO_PROJECT_);
  var reg = null;
  var earlierReg = false;
  records.forEach(function (r, i) {
    if (i > idx || entryKind_(r) !== 'project' || projectLabel_(r) !== label) return;
    if (i < idx) earlierReg = true;
    reg = r;
  });
  var split = label.indexOf(': ');
  var facility = reg ? String(reg.facility).trim() : (split > 0 ? label.slice(0, split) : 'Project not registered');
  var title = reg ? String(reg.projectTitle).trim() : (split > 0 ? label.slice(split + 2) : label);
  var team = teamEmailsFor_(records, label, idx);
  var coordinators = coordinatorEmails_(coordRows, facility);
  var facts = [];
  var add = function (k, v) { if (v !== null && v !== undefined && String(v).trim() !== '') facts.push([k, String(v)]); };
  var headline, intro;

  if (kind === 'project') {
    headline = earlierReg ? 'Project details updated' : 'New QI project registered';
    intro = earlierReg
      ? 'The project details have been updated in the QI Documentation Journal. The latest registration is now used on the dashboard.'
      : 'A new improvement project has been registered in the QI Documentation Journal.';
    add('District', rec.district); add('Department or unit', rec.department); add('Team leader', rec.teamLeader);
    add('Start date', fmtDate_(rec.startDate)); add('Planned end date', fmtDate_(rec.endDate));
    add('Improvement objective', rec.objective); add('Indicator', rec.indicator);
    add('Numerator', rec.numeratorDef); add('Denominator', rec.denominatorDef);
    add('Target', rec.target !== null && rec.target !== undefined ? rec.target + '%' : null);
    add('Problem', rec.problem);
    add('Team email list', team.length + (team.length === 1 ? ' person' : ' people'));
  } else if (kind === 'change') {
    var changes = [];
    records.forEach(function (r, i) {
      if (i <= idx && entryKind_(r) === 'change' && r.project === label && r.change) changes.push({ r: r, i: i });
    });
    changes.sort(function (a, b) { return String(a.r.changeStart || '').localeCompare(String(b.r.changeStart || '')) || a.i - b.i; });
    var no = 1;
    changes.forEach(function (c, k) { if (c.i === idx) no = k + 1; });
    headline = 'Change C' + no + ' recorded';
    intro = 'The team has recorded a change tested (Part 2 of the journal). It is marked C' + no + ' on the project graph.';
    add('Change tested', rec.change); add('Start date', fmtDate_(rec.changeStart)); add('End date', fmtDate_(rec.changeEnd));
    add('Improvement registered', rec.improved); add('Comments', rec.changeComments);
  } else if (kind === 'month') {
    var key = String(rec.month || '').slice(0, 7);
    var months = {};
    records.forEach(function (r, i) {
      if (i > idx || entryKind_(r) !== 'month' || r.project !== label || !r.month) return;
      var d = Number(r.denominator);
      if (d > 0) months[String(r.month).slice(0, 7)] = Number(r.numerator) / d * 100;
    });
    headline = 'Results for ' + monthName_(key) + ' recorded';
    intro = 'Monthly results have been recorded for this project (Part 3 of the journal).';
    var pct = months[key];
    add('Month', monthName_(key)); add('Numerator', rec.numerator); add('Denominator', rec.denominator);
    if (pct !== undefined) {
      add('Result', fmtPct_(pct));
      var target = reg && reg.target !== null && reg.target !== undefined ? Number(reg.target) : null;
      if (target !== null) add('Against the target', pct >= target ? 'Target of ' + target + '% met' : fmtPts_(target - pct) + ' below the target of ' + target + '%');
      var prev = Object.keys(months).filter(function (k) { return k < key; }).sort().pop();
      if (prev) {
        var diff = pct - months[prev];
        var dir = Math.abs(diff) < 0.05 ? 'No change on ' : (diff > 0 ? 'Up ' + fmtPts_(diff) + ' on ' : 'Down ' + fmtPts_(diff) + ' on ');
        add('Previous month', dir + monthName_(prev) + ' (' + fmtPct_(months[prev]) + ')');
      }
    }
    add('Notes on the indicator', rec.indicatorNotes); add('Other observed effects', rec.effects);
  } else {
    var added = splitEmails_(rec.emailsAdd), removed = splitEmails_(rec.emailsRemove);
    headline = 'Team email list updated';
    intro = 'The list of people who receive notifications for this project has been updated.';
    add('Addresses added', String(added.length)); add('Addresses removed', String(removed.length));
    add('People now on the list', String(team.length));
  }

  var link = RCQI.dashboardUrl + '/#journal/' + encodeURIComponent(label);
  var footer = 'You receive these emails because your address is on this project\'s team list or on the RCQI coordinator list. ' +
    'To be removed, ask the team leader to use "Update the team email list" in the QI Documentation Journal form, or contact the RCQI coordinator.';
  var content = { headline: headline, title: title, facility: facility, intro: intro, facts: facts, link: link, formUrl: opts.formUrl || '', footer: footer, hasLogo: !!opts.hasLogo };
  return {
    kind: kind, label: label, headline: headline, title: title, facility: facility,
    recipients: union_(team, coordinators), team: team, coordinators: coordinators,
    subject: headline + ': ' + title + ' (' + facility + ')',
    html: renderEmailHtml_(content), text: renderEmailText_(content), link: link
  };
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Army green, square-cornered HTML email with the coat of arms, in Ubuntu where the reader has it. */
function renderEmailHtml_(c) {
  var rows = c.facts.map(function (f) {
    return '<tr><td style="width:36%;padding:9px 12px;border-top:1px solid #E7EADB;color:#6B7158;font-size:13px;vertical-align:top">' + esc_(f[0]) +
      '</td><td style="padding:9px 12px;border-top:1px solid #E7EADB;color:#1E2410;font-size:14px;line-height:1.5;vertical-align:top">' +
      esc_(f[1]).replace(/\r?\n/g, '<br>') + '</td></tr>';
  }).join('');
  var logo = c.hasLogo
    ? '<td style="padding-right:14px;vertical-align:middle"><img src="cid:arms" width="48" alt="Coat of arms of the Republic of Uganda" style="display:block;width:48px;height:auto;border:0"></td>'
    : '';
  var buttons = '<a href="' + esc_(c.link) + '" style="display:inline-block;background:#4B5320;color:#F4F5EC;text-decoration:none;padding:11px 18px;font-weight:700;font-size:14px;border-radius:0">Open the project journal</a>';
  if (c.formUrl) {
    buttons += ' <a href="' + esc_(c.formUrl) + '" style="display:inline-block;background:#FFFFFF;color:#4B5320;text-decoration:none;padding:10px 17px;font-weight:700;font-size:14px;border:1px solid #4B5320;border-radius:0">Add a journal entry</a>';
  }
  return '<div style="margin:0;padding:24px 12px;background:#F4F5EC;font-family:Ubuntu,system-ui,sans-serif;color:#1E2410">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;border-collapse:collapse;background:#FFFFFF;border:1px solid #DCE0CC">' +
    '<tr><td style="background:#4B5320;padding:16px 24px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' + logo +
    '<td style="vertical-align:middle;font-family:Ubuntu,system-ui,sans-serif"><div style="color:#F4F5EC;font-size:18px;font-weight:700">RCQI Jinja RRH</div>' +
    '<div style="color:#E3E7D1;font-size:13px">QI Documentation Journal</div></td></tr></table></td></tr>' +
    '<tr><td style="padding:24px;font-family:Ubuntu,system-ui,sans-serif">' +
    '<div style="color:#6F823B;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase">' + esc_(c.headline) + '</div>' +
    '<div style="color:#1E2410;font-size:20px;font-weight:700;margin:6px 0 2px">' + esc_(c.title) + '</div>' +
    '<div style="color:#4A5136;font-size:14px">' + esc_(c.facility) + '</div>' +
    '<p style="color:#1E2410;font-size:14px;line-height:1.55;margin:16px 0">' + esc_(c.intro) + '</p>' +
    (rows ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-bottom:1px solid #E7EADB;margin:0 0 20px">' + rows + '</table>' : '') +
    '<div>' + buttons + '</div></td></tr>' +
    '<tr><td style="padding:14px 24px;background:#F4F5EC;color:#6B7158;font-size:12px;line-height:1.5;font-family:Ubuntu,system-ui,sans-serif">' + esc_(c.footer) + '</td></tr>' +
    '</table></div>';
}

function renderEmailText_(c) {
  var lines = ['RCQI Jinja RRH: QI Documentation Journal', '', c.headline, c.title + ' (' + c.facility + ')', '', c.intro, ''];
  c.facts.forEach(function (f) { lines.push(f[0] + ': ' + f[1]); });
  lines.push('', 'Open the project journal: ' + c.link);
  if (c.formUrl) lines.push('Add a journal entry: ' + c.formUrl);
  lines.push('', c.footer);
  return lines.join('\n');
}

/**
 * Sends one email per recipient (so no one sees anyone else's address), within the remaining daily quota.
 * mailer: { quota: function () -> number, send: function (message) }. Returns what was sent and why anything was not.
 */
function sendJournalNotification_(msg, mailer, logo) {
  var result = { sent: [], failed: [], skipped: [], status: '' };
  if (!msg || !msg.recipients.length) { result.status = 'No recipients'; return result; }
  var quota = Number(mailer.quota());
  msg.recipients.forEach(function (to, i) {
    if (i >= quota) { result.skipped.push(to); return; }
    var message = { to: to, subject: msg.subject, htmlBody: msg.html, body: msg.text, name: RCQI.mailName };
    if (logo) message.inlineImages = { arms: logo };
    try { mailer.send(message); result.sent.push(to); } catch (err) { result.failed.push(to + ' (' + err + ')'); }
  });
  result.status = result.skipped.length ? 'Daily email quota reached: ' + result.skipped.length + ' not sent'
    : (result.failed.length ? result.failed.length + ' failed' : 'Sent');
  return result;
}

/** Creates the QI Notification List and QI Notification Log tabs if they do not exist. Safe to run more than once. */
function setupNotifications() {
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  var list = ss.getSheetByName(RCQI.notifyTab);
  if (!list) {
    list = ss.insertSheet(RCQI.notifyTab);
    list.getRange(1, 1, 1, 5).setValues([['Name', 'Email', 'Facility', 'Active', 'Notes']]);
    var owner = Session.getEffectiveUser().getEmail();
    if (owner) list.getRange(2, 1, 1, 5).setValues([['RCQI coordinator', owner, 'All facilities', 'Yes', 'Receives every QI Journal notification. Set Active to No to stop.']]);
    var yesNo = SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true).setAllowInvalid(false).build();
    list.getRange(2, 4, list.getMaxRows() - 1, 1).setDataValidation(yesNo);
    styleHeader_(list);
    list.setColumnWidths(1, 5, 200);
    list.setColumnWidth(5, 360);
    Logger.log('Created the ' + RCQI.notifyTab + ' tab.');
  }
  var log = ss.getSheetByName(RCQI.notifyLogTab);
  if (!log) {
    log = ss.insertSheet(RCQI.notifyLogTab);
    log.getRange(1, 1, 1, 5).setValues([['Sent at', 'Project', 'Notification', 'Recipients', 'Status']]);
    styleHeader_(log);
    log.setColumnWidths(1, 5, 220);
    Logger.log('Created the ' + RCQI.notifyLogTab + ' tab.');
  }
}

function logNotification_(ss, msg, result) {
  var log = ss.getSheetByName(RCQI.notifyLogTab);
  if (!log) return;
  log.appendRow([new Date(), msg.label, msg.headline, result.sent.join(', '), result.status +
    (result.failed.length ? ': ' + result.failed.join('; ') : '') + (result.skipped.length ? ' (' + result.skipped.join(', ') + ')' : '')]);
}

function mailApp_() {
  return { quota: function () { return MailApp.getRemainingDailyQuota(); }, send: function (m) { MailApp.sendEmail(m); } };
}

/** Called by the submit trigger for each QI Journal entry. */
function notifyJournalEntry_(sheet, rowNumber) {
  var props = PropertiesService.getScriptProperties();
  var links = JSON.parse(props.getProperty('FORM_LINKS') || '{}');
  var ss = sheet.getParent();
  var list = ss.getSheetByName(RCQI.notifyTab);
  var logo = fetchLogo_(RCQI.emailLogoUrl);
  var msg = journalNotification_(defByKey_('qij'), sheet.getDataRange().getValues(), rowNumber,
    list ? list.getDataRange().getValues() : [[]],
    { tz: RCQI.timezone, formUrl: links.qij ? links.qij.shortUrl : '', hasLogo: !!logo, directory: facilityDirectory_(ss) });
  if (!msg) return;
  var result = sendJournalNotification_(msg, mailApp_(), logo);
  logNotification_(ss, msg, result);
  Logger.log(msg.subject + ': ' + result.status + ' (' + result.sent.length + ' sent)');
}

/**
 * Run from the editor to see a notification: sends one sample email, built from a fictitious project, to the
 * script owner only. Nothing is written to the journal.
 */
function sendTestNotification() {
  var owner = Session.getEffectiveUser().getEmail();
  var def = defByKey_('qij');
  var titles = def.items.filter(function (it) { return it.type !== 'section'; }).map(function (it) { return it.title; });
  var header = ['Timestamp'].concat(titles);
  var row = function (o) { return header.map(function (h) { return o[h] !== undefined ? o[h] : ''; }); };
  var values = [header,
    row({ 'Timestamp': '2026-01-05T08:00:00.000Z', 'What would you like to record?': 'Register a new QI project', 'District': 'Kamuli', 'Health facility in Kamuli District': 'Namwendwa Health Centre IV',
      'Short project title': 'Early first antenatal visit', 'Target for the indicator (%)': 45, 'Indicator for the objective': 'First antenatal visits within the first trimester (%)' }),
    row({ 'Timestamp': '2026-09-02T08:00:00.000Z', 'What would you like to record?': 'Record monthly results', 'Which QI project are these results for?': 'Namwendwa Health Centre IV: Early first antenatal visit',
      'Month of measurement': '2026-08-15', 'Numerator for the month': 22, 'Denominator for the month': 53 }),
    row({ 'Timestamp': '2026-10-02T08:00:00.000Z', 'What would you like to record?': 'Record monthly results', 'Which QI project are these results for?': 'Namwendwa Health Centre IV: Early first antenatal visit',
      'Month of measurement': '2026-09-15', 'Numerator for the month': 19, 'Denominator for the month': 43,
      'Notes on the indicator': 'Latest month: gains sustained.', 'Other observed effects and lessons learnt': 'Staff report better teamwork.' })];
  var logo = fetchLogo_(RCQI.emailLogoUrl);
  var links = JSON.parse(PropertiesService.getScriptProperties().getProperty('FORM_LINKS') || '{}');
  var ss0 = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  var msg = journalNotification_(def, values, 4, [['Email'], [owner]], { tz: RCQI.timezone, formUrl: links.qij ? links.qij.shortUrl : '', hasLogo: !!logo, directory: facilityDirectory_(ss0) });
  msg.subject = 'Test: ' + msg.subject;
  msg.recipients = [owner];
  var result = sendJournalNotification_(msg, mailApp_(), logo);
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  logNotification_(ss, msg, { sent: result.sent, failed: result.failed, skipped: result.skipped, status: 'Test: ' + result.status });
  Logger.log('TEST NOTIFICATION: ' + result.status + ' to ' + result.sent.length + ' recipient(s). Remaining daily quota: ' + MailApp.getRemainingDailyQuota());
}

/* ------------------------------------------------------------------------ */
/* Data service                                                              */
/* ------------------------------------------------------------------------ */

/** Health check only. Data is served by doPost so that the token never travels in a URL. */
function doGet() {
  return json_({ ok: true, service: 'RCQI Jinja RRH data service', schema: RCQI.schema, data: 'POST a JSON body {"token": "..."} to read records' });
}

/** Returns all de-identified records. Body: {"token": "...", "diag": false}. */
function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { body = {}; }
  var token = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!token || body.token !== token) return json_({ ok: false, error: 'unauthorised' });
  var cache = CacheService.getScriptCache();
  var wantDiag = body.diag === true;
  if (!wantDiag && body.nocache !== true) {
    var cached = cache.get('payload');
    if (cached) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  }
  var text = JSON.stringify(buildPayload_(wantDiag));
  if (!wantDiag && text.length < 95000) cache.put('payload', text, 60);
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

/** Run from the editor: confirms that every expected column is present in every response tab. */
function logDiagnostics() {
  var payload = buildPayload_(true);
  var ok = true;
  FORM_DEFS.forEach(function (def) {
    var d = payload.diagnostics[def.key];
    if (d.missing.length) ok = false;
    Logger.log(def.key + ': ' + d.matchedColumns + ' of ' + d.expectedColumns + ' columns matched, ' + d.rows + ' rows' +
      (d.missing.length ? ', missing: ' + d.missing.join(' | ') : ''));
  });
  Logger.log(ok ? 'DIAGNOSTICS OK: all columns matched for all ' + FORM_DEFS.length + ' forms' : 'DIAGNOSTICS FAILED');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function buildPayload_(wantDiag) {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
  var links = JSON.parse(props.getProperty('FORM_LINKS') || '{}');
  var out = { ok: true, schema: RCQI.schema, generatedAt: new Date().toISOString(), forms: {}, data: {} };
  if (wantDiag) out.diagnostics = {};
  var directory = facilityDirectory_(ss);
  FORM_DEFS.forEach(function (def) {
    var link = links[def.key] || {};
    out.forms[def.key] = { title: def.title, short: def.short, url: link.url || '', shortUrl: link.shortUrl || '' };
    var sheet = ss.getSheetByName(def.tab);
    var values = sheet ? sheet.getDataRange().getValues() : [[]];
    var parsed = parseValues_(def, values, RCQI.timezone);
    out.data[def.key] = applyFacilityMapping_(def, values, parsed.records, directory);
    out.forms[def.key].responses = parsed.records.length;
    if (wantDiag) out.diagnostics[def.key] = parsed.diag;
  });
  if (wantDiag) out.diagnostics.facilityDirectory = directory.length;
  return out;
}

/* ------------------------------------------------------------------------ */
/* Parsing (pure functions, unit tested outside Apps Script)                 */
/* ------------------------------------------------------------------------ */

var CODE_IN_BRACKETS = /\[([A-Z]{1,3}\d{1,2}[a-z]?)\.\s/;
var CODE_AT_START = /^([A-Z]{1,3}\d{1,2}[a-z]?)\.\s/;
var STANDARD_CODES = /(?:^|,\s)(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)\s/g;

/** Maps each expected response-sheet header to the field it feeds. */
function buildHeaderMap_(def) {
  var map = { 'Timestamp': { key: 'ts', kind: 'timestamp', exportField: true } };
  def.items.forEach(function (it) {
    if (it.type === 'section' || it.type === 'header') return;
    if (it.type === 'grid') {
      it.rows.forEach(function (r) {
        map[it.title + ' [' + r.code + '. ' + r.text + ']'] = { key: r.code, kind: 'coded', exportField: true };
      });
      return;
    }
    var textual = it.type === 'text' || it.type === 'paragraph';
    map[it.title] = {
      key: it.code || it.as || it.key,
      kind: it.code ? 'coded' : (it.codes ? 'codes' : it.type),
      mergeInto: it.mergeInto,
      countAs: it.countAs,
      exportField: it.exportField !== undefined ? it.exportField : !textual
    };
  });
  (def.extras || []).forEach(function (ex) {
    map[ex.header] = { key: ex.key, kind: ex.kind || 'text', exportField: ex.exportField !== false };
  });
  // Retired questions: older rows still map, but a form without them is not missing anything.
  (def.retired || []).forEach(function (r) {
    if (r.as) map[r.title] = { key: r.as, kind: 'text', exportField: true, optional: true };
  });
  return map;
}

function formatDate_(v, tz) {
  if (v === null || v === undefined || v === '') return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return null;
    if (typeof Utilities !== 'undefined') return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    return v.toISOString().slice(0, 10);
  }
  var s = String(v).trim();
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  var dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return dmy[3] + '-' + ('0' + dmy[2]).slice(-2) + '-' + ('0' + dmy[1]).slice(-2);
  return null;
}

function convert_(kind, v, tz) {
  if (v === null || v === undefined || v === '') return null;
  switch (kind) {
    case 'timestamp':
      if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v.toISOString();
      return String(v);
    case 'date':
      return formatDate_(v, tz);
    case 'number':
      var n = Number(v);
      return isFinite(n) ? n : null;
    case 'checkbox':
      return String(v).split(/,\s(?=[A-Z0-9(])/).map(function (s) { return s.trim(); }).filter(function (s) { return s; });
    case 'codes':
      var codes = [];
      var str = String(v);
      var m;
      STANDARD_CODES.lastIndex = 0;
      while ((m = STANDARD_CODES.exec(str)) !== null) codes.push(m[1]);
      return codes;
    default:
      return String(v).trim();
  }
}

/**
 * Turns a response tab (header row plus rows) into clean records and a diagnostic report.
 * opts.includePrivate keeps free text and email fields: used only for notifications, never by the data service.
 */
function parseValues_(def, values, tz, opts) {
  var includePrivate = !!(opts && opts.includePrivate);
  var map = buildHeaderMap_(def);
  var expected = Object.keys(map).filter(function (h) { return !map[h].optional; });
  var headers = (values && values.length) ? values[0].map(function (h) { return String(h).trim(); }) : [];
  var cols = [];
  var matched = {};
  headers.forEach(function (h, idx) {
    var spec = map[h];
    if (!spec) {
      var code = (h.match(CODE_IN_BRACKETS) || h.match(CODE_AT_START) || [])[1];
      if (code) spec = { key: code, kind: 'coded', exportField: true };
    }
    if (spec) {
      cols.push({ idx: idx, spec: spec });
      matched[h] = true;
    }
  });
  var records = [];
  for (var r = 1; r < (values ? values.length : 0); r++) {
    var row = values[r];
    var blank = row.every(function (c) { return c === '' || c === null || c === undefined; });
    if (blank) continue;
    var rec = { id: def.key + '-' + (r + 1), items: {} };
    cols.forEach(function (c) {
      if (c.spec.countAs) {
        var raw = row[c.idx];
        rec[c.spec.countAs] = raw ? String(raw).split(/[\n,;]+/).filter(function (x) { return x.trim(); }).length : null;
      }
      if (!c.spec.exportField && !includePrivate) return;
      var val = convert_(c.spec.kind, row[c.idx], tz);
      if (c.spec.kind === 'coded') {
        if (val !== null) rec.items[c.spec.key] = val;
      } else if (c.spec.mergeInto) {
        rec[c.spec.mergeInto] = (rec[c.spec.mergeInto] || []).concat(val || []);
      } else if (val !== null || rec[c.spec.key] === undefined) {
        // Two questions can feed one field (for example the journal's project lists); a blank never overwrites a value.
        rec[c.spec.key] = val;
      }
    });
    records.push(rec);
  }
  var missing = expected.filter(function (h) { return !matched[h]; });
  return {
    records: records,
    diag: {
      tab: def.tab,
      expectedColumns: expected.length,
      matchedColumns: expected.length - missing.length,
      missing: missing,
      rows: records.length
    }
  };
}
