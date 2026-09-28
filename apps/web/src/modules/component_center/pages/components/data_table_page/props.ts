import type { PropDoc } from '@/modules/component_center/showcase/PropsTable'

/** Key props of DataTable (DataTableProps in shared/components/DataTable.tsx) */
export const DATA_TABLE_PROPS: readonly PropDoc[] = [
  { name: 'columns', type: 'DataTableColumn<Row>[]', description: '列定义，见下方 DataTableColumn' },
  { name: 'data', type: 'readonly Row[]', default: '[]', description: '当前页的行' },
  { name: 'rowKey', type: "keyof Row | (row, index) => Key", default: "'id'", description: '行的唯一标识：React key，也是选择的值' },
  { name: 'loading', type: 'boolean', default: 'false', description: '没有数据时显示骨架行，已有数据时把行变暗' },
  { name: 'pagination', type: '{ page, perPage, total, onChange }', description: '分页（page 从 1 开始）；不传则不显示分页' },
  { name: 'selectable', type: 'boolean', default: 'false', description: '显示勾选列' },
  { name: 'selectedKeys', type: 'Key[]', default: '[]', description: '选中行的 key（受控）' },
  { name: 'onSelectionChange', type: '(keys, rows) => void', description: '勾选变化时调用，传入新的 key 列表' },
  { name: 'onRowClick', type: '(row, index) => void', description: '点击行；传了之后行显示手型光标，主列里放一个按钮供键盘和读屏使用' },
  { name: 'isRowActive', type: '(row, index) => boolean', description: '页面当前打开的那一行（如主从表的主行），读屏报 aria-current；样式仍用 rowClassName' },
  { name: 'rowClassName', type: '(row, index) => string | undefined', description: '按行追加 class' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'emptyTitle', type: 'ReactNode', default: "'暂无数据'", description: '空状态标题（中文原文，组件内翻译）' },
  { name: 'emptyDescription', type: 'ReactNode', description: '空状态说明，写下一步做什么' },
  { name: 'emptyAction', type: 'ReactNode', description: '空状态里的按钮' },
  { name: 'bordered', type: 'boolean', default: 'true', description: '外层卡片边框；放在 Panel 里时设为 false' },
  { name: 'dense', type: 'boolean', default: 'false', description: '紧凑行高' },
  { name: 'minWidth', type: 'CSSProperties["minWidth"]', description: '表格最小宽度，容器更窄时横向滚动' },
  { name: 'className', type: 'string', description: '外层容器的 class' },
]

/** Column definition (DataTableColumn<Row>) */
export const DATA_TABLE_COLUMN_PROPS: readonly PropDoc[] = [
  { name: 'key', type: 'string', description: 'React key；缺省时用 dataIndex，再缺省用列序号' },
  { name: 'title', type: 'ReactNode', description: '表头（中文原文，组件内翻译）' },
  { name: 'dataIndex', type: 'keyof Row', description: '读取的字段；render 的 value 按这个字段推断类型' },
  { name: 'render', type: '(value, row, index) => ReactNode', description: '自定义单元格；没有 dataIndex 时 value 为 undefined' },
  { name: 'width', type: 'CSSProperties["width"]', description: '列宽' },
  { name: 'minWidth', type: 'CSSProperties["minWidth"]', description: '列最小宽度' },
  { name: 'align', type: "'left' | 'center' | 'right'", default: "'left'", description: '对齐；数字列用 right + tabular-nums' },
  { name: 'ellipsis', type: 'boolean', default: 'false', description: '单行省略，文本单元格悬停显示全文' },
  { name: 'primary', type: 'boolean', default: 'false', description: '配合 onRowClick：行按钮放在这一列（默认第一列）；选能说出这一行是谁的列，且列里没有别的控件' },
  { name: 'className', type: 'string', description: '单元格 class' },
  { name: 'headerClassName', type: 'string', description: '表头单元格 class' },
]

/** RowActions (shared/components/RowActions.tsx) */
export const ROW_ACTIONS_PROPS: readonly PropDoc[] = [
  { name: 'actions', type: '(RowAction | false | null | undefined)[]', default: '[]', description: '操作列表；假值会被跳过，可以写 cond && { … }' },
  { name: 'inline', type: 'number', default: '2', description: '前几个可见操作显示为按钮，其余收进「更多」菜单' },
]

/** One RowActions entry (RowAction in shared/components/RowActions.tsx) */
export const ROW_ACTION_PROPS: readonly PropDoc[] = [
  { name: 'label', type: 'string', description: '按钮文字（中文原文，组件内翻译），同一行内唯一' },
  { name: 'onClick', type: '() => void', description: '点击时调用' },
  { name: 'render', type: '() => ReactNode', description: '自定义内联内容，例如用 ConfirmAction 包住的删除按钮（只对内联操作生效）' },
  { name: 'icon', type: 'ComponentType', description: '「更多」菜单里的图标' },
  { name: 'danger', type: 'boolean', default: 'false', description: '红色文字' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '显示但不可点击' },
  { name: 'hidden', type: 'boolean', default: 'false', description: '这一行不显示该操作' },
]
