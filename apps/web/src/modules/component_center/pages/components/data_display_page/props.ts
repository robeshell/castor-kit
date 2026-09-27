import type { PropDoc } from '@/modules/component_center/showcase/PropsTable'

/** StatCard (StatCardProps in shared/components/StatCard.tsx) */
export const STAT_CARD_PROPS: readonly PropDoc[] = [
  { name: 'label', type: 'ReactNode', description: '指标名称（中文原文，组件内翻译）' },
  { name: 'value', type: 'number | string | null', description: '数值，变化时滚动到新值；不是数字时显示 0' },
  { name: 'suffix', type: 'ReactNode', description: '数字后的单位，如 人、%（中文原文，组件内翻译）' },
  { name: 'decimals', type: 'number', default: '0', description: '小数位数' },
  { name: 'delta', type: 'ReactNode', description: '右上角的变化标记，如 +12%' },
  { name: 'deltaTone', type: "'success' | 'danger' | 'neutral'", default: "'success'", description: '变化标记的颜色：好消息、坏消息或持平' },
  { name: 'trend', type: 'readonly number[]', description: '迷你趋势线的数据；只在数据确实有趋势时传' },
  { name: 'hint', type: 'ReactNode', description: '底部一行说明，没有趋势时用它解释数字' },
  { name: 'icon', type: 'ComponentType<{ className?: string }>', description: '标签前的图标（lucide 图标组件）' },
  { name: 'loading', type: 'boolean', default: 'false', description: '数字和变化标记显示骨架，不要用 0 占位' },
  { name: 'onClick', type: 'MouseEventHandler<HTMLDivElement>', description: '点击卡片；传了之后显示手型光标' },
  { name: 'className', type: 'string', description: '卡片的 class' },
]

/** CountUp (CountUpProps in shared/components/StatCard.tsx) */
export const COUNT_UP_PROPS: readonly PropDoc[] = [
  { name: 'value', type: 'number | string | null', default: '0', description: '目标数值；不是数字时滚动到 0' },
  { name: 'decimals', type: 'number', default: '0', description: '小数位数' },
  { name: 'className', type: 'string', description: '数字的 class' },
]

/** Sparkline (SparklineProps in shared/components/StatCard.tsx) */
export const SPARKLINE_PROPS: readonly PropDoc[] = [
  { name: 'points', type: 'readonly number[]', default: '[]', description: '数据点；大于 0 的点少于 2 个时不绘制' },
  { name: 'width', type: 'number', default: '96', description: '宽度（像素）' },
  { name: 'height', type: 'number', default: '32', description: '高度（像素）' },
  { name: 'className', type: 'string', description: 'svg 的 class' },
]

/** Chart (ChartProps in shared/components/Chart.tsx: echarts-for-react's props, option typed as EChartsOption) */
export const CHART_PROPS: readonly PropDoc[] = [
  { name: 'option', type: 'EChartsOption', description: 'ECharts 配置；颜色从 useChartColors / chartBase 取，跟随主题色和暗色模式' },
  { name: 'style', type: 'CSSProperties', default: '{ height: 300 }', description: '只设高度，宽度跟随容器' },
  { name: 'className', type: 'string', description: '容器的 class' },
  { name: 'notMerge', type: 'boolean', default: 'false', description: '新配置整体替换旧配置，而不是合并（数据条数会变时用）' },
  { name: 'lazyUpdate', type: 'boolean', default: 'false', description: '延迟到下一帧更新' },
  { name: 'onEvents', type: 'Record<string, Function>', description: '按事件名绑定 ECharts 事件，如 click' },
  { name: 'showLoading', type: 'boolean', default: 'false', description: '显示 ECharts 自带的加载动画' },
  { name: 'opts', type: "{ renderer?: 'canvas' | 'svg', … }", description: '初始化参数，如渲染器' },
  { name: 'ref', type: 'Ref<EChartsReactCore>', description: '通过 getEchartsInstance() 拿到 ECharts 实例' },
]

/** Panel (PanelProps in shared/components/Panel.tsx; other props go to the <section>) */
export const PANEL_PROPS: readonly PropDoc[] = [
  { name: 'title', type: 'ReactNode', description: '标题（中文原文，组件内翻译）' },
  { name: 'description', type: 'ReactNode', description: '标题下的说明，只写有信息量的内容（中文原文，组件内翻译）' },
  { name: 'actions', type: 'ReactNode', description: '标题右侧的按钮' },
  { name: 'padded', type: 'boolean', default: 'true', description: '内容区内边距；表格、列表这类贴边内容设为 false' },
  { name: 'bodyClassName', type: 'string', description: '内容区的 class' },
  { name: 'className', type: 'string', description: '卡片的 class' },
]

/** PageHeader (PageHeaderProps in shared/components/PageHeader.tsx) */
export const PAGE_HEADER_PROPS: readonly PropDoc[] = [
  { name: 'title', type: 'ReactNode', description: '页面标题（中文原文，组件内翻译）' },
  { name: 'description', type: 'ReactNode', description: '只写数据相关的事实，不写功能介绍（中文原文，组件内翻译）' },
  { name: 'actions', type: 'ReactNode', description: '右侧的按钮，窄屏时换到标题下方' },
  { name: 'children', type: 'ReactNode', description: '标题下方的内容，如状态标签' },
  { name: 'className', type: 'string', description: '外层的 class；不要用 mb-* 改下方间距' },
]

/** UserAvatar (UserAvatarProps in shared/components/UserAvatar.tsx) */
export const USER_AVATAR_PROPS: readonly PropDoc[] = [
  { name: 'src', type: 'string | null', description: '头像地址；为空或加载失败时显示首字母' },
  { name: 'name', type: 'string | null', description: '显示名：图片的 alt，也是首字母的来源；为空时显示 ?' },
  { name: 'className', type: 'string', default: "'size-8'", description: '尺寸等，如 size-12' },
  { name: 'fallbackClassName', type: 'string', description: '首字母的 class，放大头像时一起调字号' },
]
