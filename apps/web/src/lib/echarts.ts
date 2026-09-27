import { BarChart, FunnelChart, HeatmapChart, LineChart, PieChart, SankeyChart } from 'echarts/charts'
import {
  AxisPointerComponent,
  CalendarComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers'

/**
 * ECharts with only the charts and components the pages use, instead of the whole library (about a third of the size).
 * A chart type or component that isn't registered here renders nothing, so add it to this list when a page needs one.
 */
echarts.use([
  BarChart,
  FunnelChart,
  HeatmapChart,
  LineChart,
  PieChart,
  SankeyChart,
  AxisPointerComponent,
  CalendarComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  LabelLayout,
  CanvasRenderer,
  SVGRenderer,
])

export { echarts }
