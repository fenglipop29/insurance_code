import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

type EChartCardProps = {
  title: string;
  xAxis: string[];
  values: number[];
};

export function EChartCard({ title, xAxis, values }: EChartCardProps) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!elRef.current) return;
    const chart = echarts.init(elRef.current);
    chart.setOption({
      title: { text: title, left: 8, top: 8, textStyle: { fontSize: 14 } },
      grid: { left: 24, right: 12, top: 44, bottom: 24 },
      xAxis: { type: 'category', data: xAxis },
      yAxis: { type: 'value' },
      series: [{ type: 'line', smooth: true, data: values }],
      tooltip: { trigger: 'axis' },
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
    };
  }, [title, xAxis, values]);

  return <div ref={elRef} style={{ width: '100%', height: 240 }} />;
}
