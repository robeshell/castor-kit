/**
 * Components → Filters: the list filter bar (FilterBar with SearchInput / FilterSelect) and SegmentedTabs.
 *
 * Each example is its own file under ./examples, imported twice (component + `?raw` source); props tables are in
 * ./props.ts. See data_table_page for the layout rules.
 */
import CombinedFilters from '@/modules/component_center/pages/components/filters_page/examples/CombinedFilters'
import combinedFiltersSource from '@/modules/component_center/pages/components/filters_page/examples/CombinedFilters.tsx?raw'
import InstantFilters from '@/modules/component_center/pages/components/filters_page/examples/InstantFilters'
import instantFiltersSource from '@/modules/component_center/pages/components/filters_page/examples/InstantFilters.tsx?raw'
import SearchBox from '@/modules/component_center/pages/components/filters_page/examples/SearchBox'
import searchBoxSource from '@/modules/component_center/pages/components/filters_page/examples/SearchBox.tsx?raw'
import SelectFilters from '@/modules/component_center/pages/components/filters_page/examples/SelectFilters'
import selectFiltersSource from '@/modules/component_center/pages/components/filters_page/examples/SelectFilters.tsx?raw'
import StatusTabs from '@/modules/component_center/pages/components/filters_page/examples/StatusTabs'
import statusTabsSource from '@/modules/component_center/pages/components/filters_page/examples/StatusTabs.tsx?raw'
import {
  FILTER_BAR_PROPS,
  FILTER_SELECT_PROPS,
  SEARCH_INPUT_PROPS,
  SEGMENTED_TAB_ITEM_PROPS,
  SEGMENTED_TABS_PROPS,
} from '@/modules/component_center/pages/components/filters_page/props'
import Example from '@/modules/component_center/showcase/Example'
import PropsTable from '@/modules/component_center/showcase/PropsTable'
import ShowcasePage, { ShowcaseSection } from '@/modules/component_center/showcase/ShowcasePage'

const IMPORTS = `import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import SegmentedTabs, { type SegmentedTabItem } from '@/shared/components/SegmentedTabs'`

export default function FiltersPage() {
  return (
    <ShowcasePage
      title="筛选"
      intro="列表页表格上方的筛选：FilterBar 左边放搜索框和下拉筛选，按需显示查询、重置按钮，右边放额外操作；状态切换用 SegmentedTabs，可以带数量。控件都是受控的，筛选结果由页面计算或交给接口（useCrudList 的 handleSearch）。没有日期范围筛选组件：需要时放两个 DatePicker（见「选择器」页）。"
      imports={IMPORTS}
    >
      <ShowcaseSection title="示例">
        <Example title="搜索框" description="输入的内容和生效的关键词分开存：回车才搜索，点清空按钮立即恢复全部。" source={searchBoxSource}>
          <SearchBox />
        </Example>
        <Example title="下拉筛选" description="第一项是「全部」，选中时值为空字符串；数字选项也以字符串传回，筛选状态用 string 存。" source={selectFiltersSource}>
          <SelectFilters />
        </Example>
        <Example title="分段标签" description="下划线样式做状态筛选，count 显示每个状态的数量；pill 样式做 24 小时 / 7 天这类小切换。" source={statusTabsSource}>
          <StatusTabs />
        </Example>
        <Example title="组合筛选" description="筛选栏编辑草稿，点查询或回车后生效；状态标签立即生效，数量跟随其他筛选条件；右侧放导出，没有结果时空状态提供重置。" source={combinedFiltersSource}>
          <CombinedFilters />
        </Example>
        <Example title="即时筛选" description="本地数据边输入边筛选，不需要查询按钮；有筛选条件时才显示重置，右侧显示条数。" source={instantFiltersSource}>
          <InstantFilters />
        </Example>
      </ShowcaseSection>
      <ShowcaseSection title="属性">
        <PropsTable title="FilterBar" items={FILTER_BAR_PROPS} />
        <PropsTable title="SearchInput" items={SEARCH_INPUT_PROPS} />
        <PropsTable title="FilterSelect" items={FILTER_SELECT_PROPS} />
        <PropsTable title="SegmentedTabs" items={SEGMENTED_TABS_PROPS} />
        <PropsTable title="SegmentedTabItem<V>" items={SEGMENTED_TAB_ITEM_PROPS} />
      </ShowcaseSection>
    </ShowcasePage>
  )
}
