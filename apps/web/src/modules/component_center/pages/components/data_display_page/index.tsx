/**
 * Components → Data display: StatCard (with CountUp and Sparkline), Chart (ECharts with theme colors), Panel,
 * PageHeader and UserAvatar.
 *
 * Each example is its own file under ./examples, imported twice (component + `?raw` source); props tables are in
 * ./props.ts. See data_table_page for the layout rules.
 */
import CountUpAndSparkline from '@/modules/component_center/pages/components/data_display_page/examples/CountUpAndSparkline'
import countUpAndSparklineSource from '@/modules/component_center/pages/components/data_display_page/examples/CountUpAndSparkline.tsx?raw'
import LineAndBarChart from '@/modules/component_center/pages/components/data_display_page/examples/LineAndBarChart'
import lineAndBarChartSource from '@/modules/component_center/pages/components/data_display_page/examples/LineAndBarChart.tsx?raw'
import PageHeaderExample from '@/modules/component_center/pages/components/data_display_page/examples/PageHeaderExample'
import pageHeaderExampleSource from '@/modules/component_center/pages/components/data_display_page/examples/PageHeaderExample.tsx?raw'
import PanelVariants from '@/modules/component_center/pages/components/data_display_page/examples/PanelVariants'
import panelVariantsSource from '@/modules/component_center/pages/components/data_display_page/examples/PanelVariants.tsx?raw'
import PieChart from '@/modules/component_center/pages/components/data_display_page/examples/PieChart'
import pieChartSource from '@/modules/component_center/pages/components/data_display_page/examples/PieChart.tsx?raw'
import StatCards from '@/modules/component_center/pages/components/data_display_page/examples/StatCards'
import statCardsSource from '@/modules/component_center/pages/components/data_display_page/examples/StatCards.tsx?raw'
import StatCardStates from '@/modules/component_center/pages/components/data_display_page/examples/StatCardStates'
import statCardStatesSource from '@/modules/component_center/pages/components/data_display_page/examples/StatCardStates.tsx?raw'
import UserAvatars from '@/modules/component_center/pages/components/data_display_page/examples/UserAvatars'
import userAvatarsSource from '@/modules/component_center/pages/components/data_display_page/examples/UserAvatars.tsx?raw'
import {
  CHART_PROPS,
  COUNT_UP_PROPS,
  PAGE_HEADER_PROPS,
  PANEL_PROPS,
  SPARKLINE_PROPS,
  STAT_CARD_PROPS,
  USER_AVATAR_PROPS,
} from '@/modules/component_center/pages/components/data_display_page/props'
import Example from '@/modules/component_center/showcase/Example'
import PropsTable from '@/modules/component_center/showcase/PropsTable'
import ShowcasePage, { ShowcaseSection } from '@/modules/component_center/showcase/ShowcasePage'

const IMPORTS = `import StatCard, { CountUp, Sparkline } from '@/shared/components/StatCard'
import Chart from '@/shared/components/Chart'
import { brandArea, brandLine, chartBase, useChartColors } from '@/lib/chart-theme'
import type { EChartsOption } from 'echarts'
import Panel from '@/shared/components/Panel'
import PageHeader from '@/shared/components/PageHeader'
import UserAvatar from '@/shared/components/UserAvatar'`

export default function DataDisplayPage() {
  return (
    <ShowcasePage
      title="数据展示"
      intro="仪表盘和详情页的展示件：指标卡（滚动数字、迷你趋势线）、ECharts 图表、卡片容器、页面标题和用户头像。图表的颜色从 useChartColors 读取，切换主题色或暗色模式时自动跟随；Chart 只包含 lib/echarts 里注册的图表类型（折线、柱状、饼图、漏斗、热力图、桑基图），需要别的类型先在那里注册。"
      imports={IMPORTS}
    >
      <ShowcaseSection title="示例">
        <Example title="指标卡" description="图标、单位、小数位和变化标记；有趋势数据时传 trend 画迷你趋势线，没有时用 hint 写一行说明。" source={statCardsSource}>
          <StatCards />
        </Example>
        <Example title="加载与点击" description="loading 时数字显示骨架而不是 0；onClick 让卡片可点击，用 className 标出选中的卡片。" source={statCardStatesSource}>
          <StatCardStates />
        </Example>
        <Example title="滚动数字与趋势线" description="CountUp 和 Sparkline 也可以单独使用：数值变化时滚动过去，趋势线的颜色跟随主题色。" source={countUpAndSparklineSource}>
          <CountUpAndSparkline />
        </Example>
        <Example title="折线与柱状图" description="option 标注为 EChartsOption；chartBase 提供坐标轴、网格和提示框的样式，brandLine / brandArea 是主题渐变。图例和系列名用 t() 翻译。" source={lineAndBarChartSource}>
          <LineAndBarChart />
        </Example>
        <Example title="环形图与事件" description="饼图只取 chartBase 的颜色、字体和提示框；onEvents 绑定点击事件。" source={pieChartSource}>
          <PieChart />
        </Example>
        <Example title="卡片容器" description="Panel 是页面里每个区块的容器：标题、说明、右侧操作；表格和列表设 padded={false} 贴边。" source={panelVariantsSource}>
          <PanelVariants />
        </Example>
        <Example title="页面标题" description="每个页面顶部一个：右侧放操作按钮，description 只写数据相关的事实，children 放在标题下方。" source={pageHeaderExampleSource} previewClassName="pb-0">
          <PageHeaderExample />
        </Example>
        <Example title="用户头像" description="有图片时显示图片，没有或加载失败时显示名字首字母；尺寸用 className。" source={userAvatarsSource}>
          <UserAvatars />
        </Example>
      </ShowcaseSection>
      <ShowcaseSection title="属性">
        <PropsTable title="StatCard" items={STAT_CARD_PROPS} />
        <PropsTable title="CountUp" items={COUNT_UP_PROPS} />
        <PropsTable title="Sparkline" items={SPARKLINE_PROPS} />
        <PropsTable title="Chart" items={CHART_PROPS} />
        <PropsTable title="Panel" items={PANEL_PROPS} />
        <PropsTable title="PageHeader" items={PAGE_HEADER_PROPS} />
        <PropsTable title="UserAvatar" items={USER_AVATAR_PROPS} />
      </ShowcaseSection>
    </ShowcasePage>
  )
}
