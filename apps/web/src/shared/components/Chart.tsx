import type { ComponentPropsWithRef } from 'react'
import type { EChartsOption } from 'echarts'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { echarts } from '@/lib/echarts'
import { cn } from '@/lib/utils'

/**
 * echarts-for-react's props (style, notMerge, opts, onEvents …) plus `ref` to reach getEchartsInstance(); the ECharts
 * build is fixed here. `option` is echarts' own EChartsOption: echarts-for-react types it as `any`, which would let a
 * misspelled series or axis setting through.
 */
export type ChartProps = Omit<ComponentPropsWithRef<typeof ReactEChartsCore>, 'echarts' | 'option'> & {
  option: EChartsOption
  /**
   * Text alternative (already translated): what the chart shows and its key numbers, e.g.
   * t('近 7 天操作日志柱状图，共 {{count}} 条，最多的一天 {{max}} 条', …). Screen readers read it instead of the canvas.
   */
  summary: string
  /**
   * Fill series with patterns as well as colors (ECharts decals), so categories can be told apart without color.
   * Turn it on where several categories are compared by color alone (pie slices, grouped or stacked bars).
   */
  patterns?: boolean
}

/** Drop-in for echarts-for-react's default export, bound to the on-demand ECharts build in @/lib/echarts */
export default function Chart({ option, summary, patterns = false, style, className, ...props }: ChartProps) {
  const aria: EChartsOption['aria'] = { enabled: true, label: { enabled: false }, decal: { show: patterns } }
  return (
    // The canvas says nothing to assistive technology: the wrapper is one image named by the summary
    <div role="img" aria-label={summary} className={cn('w-full', className)} style={{ height: 300, ...style }}>
      <ReactEChartsCore echarts={echarts} option={{ ...option, aria }} style={{ width: '100%', height: '100%' }} {...props} />
    </div>
  )
}
