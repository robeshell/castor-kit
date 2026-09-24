# 组件清单

## 1. shadcn 原子组件（`@/components/ui/*`）

源码在 `apps/web/src/components/ui/`（JSX，new-york 风格，Radix 原语，配置 `apps/web/components.json`）。官方文档：https://ui.shadcn.com/docs/components 。

| 分类 | 组件（文件名即导入路径，如 `@/components/ui/button`） |
|---|---|
| 操作 | `button`（variant：default / brand / outline / secondary / ghost / link / destructive；size：xs / sm / default / lg / icon / icon-xs / icon-sm / icon-lg）、`toggle`、`toggle-group`、`dropdown-menu`、`context-menu`、`command`（cmdk） |
| 输入 | `input`、`textarea`、`select`、`checkbox`、`switch`、`radio-group`、`slider`、`calendar`、`input-group`、`label`、`field`、`form`（react-hook-form 绑定） |
| 弹层 | `dialog`、`alert-dialog`、`sheet`、`drawer`（vaul）、`popover`、`tooltip`、`hover-card` |
| 展示 | `card`、`badge`、`avatar`、`table`、`tabs`、`accordion`、`collapsible`、`separator`、`scroll-area`、`breadcrumb`、`pagination`、`kbd`、`alert`、`empty` |
| 反馈 | `skeleton`、`spinner`、`progress`、`sonner`（全局 Toaster 已挂在应用外壳，页面用 `@/lib/toast`） |
| 布局 | `sidebar`（应用外壳 `apps/web/src/components/app/` 在用，页面一般不直接用） |

要点：

- **主操作按钮**：`<Button size="sm" variant="brand">`（品牌渐变 + 柔和辉光），每页最多一个；次要操作 `outline`，行内操作 `ghost` + `size="sm"` + `className="h-7 px-2"`
- 按钮里的图标直接放 lucide 组件：`<Button><Plus />新增</Button>`（尺寸由 button 统一处理）
- `dialog` / `sheet` / `alert-dialog` 的进出场动画来自 `tw-animate-css`，不要再包 motion
- 页面很少直接用 `table` / `dialog` / `alert-dialog`：优先用下面的 DataTable / FormDialog / ConfirmAction

## 2. castor-kit 业务公共组件（`@/shared/components/*`）

源码在 `apps/web/src/shared/components/`。

### 页面骨架

> **文案原则：不写没用的描述。** 页面标题下不放功能介绍；Panel / 弹窗 / 指标卡的描述只在带信息时才写——
> 数据（「共 N 条」「最近 60 个采样点」）、当前对象（「正在编辑 X」）、约束与后果（「删除后不可恢复」「编码创建后不可修改」）、
> 快捷键、空状态的下一步。复述标题、介绍功能或技术栈、宣传语一律不写。

```jsx
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'

<PageHeader title="用户管理" actions={<>…按钮…</>} />
<Panel title="系统活跃度" description={`近 7 天共 ${total} 条`} actions={…}>内容</Panel>
<Panel padded={false}>贴边内容（表格 / 列表）</Panel>
```

### 表格

```jsx
import DataTable, { DataPagination } from '@/shared/components/DataTable'

const columns = [
  { key: 'id', title: 'ID', dataIndex: 'id', width: 72, className: 'text-muted-foreground tabular-nums' },
  { key: 'name', title: '名称', dataIndex: 'name', ellipsis: true },
  { key: 'status', title: '状态', dataIndex: 'status', render: (value, row, index) => <StatusBadge … /> },
  { key: 'actions', title: '', align: 'right', width: 132, render: (_, row) => … },
]
<DataTable
  columns={columns} data={data} loading={loading} rowKey="id"
  pagination={{ page, perPage, total, onChange: handlePageChange }}   // 不传则不分页
  selectable selectedKeys={keys} onSelectionChange={(keys, rows) => …}
  onRowClick={(row) => …} emptyTitle="没有找到数据" emptyDescription="…" emptyAction={…}
  bordered dense
/>
```

### 筛选

```jsx
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'   // 实时过滤时防抖

<FilterBar onSearch={runSearch} onReset={reset} extra={…右侧附加…}>
  <SearchInput value={kw} onChange={setKw} onSubmit={runSearch} placeholder="搜索用户名" />
  <FilterSelect value={status} onChange={setStatus} options={[{ label: '启用', value: 'active' }]} placeholder="全部状态" />
</FilterBar>
```

`FilterSelect` 的 `''` / `undefined` 表示“全部”。

### 表单（react-hook-form）

```jsx
import { useForm } from 'react-hook-form'
import { FormDialog, FormSheet } from '@/shared/components/FormDialog'
import { FormInput, FormSelect, FormSwitch, FormGrid } from '@/shared/components/FormFields'

const form = useForm({ defaultValues: { name: '', status: 'active', enabled: true } })
<FormDialog open={open} onOpenChange={setOpen} title="新建" description="…" form={form} onSubmit={save} size="sm|md|lg" submitText="保存">
  <FormInput control={form.control} name="name" label="名称" placeholder="…" rules={{ required: '请输入名称' }} />
  <FormGrid columns={2}>…两列字段…</FormGrid>
</FormDialog>
```

- `onSubmit(values)` 返回 Promise；**抛错时弹窗保持打开**，所以提交函数 `catch (err) { toast.apiError(err, '保存失败'); throw err }`
- 字段多、需要保留列表上下文时用 `FormSheet`（右侧抽屉，`width` 默认 520）
- 字段组件（都接收 `control / name / label / description / rules / required / className`）：

| 组件 | 额外 props | 值 |
|---|---|---|
| `FormInput` | `type` / `placeholder` / `autoComplete` / `disabled` | string |
| `FormTextarea` | `rows`（默认 3）/ `placeholder` | string |
| `FormNumber` | `min` / `max` / `step` / `placeholder` | number，空为 `null` |
| `FormSelect` | `options=[{label,value}]` / `clearable` / `placeholder` | 保持 value 原始类型 |
| `FormMultiSelect` | `options` / `placeholder` | array |
| `FormSwitch` | `layout`（默认 inline：label 左、开关右） | boolean |
| `FormRadioGroup` | `options` / `direction` | any |
| `FormCheckboxGroup` | `options` / `columns` | array |
| `FormDate` | `placeholder` | `'YYYY-MM-DD'` |
| `FormDateTime` | - | `'YYYY-MM-DD HH:mm:ss'` |
| `FormTags` | `placeholder` | string[] |
| `FormCustom` | `render({ value, onChange, field, fieldState })` | 任意 |
| `FormGrid` | `columns`（默认 2，移动端单列） | 布局容器 |

### 详情 / 确认 / 状态

```jsx
import { DetailSheet, DescriptionList } from '@/shared/components/FormDialog'
import ConfirmAction from '@/shared/components/ConfirmAction'
import RowActions from '@/shared/components/RowActions'
import StatusBadge from '@/shared/components/StatusBadge'
import EmptyState from '@/shared/components/EmptyState'

<DetailSheet open={open} onOpenChange={setOpen} title="详情" width={480} footer={…}>
  <DescriptionList columns={2} items={[{ label: '名称', value: row.name }, { label: '备注', value: row.remark, full: true }]} />
</DetailSheet>

<ConfirmAction title="删除该用户？" description="删除后不可恢复。" confirmText="删除" onConfirm={() => remove(row)}>
  <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">删除</Button>
</ConfirmAction>   // onConfirm 返回 Promise 时按钮 loading、失败不关闭；destructive 默认 true

<RowActions actions={[{ label: '编辑', onClick: () => edit(row) }, { label: '复制', onClick: … }]} inline={2} />
<StatusBadge tone="success" dot>启用</StatusBadge>             // tone: neutral | brand | info | success | warning | danger
<StatusBadge tone="neutral" variant="plain" dot>草稿</StatusBadge>
<EmptyState icon={Inbox} title="暂无数据" description="…" action={<Button …/>} />
```

### 其他

| 组件 | 用法 |
|---|---|
| `SegmentedTabs` | `<SegmentedTabs value={tab} onChange={setTab} items={[{ value: 'all', label: '全部', count: 12 }]} />`；`variant="pill"` 小切换（24h / 7d） |
| `TreeView` | `nodes=[{ key, label, children }]`、`selectedKey` / `onSelect`、`renderLabel` / `renderActions`、`defaultExpandAll`、受控 `expandedKeys` / `onExpandedChange` |
| `StatCard` / `Sparkline` / `CountUp` | `<StatCard label="用户数" value={128} delta="+12%" trend={[…]} icon={Users} />` |
| `DatePicker` / `DateTimePicker` | 非表单场景的日期选择，值格式同上 |
| `MultiSelect` / `TagInput` | 非表单场景的多选 / 标签输入 |
| `data-transfer/ImportDialog` | `open` / `onOpenChange` / `title` / `targetLabel` / `onDownloadTemplate(fileType)` / `onImport(file)` / `onImported(res)` / `errorExportFileName`；失败行自动展示并可下载 |
| `data-transfer/ExportDialog` | `open` / `onOpenChange` / `title` / `fieldOptions` / `defaultFields` / `ruleHint` / `onConfirm({ fields, fileType })`（返回 Promise，成功后调用方关闭） |
| `upload/FileUpload` / `upload/ImageUpload` | `fileList` / `onFileListChange` / `uploadApi` / `limit` / `accept` / `maxSizeMB`；条目 `{ uid, name, url, status: 'uploading' \| 'success' \| 'error', response }` |

## 3. lib 与 hooks

| 模块 | 导出 |
|---|---|
| `@/lib/utils` | `cn(...classes)`（clsx + tailwind-merge） |
| `@/lib/toast` | `toast.success / error / warning / info`、`toast.apiError(err, fallback)`（后端 `{error}` 文案优先）、`errorMessage(err, fallback)` |
| `@/lib/format` | `formatDateTime(v)`、`formatDate(v)`、`formatNumber(v)`、`formatRelative(v)`（第二个参数是空值占位，默认 `'-'`） |
| `@/lib/motion` | `fadeUp`、`stagger.container / stagger.item`、`pageTransition`、`layoutSpring`、`EASE_OUT`、`EASE_SPRING` |
| `@/lib/chart-theme` | `useChartColors()`、`chartBase(c)`、`brandArea(c, opacity)`、`brandLine(c)`、`hexToRgba(hex, alpha)`——ECharts 取色必须走它，亮暗自动切换 |
| `@/lib/menu-icons` | `resolveMenuIcon(menu)`：菜单 icon 字段（历史 Semi 图标名如 `IconUser`）→ lucide 组件 |
| `@/shared/hooks/useCrudList` | `{ data, total, page, perPage, loading, filters, fetchData, handleSearch, handleReset, handlePageChange }` |
| `@/shared/hooks/useIsMobile` / `@/shared/hooks/useDebouncedValue` | 断点判断（默认 768）/ 防抖值 |
| `@/shared/api/request` | Axios 实例（CSRF、401 跳登录、响应已 unwrap） |
| `@/shared/utils/file` | `downloadBlobFile(blob, filename)`、`downloadErrorRowsCsv` |
