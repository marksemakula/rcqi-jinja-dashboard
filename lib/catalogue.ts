/**
 * Reference catalogue of the RCQI tools: item codes, domains, thresholds and expected scores.
 * Codes must match apps-script/Code.gs; the gate script verify/check-scoring.mjs cross-checks them.
 */

export const HOSPITAL = 'Jinja Regional Referral Hospital';

/* 5S monitoring and evaluation sheet ------------------------------------- */
export const FIVE_S_DOMAINS = [
  { code: 'LD', name: 'Leadership', items: ['LD1', 'LD2', 'LD3', 'LD4'] },
  { code: 'SO', name: 'Sort', items: ['SO1', 'SO2', 'SO3'] },
  { code: 'SE', name: 'Set', items: ['SE1', 'SE2', 'SE3', 'SE4', 'SE5'] },
  { code: 'SH', name: 'Shine', items: ['SH1', 'SH2', 'SH3'] },
  { code: 'ST', name: 'Standardise', items: ['ST1', 'ST2', 'ST3'] }
] as const;

export const FIVE_S_ITEMS: Record<string, string> = {
  LD1: 'WIT has its own 5S-CQI-TQM work plan',
  LD2: 'WIT holds meetings regularly',
  LD3: '5S-CQI orientation and training conducted',
  LD4: '5S guidelines and handbook available',
  SO1: 'Unnecessary items removed',
  SO2: 'Old posters and notices removed',
  SO3: 'Waste segregation properly implemented',
  SE1: 'Easy to see, take out and return',
  SE2: 'Items aligned on X and Y axes',
  SE3: 'Zoning fixes home positions',
  SE4: 'Colour coding and labelling used',
  SE5: 'Signboards, door plates and maps displayed',
  SH1: 'Floors, walls, toilets and rooms clean',
  SH2: 'Cleaning tools available and stored',
  SH3: 'Cleaning checklist used',
  ST1: 'Checklist maintains Sort, Set and Shine',
  ST2: 'SOPs for Sort, Set and Shine available',
  ST3: 'Photographs used as evidence'
};

/* Basic IPC assessment (RAG) ---------------------------------------------- */
export interface RagDomain {
  code: string;
  name: string;
  items: number;
  green: number;
  amber: number;
  core: boolean;
  reverse?: string[];
}

export const BASIC_IPC_DOMAINS: RagDomain[] = [
  { code: 'ORG', name: 'Organisation and monitoring', items: 9, green: 8, amber: 5, core: true },
  { code: 'EDU', name: 'Education and training', items: 3, green: 3, amber: 2, core: true },
  { code: 'SUP', name: 'IPC supplies', items: 4, green: 4, amber: 3, core: true },
  { code: 'HHY', name: 'Hand hygiene', items: 7, green: 6, amber: 4, core: true, reverse: ['HHY4', 'HHY5'] },
  { code: 'PPE', name: 'Personal protective equipment', items: 5, green: 5, amber: 3, core: true },
  { code: 'WST', name: 'Waste management', items: 7, green: 5, amber: 3, core: true },
  { code: 'SHP', name: 'Sharps safety', items: 3, green: 3, amber: 2, core: true },
  { code: 'DEQ', name: 'Decontamination of equipment', items: 8, green: 7, amber: 5, core: true },
  { code: 'LIN', name: 'Decontamination of linen', items: 7, green: 6, amber: 4, core: false },
  { code: 'ENV', name: 'Decontamination of environment', items: 6, green: 5, amber: 3, core: true },
  { code: 'SCI', name: 'Screening and isolation', items: 13, green: 11, amber: 7, core: true },
  { code: 'HAI', name: 'HAI monitoring and outbreaks', items: 5, green: 5, amber: 3, core: true }
];

/* MoH IPC facility assessment tool (May 2024) ------------------------------ */
const range = (prefix: string, letters: string) => letters.split('').map((l) => prefix + l);

export const MOH_IPC_AREAS = [
  { id: 1, name: 'IPC programme', short: 'Programme', codes: ['P1a', 'P1b', 'P1c', 'P2', 'P2m', 'P3', 'P3m'] },
  { id: 2, name: 'IPC training', short: 'Training', codes: ['T1', 'T2', 'T3'] },
  { id: 3, name: 'Guidelines, SOPs and IEC', short: 'Guidelines', codes: ['G1', ...range('G2', 'abcdefghijklm'), ...range('G3', 'abcd')] },
  { id: 4, name: 'HAI surveillance', short: 'HAI surveillance', codes: range('H1', 'abcd') },
  { id: 5, name: 'Multimodal strategies', short: 'Multimodal', codes: range('M1', 'abcd') },
  { id: 6, name: 'Monitoring of IPC practices', short: 'Monitoring', codes: ['O1', 'O3', 'O5'] },
  { id: 7, name: 'Workload, staffing and beds', short: 'Workload', codes: ['W1', 'W2', 'W3', 'W4'] },
  {
    id: 8,
    name: 'Built environment and materials',
    short: 'Environment',
    codes: ['B1', 'B3', 'B4', 'B5', 'B6', 'B7', ...range('B8', 'abcdefghi'), ...range('B9', 'abcdefghi'), 'B10', 'B11', 'B12',
      'B14', 'B15', 'B16', ...range('B17', 'abcdef'), 'B18', 'B19', 'B20', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B28']
  }
];

export const MOH_IPC_REVERSE = new Set(['B7', ...range('B9', 'abcdefghi')]);

/** Graded answers. Any answer not listed scores by its first word (Yes = 1, No = 0); N/A is excluded. */
export const MOH_IPC_GRADED: Record<string, Record<string, number | null>> = {
  P2: {
    'Yes, every meeting': 1,
    'Yes, most or at least half of the meetings': 0.5,
    'Yes, but only once a year or rarely': 0,
    'No, IPC is not part of the facility meeting agenda': 0,
    'N/A, the facility has no quarterly management meetings': null
  },
  T1: {
    'Yes, monthly': 1,
    'Yes, quarterly': 1,
    'No, IPC education and training is given as needed (not on a regular basis)': 0.5,
    'No, none currently scheduled or planned': 0
  },
  B20: {
    'Yes, available, up to date and properly completed': 1,
    'No, available and up to date but not properly completed': 0.5,
    'No, available but not up to date': 0,
    'No, not available': 0
  },
  B21: {
    'Yes, available, up to date and properly completed': 1,
    'No, available and up to date but not properly completed': 0.5,
    'No, available but not up to date': 0,
    'No, not available': 0
  }
};

export const PPE_ITEMS: Record<string, string> = {
  a: 'Gloves', b: 'Surgical masks', c: 'Respirators (N95)', d: 'Eye protection', e: 'Gowns',
  f: 'Plastic aprons', g: 'Heavy duty gloves', h: 'Heavy duty aprons', i: 'Gum boots'
};

/* HFQAP ---------------------------------------------------------------------- */
export type LevelKey = 'II' | 'III' | 'IV' | 'H';

export const LEVEL_MAP: Record<string, LevelKey> = {
  'HC II': 'II',
  'HC III': 'III',
  'HC IV': 'IV',
  'General Hospital': 'H',
  'Regional Referral Hospital': 'H'
};

export interface HfqapModule {
  id: string;
  name: string;
  short: string;
  fields: string[];
  expected: Record<LevelKey, number>;
}

export const HFQAP_MODULES: HfqapModule[] = [
  { id: 'm1', name: 'Leadership and governance', short: 'Leadership', fields: ['s_m1'], expected: { II: 14, III: 14, IV: 14, H: 14 } },
  { id: 'm2', name: 'Human resources for health', short: 'HRH', fields: ['s_m2'], expected: { II: 19, III: 19, IV: 20, H: 20 } },
  { id: 'm3', name: 'Health financing', short: 'Financing', fields: ['s_m3'], expected: { II: 9, III: 9, IV: 9, H: 9 } },
  { id: 'm4', name: 'Health information', short: 'Information', fields: ['s_m4'], expected: { II: 21, III: 29, IV: 32, H: 32 } },
  { id: 'm5', name: 'Medicines, supplies, vaccines and equipment', short: 'Medicines', fields: ['s_m5a', 's_m5b', 's_m5c', 's_m5d'], expected: { II: 36, III: 49, IV: 63, H: 67 } },
  { id: 'm6', name: 'Health infrastructure', short: 'Infrastructure', fields: ['s_m6'], expected: { II: 20, III: 21, IV: 24, H: 24 } },
  { id: 'm7', name: 'RMNCAH services', short: 'RMNCAH', fields: ['s_m7'], expected: { II: 32, III: 38, IV: 38, H: 38 } },
  { id: 'm8', name: 'Outreach, clinical, surgical, referral and emergency', short: 'Clinical care', fields: ['s_m8'], expected: { II: 37, III: 37, IV: 48, H: 48 } },
  { id: 'm9', name: 'Diagnostic services', short: 'Diagnostics', fields: ['s_m9'], expected: { II: 1, III: 9, IV: 10, H: 13 } },
  { id: 'm10', name: 'Client centred care and safety', short: 'Client care', fields: ['s_m10'], expected: { II: 22, III: 24, IV: 25, H: 25 } }
];

export const HFQAP_M5_PARTS: { field: string; name: string; expected: Record<LevelKey, number> }[] = [
  { field: 's_m5a', name: '5a Medicines and supplies management', expected: { II: 15, III: 17, IV: 20, H: 20 } },
  { field: 's_m5b', name: '5b Vaccines and tracer medicines', expected: { II: 13, III: 19, IV: 25, H: 26 } },
  { field: 's_m5c', name: '5c Tracer equipment', expected: { II: 5, III: 10, IV: 13, H: 15 } },
  { field: 's_m5d', name: '5d Equipment inventory and diagnostics', expected: { II: 3, III: 3, IV: 5, H: 6 } }
];

export const HFQAP_PRIVATE_FINANCING = 7;

export const STAR_BANDS = [
  { star: 0, min: 0, label: 'Below 55%' },
  { star: 1, min: 55, label: '55 to 64%' },
  { star: 2, min: 65, label: '65 to 74%' },
  { star: 3, min: 75, label: '75 to 84%' },
  { star: 4, min: 85, label: '85 to 94%' },
  { star: 5, min: 95, label: '95% and above' }
];

export const HFQAP_STANDARDS: Record<string, string> = {
  '1.1': 'Posters with the health sector vision and mission statement',
  '1.2': 'Client charter key messages displayed',
  '1.3': 'Meetings held and action points monitored',
  '1.4': 'Current catchment map and disaggregated population',
  '1.5': 'Joint planning meetings held as scheduled',
  '1.6': 'Annual and quarterly work plans and budgets communicated',
  '1.7': 'Support supervision findings and actions recorded',
  '1.8': 'Community involvement',
  '2.1': 'Availability of qualified health workers',
  '2.2': 'Guidelines on human resource management procedures',
  '2.3': 'Up-to-date written job descriptions',
  '2.4': 'Scheduled CPD and CME',
  '2.5': 'Up-to-date training database',
  '2.6': 'Functional library',
  '2.7': 'Functional staff appraisal system',
  '2.8': 'Health workers welfare such as break teas and resting rooms',
  '2.9': 'System of recognition of performance',
  '3.1': 'Availability of financial guidelines',
  '3.2': 'Financial guidelines followed',
  '3.3': 'Procurement',
  '4.1': 'System for accurate data collection plus storage and retrieval',
  '4.2': 'Alignment of diseases and birth outcomes to ICD',
  '4.3': 'Death and birth registration system',
  '4.4': 'Patient cards for follow up and continuity',
  '4.5': 'HMIS registers correctly filled',
  '4.6': 'HMIS reports compiled and submitted on time',
  '4.7': 'Accuracy of HMIS reports',
  '4.8': 'SOPs for data quality assessment',
  '4.9': 'Key performance indicators displayed',
  '4.10': 'HMIS data analysed and used',
  '4.11': 'Computers for data management',
  '4.12': 'Functional disease surveillance system',
  '5.1': 'Functional supply chain management system',
  '5.2': 'Current medicines and health supplies management tools',
  '5.3': 'Proper space for storage of medicines and supplies',
  '5.4': 'Proper cold chain for vaccines',
  '5.5': 'Correct storage procedures for medicines and supplies',
  '5.5.1': 'Vaccines registered in the vaccine control book',
  '5.5.2': 'Tracer commodities for family planning',
  '5.5.3': 'Tracer commodities for nutrition management',
  '5.5.4': 'Tracer medicines for antenatal care',
  '5.5.5': 'Tracer medicines for basic obstetric care',
  '5.5.6': 'Tracer medicines for newborn care',
  '5.5.7': 'Tracer medicines for child health',
  '5.5.8': 'Tracer medicines for adolescent health',
  '5.5.9': 'Tracer medicines for STD management',
  '5.5.10': 'Tracer medicines for malaria management',
  '5.5.11': 'Tracer medicines for HIV and AIDS management',
  '5.5.12': 'Tracer medicines for TB management',
  '5.5.13': 'Tracer medicines for NCDs',
  '5.5.14': 'Tracer medicines for basic surgery',
  '5.5.15': 'Tracer medicines for comprehensive surgery',
  '5.5.16': 'Diagnostic kits and reagents for basic investigations',
  '5.6.1': 'Tracer equipment for OPD',
  '5.6.2': 'Tracer equipment for immunisation',
  '5.6.3': 'Tracer equipment for family planning',
  '5.6.4': 'Tracer equipment for antenatal care',
  '5.6.5': 'Tracer equipment for basic obstetric care',
  '5.6.6': 'Tracer equipment for surgery',
  '5.6.7': 'Tracer equipment for general inpatient services',
  '5.6.8': 'Tracer laboratory equipment',
  '5.7': 'Tracer laboratory and radiology diagnostics',
  '5.8': 'Up-to-date inventory for tracer equipment',
  '6.1': 'Land title available',
  '6.2': 'Signage',
  '6.3': 'List of available services displayed',
  '6.4': 'Clean and protected external environment and service areas',
  '6.5': 'Comfort (ambience) for clients',
  '6.6': 'Private area for service delivery',
  '6.7': 'Changing rooms',
  '6.8': 'Reliable and clean water supply',
  '6.9': 'Reliable power supply',
  '6.10': 'Clean sanitary facilities for staff and clients',
  '6.11': 'Communication equipment',
  '6.12': 'Functional transport system',
  '7.1': 'Health education programme in RMNCAH',
  '7.3': 'In-service training in RMNCAH in the last two years',
  '7.4': 'Guidelines for RMNCAH',
  '7.5': 'Technically appropriate services in RMNCAH',
  '7.6': 'Maternal and perinatal death reviews',
  '8.1': 'Functional outreach programme',
  '8.2': 'Functional health education programme in OPD',
  '8.3': 'OPD staff trained in management of common diseases including NCDs',
  '8.4': 'Current guidelines for common conditions',
  '8.5': 'Technically appropriate services in OPD',
  '8.6': 'Clinical audits',
  '8.7': 'Staff trained in emergency and essential surgical care',
  '8.8': 'Functional theatre',
  '8.9': 'Functional patient referral system',
  '8.10': 'Functional emergency unit or service',
  '9.1': 'Laboratory staff who received in-service training in the last two years',
  '9.2': 'Current laboratory guidelines and SOPs',
  '9.3': 'Radiology and imaging staff trained in the last two years',
  '9.4': 'Current radiology and imaging guidelines and SOPs',
  '9.5': 'Functional laboratory referral mechanism',
  '9.6': 'Laboratory quality management system',
  '10.1': 'Effective interaction with clients and family members',
  '10.2': 'Health workers know the client rights',
  '10.3': 'Client feedback mechanism',
  '10.4': 'Triage system',
  '10.5': 'Guidelines for infection prevention and control',
  '10.6': 'Supplies and equipment for IPC',
  '10.7': 'Proper storage for sterile equipment',
  '10.8': 'Adequate area for hand washing',
  '10.9': 'Guidelines for healthcare waste management',
  '10.10': 'In-service training in HCWM in the last two years',
  '10.11': 'Adequate waste disposal supplies and materials',
  '10.12': 'Refuse and medical waste disposal facilities',
  '10.13': 'Reporting system for adverse events and medical errors',
  '10.14': 'Occupational health and safety programme'
};

/* WHO hand hygiene ------------------------------------------------------------ */
export const HH_MOMENTS = [
  { id: 1, name: 'Before touching a patient' },
  { id: 2, name: 'Before clean or aseptic procedure' },
  { id: 3, name: 'After body fluid exposure risk' },
  { id: 4, name: 'After touching a patient' },
  { id: 5, name: 'After touching patient surroundings' }
];

export const HH_CADRE_GROUPS: Record<string, string> = {
  Nurse: 'Nurse or midwife',
  Midwife: 'Nurse or midwife',
  'Student nurse or midwife': 'Nurse or midwife',
  Auxiliary: 'Auxiliary',
  'Medical doctor (internal medicine)': 'Medical doctor',
  Surgeon: 'Medical doctor',
  'Anaesthetist or emergency physician': 'Medical doctor',
  Paediatrician: 'Medical doctor',
  Gynaecologist: 'Medical doctor',
  Consultant: 'Medical doctor',
  'Medical student': 'Medical doctor',
  Therapist: 'Other health worker',
  Technician: 'Other health worker',
  'Other health worker': 'Other health worker',
  'Other student': 'Other health worker'
};

/* Patient safety -------------------------------------------------------------- */
export const HSR_STATUSES = ['Pending review', 'Follow up required by the department', 'Support required by the QI committee', 'Resolved'];
export const HSR_OUTCOMES = ['Near miss (did not reach the patient or person)', 'Adverse event without harm', 'Adverse event with harm'];
export const HSR_TIMEFRAMES = ['Day', 'Evening', 'Night'];
