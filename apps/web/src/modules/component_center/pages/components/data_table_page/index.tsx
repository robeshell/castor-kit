/**
 * Components → Data table: how to use DataTable (with RowActions and ConfirmAction for row actions).
 *
 * The reference for a Components gallery page: each example is its own file under ./examples, imported twice — as a
 * component for the live preview and with `?raw` for the source shown under it, so the two can't drift. Props
 * tables are hand-written in ./props.ts from the components' exported Props interfaces. Layout pieces come from
 * modules/component_center/showcase (ShowcasePage, ShowcaseSection, Example, PropsTable).
 */
import BasicTable from '@/modules/component_center/pages/components/data_table_page/examples/BasicTable'
import basicTableSource from '@/modules/component_center/pages/components/data_table_page/examples/BasicTable.tsx?raw'
import ControlledPagination from '@/modules/component_center/pages/components/data_table_page/examples/ControlledPagination'
import controlledPaginationSource from '@/modules/component_center/pages/components/data_table_page/examples/ControlledPagination.tsx?raw'
import LayoutOptions from '@/modules/component_center/pages/components/data_table_page/examples/LayoutOptions'
import layoutOptionsSource from '@/modules/component_center/pages/components/data_table_page/examples/LayoutOptions.tsx?raw'
import LoadingAndEmpty from '@/modules/component_center/pages/components/data_table_page/examples/LoadingAndEmpty'
import loadingAndEmptySource from '@/modules/component_center/pages/components/data_table_page/examples/LoadingAndEmpty.tsx?raw'
import RenderCells from '@/modules/component_center/pages/components/data_table_page/examples/RenderCells'
import renderCellsSource from '@/modules/component_center/pages/components/data_table_page/examples/RenderCells.tsx?raw'
import SelectionToolbar from '@/modules/component_center/pages/components/data_table_page/examples/SelectionToolbar'
import selectionToolbarSource from '@/modules/component_center/pages/components/data_table_page/examples/SelectionToolbar.tsx?raw'
import WithRowActions from '@/modules/component_center/pages/components/data_table_page/examples/WithRowActions'
import withRowActionsSource from '@/modules/component_center/pages/components/data_table_page/examples/WithRowActions.tsx?raw'
import {
  DATA_TABLE_COLUMN_PROPS,
  DATA_TABLE_PROPS,
  ROW_ACTION_PROPS,
  ROW_ACTIONS_PROPS,
} from '@/modules/component_center/pages/components/data_table_page/props'
import Example from '@/modules/component_center/showcase/Example'
import PropsTable from '@/modules/component_center/showcase/PropsTable'
import ShowcasePage, { ShowcaseSection } from '@/modules/component_center/showcase/ShowcasePage'

const IMPORTS = `import DataTable, { DataPagination, type DataTableColumn } from '@/shared/components/DataTable'
import RowActions from '@/shared/components/RowActions'
import ConfirmAction from '@/shared/components/ConfirmAction'`

export default function DataTablePage() {
  return (
    <ShowcasePage
      title="数据表格"
      intro="列表页的表格：带类型的列定义、自定义单元格、行选择、受控分页，内置加载骨架和空状态。行操作用 RowActions，危险操作用 ConfirmAction 确认。不带排序和固定表头：排序交给接口的查询参数，长列表用分页。"
      imports={IMPORTS}
    >
      <ShowcaseSection title="示例">
        <Example title="基础用法" description="给列数组标注 DataTableColumn<Row>[]，dataIndex 只能是行的字段。没有 render 的列直接显示值，空值显示 -。" source={basicTableSource}>
          <BasicTable />
        </Example>
        <Example title="自定义单元格" description="render 拿到的 value 按 dataIndex 推断类型：状态用 StatusBadge，金额右对齐并格式化，时间转成本地时区。" source={renderCellsSource}>
          <RenderCells />
        </Example>
        <Example title="行选择与批量操作" description="selectedKeys 由页面管理；有选中行时工具栏显示数量和批量操作，删除前用 ConfirmAction 确认。" source={selectionToolbarSource}>
          <SelectionToolbar />
        </Example>
        <Example title="受控分页" description="页码由页面管理，onChange 里切换页码；接口分页时把 items 和 total 传进来（useCrudList 已经封装好）。" source={controlledPaginationSource}>
          <ControlledPagination />
        </Example>
        <Example title="加载与空状态" description="首次加载显示骨架行，刷新时保留旧数据并变暗；没有数据时显示空状态和下一步操作。" source={loadingAndEmptySource}>
          <LoadingAndEmpty />
        </Example>
        <Example title="行操作" description="前两个操作显示为按钮，其余收进「更多」菜单；删除用 render 包一层 ConfirmAction。" source={withRowActionsSource}>
          <WithRowActions />
        </Example>
        <Example title="布局选项" description="放进 Panel 时去掉边框，dense 紧凑行高，minWidth 让窄屏横向滚动；onRowClick 和 rowClassName 标出当前行和延误的运单。" source={layoutOptionsSource}>
          <LayoutOptions />
        </Example>
      </ShowcaseSection>
      <ShowcaseSection title="属性">
        <PropsTable title="DataTable" items={DATA_TABLE_PROPS} />
        <PropsTable title="DataTableColumn<Row>" items={DATA_TABLE_COLUMN_PROPS} />
        <PropsTable title="RowActions" items={ROW_ACTIONS_PROPS} />
        <PropsTable title="RowAction" items={ROW_ACTION_PROPS} />
      </ShowcaseSection>
    </ShowcasePage>
  )
}
