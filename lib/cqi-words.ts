/**
 * The vocabulary of the landing page word field: terms used in Continuous Quality Improvement work at Jinja RRH and in
 * the Busoga facilities (the CQI tools, the improvement method and the quality dimensions). British spelling throughout.
 * Nothing else may appear in the field.
 */
export const CQI_VOCABULARY = [
  // The programme and its approaches
  'continuous', 'quality', 'improvement', 'CQI', 'QI', 'quality improvement', 'continuous improvement', 'Kaizen', 'TQM',
  'total quality management', 'quality assurance', 'quality control', 'accreditation', 'certification', 'excellence',
  // The improvement method
  'PDSA', 'plan', 'do', 'study', 'act', 'plan do study act', 'test of change', 'change idea', 'small tests', 'rapid cycles',
  'aim statement', 'baseline', 'target', 'indicator', 'numerator', 'denominator', 'measurement', 'run chart', 'control chart',
  'Pareto', 'fishbone', 'root cause', 'root cause analysis', 'five whys', 'process map', 'flowchart', 'brainstorming',
  'gap analysis', 'action plan', 'audit', 're-audit', 'benchmarking', 'variation', 'spread', 'scale up', 'sustainability',
  'documentation journal', 'learning session', 'collaborative', 'coaching', 'mentorship', 'support supervision',
  'QI team', 'QI committee', 'work improvement team',
  // 5S
  '5S', 'sort', 'set in order', 'shine', 'standardise', 'sustain', 'orderliness', 'cleanliness', 'waste reduction',
  // The CQI tools
  'patient safety', 'hand hygiene', 'five moments', 'hand rub', 'infection prevention', 'IPC', 'HFQAP', 'star rating',
  'safety culture', 'incident reporting', 'near miss', 'adverse event', 'waste segregation', 'decontamination',
  'sterilisation', 'PPE', 'antimicrobial stewardship', 'triage', 'waiting time', 'patient flow', 'stock management',
  // Quality dimensions and values
  'safe', 'effective', 'efficient', 'timely', 'equitable', 'people-centred', 'client-centred care', 'respectful care',
  'client satisfaction', 'client experience', 'dignity', 'accountability', 'leadership', 'teamwork', 'ownership',
  'commitment', 'transparency', 'learning', 'reflection', 'innovation', 'champion', 'systems thinking',
  // Standards and evidence
  'standards', 'guidelines', 'SOP', 'checklist', 'best practice', 'compliance', 'assessment', 'monitoring', 'evaluation',
  'feedback', 'data', 'data quality', 'evidence', 'results', 'outcome', 'process', 'trend', 'review', 'verification',
  'dashboard', 'documentation'
] as const;

export type Tone = 1 | 2 | 3 | 4 | 5;

export interface FieldWord {
  text: string;
  /** Size step, 1 (smallest) to 8. */
  size: number;
  weight: 300 | 400 | 500 | 700;
  /** 1 faint, 2 soft, 3 medium, 4 bright, 5 khaki accent. */
  tone: Tone;
  upper: boolean;
}

/** 'along' lines run with the field (rising to the right on screen); 'across' lines run at right angles to it (reading downwards). */
export type Direction = 'along' | 'across';

export interface FieldBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: Direction;
  lines: FieldWord[][];
}

/** Size of the whole field in pixels, before it is rotated and centred on the half page. */
export const FIELD_W = 2000;
export const FIELD_H = 2400;
/** Font size in pixels for each size step. */
export const FIELD_SIZES = [0, 12, 14, 16, 19, 23, 28, 36, 46];
const GAP = 14;
const MIN_SIDE = 260;

/** Small, fast, seeded generator (mulberry32), so the field is the same on the server and in the browser. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((n, [, w]) => n + w, 0);
  let r = rand() * total;
  for (const [v, w] of weighted) {
    r -= w;
    if (r < 0) return v;
  }
  return weighted[weighted.length - 1][0];
}

/** Lines of words that fill `length` by `breadth` pixels (length runs with the text, breadth across the lines). */
function fillLines(rand: () => number, length: number, breadth: number): FieldWord[][] {
  const words = CQI_VOCABULARY as readonly string[];
  const out: FieldWord[][] = [];
  let previous = '';
  let filled = 0;
  while (filled < breadth + 30) {
    const line: FieldWord[] = [];
    let used = 0;
    let tallest = 0;
    while (used < length * 1.2) {
      let text = words[Math.floor(rand() * words.length)];
      if (text === previous) text = words[(words.indexOf(text) + 7) % words.length];
      previous = text;
      const size = pick(rand, [[1, 16], [2, 20], [3, 18], [4, 14], [5, 10], [6, 7], [7, 4], [8, 2]]);
      const weight = pick<FieldWord['weight']>(rand, [[300, 46], [400, 26], [500, 12], [700, 16]]);
      const big = size >= 6;
      const tone = pick<Tone>(rand, big ? [[2, 30], [3, 34], [4, 22], [5, 14]] : [[1, 36], [2, 30], [3, 20], [4, 9], [5, 5]]);
      const upper = weight === 700 ? rand() < 0.6 : rand() < 0.06;
      line.push({ text, size, weight, tone, upper });
      used += text.length * FIELD_SIZES[size] * (upper ? 0.68 : 0.55) + 12;
      tallest = Math.max(tallest, FIELD_SIZES[size]);
    }
    out.push(line);
    filled += tallest * 1.02;
  }
  return out;
}

/**
 * The landing page field: the area is cut into rectangular blocks of different sizes, and each block is filled with lines
 * of words running either along the field or across it, so the text direction changes from block to block. Most words
 * are small, light and faint, with a few larger, bolder and brighter ones, as in a typographic word cloud.
 */
export function buildWordField(seed = 1898): FieldBlock[] {
  const rand = seeded(seed);
  const leaves: { x: number; y: number; w: number; h: number }[] = [];
  const split = (x: number, y: number, w: number, h: number, depth: number) => {
    const canW = w >= MIN_SIDE * 2;
    const canH = h >= MIN_SIDE * 2;
    if ((!canW && !canH) || (depth >= 3 && rand() < 0.3)) { leaves.push({ x, y, w, h }); return; }
    const vertical = canW && (!canH || (w >= h ? rand() < 0.75 : rand() < 0.25));
    const side = vertical ? w : h;
    const cut = Math.round(Math.max(MIN_SIDE, Math.min(side - MIN_SIDE, side * (0.3 + rand() * 0.4))));
    if (vertical) { split(x, y, cut, h, depth + 1); split(x + cut, y, w - cut, h, depth + 1); }
    else { split(x, y, w, cut, depth + 1); split(x, y + cut, w, h - cut, depth + 1); }
  };
  split(0, 0, FIELD_W, FIELD_H, 0);
  let previous: Direction = 'across';
  return leaves.map((b) => {
    // Neighbouring blocks in the cut order usually change direction, so the two directions are well mixed.
    const dir: Direction = rand() < 0.72 ? (previous === 'along' ? 'across' : 'along') : previous;
    previous = dir;
    const w = b.w - GAP;
    const h = b.h - GAP;
    const lines = dir === 'along' ? fillLines(rand, w, h) : fillLines(rand, h, w);
    return { x: b.x, y: b.y, w, h, dir, lines };
  });
}
