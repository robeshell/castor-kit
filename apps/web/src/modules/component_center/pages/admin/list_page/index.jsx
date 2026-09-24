import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import {
  Braces,
  CheckCircle2,
  Database,
  Download,
  FileText,
  Filter,
  ImageIcon,
  Paperclip,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/toast'
import { formatDateTime } from '@/lib/format'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  createListPage,
  deleteListPage,
  downloadListPageTemplate,
  exportListPage,
  getListPageList,
  importListPage,
  updateListPage,
  uploadListPageFile,
  uploadListPageImage,
} from '@/modules/component_center/api/list_page'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { DescriptionList, DetailSheet, FormSheet } from '@/shared/components/FormDialog'
import { FormCustom, FormGrid, FormInput, FormNumber, FormSelect, FormSwitch } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import FileUpload from '@/shared/components/upload/FileUpload'
import ImageUpload from '@/shared/components/upload/ImageUpload'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { downloadBlobFile } from '@/shared/utils/file'

const CATEGORY_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: '订单', value: 'order' },
  { label: '用户', value: 'user' },
  { label: '财务', value: 'finance' },
  { label: '风控', value: 'risk' },
]

const ACTIVE_OPTIONS = [
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
]

const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
]

const CONDITION_OPERATOR_OPTIONS = [
  { label: '等于', value: 'eq' },
  { label: '不等于', value: 'ne' },
  { label: '包含', value: 'contains' },
  { label: '不包含', value: 'not_contains' },
  { label: '大于', value: 'gt' },
  { label: '小于', value: 'lt' },
  { label: '在范围内', value: 'between' },
]

const CONDITION_LOGIC_OPTIONS = [
  { label: 'AND', value: 'AND' },
  { label: 'OR', value: 'OR' },
]

const DATA_SOURCE_OPTIONS = [
  { label: '订单表 orders', value: 'orders' },
  { label: '用户表 users', value: 'users' },
  { label: '风控表 risk_events', value: 'risk_events' },
  { label: '日志表 logs', value: 'logs' },
]

const DATA_SOURCE_FIELD_MAP = {
  orders: [
    { label: '订单号 order_no', value: 'order_no' },
    { label: '订单状态 status', value: 'status' },
    { label: '下单时间 created_at', value: 'created_at' },
    { label: '支付金额 amount', value: 'amount' },
  ],
  users: [
    { label: '用户ID user_id', value: 'user_id' },
    { label: '用户昵称 nickname', value: 'nickname' },
    { label: '注册时间 register_at', value: 'register_at' },
    { label: '会员等级 level', value: 'level' },
  ],
  risk_events: [
    { label: '事件ID event_id', value: 'event_id' },
    { label: '事件类型 event_type', value: 'event_type' },
    { label: '风险分 risk_score', value: 'risk_score' },
    { label: '创建时间 created_at', value: 'created_at' },
  ],
  logs: [
    { label: '日志ID id', value: 'id' },
    { label: '操作人 operator', value: 'operator' },
    { label: '操作模块 module', value: 'module' },
    { label: '操作时间 created_at', value: 'created_at' },
  ],
}

const ALL_FIELD_OPTIONS = Array.from(
  new Map(
    Object.values(DATA_SOURCE_FIELD_MAP)
      .flat()
      .map((item) => [item.value, item]),
  ).values(),
)

const QUERY_EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '名称', value: 'name' },
  { label: '编码', value: 'query_code' },
  { label: '分类', value: 'category' },
  { label: '关键字', value: 'keyword' },
  { label: '数据源', value: 'data_source' },
  { label: '负责人', value: 'owner' },
  { label: '图片URL列表', value: 'image_urls' },
  { label: '文件URL列表', value: 'file_urls' },
  { label: '优先级', value: 'priority' },
  { label: '状态', value: 'is_active' },
  { label: '发布状态', value: 'status' },
  { label: '版本号', value: 'version' },
  { label: '更新时间', value: 'updated_at' },
]

const DEFAULT_DISPLAY_CONFIG = {
  selected_fields: ['id', 'name', 'status', 'owner', 'updated_at'],
  preview_rows: 8,
  sort_by: 'updated_at',
  sort_order: 'desc',
}

const DEFAULT_PERMISSION_CONFIG = {
  visible_roles: ['super_admin'],
  editable_roles: ['super_admin'],
}

const DEFAULT_FORM_VALUES = {
  name: '',
  query_code: '',
  category: 'general',
  status: 'draft',
  owner: '',
  data_source: '',
  keyword: '',
  description: '',
  priority: 0,
  is_active: true,
  image_url: '',
  image_urls: [],
  file_url: '',
  file_urls: [],
  schema_config: '{}',
}

const DESCRIPTION_MAX = 500
const MAX_QUERY_IMAGE_COUNT = 9
const MAX_QUERY_FILE_COUNT = 20

const normalizeFileType = (raw) => (['csv', 'xlsx'].includes(raw) ? raw : 'xlsx')

const normalizeUrlList = (raw) => {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    const value = raw.trim()
    if (!value) {
      return []
    }
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean)
      }
    } catch {
      // 非 JSON 数组，按分隔符切分
    }
    return value
      .replaceAll('，', ',')
      .replaceAll('；', ';')
      .replaceAll('\n', ';')
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

const buildUploadFileList = (urls = [], seed = 'default', namePrefix = '资源') =>
  normalizeUrlList(urls).map((url, index) => ({
    uid: `query-upload-${seed}-${index + 1}`,
    name: `${namePrefix}${index + 1}`,
    status: 'success',
    preview: true,
    url,
  }))

const extractUploadedUrls = (fileList = []) =>
  (fileList || [])
    .filter((item) => item?.status === 'success')
    .map((item) => item?.url || item?.response?.url || '')
    .map((item) => String(item || '').trim())
    .filter(Boolean)

const mapCategoryLabel = (value) => {
  const matched = CATEGORY_OPTIONS.find((item) => item.value === value)
  return matched?.label || value || '-'
}

const mapStatusMeta = (value) => {
  if (value === 'published') return { label: '已发布', tone: 'success' }
  return { label: '草稿', tone: 'neutral' }
}

const mapDataSourceLabel = (value) => DATA_SOURCE_OPTIONS.find((item) => item.value === value)?.label || value

const normalizeConditionItems = (conditions) => {
  const items = Array.isArray(conditions?.items) ? conditions.items : []
  return items.map((item, index) => ({
    uid: `condition-${Date.now()}-${index}`,
    field: String(item?.field || ''),
    operator: String(item?.operator || 'eq'),
    value: item?.value ?? '',
    logic: String(item?.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
  }))
}

const buildConditionPayload = (items = []) => ({
  groups: [],
  items: items
    .map((item) => ({
      field: String(item?.field || '').trim(),
      operator: String(item?.operator || '').trim(),
      value: item?.value ?? '',
      logic: String(item?.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
    }))
    .filter((item) => item.field && item.operator),
})

/** 返回 JSON 解析错误信息；合法时返回 null（空文本按 '{}' 处理，与旧页面一致） */
const jsonError = (text) => {
  try {
    JSON.parse(text || '{}')
    return null
  } catch (error) {
    return error.message
  }
}

/* ─── 表单分区 ─────────────────────────────────────────────────────────── */

function EditorSection({ icon: Icon, title, description, actions, children }) {
  return (
    <section className="bg-card rounded-xl border">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <span className="bg-brand-soft text-primary flex size-7 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-medium">{title}</h3>
          {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  )
}

function MiniSelect({ value, onChange, options, placeholder, className, ariaLabel }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={ariaLabel} className={cn('h-8 w-full text-[13px]', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* ─── 条件构建器 ───────────────────────────────────────────────────────── */

function ConditionEditor({ items, fieldOptions, onChange, onRemove }) {
  if (!items.length) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-8 text-center text-xs">
        <Filter className="size-4 opacity-70" />
        暂无条件，点击“新增条件”开始配置
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="text-muted-foreground hidden grid-cols-[88px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_32px] gap-2 px-1 text-xs md:grid">
        <span>逻辑</span>
        <span>字段</span>
        <span>操作符</span>
        <span>值</span>
        <span className="sr-only">操作</span>
      </div>
      <AnimatePresence initial={false}>
        {items.map((item, index) => (
          <motion.div
            key={item.uid}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="bg-muted/30 grid grid-cols-2 items-center gap-2 rounded-lg border p-2 md:grid-cols-[88px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_32px] md:border-0 md:bg-transparent md:p-0">
              <MiniSelect
                ariaLabel={`第 ${index + 1} 条条件逻辑`}
                value={item.logic}
                options={CONDITION_LOGIC_OPTIONS}
                onChange={(next) => onChange(item.uid, { logic: next })}
                className="font-mono text-xs"
              />
              <MiniSelect
                ariaLabel={`第 ${index + 1} 条条件字段`}
                value={item.field}
                options={fieldOptions}
                placeholder="选择字段"
                onChange={(next) => onChange(item.uid, { field: next })}
              />
              <MiniSelect
                ariaLabel={`第 ${index + 1} 条条件操作符`}
                value={item.operator}
                options={CONDITION_OPERATOR_OPTIONS}
                onChange={(next) => onChange(item.uid, { operator: next })}
              />
              <Input
                aria-label={`第 ${index + 1} 条条件值`}
                value={String(item.value ?? '')}
                placeholder="输入条件值"
                onChange={(e) => onChange(item.uid, { value: e.target.value })}
                className="h-8 text-[13px]"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="删除条件"
                onClick={() => onRemove(item.uid)}
                className="text-muted-foreground hover:text-danger col-span-2 w-full md:col-span-1 md:w-8"
              >
                <Trash2 />
                <span className="md:hidden">删除</span>
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ─── 页面 ─────────────────────────────────────────────────────────────── */

export default function ListPage() {
  const list = useCrudList(
    (params) =>
      getListPageList(params).catch(() => {
        toast.error('加载列表页数据失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [owner, setOwner] = useState('')
  const [isActive, setIsActive] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editRecord, setEditRecord] = useState(null)

  const [imageFileList, setImageFileList] = useState([])
  const [attachmentFileList, setAttachmentFileList] = useState([])
  const [conditionLogic, setConditionLogic] = useState('AND')
  const [conditionItems, setConditionItems] = useState([])

  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)

  const form = useForm({ defaultValues: DEFAULT_FORM_VALUES })
  const [watchedStatus, currentDataSource, schemaText] = useWatch({
    control: form.control,
    name: ['status', 'data_source', 'schema_config'],
  })
  const schemaError = jsonError(schemaText)

  const fieldOptions = useMemo(() => {
    if (!currentDataSource) return ALL_FIELD_OPTIONS
    return DATA_SOURCE_FIELD_MAP[currentDataSource] || ALL_FIELD_OPTIONS
  }, [currentDataSource])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首屏加载一次
  }, [])

  const handleSearch = () => {
    setSelectedRowKeys([])
    list.handleSearch({
      search: search.trim(),
      category: category || '',
      owner: owner.trim(),
      is_active: isActive || '',
      status: statusFilter || '',
    })
  }

  const handleReset = () => {
    setSearch('')
    setCategory('')
    setOwner('')
    setIsActive('')
    setStatusFilter('')
    setSelectedRowKeys([])
    list.handleReset()
  }

  const openDetail = (record) => {
    setDetailRecord(record)
    setDetailOpen(true)
  }

  const openCreate = () => {
    setEditRecord(null)
    form.reset(DEFAULT_FORM_VALUES)
    setImageFileList([])
    setAttachmentFileList([])
    setConditionLogic('AND')
    setConditionItems([])
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditRecord(record)
    form.reset({
      ...DEFAULT_FORM_VALUES,
      ...record,
      data_source: String(record?.data_source || '').trim(),
      schema_config: String(record?.schema_config || '{}'),
    })
    setImageFileList(buildUploadFileList(record?.image_urls || record?.image_url, `img-${record?.id || 'edit'}`, '图片'))
    setAttachmentFileList(buildUploadFileList(record?.file_urls || record?.file_url, `file-${record?.id || 'edit'}`, '附件'))
    setConditionLogic(String(record?.condition_logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND')
    setConditionItems(normalizeConditionItems(record?.conditions))
    setFormOpen(true)
  }

  const handleAddCondition = () => {
    setConditionItems((prev) => [
      ...prev,
      { uid: `condition-${Date.now()}-${prev.length + 1}`, field: '', operator: 'eq', value: '', logic: 'AND' },
    ])
  }

  const handleChangeCondition = (uid, patch) => {
    setConditionItems((prev) => prev.map((item) => (item.uid === uid ? { ...item, ...patch } : item)))
  }

  const handleRemoveCondition = (uid) => {
    setConditionItems((prev) => prev.filter((item) => item.uid !== uid))
  }

  const handleFormatSchemaJson = () => {
    try {
      const parsed = JSON.parse(form.getValues('schema_config') || '{}')
      form.setValue('schema_config', JSON.stringify(parsed, null, 2), { shouldDirty: true, shouldValidate: true })
      toast.success('JSON 已格式化')
    } catch {
      toast.error('JSON 格式错误，无法格式化')
    }
  }

  const handleValidateSchemaJson = () => {
    const message = jsonError(form.getValues('schema_config'))
    if (message) {
      toast.error(`JSON 校验失败：${message}`)
      form.trigger('schema_config')
    } else {
      toast.success('JSON 校验通过')
      form.clearErrors('schema_config')
    }
  }

  const collectPayload = (formValues = {}) => {
    const imageUrls = extractUploadedUrls(imageFileList)
    const fileUrls = extractUploadedUrls(attachmentFileList)
    return {
      ...formValues,
      query_code: (formValues.query_code || '').trim(),
      name: (formValues.name || '').trim(),
      keyword: (formValues.keyword || '').trim(),
      owner: (formValues.owner || '').trim(),
      data_source: (formValues.data_source || '').trim(),
      description: (formValues.description || '').trim(),
      status: formValues.status || 'draft',
      image_url: imageUrls[0] || '',
      image_urls: imageUrls,
      file_url: fileUrls[0] || '',
      file_urls: fileUrls,
      condition_logic: conditionLogic,
      conditions: buildConditionPayload(conditionItems),
      display_config: { ...DEFAULT_DISPLAY_CONFIG, data_source: (formValues.data_source || '').trim() },
      permission_config: DEFAULT_PERMISSION_CONFIG,
      schema_config: formValues.schema_config,
    }
  }

  const handleSubmit = async (values) => {
    const payload = collectPayload(values)
    try {
      if (editRecord?.id) await updateListPage(editRecord.id, payload)
      else await createListPage(payload)
      toast.success(editRecord?.id ? '更新成功' : '创建成功')
      setFormOpen(false)
      fetchData()
    } catch (err) {
      toast.apiError(err, '保存失败')
      throw err
    }
  }

  const handleDelete = async (record) => {
    try {
      await deleteListPage(record.id)
      toast.success('删除成功')
      setSelectedRowKeys((keys) => keys.filter((k) => k !== record.id))
      if (detailRecord?.id === record.id) setDetailOpen(false)
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const handleExport = async ({ fields, fileType }) => {
    const finalFileType = normalizeFileType(fileType)
    const hasSelected = selectedRowKeys.length > 0
    const payload = { fields, file_type: finalFileType, export_mode: hasSelected ? 'selected' : 'filtered' }
    if (hasSelected) payload.ids = selectedRowKeys
    else payload.filters = filters
    try {
      const blob = await exportListPage(payload)
      downloadBlobFile(blob, `list_page_export.${finalFileType}`)
      toast.success('导出成功')
      setExportOpen(false)
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  const hasFilters = Boolean(filters.search || filters.category || filters.owner || filters.is_active || filters.status)

  const columns = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 64, className: 'text-muted-foreground tabular-nums' },
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      minWidth: 200,
      render: (value, record) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => openDetail(record)}
            className="hover:text-primary block max-w-full truncate text-left font-medium transition-colors"
          >
            {value}
          </button>
          {record.owner || record.data_source ? (
            <p className="text-muted-foreground truncate text-xs">
              {[record.owner, record.data_source].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'query_code',
      title: '编码',
      dataIndex: 'query_code',
      width: 200,
      render: (value) =>
        value ? (
          <code className="bg-muted text-foreground/80 inline-block max-w-full truncate rounded-md px-1.5 py-0.5 align-middle font-mono text-xs">
            {value}
          </code>
        ) : null,
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 88,
      render: (value) => mapCategoryLabel(value),
    },
    {
      key: 'status',
      title: '发布状态',
      dataIndex: 'status',
      width: 136,
      render: (value, record) => {
        const meta = mapStatusMeta(value)
        return (
          <div className="flex items-center gap-2">
            <StatusBadge tone={meta.tone} dot>
              {meta.label}
            </StatusBadge>
            {record.is_active === false ? (
              <StatusBadge tone="warning" variant="plain" dot className="whitespace-nowrap">
                停用
              </StatusBadge>
            ) : null}
          </div>
        )
      },
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 72,
      className: 'font-mono text-xs tabular-nums text-muted-foreground',
      render: (value) => `v${value || 1}`,
    },
    {
      key: 'updated_at',
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 164,
      className: 'text-muted-foreground tabular-nums',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 168,
      render: (_, record) => (
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openDetail(record)}>
            查看
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <ConfirmAction title="确认删除该记录？" description="删除后不可恢复" confirmText="删除" onConfirm={() => handleDelete(record)}>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              删除
            </Button>
          </ConfirmAction>
        </div>
      ),
    },
  ]

  const detailStatus = detailRecord ? mapStatusMeta(detailRecord.status) : null

  return (
    <div>
      <PageHeader
        title="列表页"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload />
              导入
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <Download />
              导出
            </Button>
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              新建记录
            </Button>
          </>
        }
      />

      <FilterBar onSearch={handleSearch} onReset={handleReset}>
        <SearchInput
          value={search}
          onChange={setSearch}
          onSubmit={handleSearch}
          placeholder="名称/编码/关键字/数据源/负责人"
          className="sm:w-72"
        />
        <Input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch()
          }}
          placeholder="负责人"
          aria-label="负责人"
          className="h-8 w-full text-[13px] sm:w-32"
        />
        <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} placeholder="分类" allLabel="全部分类" className="w-[calc(50%-4px)] sm:w-32" />
        <FilterSelect value={isActive} onChange={setIsActive} options={ACTIVE_OPTIONS} placeholder="启用状态" allLabel="全部启用状态" className="w-[calc(50%-4px)] sm:w-36" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="发布状态" allLabel="全部发布状态" className="w-[calc(50%-4px)] sm:w-36" />
      </FilterBar>

      <AnimatePresence>
        {selectedRowKeys.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="bg-brand-soft mb-3 flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-[13px]">
              <span>
                已勾选 <span className="font-medium tabular-nums">{selectedRowKeys.length}</span> 条，将优先导出勾选数据
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7" onClick={() => setExportOpen(true)}>
                  <Download />
                  导出勾选
                </Button>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => setSelectedRowKeys([])}>
                  <X />
                  清空勾选
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        minWidth={980}
        selectable
        selectedKeys={selectedRowKeys}
        onSelectionChange={setSelectedRowKeys}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        emptyTitle="暂无列表页数据"
        emptyDescription={hasFilters ? '没有符合条件的记录，换个筛选条件试试' : '点击右上角「新建记录」创建第一条数据'}
      />

      {/* ── 新建 / 编辑 ── */}
      <FormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editRecord?.id ? '编辑记录' : '新建记录'}
        description={editRecord?.id ? `正在编辑 ${editRecord.name || editRecord.query_code}（v${editRecord.version || 1}）` : undefined}
        form={form}
        onSubmit={handleSubmit}
        submitText={watchedStatus === 'published' ? '保存并发布' : '保存草稿'}
        width={760}
      >
        <EditorSection icon={Database} title="基础信息">
          <FormGrid>
            <FormInput control={form.control} name="name" label="名称" rules={{ required: '请输入名称' }} />
            <FormInput
              control={form.control}
              name="query_code"
              label="编码"
              placeholder="例如：order_main_query"
              rules={{ required: '请输入编码' }}
              disabled={Boolean(editRecord?.id)}
              inputClassName="font-mono text-[13px]"
              description={editRecord?.id ? '编码创建后不可修改' : undefined}
            />
            <FormSelect control={form.control} name="category" label="分类" options={CATEGORY_OPTIONS} />
            <FormSelect control={form.control} name="status" label="发布状态" options={STATUS_OPTIONS} />
            <FormInput control={form.control} name="owner" label="负责人" placeholder="例如：admin" />
            <FormSelect control={form.control} name="data_source" label="数据源" options={DATA_SOURCE_OPTIONS} placeholder="选择数据源" />
          </FormGrid>
          <FormInput control={form.control} name="keyword" label="关键字" placeholder="多个关键字用逗号分隔" />
          <FormCustom
            control={form.control}
            name="description"
            label="描述"
            rules={{ maxLength: { value: DESCRIPTION_MAX, message: `描述不能超过 ${DESCRIPTION_MAX} 字` } }}
            render={({ field }) => (
              <div className="relative">
                <Textarea
                  {...field}
                  value={field.value ?? ''}
                  rows={3}
                  maxLength={DESCRIPTION_MAX}
                  className="field-sizing-fixed min-h-20 resize-y pb-6"
                />
                <span className="text-muted-foreground pointer-events-none absolute right-2.5 bottom-1.5 text-[11px] tabular-nums">
                  {(field.value || '').length}/{DESCRIPTION_MAX}
                </span>
              </div>
            )}
          />
          <FormGrid>
            <FormSwitch control={form.control} name="is_active" label="启用" className="h-9 self-end py-0" />
            <FormNumber control={form.control} name="priority" label="优先级" min={0} max={9999} />
          </FormGrid>
        </EditorSection>

        <EditorSection
          icon={SlidersHorizontal}
          title="条件构建器"
          description={currentDataSource ? `字段来自 ${mapDataSourceLabel(currentDataSource)}` : '未选数据源时可选全部字段'}
          actions={
            <>
              <span className="text-muted-foreground text-xs">全局逻辑</span>
              <MiniSelect
                ariaLabel="全局逻辑"
                value={conditionLogic}
                options={CONDITION_LOGIC_OPTIONS}
                onChange={setConditionLogic}
                className="w-20 font-mono text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddCondition}>
                <Plus />
                新增条件
              </Button>
            </>
          }
        >
          <ConditionEditor
            items={conditionItems}
            fieldOptions={fieldOptions}
            onChange={handleChangeCondition}
            onRemove={handleRemoveCondition}
          />
        </EditorSection>

        <EditorSection
          icon={Braces}
          title="高级配置"
          actions={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={handleFormatSchemaJson}>
                <Wand2 />
                格式化 JSON
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleValidateSchemaJson}>
                <CheckCircle2 />
                校验 JSON
              </Button>
            </>
          }
        >
          <FormCustom
            control={form.control}
            name="schema_config"
            label="Schema 配置"
            rules={{ validate: (value) => (jsonError(value) ? `JSON 格式错误：${jsonError(value)}` : true) }}
            render={({ field, fieldState }) => (
              <div className="bg-muted/30 focus-within:border-ring focus-within:ring-ring/50 overflow-hidden rounded-lg border transition-[box-shadow,border-color] focus-within:ring-[3px] aria-invalid:border-destructive" aria-invalid={Boolean(fieldState.error)}>
                <div className="text-muted-foreground flex items-center justify-between border-b px-3 py-1.5 text-[11px]">
                  <span className="font-mono">schema.json</span>
                  <StatusBadge tone={schemaError ? 'danger' : 'success'} variant="plain" dot>
                    {schemaError ? 'JSON 无效' : 'JSON 有效'}
                  </StatusBadge>
                </div>
                <Textarea
                  {...field}
                  value={field.value ?? ''}
                  spellCheck={false}
                  placeholder="输入 JSON Schema 配置"
                  className="field-sizing-fixed h-52 resize-y rounded-none border-0 bg-transparent font-mono text-xs leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
              </div>
            )}
          />

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[13px] font-medium">
              <ImageIcon className="text-muted-foreground size-3.5" />
              图片
            </div>
            <ImageUpload
              fileList={imageFileList}
              onFileListChange={setImageFileList}
              uploadApi={uploadListPageImage}
              limit={MAX_QUERY_IMAGE_COUNT}
              accept=".jpg,.jpeg,.png,.gif,.webp"
              maxSizeMB={5}
              promptText={`照片墙上传，最多 ${MAX_QUERY_IMAGE_COUNT} 张，支持 JPG/PNG/GIF/WEBP，最大 5MB`}
              imageSize={96}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[13px] font-medium">
              <Paperclip className="text-muted-foreground size-3.5" />
              附件
            </div>
            <FileUpload
              fileList={attachmentFileList}
              onFileListChange={setAttachmentFileList}
              uploadApi={uploadListPageFile}
              limit={MAX_QUERY_FILE_COUNT}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.rar,.7z,.json,.ppt,.pptx"
              maxSizeMB={20}
              promptText={`最多 ${MAX_QUERY_FILE_COUNT} 个附件，支持文档/表格/压缩包，最大 20MB`}
              triggerText="上传附件"
            />
          </div>
        </EditorSection>
      </FormSheet>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="列表页导出字段"
        ruleHint={selectedRowKeys.length > 0 ? `已勾选 ${selectedRowKeys.length} 条，将优先导出勾选数据` : '未勾选数据时，将按当前筛选条件导出'}
        fieldOptions={QUERY_EXPORT_FIELDS}
        defaultFields={['name', 'query_code', 'category', 'owner', 'status', 'version', 'updated_at']}
        onConfirm={handleExport}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入列表页数据"
        targetLabel="列表页"
        onDownloadTemplate={(fileType) =>
          downloadListPageTemplate(normalizeFileType(fileType))
            .then((blob) => {
              downloadBlobFile(blob, `list_page_import_template.${normalizeFileType(fileType)}`)
              toast.success('模板下载成功')
            })
            .catch((err) => toast.apiError(err, '模板下载失败'))
        }
        onImport={(file) => importListPage(file)}
        onImported={(res) => {
          toast.success(`导入成功：新增 ${res?.created || 0} 条，更新 ${res?.updated || 0} 条`)
          fetchData()
        }}
        errorExportFileName="list_page_import_error_rows.csv"
      />

      {/* ── 详情 ── */}
      <DetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="记录详情"
        description={detailRecord ? `v${detailRecord.version || 1} · 更新于 ${formatDateTime(detailRecord.updated_at)}` : undefined}
        width={540}
        footer={
          <>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
            <Button
              onClick={() => {
                setDetailOpen(false)
                openEdit(detailRecord)
              }}
            >
              <Pencil />
              编辑
            </Button>
          </>
        }
      >
        {detailRecord ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge tone={detailStatus.tone} dot>
                  {detailStatus.label}
                </StatusBadge>
                <StatusBadge tone={detailRecord.is_active ? 'success' : 'neutral'}>{detailRecord.is_active ? '启用' : '停用'}</StatusBadge>
                <StatusBadge tone="brand">{mapCategoryLabel(detailRecord.category)}</StatusBadge>
              </div>
              <h2 className="text-lg leading-snug font-semibold tracking-tight break-words">{detailRecord.name}</h2>
              {detailRecord.query_code ? (
                <code className="bg-muted text-foreground/80 inline-block rounded-md px-1.5 py-0.5 font-mono text-xs break-all">
                  {detailRecord.query_code}
                </code>
              ) : null}
            </div>

            <DescriptionList
              items={[
                { label: 'ID', value: <span className="tabular-nums">{detailRecord.id}</span> },
                { label: '名称', value: detailRecord.name },
                { label: '编码', value: <span className="font-mono text-xs">{detailRecord.query_code}</span> },
                { label: '分类', value: mapCategoryLabel(detailRecord.category) },
                {
                  label: '发布状态',
                  value: (
                    <StatusBadge tone={detailStatus.tone} dot>
                      {detailStatus.label}
                    </StatusBadge>
                  ),
                },
                { label: '版本', value: <span className="font-mono text-xs tabular-nums">v{detailRecord.version || 1}</span> },
                { label: '负责人', value: detailRecord.owner || '-' },
                { label: '数据源', value: detailRecord.data_source || '-' },
                { label: '关键字', value: detailRecord.keyword || '-' },
                {
                  label: '启用',
                  value: (
                    <StatusBadge tone={detailRecord.is_active ? 'success' : 'neutral'} dot>
                      {detailRecord.is_active ? '启用' : '停用'}
                    </StatusBadge>
                  ),
                },
                { label: '优先级', value: <span className="tabular-nums">{detailRecord.priority ?? 0}</span> },
                { label: '发布时间', value: <span className="tabular-nums">{detailRecord.published_at ? formatDateTime(detailRecord.published_at) : '-'}</span> },
                { label: '创建时间', value: <span className="tabular-nums">{formatDateTime(detailRecord.created_at)}</span> },
                { label: '更新时间', value: <span className="tabular-nums">{formatDateTime(detailRecord.updated_at)}</span> },
              ]}
            />

            {detailRecord.description ? (
              <section className="space-y-2 border-t pt-5">
                <h3 className="text-[13px] font-medium">描述</h3>
                <p className="text-muted-foreground text-[13px] leading-relaxed break-words whitespace-pre-wrap">{detailRecord.description}</p>
              </section>
            ) : null}

            {detailRecord.image_urls?.length > 0 ? (
              <section className="space-y-2 border-t pt-5">
                <h3 className="text-[13px] font-medium">
                  图片 <span className="text-muted-foreground font-normal tabular-nums">{detailRecord.image_urls.length}</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detailRecord.image_urls.map((url, i) => (
                    <a
                      key={`${i}-${url}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="group bg-muted ring-border block size-20 overflow-hidden rounded-lg ring-1"
                    >
                      <img src={url} alt={`图片${i + 1}`} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {detailRecord.file_urls?.length > 0 ? (
              <section className="space-y-2 border-t pt-5">
                <h3 className="text-[13px] font-medium">
                  附件 <span className="text-muted-foreground font-normal tabular-nums">{detailRecord.file_urls.length}</span>
                </h3>
                <ul className="divide-y rounded-lg border">
                  {detailRecord.file_urls.map((url, i) => (
                    <li key={`${i}-${url}`}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:bg-muted/50 hover:text-primary flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
                      >
                        <FileText className="text-muted-foreground size-4 shrink-0" />
                        附件 {i + 1}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </DetailSheet>
    </div>
  )
}
