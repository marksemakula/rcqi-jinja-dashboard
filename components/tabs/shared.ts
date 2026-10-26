import type { Dataset, FormKey, FormMeta, Mode } from '@/lib/types';
import type { Filters } from '@/lib/filters';

export type TabId = 'overview' | 'safety' | 'hand' | 'ipc' | 'fives' | 'hfqap' | 'journal' | 'forms';

export const TABS: { id: TabId; label: string; short: string; form?: FormKey }[] = [
  { id: 'overview', label: 'Overview', short: 'Overview' },
  { id: 'safety', label: 'Patient Safety', short: 'Safety', form: 'hsr' },
  { id: 'hand', label: 'Hand Hygiene', short: 'Hand hygiene', form: 'hh' },
  { id: 'ipc', label: 'Infection Prevention', short: 'IPC', form: 'ipcBasic' },
  { id: 'fives', label: '5S-CQI-TQM', short: '5S', form: 'fives' },
  { id: 'hfqap', label: 'HFQAP', short: 'HFQAP', form: 'hfqap' },
  { id: 'journal', label: 'QI Journal', short: 'Journal', form: 'qij' },
  { id: 'forms', label: 'Forms and Data', short: 'Forms' }
];

export interface TabProps {
  data: Dataset;
  all: Dataset;
  filters: Filters;
  forms: Partial<Record<FormKey, FormMeta>>;
  mode: Mode;
  go: (tab: TabId, focus?: string) => void;
  focus?: string | null;
  generatedAt?: string | null;
}
