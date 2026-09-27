import ReactEChartsCore from 'echarts-for-react/lib/core'
import { echarts } from '@/lib/echarts'

/** Drop-in for echarts-for-react's default export, bound to the on-demand ECharts build in @/lib/echarts */
export default function Chart(props) {
  return <ReactEChartsCore echarts={echarts} {...props} />
}
