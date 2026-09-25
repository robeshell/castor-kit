import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { Download, Plus, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import {
  createDynamicFormPage,
  deleteDynamicFormPage,
  downloadDynamicFormPageTemplate,
  exportDynamicFormPage,
  getDynamicFormPageDetail,
  getDynamicFormPageList,
  importDynamicFormPage,
  updateDynamicFormPage,
} from '@/modules/component_center/api/dynamic_form_page'
import { EMPTY_FIELD_ROW, FIELD_TYPE_OPTIONS } from '@/modules/component_center/pages/admin/dynamic_form_page/constants'
import FieldRowsEditor from '@/modules/component_center/pages/admin/dynamic_form_page/FieldRowsEditor'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { DescriptionList, DetailSheet, FormDialog } from '@/shared/components/FormDialog'
import { FormGrid, FormInput, FormNumber, FormSelect, FormSwitch, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { downloadBlobFile } from '@/shared/utils/file'

// ── Constants ──────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: '配置', value: 'config' },
  { label: '档案', value: 'profile' },
  { label: '规格', value: 'spec' },
]
const CATEGORY_META = {
  general: { label: '通用', tone: 'brand' },
  config: { label: '配置', tone: 'warning' },
  profile: { label: '档案', tone: 'info' },
  spec: { label: '规格', tone: 'neutral' },
}

const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
]
const STATUS_META = {
  draft: { label: '草稿', tone: 'neutral' },
  published: { label: '已发布', tone: 'success' },
  archived: { label: '已归档', tone: 'warning' },
}

const FIELD_TYPE_META = {
  text: { label: '文本', tone: 'brand' },
  number: { label: '数字', tone: 'warning' },
  boolean: { label: '布尔', tone: 'success' },
  date: { label: '日期', tone: 'info' },
}
const FIELD_TYPE_LABEL = Object.fromEntries(FIELD_TYPE_OPTIONS.map((o) => [o.value, o.label]))

const ACTIVE_OPTIONS = [
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
]

const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '标题', value: 'title' },
  { label: '记录编码', value: 'record_code' },
  { label: '分类', value: 'category' },
  { label: '发布状态', value: 'status' },
  { label: '负责人', value: 'owner' },
  { label: '优先级', value: 'priority' },
  { label: '字段数量', value: 'fields_count' },
  { label: '启用', value: 'is_active' },
  { label: '描述', value: 'description' },
  { label: '创建时间', value: 'created_at' },
  { label: '更新时间', value: 'updated_at' },
]

const normalizeFileType = (raw) => (['csv', 'xlsx'].includes(raw) ? raw : 'csv')

/** Field sub-table row → form row (keep only editable columns; drop id / record_id etc.) */
const toFieldRow = (f) => ({
  field_key: f?.field_key ?? '',
  field_value: f?.field_value ?? '',
  field_type: f?.field_type || 'text',
  remark: f?.remark ?? '',
})

function toFormValues(record) {
  if (!record) {
    return {
      title: '',
      record_code: '',
      category: 'general',
      status: 'draft',
      owner: '',
      priority: 0,
      is_active: true,
      description: '',
      fields: [{ ...EMPTY_FIELD_ROW }],
    }
  }
  return {
    title: record.title ?? '',
    record_code: record.record_code ?? '',
    category: record.category || 'general',
    status: record.status || 'draft',
    owner: record.owner || '',
    priority: record.priority ?? 0,
    is_active: record.is_active !== false,
    description: record.description || '',
    fields: record.fields?.length ? record.fields.map(toFieldRow) : [{ ...EMPTY_FIELD_ROW }],
  }
}

function categoryBadge(value) {
  const meta = CATEGORY_META[value]
  return <StatusBadge tone={meta?.tone || 'neutral'}>{meta?.label || value || '-'}</StatusBadge>
}

function statusBadge(value) {
  const meta = STATUS_META[value] || { label: value, tone: 'neutral' }
  return (
    <StatusBadge tone={meta.tone} dot>
      {meta.label}
    </StatusBadge>
  )
}

function activeBadge(value, variant = 'plain') {
  return (
    <StatusBadge tone={value ? 'success' : 'neutral'} variant={variant} dot={variant !== 'plain'}>
      {value ? '启用' : '停用'}
    </StatusBadge>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DynamicFormPage() {
  const { t } = useTranslation()
  const list = useCrudList(
    (params) =>
      getDynamicFormPageList(params).catch((err) => {
        toast.apiError(err, '加载动态表单数据失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data: items, total, loading, page, perPage, filters, fetchData, handlePageChange } = list

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterActive, setFilterActive] = useState('')

  const [selectedKeys, setSelectedKeys] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [loadingEditId, setLoadingEditId] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm({ defaultValues: toFormValues(null) })

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [])

  const runSearch = () => {
    setSelectedKeys([])
    list.handleSearch({
      search: search.trim(),
      category: filterCategory,
      status: filterStatus,
      is_active: filterActive,
    })
  }

  const reset = () => {
    setSearch('')
    setFilterCategory('')
    setFilterStatus('')
    setFilterActive('')
    setSelectedKeys([])
    list.handleReset()
  }

  // ── CRUD ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    form.reset(toFormValues(null))
    setFormOpen(true)
  }

  /** List rows have no field sub-table: edit directly when fields are present, otherwise fetch the detail first so saving does not wipe existing fields */
  const openEdit = async (record) => {
    if (!record) return
    let full = record
    if (!Array.isArray(record.fields)) {
      try {
        setLoadingEditId(record.id)
        full = await getDynamicFormPageDetail(record.id)
      } catch (err) {
        toast.apiError(err, '详情加载失败')
        return
      } finally {
        setLoadingEditId(null)
      }
    }
    setEditing(full)
    form.reset(toFormValues(full))
    setFormOpen(true)
  }

  const openDetail = (record) => {
    setDetail(null)
    setDetailOpen(true)
    getDynamicFormPageDetail(record.id)
      .then((res) => setDetail(res))
      .catch((err) => toast.apiError(err, '详情加载失败'))
  }

  const submit = async (values) => {
    const cleanFields = (values.fields || [])
      .filter((f) => String(f?.field_key || '').trim())
      .map((f, idx) => ({ ...toFieldRow(f), sort_order: idx }))
    const payload = { ...values, fields: cleanFields }
    try {
      if (editing?.id) await updateDynamicFormPage(editing.id, payload)
      else await createDynamicFormPage(payload)
      toast.success(editing?.id ? '更新成功' : '创建成功')
      setFormOpen(false)
      fetchData()
    } catch (err) {
      toast.apiError(err, '保存失败')
      throw err
    }
  }

  const remove = async (record) => {
    try {
      await deleteDynamicFormPage(record.id)
      toast.success('删除成功')
      setSelectedKeys((keys) => keys.filter((k) => k !== record.id))
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  // ── Export ──────────────────────────────────────────────────────────
  const handleExport = async ({ fields, fileType }) => {
    const ft = normalizeFileType(fileType)
    const payload = {
      fields,
      file_type: ft,
      export_mode: selectedKeys.length > 0 ? 'selected' : 'filtered',
      ids: selectedKeys.length > 0 ? selectedKeys : undefined,
      filters,
    }
    try {
      const blob = await exportDynamicFormPage(payload)
      downloadBlobFile(blob, `dynamic_form_page_export.${ft}`)
      toast.success('导出成功')
      setExportOpen(false)
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  // ── Table columns ────────────────────────────────────────────────────────
  const columns = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 60, className: 'text-muted-foreground tabular-nums' },
    { key: 'title', title: '标题', dataIndex: 'title', minWidth: 160, render: (v) => <span className="font-medium">{v}</span> },
    {
      key: 'record_code',
      title: '编码',
      dataIndex: 'record_code',
      width: 150,
      render: (v) => (v ? <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{v}</code> : null),
    },
    { key: 'category', title: '分类', dataIndex: 'category', width: 80, render: categoryBadge },
    { key: 'status', title: '状态', dataIndex: 'status', width: 90, render: statusBadge },
    { key: 'owner', title: '负责人', dataIndex: 'owner', width: 100, render: (v) => v || '-' },
    {
      key: 'fields_count',
      title: '字段数',
      dataIndex: 'fields_count',
      width: 80,
      render: (v) => <StatusBadge tone={v ? 'brand' : 'neutral'} className="tabular-nums">{t('{{count}} 条', { count: v || 0 })}</StatusBadge>,
    },
    { key: 'is_active', title: '启用', dataIndex: 'is_active', width: 76, render: (v) => activeBadge(v) },
    {
      key: 'updated_at',
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      className: 'text-muted-foreground tabular-nums',
      render: (v) => formatDateTime(v),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 160,
      render: (_, record) => (
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openDetail(record)}>
            {t('查看')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" disabled={loadingEditId === record.id} onClick={() => openEdit(record)}>
            {loadingEditId === record.id ? <Spinner /> : null}
            {t('编辑')}
          </Button>
          <ConfirmAction title="确认删除该记录？" description="删除后不可恢复" confirmText="删除" onConfirm={() => remove(record)}>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              {t('删除')}
            </Button>
          </ConfirmAction>
        </div>
      ),
    },
  ]

  const hasFilters = Object.values(filters).some((v) => v !== '' && v !== undefined)

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="动态表单页"
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
              {t('新建记录')}
            </Button>
          </>
        }
      />

      <FilterBar onSearch={runSearch} onReset={reset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="标题 / 编码 / 负责人" />
        <FilterSelect value={filterCategory} onChange={setFilterCategory} options={CATEGORY_OPTIONS} placeholder="分类" allLabel="全部分类" className="w-32" />
        <FilterSelect value={filterStatus} onChange={setFilterStatus} options={STATUS_OPTIONS} placeholder="状态" allLabel="全部状态" className="w-32" />
        <FilterSelect value={filterActive} onChange={setFilterActive} options={ACTIVE_OPTIONS} placeholder="启用状态" allLabel="全部启用状态" />
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
        data={items}
        loading={loading}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        minWidth={1100}
        emptyTitle="暂无动态表单记录"
        emptyDescription={hasFilters ? '换个筛选条件试试' : '点击右上角「新建记录」添加第一条数据'}
      />

      {/* ── Create / edit ── */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing?.id ? '编辑记录' : '新建记录'}
        description={editing?.id ? t('正在编辑 {{name}}', { name: editing.title }) : undefined}
        form={form}
        onSubmit={submit}
        size="lg"
      >
        <div className="text-muted-foreground text-xs font-medium">{t('基础信息')}</div>
        <FormGrid>
          <FormInput control={form.control} name="title" label="标题" rules={{ required: '请输入标题' }} />
          <FormInput
            control={form.control}
            name="record_code"
            label="记录编码"
            placeholder="例如：form_001"
            rules={{ required: '请输入记录编码' }}
            disabled={Boolean(editing?.id)}
          />
          <FormSelect control={form.control} name="category" label="分类" options={CATEGORY_OPTIONS} />
          <FormSelect control={form.control} name="status" label="发布状态" options={STATUS_OPTIONS} />
          <FormInput control={form.control} name="owner" label="负责人" placeholder="例如：admin" />
          <FormNumber
            control={form.control}
            name="priority"
            label="优先级"
            min={0}
            max={9999}
            step={1}
            rules={{
              min: { value: 0, message: '优先级范围 0–9999' },
              max: { value: 9999, message: '优先级范围 0–9999' },
            }}
          />
        </FormGrid>
        <FormSwitch control={form.control} name="is_active" label="启用" />

        <Separator />
        <FieldRowsEditor control={form.control} />
        <Separator />

        <FormTextarea
          control={form.control}
          name="description"
          label="描述"
          rows={3}
          inputClassName="min-h-20"
          rules={{ maxLength: { value: 300, message: '描述最多 300 字' } }}
        />
      </FormDialog>

      {/* ── Detail ── */}
      <DetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="记录详情"
        description={detail?.title}
        width={560}
        footer={
          <>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              {t('关闭')}
            </Button>
            <Button
              disabled={!detail}
              onClick={() => {
                setDetailOpen(false)
                if (detail) openEdit(detail)
              }}
            >
              {t('编辑')}
            </Button>
          </>
        }
      >
        {!detail ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <DescriptionList
              items={[
                { label: 'ID', value: <span className="tabular-nums">{detail.id}</span> },
                { label: '标题', value: detail.title },
                { label: '编码', value: <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{detail.record_code}</code> },
                { label: '分类', value: categoryBadge(detail.category) },
                { label: '状态', value: statusBadge(detail.status) },
                { label: '负责人', value: detail.owner || '-' },
                { label: '优先级', value: <span className="tabular-nums">{detail.priority ?? 0}</span> },
                { label: '启用', value: activeBadge(detail.is_active, 'soft') },
                { label: '字段数量', value: <span className="tabular-nums">{detail.fields?.length ?? 0}</span> },
                { label: '创建时间', value: <span className="tabular-nums">{formatDateTime(detail.created_at)}</span> },
                { label: '更新时间', value: <span className="tabular-nums">{formatDateTime(detail.updated_at)}</span> },
              ]}
            />

            {detail.fields?.length > 0 ? (
              <>
                <Separator />
                <div className="space-y-2.5">
                  <div className="text-[13px] font-medium">
                    {t('动态字段')} <span className="text-muted-foreground font-normal tabular-nums">{t('（{{count}} 条）', { count: detail.fields.length })}</span>
                  </div>
                  <DataTable
                    dense
                    rowKey={(row, i) => row.id ?? i}
                    data={detail.fields}
                    columns={[
                      {
                        key: 'field_key',
                        title: '字段键',
                        dataIndex: 'field_key',
                        render: (v) => <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{v}</code>,
                      },
                      { key: 'field_value', title: '字段值', dataIndex: 'field_value', ellipsis: true, render: (v) => v || '-' },
                      {
                        key: 'field_type',
                        title: '类型',
                        dataIndex: 'field_type',
                        width: 70,
                        render: (v) => <StatusBadge tone={FIELD_TYPE_META[v]?.tone || 'neutral'}>{FIELD_TYPE_LABEL[v] || v}</StatusBadge>,
                      },
                      { key: 'remark', title: '备注', dataIndex: 'remark', ellipsis: true, render: (v) => v || '-' },
                    ]}
                  />
                </div>
              </>
            ) : null}

            {detail.description ? (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <div className="text-[13px] font-medium">{t('描述')}</div>
                  <p className="text-muted-foreground text-[13px] leading-relaxed whitespace-pre-wrap">{detail.description}</p>
                </div>
              </>
            ) : null}
          </div>
        )}
      </DetailSheet>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="动态表单页导出字段"
        ruleHint={selectedKeys.length > 0 ? t('已勾选 {{count}} 条，将优先导出勾选数据', { count: selectedKeys.length }) : '未勾选时，将按当前筛选条件导出'}
        fieldOptions={EXPORT_FIELDS}
        defaultFields={['title', 'record_code', 'category', 'status', 'owner', 'fields_count', 'updated_at']}
        onConfirm={handleExport}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入动态表单页数据"
        targetLabel="动态表单页"
        onDownloadTemplate={(fileType) => {
          const ext = normalizeFileType(fileType)
          downloadDynamicFormPageTemplate(ext)
            .then((blob) => {
              downloadBlobFile(blob, `dynamic_form_page_import_template.${ext}`)
              toast.success('模板下载成功')
            })
            .catch((err) => toast.apiError(err, '模板下载失败'))
        }}
        onImport={(file) => importDynamicFormPage(file)}
        onImported={(res) => {
          toast.success(t('导入成功：新增 {{created}} 条，更新 {{updated}} 条', { created: res?.created || 0, updated: res?.updated || 0 }))
          fetchData()
        }}
        errorExportFileName="dynamic_form_page_import_error_rows.csv"
      />
    </div>
  )
}
