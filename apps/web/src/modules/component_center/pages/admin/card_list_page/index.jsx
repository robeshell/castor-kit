import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { motion } from 'motion/react'
import { Download, Eye, LayoutGrid, Pencil, Plus, Trash2, Upload, UserRound } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/toast'
import { formatDateTime } from '@/lib/format'
import { stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  createCardListPage,
  deleteCardListPage,
  downloadCardListPageTemplate,
  exportCardListPage,
  getCardListPageList,
  importCardListPage,
  updateCardListPage,
} from '@/modules/component_center/api/card_list_page'
import ConfirmAction from '@/shared/components/ConfirmAction'
import { DataPagination } from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import EmptyState from '@/shared/components/EmptyState'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { DescriptionList, DetailSheet, FormDialog } from '@/shared/components/FormDialog'
import { FormCustom, FormGrid, FormInput, FormNumber, FormSelect, FormSwitch } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { downloadBlobFile } from '@/shared/utils/file'

const CATEGORY_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: '商品', value: 'product' },
  { label: '文章', value: 'article' },
  { label: '活动', value: 'event' },
  { label: '促销', value: 'promotion' },
]

const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
]

const ACTIVE_OPTIONS = [
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
]

const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '标题', value: 'title' },
  { label: '编码', value: 'card_code' },
  { label: '副标题', value: 'subtitle' },
  { label: '分类', value: 'category' },
  { label: '标签', value: 'tag' },
  { label: '发布状态', value: 'status' },
  { label: '负责人', value: 'owner' },
  { label: '优先级', value: 'priority' },
  { label: '启用状态', value: 'is_active' },
  { label: '描述', value: 'description' },
  { label: '创建时间', value: 'created_at' },
  { label: '更新时间', value: 'updated_at' },
]

const CATEGORY_LABEL_MAP = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]))
const CATEGORY_TONE_MAP = {
  general: 'brand',
  product: 'warning',
  article: 'success',
  event: 'info',
  promotion: 'danger',
}

const DEFAULT_FORM_VALUES = {
  title: '',
  card_code: '',
  subtitle: '',
  category: 'general',
  status: 'draft',
  tag: '',
  owner: '',
  priority: 0,
  cover_url: '',
  is_active: true,
  description: '',
}

const DESCRIPTION_MAX = 300

const normalizeFileType = (raw) => (['csv', 'xlsx'].includes(raw) ? raw : 'xlsx')

const mapStatusMeta = (value) => {
  if (value === 'published') return { label: '已发布', tone: 'success' }
  if (value === 'archived') return { label: '已归档', tone: 'neutral' }
  return { label: '草稿', tone: 'info' }
}

/* ─── Card ─────────────────────────────────────────────────────────────── */

function CardCover({ src, alt, className, iconClassName }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      <div className={cn('bg-muted overflow-hidden', className)}>
        <img
          alt={alt}
          src={src}
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      </div>
    )
  }
  return (
    <div className={cn('bg-muted/60 bg-brand-glow text-muted-foreground/60 flex items-center justify-center', className)}>
      <LayoutGrid className={cn('size-7 transition-transform duration-300 group-hover:scale-110', iconClassName)} strokeWidth={1.5} />
    </div>
  )
}

function ItemCard({ record, onView, onEdit, onDelete }) {
  const { t } = useTranslation()
  const statusMeta = mapStatusMeta(record.status)
  const categoryTone = CATEGORY_TONE_MAP[record.category] || 'brand'
  const categoryLabel = CATEGORY_LABEL_MAP[record.category] || record.category

  return (
    <motion.article
      variants={stagger.item}
      className="group surface-card hover:ring-foreground/15 hover:ring-1 flex min-w-0 flex-col overflow-hidden transition-[translate,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/30"
    >
      <button type="button" onClick={() => onView(record)} className="block text-left" aria-label={t('查看 {{title}}', { title: record.title })}>
        <CardCover key={record.cover_url} src={record.cover_url} alt={record.title} className="h-36 border-b" />
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge tone={categoryTone}>{categoryLabel}</StatusBadge>
          <StatusBadge tone={statusMeta.tone} dot>
            {statusMeta.label}
          </StatusBadge>
          {!record.is_active ? <StatusBadge tone="neutral">{t('停用')}</StatusBadge> : null}
          {record.tag ? (
            <span className="text-muted-foreground inline-flex h-5 items-center rounded-md border px-1.5 text-xs">{record.tag}</span>
          ) : null}
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium" title={record.title}>
            {record.title}
          </h3>
          {record.subtitle ? (
            <p className="text-muted-foreground mt-0.5 truncate text-xs" title={record.subtitle}>
              {record.subtitle}
            </p>
          ) : null}
        </div>

        <div className="text-muted-foreground mt-auto flex items-center justify-between gap-2 pt-1 text-xs">
          <span className="flex min-w-0 items-center gap-1">
            <UserRound className="size-3 shrink-0" />
            <span className="truncate">{record.owner || '-'}</span>
          </span>
          <span className="text-muted-foreground/70 truncate font-mono">#{record.card_code}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-0.5 border-t px-2 py-1.5">
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onView(record)}>
          <Eye />
          {t('查看')}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onEdit(record)}>
          <Pencil />
          {t('编辑')}
        </Button>
        <ConfirmAction title="确认删除该卡片？" description="删除后不可恢复" confirmText="删除" onConfirm={() => onDelete(record)}>
          <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
            <Trash2 />
            {t('删除')}
          </Button>
        </ConfirmAction>
      </div>
    </motion.article>
  )
}

function CardSkeleton() {
  return (
    <div className="surface-card overflow-hidden">
      <Skeleton className="h-36 rounded-none" />
      <div className="space-y-3 p-4">
        <div className="flex gap-1">
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-5 w-14" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between pt-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="border-t px-4 py-2.5">
        <Skeleton className="ml-auto h-4 w-32" />
      </div>
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function CardListPage() {
  const { t } = useTranslation()
  const list = useCrudList(
    (params) =>
      getCardListPageList(params).catch(() => {
        toast.error('加载数据失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [isActive, setIsActive] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editRecord, setEditRecord] = useState(null)

  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)

  const form = useForm({ defaultValues: DEFAULT_FORM_VALUES })
  const coverUrl = useWatch({ control: form.control, name: 'cover_url' })

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on first render
  }, [])

  const handleSearch = () => {
    list.handleSearch({
      search: search.trim(),
      category: category || '',
      is_active: isActive || '',
      status: statusFilter || '',
    })
  }

  const handleReset = () => {
    setSearch('')
    setCategory('')
    setIsActive('')
    setStatusFilter('')
    list.handleReset()
  }

  const openDetail = (record) => {
    setDetailRecord(record)
    setDetailOpen(true)
  }

  const openCreate = () => {
    setEditRecord(null)
    form.reset(DEFAULT_FORM_VALUES)
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditRecord(record)
    form.reset({ ...DEFAULT_FORM_VALUES, ...record })
    setFormOpen(true)
  }

  const handleSubmit = async (values) => {
    try {
      if (editRecord?.id) await updateCardListPage(editRecord.id, values)
      else await createCardListPage(values)
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
      await deleteCardListPage(record.id)
      toast.success('删除成功')
      if (detailRecord?.id === record.id) setDetailOpen(false)
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const handleExport = async ({ fields, fileType }) => {
    const finalFileType = normalizeFileType(fileType)
    const payload = { fields, file_type: finalFileType, export_mode: 'filtered', filters }
    try {
      const blob = await exportCardListPage(payload)
      downloadBlobFile(blob, `card_list_page_export.${finalFileType}`)
      toast.success('导出成功')
      setExportOpen(false)
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  const hasFilters = Boolean(filters.search || filters.category || filters.is_active || filters.status)
  const initialLoading = loading && data.length === 0
  const detailStatus = detailRecord ? mapStatusMeta(detailRecord.status) : null

  return (
    <div>
      <PageHeader
        title="卡片列表页"
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
              {t('新建卡片')}
            </Button>
          </>
        }
      />

      <FilterBar
        onSearch={handleSearch}
        onReset={handleReset}
        extra={
          total > 0 ? (
            <span className="text-muted-foreground text-xs">
              <Trans
                i18nKey="共 <0>{{count}}</0> 条"
                values={{ count: total }}
                components={[<span key="count" className="text-foreground font-medium tabular-nums" />]}
              />
            </span>
          ) : null
        }
      >
        <SearchInput value={search} onChange={setSearch} onSubmit={handleSearch} placeholder="标题 / 编码 / 负责人" />
        <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} placeholder="分类" allLabel="全部分类" className="w-[calc(50%-4px)] sm:w-32" />
        <FilterSelect value={isActive} onChange={setIsActive} options={ACTIVE_OPTIONS} placeholder="启用状态" allLabel="全部启用状态" className="w-[calc(50%-4px)] sm:w-36" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="状态" allLabel="全部状态" className="w-[calc(50%-4px)] sm:w-32" />
      </FilterBar>

      {initialLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={LayoutGrid}
            title="暂无卡片数据"
            description={hasFilters ? '没有符合条件的卡片，换个筛选条件试试' : '点击右上角「新建卡片」创建第一张卡片'}
          />
        </div>
      ) : (
        <motion.div
          key={`${page}-${JSON.stringify(filters)}`}
          variants={stagger.container}
          initial="hidden"
          animate="show"
          className={cn(
            'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 transition-opacity duration-200',
            loading && 'pointer-events-none opacity-60',
          )}
        >
          {data.map((record) => (
            <ItemCard key={record.id} record={record} onView={openDetail} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </motion.div>
      )}

      {total > 0 ? (
        <div className="surface-card mt-4 overflow-hidden">
          <DataPagination page={page} perPage={perPage} total={total} onChange={handlePageChange} className="border-t-0" />
        </div>
      ) : null}

      {/* ── Create / edit ── */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editRecord?.id ? '编辑卡片' : '新建卡片'}
        description={editRecord?.id ? t('正在编辑 {{name}}', { name: editRecord.title }) : undefined}
        form={form}
        onSubmit={handleSubmit}
        size="lg"
      >
        <FormGrid>
          <FormInput control={form.control} name="title" label="标题" rules={{ required: '请输入标题' }} />
          <FormInput
            control={form.control}
            name="card_code"
            label="编码"
            placeholder="例如：card_001"
            rules={{ required: '请输入编码' }}
            disabled={Boolean(editRecord?.id)}
            inputClassName="font-mono text-[13px]"
          />
          <FormInput control={form.control} name="subtitle" label="副标题" placeholder="可选" />
          <FormSelect control={form.control} name="category" label="分类" options={CATEGORY_OPTIONS} />
          <FormSelect control={form.control} name="status" label="发布状态" options={STATUS_OPTIONS} />
          <FormInput control={form.control} name="tag" label="标签" placeholder="例如：新品、推荐" />
          <FormInput control={form.control} name="owner" label="负责人" placeholder="例如：admin" />
          <FormNumber control={form.control} name="priority" label="优先级" min={0} max={9999} />
        </FormGrid>
        <FormCustom
          control={form.control}
          name="cover_url"
          label="封面图地址"
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <Input {...field} value={field.value ?? ''} placeholder={t('输入图片 URL')} className="h-9 min-w-0 flex-1" />
              <CardCover key={coverUrl} src={coverUrl} alt={t('封面预览')} className="h-9 w-14 shrink-0 rounded-md border" iconClassName="size-4" />
            </div>
          )}
        />
        <FormSwitch control={form.control} name="is_active" label="启用" />
        <FormCustom
          control={form.control}
          name="description"
          label="描述"
          rules={{ maxLength: { value: DESCRIPTION_MAX, message: t('描述不能超过 {{max}} 字', { max: DESCRIPTION_MAX }) } }}
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
      </FormDialog>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="卡片列表页导出字段"
        ruleHint="将按当前筛选条件导出"
        fieldOptions={EXPORT_FIELDS}
        defaultFields={['title', 'card_code', 'category', 'tag', 'status', 'owner', 'updated_at']}
        onConfirm={handleExport}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入卡片列表页数据"
        targetLabel="卡片列表页"
        onDownloadTemplate={(fileType) =>
          downloadCardListPageTemplate(normalizeFileType(fileType))
            .then((blob) => {
              downloadBlobFile(blob, `card_list_page_import_template.${normalizeFileType(fileType)}`)
              toast.success('模板下载成功')
            })
            .catch((err) => toast.apiError(err, '模板下载失败'))
        }
        onImport={(file) => importCardListPage(file)}
        onImported={(res) => {
          toast.success(t('导入成功：新增 {{created}} 条，更新 {{updated}} 条', { created: res?.created || 0, updated: res?.updated || 0 }))
          fetchData()
        }}
        errorExportFileName="card_list_page_import_error_rows.csv"
      />

      {/* ── Details ── */}
      <DetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="卡片详情"
        width={480}
        footer={
          <>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              {t('关闭')}
            </Button>
            <Button
              onClick={() => {
                setDetailOpen(false)
                openEdit(detailRecord)
              }}
            >
              <Pencil />
              {t('编辑')}
            </Button>
          </>
        }
      >
        {detailRecord ? (
          <div className="space-y-5">
            {detailRecord.cover_url ? (
              <div className="bg-muted max-h-52 overflow-hidden rounded-xl border">
                <img src={detailRecord.cover_url} alt={detailRecord.title} className="max-h-52 w-full object-cover" />
              </div>
            ) : null}
            <div className="space-y-1">
              <h2 className="text-lg leading-snug font-semibold tracking-tight break-words">{detailRecord.title}</h2>
              {detailRecord.subtitle ? <p className="text-muted-foreground text-[13px]">{detailRecord.subtitle}</p> : null}
            </div>
            <DescriptionList
              items={[
                { label: 'ID', value: <span className="tabular-nums">{detailRecord.id}</span> },
                { label: '标题', value: detailRecord.title },
                {
                  label: '编码',
                  value: <code className="bg-muted rounded-md px-1.5 py-0.5 font-mono text-xs break-all">{detailRecord.card_code}</code>,
                },
                { label: '副标题', value: detailRecord.subtitle || '-' },
                {
                  label: '分类',
                  value: CATEGORY_LABEL_MAP[detailRecord.category] ? (
                    <StatusBadge tone={CATEGORY_TONE_MAP[detailRecord.category] || 'brand'}>{CATEGORY_LABEL_MAP[detailRecord.category]}</StatusBadge>
                  ) : (
                    detailRecord.category || '-'
                  ),
                },
                {
                  label: '标签',
                  value: detailRecord.tag ? (
                    <span className="text-muted-foreground inline-flex h-5 items-center rounded-md border px-1.5 text-xs">{detailRecord.tag}</span>
                  ) : (
                    '-'
                  ),
                },
                {
                  label: '发布状态',
                  value: (
                    <StatusBadge tone={detailStatus.tone} dot>
                      {detailStatus.label}
                    </StatusBadge>
                  ),
                },
                { label: '负责人', value: detailRecord.owner || '-' },
                { label: '优先级', value: <span className="tabular-nums">{detailRecord.priority ?? 0}</span> },
                {
                  label: '启用',
                  value: (
                    <StatusBadge tone={detailRecord.is_active ? 'success' : 'neutral'} dot>
                      {detailRecord.is_active ? '启用' : '停用'}
                    </StatusBadge>
                  ),
                },
                { label: '创建时间', value: <span className="tabular-nums">{formatDateTime(detailRecord.created_at)}</span> },
                { label: '更新时间', value: <span className="tabular-nums">{formatDateTime(detailRecord.updated_at)}</span> },
              ]}
            />
            {detailRecord.description ? (
              <section className="space-y-2 border-t pt-5">
                <h3 className="text-[13px] font-medium">{t('描述')}</h3>
                <p className="text-muted-foreground text-[13px] leading-relaxed break-words whitespace-pre-wrap">{detailRecord.description}</p>
              </section>
            ) : null}
          </div>
        ) : null}
      </DetailSheet>
    </div>
  )
}
