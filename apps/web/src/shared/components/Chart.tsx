import type { ComponentPropsWithRef } from 'react'
import type { EChartsOption } from 'echarts'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { echarts } from '@/lib/echarts'

/**
 * echarts-for-react's props (style, notMerge, opts, onEvents …) plus `ref` to reach getEchartsInstance(); the ECharts
 * build is fixed here. `option` is echarts' own EChartsOption: echarts-for-react types it as `any`, which would let a
 * misspelled series or axis setting through.
 */
export type ChartProps = Omit<ComponentPropsWithRef<typeof ReactEChartsCore>, 'echarts' | 'option'> & { option: EChartsOption }

/** Drop-in for echarts-for-react's default export, bound to the on-demand ECharts build in @/lib/echarts */
export default function Chart(props: ChartProps) {
  return <ReactEChartsCore echarts={echarts} {...props} />
}
