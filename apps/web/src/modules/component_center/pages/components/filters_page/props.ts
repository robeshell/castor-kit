import type { PropDoc } from '@/modules/component_center/showcase/PropsTable'

/** FilterBar (FilterBarProps in shared/components/Filters.tsx) */
export const FILTER_BAR_PROPS: readonly PropDoc[] = [
  { name: 'children', type: 'ReactNode', description: '筛选控件，从左往右排，窄屏自动换行' },
  { name: 'onSearch', type: '() => void', description: '传了才显示「查询」按钮' },
  { name: 'onReset', type: '() => void', description: '传了才显示「重置」按钮' },
  { name: 'extra', type: 'ReactNode', description: '靠右的内容，例如导出按钮或条数' },
  { name: 'className', type: 'string', description: '外层 class（默认带 mb-4）' },
]

/** SearchInput (SearchInputProps) */
export const SEARCH_INPUT_PROPS: readonly PropDoc[] = [
  { name: 'value', type: 'string | null', description: '输入框的值（受控）' },
  { name: 'onChange', type: '(value: string) => void', description: '输入或点清空按钮时调用，清空时为空字符串' },
  { name: 'onSubmit', type: '() => void', description: '按回车时调用' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'placeholder', type: 'string', default: "'搜索'", description: '占位文字（中文原文，组件内翻译）' },
  { name: 'className', type: 'string', description: '外层 class，用来改宽度（默认 w-full sm:w-60）' },
]

/** FilterSelect (FilterSelectProps) */
export const FILTER_SELECT_PROPS: readonly PropDoc[] = [
  { name: 'value', type: 'string | number | null', description: "当前值；'' / null / undefined 表示全部" },
  { name: 'onChange', type: '(value: string) => void', description: "传入选项值的字符串形式，选「全部」时为 ''" },
  { name: 'options', type: 'readonly SelectOption[]', default: '[]', description: '选项 { label, value }，label 为中文原文' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'placeholder', type: 'string', default: "'全部'", description: '筛选项名称，「全部」项显示为「全部」+ 名称' },
  { name: 'allLabel', type: 'string', description: '「全部」项的文字，替代默认的「全部」+ 名称' },
  { name: 'className', type: 'string', description: '触发器的 class，用来改宽度（默认 w-36）' },
]

/** SegmentedTabs (SegmentedTabsProps<V> in shared/components/SegmentedTabs.tsx) */
export const SEGMENTED_TABS_PROPS: readonly PropDoc[] = [
  { name: 'value', type: 'V extends string | number', description: '当前项（受控）' },
  { name: 'onChange', type: '(value: V) => void', description: '点击某一项时调用' },
  { name: 'items', type: 'readonly SegmentedTabItem<V>[]', default: '[]', description: '选项，见下方 SegmentedTabItem' },
  { name: 'variant', type: "'underline' | 'pill'", default: "'underline'", description: 'underline：下划线标签，用于状态筛选；pill：灰底小切换，用于 24h / 7d 这类选项' },
  { name: 'className', type: 'string', description: '外层 class' },
]

/** One SegmentedTabs item (SegmentedTabItem<V>) */
export const SEGMENTED_TAB_ITEM_PROPS: readonly PropDoc[] = [
  { name: 'value', type: 'V', description: '选项值' },
  { name: 'label', type: 'ReactNode', description: '文字（中文原文，组件内翻译）' },
  { name: 'count', type: 'ReactNode', description: '文字后的数量徽标（只在 underline 样式显示）' },
]
