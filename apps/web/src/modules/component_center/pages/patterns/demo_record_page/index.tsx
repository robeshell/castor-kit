/**
 * Page patterns → Standard list: the reference implementation of the standard list pattern, on the shared demo API
 * (/api/admin/component-center/demo-records, see modules/component-center/demo-record in apps/api).
 *
 * Use it for a plain CRUD resource: filter, page, create / edit in a dialog, delete, import / export. This is
 * `pnpm scaffold` output (spec: name demo_record, domain component_center) with three hand edits worth copying:
 * the category / status / enabled filters; a column subset instead of one column per field (the form and the
 * export still cover every field); status and enabled as StatusBadge, in the tones of the options the patterns
 * share (../demo-record-options). Same structure as apps/web/src/modules/admin/pages/users/index.tsx: PageHeader ->
 * FilterBar -> DataTable (pagination / selection / row actions) -> FormDialog (react-hook-form) -> ImportDialog /
 * ExportDialog.
 *
 * Types: Row is the record the API returns (ApiItem of the module's OpenAPI entry, see ./api); FormValues is what the
 * form holds and submits, checked against the create / edit body. Change a field in the OpenAPI doc
 * (docs/apifox-full.openapi.json, then `pnpm openapi:generate`) and tsc points at the page code to update.
 *
 * i18n: Chinese source text is the key. Strings passed to shared components (PageHeader, DataTable columns,
 * FormDialog, FormFields, ExportDialog, toast, ...) are translated inside them; text written in JSX, native
 * attributes and interpolated strings go through t() / <Trans>. Shared CRUD strings are translated in
 * src/locales; add page-specific translations (e.g. the Chinese title and labels) to ./locales/<lang>.json.
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import { Trans, useTranslation } from 'react-i18next'
import { Download, Plus, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate, formatNumber } from '@/lib/format'
import { toast } from '@/lib/toast'
import {
  createItem,
  deleteItem,
  downloadTemplate,
  exportItems,
  getItems,
  importItems,
  updateItem,
  type DemoRecord as Row,
  type DemoRecordExportBody,
  type DemoRecordFileType,
} from '@/modules/component_center/api/demo_record'
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  enabledOption,
  ENABLED_OPTIONS,
  STATUS_OPTIONS,
  statusLabel,
  statusTone,
  type DemoCategory,
  type DemoStatus,
} from '@/modules/component_center/pages/patterns/demo-record-options'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import ExportDialog, { type ExportFieldOption, type ExportParams } from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormDate, FormImageUpload, FormInput, FormNumber, FormSelect, FormSwitch, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { downloadBlobFile } from '@/shared/utils/file'

const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '名称', value: 'name' },
  { label: '编码', value: 'code' },
  { label: '分类', value: 'category' },
  { label: '状态', value: 'status' },
  { label: '负责人', value: 'owner' },
  { label: '优先级', value: 'priority' },
  { label: '是否启用', value: 'is_active' },
  { label: '金额', value: 'amount' },
  { label: '数量', value: 'quantity' },
  { label: '进度', value: 'progress' },
  { label: '开始日期', value: 'start_date' },
  { label: '结束日期', value: 'end_date' },
  { label: '上级记录', value: 'parent_id' },
  { label: '排序', value: 'sort_order' },
  { label: '封面', value: 'cover' },
  { label: '描述', value: 'description' },
  { label: '创建时间', value: 'created_at' },
] as const satisfies readonly ExportFieldOption[]
/** Export column names (the values the export body accepts) */
type ExportField = (typeof EXPORT_FIELDS)[number]['value']
const isExportField = (value: string): value is ExportField => EXPORT_FIELDS.some((o) => o.value === value)
const normalizeFileType = (raw: string): DemoRecordFileType => (raw === 'csv' || raw === 'xlsx' ? raw : 'xlsx')

/** What the form holds and submits (the create / edit body) */
interface FormValues {
  name: string
  code: string
  category: DemoCategory | null
  status: DemoStatus | null
  owner: string
  priority: number | null
  is_active: boolean
  amount: number | string | null
  quantity: number | null
  progress: number | null
  start_date: string
  end_date: string
  parent_id: number | null
  sort_order: number | null
  cover: string | null
  description: string
}

const EMPTY_VALUES: FormValues = {
  name: '',
  code: '',
  category: null,
  status: 'todo',
  owner: '',
  priority: 0,
  is_active: true,
  amount: null,
  quantity: null,
  progress: 0,
  start_date: '',
  end_date: '',
  parent_id: null,
  sort_order: 0,
  cover: null,
  description: '',
}

/** Edit: take only the form fields (id / created_at are not sent back); dates converted to the picker format */
const toFormValues = (record: Row): FormValues => ({
  name: record.name ?? '',
  code: record.code ?? '',
  category: record.category ?? null,
  status: record.status ?? null,
  owner: record.owner ?? '',
  priority: record.priority ?? null,
  is_active: Boolean(record.is_active),
  amount: record.amount ?? null,
  quantity: record.quantity ?? null,
  progress: record.progress ?? null,
  start_date: formatDate(record.start_date, ''),
  end_date: formatDate(record.end_date, ''),
  parent_id: record.parent_id ?? null,
  sort_order: record.sort_order ?? null,
  cover: record.cover ?? null,
  description: record.description ?? '',
})

export default function StandardListPage() {
  const { t } = useTranslation()
  const list = useCrudList(
    (params) =>
      getItems(params).catch((err: unknown) => {
        toast.apiError(err, '加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [isActive, setIsActive] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [editing, setEditing] = useState<Row | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm<FormValues>({ defaultValues: EMPTY_VALUES })

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.reset(EMPTY_VALUES)
    setFormOpen(true)
  }

  const openEdit = (record: Row) => {
    setEditing(record)
    form.reset(toFormValues(record))
    setFormOpen(true)
  }

  const submit = async (values: FormValues) => {
    try {
      if (editing) {
        await updateItem(editing.id, values)
        toast.success('更新成功')
      } else {
        await createItem(values)
        toast.success('创建成功')
      }
      setFormOpen(false)
      fetchData()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async (record: Row) => {
    try {
      await deleteItem(record.id)
      toast.success('删除成功')
      setSelectedKeys((keys) => keys.filter((k) => k !== record.id))
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const runSearch = () => {
    setSelectedKeys([])
    list.handleSearch({ search: search.trim(), category, status, is_active: isActive })
  }
  const reset = () => {
    setSearch('')
    setCategory('')
    setStatus('')
    setIsActive('')
    setSelectedKeys([])
    list.handleReset()
  }

  const handleExport = async ({ fields, fileType }: ExportParams) => {
    const type = normalizeFileType(fileType)
    const payload: DemoRecordExportBody = { fields: fields.filter(isExportField), file_type: type }
    if (selectedKeys.length) payload.ids = selectedKeys
    try {
      const blob = await exportItems(payload)
      downloadBlobFile(blob, `demo-records_export.${type}`)
      toast.success('导出成功')
      setExportOpen(false)
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  // A column subset: what a row is recognised and compared by. The rest of the fields are in the form and the export.
  const columns: DataTableColumn<Row>[] = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      render: (value, record) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{value}</div>
          <div className="text-muted-foreground truncate font-mono text-xs">{record.code}</div>
        </div>
      ),
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (value) => {
        const label = categoryLabel(value)
        return label ? t(label) : (value ?? '-')
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value) =>
        value ? (
          <StatusBadge tone={statusTone(value)} dot>
            {statusLabel(value)}
          </StatusBadge>
        ) : (
          '-'
        ),
    },
    { key: 'owner', title: '负责人', dataIndex: 'owner', width: 100, render: (value) => value || '-' },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      align: 'right',
      className: 'tabular-nums',
    },
    {
      key: 'amount',
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      className: 'tabular-nums',
      render: (value) => formatNumber(value),
    },
    {
      key: 'start_date',
      title: '开始日期',
      dataIndex: 'start_date',
      width: 120,
      className: 'text-muted-foreground tabular-nums',
      render: (value) => formatDate(value),
    },
    {
      key: 'end_date',
      title: '结束日期',
      dataIndex: 'end_date',
      width: 120,
      className: 'text-muted-foreground tabular-nums',
      render: (value) => formatDate(value),
    },
    {
      key: 'is_active',
      title: '是否启用',
      dataIndex: 'is_active',
      width: 100,
      render: (value) => {
        if (value === null) return '-'
        const option = enabledOption(value)
        return (
          <StatusBadge tone={option.tone} dot>
            {option.label}
          </StatusBadge>
        )
      },
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 132,
      render: (_, record) => (
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>
            {t('编辑')}
          </Button>
          <ConfirmAction title="确认删除该记录？" description="删除后不可恢复。" confirmText="删除" onConfirm={() => remove(record)}>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              {t('删除')}
            </Button>
          </ConfirmAction>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="标准列表"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload />
              {t('导入')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <Download />
              {t('导出')}
            </Button>
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              {t('新增')}
            </Button>
          </>
        }
      />

      <FilterBar onSearch={runSearch} onReset={reset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="搜索…" />
        <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} placeholder="分类" />
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="状态" />
        <FilterSelect value={isActive} onChange={setIsActive} options={ENABLED_OPTIONS} placeholder="是否启用" />
      </FilterBar>

      <AnimatePresence>
        {selectedKeys.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-brand-soft mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-[13px]">
              <span>
                <Trans
                  i18nKey="已勾选 <0>{{count}}</0> 条，导出时将优先导出勾选数据"
                  values={{ count: selectedKeys.length }}
                  components={[<span className="font-medium tabular-nums" />]}
                />
              </span>
              <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => setSelectedKeys([])}>
                <X />
                {t('清空勾选')}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        emptyTitle="暂无数据"
        emptyDescription={filters.search || filters.category || filters.status || filters.is_active ? '换个关键词试试' : '点击右上角「新增」添加第一条数据'}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? '编辑' : '新增'}
        form={form}
        onSubmit={submit}
      >
        <FormInput control={form.control} name="name" label="名称" rules={{ required: '此项必填' }} />
        <FormInput control={form.control} name="code" label="编码" rules={{ required: '此项必填' }} />
        <FormSelect control={form.control} name="category" label="分类" options={CATEGORY_OPTIONS} clearable />
        <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} rules={{ required: '此项必填' }} />
        <FormInput control={form.control} name="owner" label="负责人" />
        <FormNumber control={form.control} name="priority" label="优先级" step={1} rules={{ required: '此项必填' }} />
        <FormSwitch control={form.control} name="is_active" label="是否启用" rules={{ required: '此项必填' }} />
        <FormNumber control={form.control} name="amount" label="金额" step={0.01} />
        <FormNumber control={form.control} name="quantity" label="数量" step={1} />
        <FormNumber control={form.control} name="progress" label="进度" step={1} rules={{ required: '此项必填' }} />
        <FormDate control={form.control} name="start_date" label="开始日期" />
        <FormDate control={form.control} name="end_date" label="结束日期" />
        <FormNumber control={form.control} name="parent_id" label="上级记录" step={1} />
        <FormNumber control={form.control} name="sort_order" label="排序" step={1} rules={{ required: '此项必填' }} />
        <FormImageUpload control={form.control} name="cover" label="封面" />
        <FormTextarea control={form.control} name="description" label="描述" />
      </FormDialog>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="导出设置"
        ruleHint={
          selectedKeys.length
            ? t('已勾选 {{count}} 条，将优先导出勾选数据。', { count: selectedKeys.length })
            : '未勾选数据时导出全部数据。'
        }
        fieldOptions={EXPORT_FIELDS}
        onConfirm={handleExport}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入数据"
        targetLabel="示例数据"
        onDownloadTemplate={(fileType) =>
          downloadTemplate(normalizeFileType(fileType))
            .then((blob) => {
              downloadBlobFile(blob, `demo-records_import_template.${normalizeFileType(fileType)}`)
              toast.success('模板已下载')
            })
            .catch((err: unknown) => toast.apiError(err, '模板下载失败'))
        }
        onImport={(file) => importItems(file)}
        onImported={(res) => {
          toast.success(t('导入成功：新增 {{created}} 条，更新 {{updated}} 条', { created: res?.created || 0, updated: res?.updated || 0 }))
          fetchData()
        }}
        errorExportFileName="demo-records_import_errors.csv"
      />
    </div>
  )
}
