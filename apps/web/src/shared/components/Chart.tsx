import type { ComponentPropsWithRef } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { echarts } from '@/lib/echarts'

/** echarts-for-react's props (option, style, notMerge, opts, onEvents …) plus `ref` to reach getEchartsInstance(); the ECharts build is fixed here */
export type ChartProps = Omit<ComponentPropsWithRef<typeof ReactEChartsCore>, 'echarts'>

/** Drop-in for echarts-for-react's default export, bound to the on-demand ECharts build in @/lib/echarts */
export default function Chart(props: ChartProps) {
  return <ReactEChartsCore echarts={echarts} {...props} />
}
