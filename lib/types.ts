export type FormKey = 'hsr' | 'fives' | 'hh' | 'ipcBasic' | 'ipcMoh' | 'hfqap' | 'qij';

export const FORM_KEYS: FormKey[] = ['hsr', 'fives', 'hh', 'ipcBasic', 'ipcMoh', 'hfqap', 'qij'];

export interface BaseRec {
  id: string;
  ts?: string | null;
  date?: string | null;
  district?: string | null;
  facility?: string | null;
  /** DHIS2 mapping added by the data service: selected or matched entries carry the facility's DHIS2 details. */
  facilityUid?: string | null;
  subcounty?: string | null;
  facilityLevel?: string | null;
  facilityOwnership?: string | null;
  facilityMatch?: FacilityMatch | null;
  facilityEntered?: string | null;
  facilitySuggestion?: string | null;
  items: Record<string, string>;
}

export type FacilityMatch = 'selected' | 'matched' | 'confirmed' | 'review' | 'unmatched';

export interface HsrRec extends BaseRec {
  cadre?: string | null;
  department?: string | null;
  timeframe?: string | null;
  location?: string | null;
  harmed?: string[] | null;
  category?: string | null;
  eventType?: string | null;
  outcome?: string | null;
  ref?: string | null;
  status?: string | null;
  closed?: string | null;
}

export interface FiveSRec extends BaseRec {
  department?: string | null;
}

export interface HhRec extends BaseRec {
  ward?: string | null;
  deptType?: string | null;
  period?: string | null;
  session?: number | null;
  duration?: number | null;
  profCat?: string | null;
  hcws?: number | null;
  opp?: number | null;
  hr?: number | null;
  hw?: number | null;
  gloves?: number | null;
  m1i?: number | null; m1a?: number | null;
  m2i?: number | null; m2a?: number | null;
  m3i?: number | null; m3a?: number | null;
  m4i?: number | null; m4a?: number | null;
  m5i?: number | null; m5a?: number | null;
}

export interface IpcBasicRec extends BaseRec {
  facType?: string | null;
  ownership?: string | null;
  beds?: number | null;
  occupancy?: number | null;
  hws?: number | null;
  ipd?: number | null;
  opd?: number | null;
}

export interface IpcMohRec extends BaseRec {
  level?: string | null;
  ownership?: string | null;
  assessType?: string | null;
  monitored?: string[] | null;
  hhRate?: number | null;
  hhStations?: number | null;
  sdp?: number | null;
  sdpBins?: number | null;
  disposal?: string[] | null;
}

export interface HfqapRec extends BaseRec {
  level?: string | null;
  ownership?: string | null;
  facilityCode?: string | null;
  assessType?: string | null;
  notMet?: string[] | null;
  s_m1?: number | null; s_m2?: number | null; s_m3?: number | null; s_m4?: number | null;
  s_m5a?: number | null; s_m5b?: number | null; s_m5c?: number | null; s_m5d?: number | null;
  s_m6?: number | null; s_m7?: number | null; s_m8?: number | null; s_m9?: number | null; s_m10?: number | null;
}

/** One entry in the QI Documentation Journal form: a project registration, a change tested or a month of results. */
export interface QijRec extends BaseRec {
  entryType?: string | null;
  region?: string | null;
  department?: string | null;
  projectTitle?: string | null;
  teamSize?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  objective?: string | null;
  indicator?: string | null;
  numeratorDef?: string | null;
  denominatorDef?: string | null;
  target?: number | null;
  problem?: string | null;
  project?: string | null;
  change?: string | null;
  changeStart?: string | null;
  changeEnd?: string | null;
  improved?: string | null;
  changeComments?: string | null;
  month?: string | null;
  numerator?: number | null;
  denominator?: number | null;
  indicatorNotes?: string | null;
  effects?: string | null;
}

export interface FormMeta {
  title: string;
  short: string;
  url: string;
  shortUrl: string;
  responses?: number;
}

export interface Dataset {
  hsr: HsrRec[];
  fives: FiveSRec[];
  hh: HhRec[];
  ipcBasic: IpcBasicRec[];
  ipcMoh: IpcMohRec[];
  hfqap: HfqapRec[];
  qij: QijRec[];
}

export interface Payload {
  ok: boolean;
  configured?: boolean;
  reason?: string;
  schema?: number;
  generatedAt?: string;
  forms?: Partial<Record<FormKey, FormMeta>>;
  data?: Partial<Dataset>;
}

export type Mode = 'live' | 'demo';
