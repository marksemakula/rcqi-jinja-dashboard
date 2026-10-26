/* Shared ECharts option builders in the army green theme. */
import { palette, sequential } from './palette';

export type Opt = Record<string, any>;

export const FONT = 'Ubuntu, system-ui, sans-serif';

export const textStyle = { fontFamily: FONT, color: palette.inkSoft, fontSize: 12 };

export const tooltip = (extra: Opt = {}): Opt => ({
  trigger: 'item',
  confine: true,
  backgroundColor: palette.card,
  borderColor: palette.border,
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { fontFamily: FONT, color: palette.ink, fontSize: 12 },
  extraCssText: 'border-radius:0;box-shadow:0 8px 24px rgba(40,49,15,0.14);',
  ...extra
});

export const axisTooltip = (extra: Opt = {}): Opt =>
  tooltip({ trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: palette.ag300, width: 1 } }, ...extra });

export const categoryAxis = (data: string[], extra: Opt = {}): Opt => ({
  type: 'category',
  data,
  axisLine: { lineStyle: { color: palette.border } },
  axisTick: { show: false },
  axisLabel: { color: palette.inkMuted, fontFamily: FONT, fontSize: 11, hideOverlap: true },
  ...extra
});

export const valueAxis = (extra: Opt = {}): Opt => ({
  type: 'value',
  splitLine: { lineStyle: { color: palette.grid } },
  axisLine: { show: false },
  axisLabel: { color: palette.inkMuted, fontFamily: FONT, fontSize: 11 },
  ...extra
});

export const pctAxis = (extra: Opt = {}): Opt => valueAxis({ min: 0, max: 100, axisLabel: { color: palette.inkMuted, fontFamily: FONT, fontSize: 11, formatter: '{value}%' }, ...extra });

export const grid = (extra: Opt = {}): Opt => ({ left: 8, right: 16, top: 24, bottom: 8, containLabel: true, ...extra });

export const legend = (extra: Opt = {}): Opt => ({
  top: 0,
  right: 0,
  icon: 'rect',
  itemWidth: 12,
  itemHeight: 8,
  textStyle: { fontFamily: FONT, color: palette.inkSoft, fontSize: 11 },
  ...extra
});

export const barSeries = (extra: Opt = {}): Opt => ({
  type: 'bar',
  barMaxWidth: 28,
  itemStyle: { borderRadius: 0, color: palette.ag600 },
  emphasis: { focus: 'self', itemStyle: { color: palette.ag800 } },
  ...extra
});

export const hBarSeries = (extra: Opt = {}): Opt => ({
  type: 'bar',
  barMaxWidth: 18,
  itemStyle: { borderRadius: 0, color: palette.ag600 },
  emphasis: { focus: 'self', itemStyle: { color: palette.ag800 } },
  ...extra
});

export const lineSeries = (extra: Opt = {}): Opt => ({
  type: 'line',
  smooth: false,
  symbol: 'rect',
  symbolSize: 8,
  lineStyle: { width: 2, color: palette.ag600 },
  itemStyle: { color: palette.ag600, borderColor: palette.card, borderWidth: 2 },
  emphasis: { focus: 'series' },
  ...extra
});

/** Heatmap cell with a label colour that stays readable on dark army green cells. */
export const heatCell = (x: number, y: number, v: number | string, min: number, max: number): Opt => {
  const t = typeof v === 'number' && max > min ? (v - min) / (max - min) : 0;
  return { value: [x, y, v], label: { color: t > 0.5 ? palette.onDark : palette.ink } };
};

export const heatVisualMap = (min = 0, max = 100, extra: Opt = {}): Opt => ({
  min,
  max,
  calculable: false,
  orient: 'horizontal',
  left: 'center',
  bottom: 0,
  itemWidth: 10,
  itemHeight: 120,
  inRange: { color: sequential.slice(1) },
  textStyle: { fontFamily: FONT, color: palette.inkMuted, fontSize: 11 },
  ...extra
});

export const dataZoom = (start = 0): Opt[] => [
  { type: 'inside', start, end: 100 },
  {
    type: 'slider', start, end: 100, height: 16, bottom: 4, borderColor: palette.border,
    fillerColor: 'rgba(95,114,46,0.18)', handleStyle: { color: palette.ag600 }, textStyle: { color: palette.inkMuted, fontFamily: FONT },
    dataBackground: { lineStyle: { color: palette.ag300 }, areaStyle: { color: palette.ag100 } },
    selectedDataBackground: { lineStyle: { color: palette.ag600 }, areaStyle: { color: palette.ag200 } }
  }
];

export const targetLine = (value: number, label = 'Target'): Opt => ({
  silent: true,
  symbol: 'none',
  lineStyle: { color: palette.khakiDark, type: 'dashed', width: 1.5 },
  label: { formatter: `${label} ${value}%`, color: palette.khakiDark, fontFamily: FONT, fontSize: 11, position: 'insideEndTop' },
  data: [{ yAxis: value }]
});

/** Colour a bar by whether it is selected in a cross-filter. */
export const selColour = (selected: string | null, name: string, base: string = palette.ag600) =>
  !selected || selected === name ? base : palette.ag150;
