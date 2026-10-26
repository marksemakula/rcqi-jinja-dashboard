/**
 * RCQI Jinja RRH: Google Forms, master Google Sheet and dashboard data service.
 *
 * Regional Continuous Quality Improvement (RCQI), Jinja Regional Referral Hospital.
 *
 * How to use
 *   1. Run setupRCQI() once. It creates a Drive folder, the master spreadsheet,
 *      six Google Forms linked to their own tabs, the HSR reference trigger and
 *      an API token.
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
  // Jinja RRH logo from the public GitHub repository. Shown at the top of every form.
  logoUrl: 'https://raw.githubusercontent.com/marksemakula/rcqi-jinja-dashboard/main/public/jrrh-logo-800.png'
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

function facilityBlock_() {
  return [
    { type: 'dropdown', key: 'district', title: 'District', required: true, options: LISTS.districts },
    { type: 'mc', key: 'facility', title: 'Health facility', required: true, options: [RCQI.hospital], other: true,
      help: 'For any other facility, choose Other and type its full official name as it appears in the DHIS2 facility list.' }
  ];
}

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
    items: [].concat(facilityBlock_(), [
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
    ])
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
    items: [].concat(facilityBlock_(), [
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
    ])
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
    items: [].concat(facilityBlock_(), [
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
    ])
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
    items: [].concat(facilityBlock_(), [
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
    ])
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
    items: [].concat(facilityBlock_(), [
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
    ])
  }
];

/* ------------------------------------------------------------------------ */
/* Setup                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Creates the folder, the master spreadsheet, the six forms and the trigger.
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

  var links = {};
  FORM_DEFS.forEach(function (def) {
    var form = buildForm_(def);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    DriveApp.getFileById(form.getId()).moveTo(folder);
    var sheet = waitForFormSheet_(ss.getId(), [form.getId(), form.getPublishedUrl().split('/d/e/')[1].split('/')[0]]);
    sheet.setName(def.tab);
    styleHeader_(sheet);
    if (def.extras) addExtraColumns_(sheet, def.extras);
    var published = form.getPublishedUrl();
    var shortUrl = published;
    try { shortUrl = form.shortenFormUrl(published); } catch (err) { Logger.log('Short link unavailable: ' + err); }
    links[def.key] = { id: form.getId(), url: published, shortUrl: shortUrl, editUrl: form.getEditUrl() };
    Logger.log('Created form: ' + def.title);
  });

  props.setProperties({
    SPREADSHEET_ID: ss.getId(),
    FOLDER_ID: folder.getId(),
    FORM_LINKS: JSON.stringify(links),
    API_TOKEN: Utilities.getUuid().replace(/-/g, ''),
    HSR_SEQ: '0'
  });

  writeReadMe_(SpreadsheetApp.openById(ss.getId()), links);
  ScriptApp.newTrigger('onRcqiFormSubmit').forSpreadsheet(ss.getId()).onFormSubmit().create();
  Logger.log('Setup complete.');
  showLinks();
}

function buildForm_(def) {
  var form = FormApp.create(def.title);
  addLogo_(form);
  form.setDescription(def.description);
  form.setConfirmationMessage(def.confirmation || 'Thank you. Your submission has been recorded for the RCQI dashboard.');
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(true);
  def.items.forEach(function (it) { addItem_(form, it); });
  return form;
}

/** Places the Jinja RRH logo at the top of a form. Skipped quietly if the logo cannot be fetched. */
function addLogo_(form) {
  if (!RCQI.logoUrl) return false;
  try {
    var blob = UrlFetchApp.fetch(RCQI.logoUrl).getBlob().setName('jrrh-logo.png');
    var img = form.addImageItem().setImage(blob).setAlignment(FormApp.Alignment.CENTER).setWidth(150);
    form.moveItem(img.getIndex(), 0);
    return true;
  } catch (err) {
    Logger.log('Logo not added: ' + err);
    return false;
  }
}

/** Adds the logo to forms created before the logo was available. Safe to run more than once. */
function addLogoToForms() {
  var links = JSON.parse(PropertiesService.getScriptProperties().getProperty('FORM_LINKS') || '{}');
  Object.keys(links).forEach(function (key) {
    var form = FormApp.openById(links[key].id);
    var hasImage = form.getItems(FormApp.ItemType.IMAGE).length > 0;
    if (!hasImage) Logger.log(key + (addLogo_(form) ? ': logo added' : ': logo could not be added'));
  });
}

function addItem_(form, it) {
  var item;
  switch (it.type) {
    case 'section':
      item = form.addPageBreakItem().setTitle(it.title);
      if (it.help) item.setHelpText(it.help);
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
  sheet.getRange(1, 1, 1, width)
    .setBackground(RCQI.headerColour).setFontColor(RCQI.headerText).setFontWeight('bold').setWrap(true);
  sheet.setFrozenRows(1);
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
    ['Privacy', 'Free text (descriptions, causes, names and phone numbers) stays in this sheet and is never sent to the public dashboard.'],
    ['', ''],
    ['Form', 'Share link']
  ];
  FORM_DEFS.forEach(function (def) { rows.push([def.short, links[def.key].shortUrl]); });
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1).setFontSize(14).setFontWeight('bold').setFontColor(RCQI.headerColour);
  sh.getRange(7, 1, 1, 2).setBackground(RCQI.headerColour).setFontColor(RCQI.headerText).setFontWeight('bold');
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
  FORM_DEFS.forEach(function (def) {
    var link = links[def.key] || {};
    out.forms[def.key] = { title: def.title, short: def.short, url: link.url || '', shortUrl: link.shortUrl || '' };
    var sheet = ss.getSheetByName(def.tab);
    var values = sheet ? sheet.getDataRange().getValues() : [[]];
    var parsed = parseValues_(def, values, RCQI.timezone);
    out.data[def.key] = parsed.records;
    out.forms[def.key].responses = parsed.records.length;
    if (wantDiag) out.diagnostics[def.key] = parsed.diag;
  });
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
      key: it.code || it.key,
      kind: it.code ? 'coded' : (it.codes ? 'codes' : it.type),
      mergeInto: it.mergeInto,
      exportField: it.exportField !== undefined ? it.exportField : !textual
    };
  });
  (def.extras || []).forEach(function (ex) {
    map[ex.header] = { key: ex.key, kind: ex.kind || 'text', exportField: ex.exportField !== false };
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

/** Turns a response tab (header row plus rows) into clean records and a diagnostic report. */
function parseValues_(def, values, tz) {
  var map = buildHeaderMap_(def);
  var expected = Object.keys(map);
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
      if (!c.spec.exportField) return;
      var val = convert_(c.spec.kind, row[c.idx], tz);
      if (c.spec.kind === 'coded') {
        if (val !== null) rec.items[c.spec.key] = val;
      } else if (c.spec.mergeInto) {
        rec[c.spec.mergeInto] = (rec[c.spec.mergeInto] || []).concat(val || []);
      } else {
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
