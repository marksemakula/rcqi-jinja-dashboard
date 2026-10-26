/**
 * The documented army green palette. Every colour used by the dashboard is defined here and nowhere else
 * (globals.css mirrors these values as CSS custom properties).
 *
 * Validation notes (dataviz six checks, run with the bundled validator):
 * - ORDINAL ramp passes: monotone lightness, adjacent delta L >= 0.06, light end 2.06:1 on the surface, single hue.
 * - PAIR (army green with khaki) passes CVD (delta E 31 protan) and the normal-vision floor (32);
 *   khaki sits below 3:1 on the surface, so every chart that uses it ships tooltips, direct labels or a table view.
 * - Army green is a low-chroma hue by nature (C about 0.09); identity is therefore carried by lightness steps,
 *   legends and labels rather than by hue alone.
 */
export const palette = {
  // Army green ramp, light to dark
  ag50: '#F4F5EC',
  ag100: '#E3E7D1',
  ag150: '#D3DAB8',
  ag200: '#C3CB9F',
  ag300: '#A9B77A',
  ag400: '#85974F',
  ag500: '#5F722E',
  ag600: '#4B5320',
  ag700: '#424F1E',
  ag800: '#2F3A16',
  ag900: '#28310F',
  // Field variations
  olive: '#6F823B',
  moss: '#3F5A1E',
  khaki: '#C2A55A',
  khakiDark: '#8C7535',
  sand: '#E9E1C8',
  // Surfaces and ink
  surface: '#FAFAF6',
  card: '#FFFFFF',
  border: '#DCE0CC',
  grid: '#E7EADB',
  ink: '#1E2410',
  inkSoft: '#4A5136',
  inkMuted: '#6B7158',
  onDark: '#F4F5EC',
  // Reserved status colours (always shown with an icon and a label)
  statusGood: '#3B4420',
  statusWarn: '#C9971C',
  statusBad: '#A3402C'
} as const;

/** One-hue ordinal ramp for ordered categories (validated with --ordinal). */
export const ordinal5 = ['#A9B77A', '#85974F', '#5F722E', '#424F1E', '#28310F'];

/** Two-series identity pair. */
export const pair = [palette.moss, palette.khaki];

/** Sequential ramp for heatmaps and magnitude. */
export const sequential = ['#F4F5EC', '#E3E7D1', '#C3CB9F', '#A9B77A', '#85974F', '#5F722E', '#424F1E', '#28310F'];

/** Muted context colour for non-selected series in focus-and-context charts. */
export const context = palette.ag150;

export const rag = {
  Green: palette.statusGood,
  Amber: palette.statusWarn,
  Red: palette.statusBad
} as const;
