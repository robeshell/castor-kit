# 常见模式

所有模式的完整可运行版本：`apps/web/src/modules/admin/pages/users/index.jsx`（列表 / 表单 / 导入导出）、`docs/templates/frontend/list_page/index.jsx`、`docs/templates/frontend/detail_page/index.jsx`。

## 1. CRUD 列表页骨架

```
PageHeader（title / description / actions：导入 outline、导出 outline、新增 variant="brand"）
→ FilterBar（SearchInput / FilterSelect）
→ 勾选提示条（AnimatePresence，可选）
→ DataTable（pagination / selectable / 行操作）
→ FormDialog（新增 / 编辑）
→ ExportDialog / ImportDialog
```

```jsx
const list = useCrudList(
  (params) =>
    getItems(params).catch((err) => {
      toast.apiError(err, '加载失败')
      return { items: [], total: 0 }
    }),
  { defaultPerPage: 20 },
)
const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list

useEffect(() => {
  fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

const runSearch = () => list.handleSearch({ search: search.trim(), status })
const reset = () => { setSearch(''); setStatus(''); list.handleReset() }
```

`pnpm scaffold` 生成的页面就是这个骨架。字段类型 → 表单组件 / 表格列：

| scaffold 类型 | 表单组件 | 表格列 | 默认值 / 编辑回填 |
|---|---|---|---|
| `str` / `str20` / `str50` / `str500` | `FormInput` | 原样 | `''` / `record.x ?? ''` |
| `text` | `FormTextarea` | `ellipsis: true` | `''` |
| `int` / `float` | `FormNumber`（`step={1}` / `step={0.01}`） | `align: 'right'` + `tabular-nums` | `null` / `record.x ?? null` |
| `bool` | `FormSwitch` | `StatusBadge`（是 / 否） | `false` / `Boolean(record.x)` |
| `date` | `FormDate` | `formatDate` | `''` / `formatDate(record.x, '')` |
| `datetime` | `FormDateTime` | `formatDateTime` | `''` / `formatDateTime(record.x, '')` |
| 枚举（手写） | `FormSelect` / `FormRadioGroup` | `StatusBadge` + tone 映射 | 枚举默认值 |

## 2. 新增 / 编辑表单

```jsx
const EMPTY = { name: '', status: 'active' }
const form = useForm({ defaultValues: EMPTY })

const openCreate = () => { setEditing(null); form.reset(EMPTY); setOpen(true) }
const openEdit = (row) => { setEditing(row); form.reset({ name: row.name ?? '', status: row.status }); setOpen(true) }  // 只回填表单字段

const submit = async (values) => {
  try {
    if (editing) await updateItem(editing.id, values)
    else await createItem(values)
    toast.success(editing ? '更新成功' : '创建成功')
    setOpen(false)
    fetchData()
  } catch (err) {
    toast.apiError(err, '操作失败')
    throw err                      // 让 FormDialog 保持打开
  }
}

<FormDialog open={open} onOpenChange={setOpen} title={editing ? '编辑' : '新增'} form={form} onSubmit={submit}>
  <FormInput control={form.control} name="name" label="名称" rules={{ required: '请输入名称', maxLength: { value: 100, message: '最多 100 个字符' } }} />
  <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} />
</FormDialog>
```

- 校验文案写进 `rules`（required / minLength / maxLength / pattern / validate），与后端 / 旧页面文案一致
- 字段多用 `FormSheet`；两列用 `FormGrid`；自定义控件（上传、树选择）用 `FormCustom`
- 独立表单页（非弹窗）：`<Form {...form}><form onSubmit={form.handleSubmit(save)}>…</form></Form>`（`@/components/ui/form`），参考 profile 页

## 3. 行操作与删除确认

```jsx
{
  key: 'actions', title: '', align: 'right', width: 132,
  render: (_, row) => (
    <div className="flex justify-end gap-0.5">
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(row)}>编辑</Button>
      <ConfirmAction title={`删除「${row.name}」？`} description="删除后不可恢复。" confirmText="删除" onConfirm={() => remove(row)}>
        <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">删除</Button>
      </ConfirmAction>
    </div>
  ),
}
```

`remove` 里 `catch → toast.apiError → throw`，确认框在失败时不关闭。按钮权限沿用页面已有的 `hasPermission` 判断（旧页面没有就不要新加）。

## 4. 导入导出

```jsx
const normalizeFileType = (raw) => (['csv', 'xlsx'].includes(raw) ? raw : 'xlsx')

const handleExport = async ({ fields, fileType }) => {
  const type = normalizeFileType(fileType)
  const payload = { fields, file_type: type }
  if (selectedKeys.length) payload.ids = selectedKeys
  try {
    downloadBlobFile(await exportItems(payload), `xxx_export.${type}`)
    toast.success('导出成功')
    setExportOpen(false)
  } catch (err) {
    toast.apiError(err, '导出失败')
  }
}

<ExportDialog open={exportOpen} onOpenChange={setExportOpen} fieldOptions={EXPORT_FIELDS} ruleHint="…" onConfirm={handleExport} />
<ImportDialog
  open={importOpen} onOpenChange={setImportOpen} title="导入数据" targetLabel="客户"
  onDownloadTemplate={(t) => downloadTemplate(normalizeFileType(t)).then((b) => downloadBlobFile(b, `xxx_import_template.${normalizeFileType(t)}`))}
  onImport={(file) => importItems(file)}
  onImported={(res) => { toast.success(`导入成功：新增 ${res?.created || 0} 条`); fetchData() }}
  errorExportFileName="xxx_import_error_rows.csv"
/>
```

只支持 csv / xlsx。导入失败（后端 400 + `error_rows`）由 ImportDialog 展示并可下载错误行，页面不用处理。

## 5. 状态徽章

```jsx
const STATUS = { active: { label: '启用', tone: 'success' }, disabled: { label: '停用', tone: 'neutral' } }
render: (v) => <StatusBadge tone={STATUS[v]?.tone ?? 'neutral'} dot>{STATUS[v]?.label ?? v}</StatusBadge>
```

tone：neutral（草稿 / 停用）、brand（特殊身份）、info（进行中）、success（成功 / 启用）、warning（待处理）、danger（失败 / 异常）。

## 6. 详情

- 行点击看详情：`DataTable onRowClick` + `DetailSheet` + `DescriptionList`
- 左列表右详情：见 `docs/templates/frontend/detail_page/index.jsx`（`md:grid-cols-[280px_minmax(0,1fr)]`，移动端堆叠）
- 详情里的分组切换用 `SegmentedTabs`，内容区用 `Panel`

## 7. 卡片 / 统计 / 图表

```jsx
<motion.div variants={stagger.container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {stats.map((s) => (
    <motion.div key={s.label} variants={stagger.item}>
      <StatCard label={s.label} value={s.value} delta={s.delta} trend={s.trend} icon={s.icon} />
    </motion.div>
  ))}
</motion.div>

<Panel title="访问趋势" actions={<SegmentedTabs variant="pill" value={range} onChange={setRange} items={RANGES} />}>
  <ReactECharts option={option} style={{ height: 280 }} notMerge />   {/* option 颜色取自 useChartColors() */}
</Panel>
```

## 8. 加载与空态

- 表格：`DataTable loading` 自带骨架与空态（`emptyTitle` / `emptyDescription` / `emptyAction`）
- 其他区域：`<Skeleton className="h-10 w-full" />` 占位；`<EmptyState title="…" description="…" action={…} />`
- 首次加载的 `loading` 初始值设为 `true`，在 promise 回调里 `setLoading(false)`，不要在 `useEffect` 里同步 `setLoading(true)`（react-hooks/set-state-in-effect）

## 9. 反馈

- 成功：`toast.success('已保存')`；失败：`toast.apiError(err, '保存失败')`（后端 `{error}` 文案优先）
- 不要 `alert` / `window.confirm`；危险操作一律 `ConfirmAction`
