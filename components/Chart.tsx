'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { Opt } from '@/lib/chart';
import { FONT, textStyle } from '@/lib/chart';
import { palette } from '@/lib/palette';

const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <div className="chart-loading" aria-hidden="true" />
});

export interface ChartProps {
  option: Opt;
  height?: number;
  onClick?: (params: Opt) => void;
  ariaLabel: string;
}

export default function Chart({ option, height = 300, onClick, ariaLabel }: ChartProps) {
  const merged = useMemo<Opt>(() => ({
    animationDuration: 600,
    animationEasing: 'cubicOut',
    textStyle,
    color: [palette.ag600, palette.khaki, palette.ag300, palette.ag800, palette.olive],
    aria: { enabled: true, label: { description: ariaLabel } },
    ...option
  }), [option, ariaLabel]);

  const events = useMemo(() => (onClick ? { click: onClick } : undefined), [onClick]);

  return (
    <div className="chart" role="img" aria-label={ariaLabel} style={{ height, fontFamily: FONT }}>
      <ReactECharts option={merged} notMerge lazyUpdate style={{ height: '100%', width: '100%' }} onEvents={events} opts={{ renderer: 'canvas' }} />
    </div>
  );
}
