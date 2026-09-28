/**
 * Page patterns → Detail page: the reference implementation of a record detail with tabs, on the shared demo API
 * (/api/admin/component-center/demo-records, see modules/component-center/demo-record in apps/api).
 *
 * Use it when one record has more to show than a table row or a side sheet holds: key fields in a header, then tabs
 * (overview, related records, secondary data), with edit / delete on the record itself.
 *
 * What to copy:
 *   - the selected record lives in the URL (`?id=`, useSearchParams): links from other pages open it directly, the tab
 *     bar keeps it when switching tabs; without an id the first record of the picker is shown
 *   - the detail is loaded by id (getItem), not taken from the list, so a record that isn't on the picker's page still
 *     opens; related data (parent, children) loads with it, and a stale response is dropped when the id changes
 *   - header (cover / initial, name, status, key facts, edit / delete gated by cc_patterns_edit / _delete), then
 *     SegmentedTabs: overview (DescriptionList), children (DataTable, a row opens that record), tags and extra fields
 *   - delete: the API refuses a record that still has children (400, shown by toast.apiError); after a delete the page
 *     moves to the parent (or the first record)
 *
 * Layout from docs/templates/frontend/detail_page: picker on the left, detail on the right, stacked on mobile.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { CornerLeftUp, FileSearch, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { EASE_OUT, stagger } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { deleteItem, getItem, getItems, updateItem, type DemoRecord as Row } from '@/modules/component_center/api/demo_record'
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  enabledOption,
  STATUS_OPTIONS,
  statusLabel,
  statusTone,
  type DemoCategory as Category,
  type DemoStatus as Status,
} from '@/modules/component_center/pages/patterns/demo-record-options'
import { fileUrl } from '@/shared/api/files'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import EmptyState from '@/shared/components/EmptyState'
import { SearchInput } from '@/shared/components/Filters'
import { DescriptionList, FormDialog } from '@/shared/components/FormDialog'
import { FormDate, FormGrid, FormInput, FormNumber, FormSelect, FormSwitch, FormTags, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import SegmentedTabs, { type SegmentedTabItem } from '@/shared/components/SegmentedTabs'
import StatusBadge from '@/shared/components/StatusBadge'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'

/** Records in the picker (search narrows it; a record further down opens by ?id=) */
const PICKER_SIZE = 50

type Tab = 'overview' | 'children' | 'extra'

/** The detail of one record: the record, its parent and its direct children */
interface Detail {
  id: number
  /** null: the record could not be loaded (deleted, or a stale ?id=) */
  record: Row | null
  parent: Row | null
  children: Row[]
}

async function loadDetail(id: number): Promise<Detail> {
  const record = await getItem(id)
  const [parent, children] = await Promise.all([
    record.parent_id !== null ? getItem(record.parent_id) : null,
    // A detail page shows the first page of related records; a longer list links to a filtered list page instead
    getItems({ parent_id: String(id), per_page: 200, sort_field: 'sort_order', sort_dir: 'asc' }),
  ])
  return { id, record, parent, children: children.items }
}

/** What the edit form holds and submits (a subset of the edit body) */
interface FormValues {
  name: string
  code: string
  category: Category | null
  status: Status | null
  owner: string
  priority: number | null
  is_active: boolean
  amount: number | string | null
  quantity: number | null
  progress: number | null
  start_date: string
  end_date: string
  tags: string[]
  description: string
}

const toFormValues = (record: Row): FormValues => ({
  name: record.name ?? '',
  code: record.code ?? '',
  category: record.category,
  status: record.status,
  owner: record.owner ?? '',
  priority: record.priority,
  is_active: Boolean(record.is_active),
  amount: record.amount,
  quantity: record.quantity,
  progress: record.progress,
  start_date: formatDate(record.start_date, ''),
  end_date: formatDate(record.end_date, ''),
  tags: record.tags,
  description: record.description ?? '',
})

// ─── Picker item ────────────────────────────────────────────────────────────────

interface PickerItemProps {
  record: Row
  selected: boolean
  onClick: () => void
}

function PickerItem({ record, selected, onClick }: PickerItemProps) {
  return (
    <motion.button
      type="button"
      variants={stagger.item}
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full flex-col items-start gap-1 border-b px-4 py-2.5 text-left transition-colors last:border-b-0',
        selected ? 'bg-brand-soft' : 'hover:bg-muted/60',
      )}
    >
      <span className={cn('w-full truncate text-[13px]', selected ? 'text-primary font-medium' : 'font-medium')}>{record.name}</span>
      <span className="flex w-full items-center justify-between gap-2">
        <span className="text-muted-foreground truncate font-mono text-xs">{record.code}</span>
        {record.status ? (
          <StatusBadge tone={statusTone(record.status)} variant="plain" className="shrink-0">
            {statusLabel(record.status)}
          </StatusBadge>
        ) : null}
      </span>
    </motion.button>
  )
}

// ─── Tabs ───────────────────────────────────────────────────────────────────────

interface OverviewProps {
  record: Row
  parent: Row | null
  onOpen: (id: number) => void
}

function Overview({ record, parent, onOpen }: OverviewProps) {
  const { t, i18n } = useTranslation()
  const category = categoryLabel(record.category)
  const enabled = enabledOption(Boolean(record.is_active))
  const amount = record.amount === null ? null : new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2 }).format(Number(record.amount))
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">{t('进度')}</span>
          <span className="font-medium tabular-nums">{record.progress ?? 0}%</span>
        </div>
        <Progress value={record.progress ?? 0} aria-label={t('进度')} />
      </div>
      <DescriptionList
        columns={2}
        items={[
          { label: '编码', value: <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{record.code}</code> },
          { label: '分类', value: category ? t(category) : null },
          { label: '负责人', value: record.owner },
          { label: '优先级', value: <span className="tabular-nums">{record.priority}</span> },
          { label: '金额', value: amount === null ? null : <span className="tabular-nums">{amount}</span> },
          { label: '数量', value: record.quantity === null ? null : <span className="tabular-nums">{formatNumber(record.quantity)}</span> },
          { label: '开始日期', value: <span className="tabular-nums">{formatDate(record.start_date)}</span> },
          { label: '结束日期', value: <span className="tabular-nums">{formatDate(record.end_date)}</span> },
          {
            label: '是否启用',
            value: (
              <StatusBadge tone={enabled.tone} dot>
                {enabled.label}
              </StatusBadge>
            ),
          },
          {
            label: '上级记录',
            value: parent ? (
              <button type="button" onClick={() => onOpen(parent.id)} className="text-primary hover:underline">
                {parent.name}
              </button>
            ) : null,
          },
          { label: '创建时间', value: <span className="tabular-nums">{formatDateTime(record.created_at)}</span> },
          { label: '更新时间', value: <span className="tabular-nums">{formatDateTime(record.updated_at)}</span> },
          { label: '描述', value: record.description ? <p className="leading-relaxed whitespace-pre-wrap">{record.description}</p> : null, full: true },
        ]}
      />
    </div>
  )
}

interface ChildRecordsProps {
  records: Row[]
  onOpen: (id: number) => void
}

function ChildRecords({ records, onOpen }: ChildRecordsProps) {
  const columns: DataTableColumn<Row>[] = [
    { key: 'name', title: '名称', dataIndex: 'name', render: (value) => <span className="font-medium">{value}</span> },
    { key: 'code', title: '编码', dataIndex: 'code', width: 140, className: 'text-muted-foreground font-mono text-xs' },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value) =>
        value ? (
          <StatusBadge tone={statusTone(value)} dot>
            {statusLabel(value)}
          </StatusBadge>
        ) : null,
    },
    { key: 'owner', title: '负责人', dataIndex: 'owner', width: 100 },
    { key: 'progress', title: '进度', dataIndex: 'progress', width: 80, align: 'right', className: 'tabular-nums', render: (value) => `${value ?? 0}%` },
  ]
  return (
    <DataTable
      columns={columns}
      data={records}
      onRowClick={(row) => onOpen(row.id)}
      rowClassName={() => 'cursor-pointer'}
      emptyTitle="没有下级记录"
      emptyDescription="在其他记录的「上级记录」中选择这条记录，它就会出现在这里"
    />
  )
}

function TagsAndExtra({ record }: { record: Row }) {
  const { t } = useTranslation()
  const extra = Object.entries(record.extra)
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h4 className="text-muted-foreground text-xs">{t('标签')}</h4>
        {record.tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {record.tags.map((tag) => (
              <span key={tag} className="bg-muted rounded-md px-2 py-0.5 text-xs">
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground/70 text-[13px]">{t('暂无标签')}</p>
        )}
      </section>
      <section className="space-y-2">
        <h4 className="text-muted-foreground text-xs">{t('扩展字段')}</h4>
        {extra.length ? (
          // Extra fields are free-form values from the dynamic form: keys shown as they are, non-text values as JSON
          <dl className="divide-y rounded-lg border text-[13px]">
            {extra.map(([key, value]) => (
              <div key={key} className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-3 py-2">
                <dt className="text-muted-foreground truncate font-mono text-xs leading-5">{key}</dt>
                <dd className="break-words">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-muted-foreground/70 text-[13px]">{t('暂无扩展字段')}</p>
        )}
      </section>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      </div>
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function DetailPage() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('cc_patterns_edit')
  const canDelete = hasPermission('cc_patterns_delete')

  // Picker (left)
  const [search, setSearch] = useState('')
  const keyword = useDebouncedValue(search.trim())
  const [records, setRecords] = useState<Row[]>([])
  const [recordTotal, setRecordTotal] = useState(0)
  const [pickerLoading, setPickerLoading] = useState(true)

  // Selection: ?id= in the URL, else the first record of the picker
  const [params, setParams] = useSearchParams()
  const activeId = Number(params.get('id')) || records[0]?.id || null
  const open = (id: number | null) => setParams(id === null ? {} : { id: String(id) })

  // Detail (right): loading while the loaded detail is not the active id
  const [detail, setDetail] = useState<Detail | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const detailLoading = activeId !== null && detail?.id !== activeId

  const [formOpen, setFormOpen] = useState(false)
  const form = useForm<FormValues>()

  const fetchRecords = (query: string) =>
    getItems({ search: query, per_page: PICKER_SIZE })
      .then((res) => {
        setRecords(res.items)
        setRecordTotal(res.total)
      })
      .catch((err: unknown) => toast.apiError(err, '加载失败'))
      .finally(() => setPickerLoading(false))

  useEffect(() => {
    fetchRecords(keyword)
  }, [keyword])

  const showDetail = (id: number) =>
    loadDetail(id).catch((err: unknown): Detail => {
      toast.apiError(err, '加载失败')
      return { id, record: null, parent: null, children: [] }
    })

  useEffect(() => {
    if (activeId === null) return
    // A response for an id that is no longer selected is dropped
    let current = true
    showDetail(activeId).then((next) => {
      if (current) setDetail(next)
    })
    return () => {
      current = false
    }
  }, [activeId])

  const record = detail?.id === activeId ? detail.record : null

  const openEdit = () => {
    if (!record) return
    form.reset(toFormValues(record))
    setFormOpen(true)
  }

  const submit = async (values: FormValues) => {
    if (!record) return
    try {
      await updateItem(record.id, values)
      toast.success('更新成功')
      setFormOpen(false)
      setDetail(await showDetail(record.id))
      fetchRecords(keyword)
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async () => {
    if (!record) return
    try {
      await deleteItem(record.id)
      toast.success('删除成功')
      // Drop it from the picker right away, so "the first record" can't point at it while the list reloads
      setRecords((rows) => rows.filter((r) => r.id !== record.id))
      open(record.parent_id)
      fetchRecords(keyword)
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const tabs: SegmentedTabItem<Tab>[] = [
    { value: 'overview', label: '概览' },
    { value: 'children', label: '下级记录', count: detail?.children.length || undefined },
    { value: 'extra', label: '标签与扩展字段' },
  ]

  return (
    <div>
      <PageHeader title="详情页" description="选中的记录写在地址栏（?id=），链接可直接打开这条记录" />

      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        {/* Picker */}
        <Panel padded={false} className="flex flex-col md:h-[calc(100dvh-210px)] md:min-h-[480px]" bodyClassName="flex min-h-0 flex-1 flex-col">
          <div className="border-b p-3">
            <SearchInput value={search} onChange={setSearch} placeholder="名称 / 编码" className="sm:w-full" />
          </div>
          <div className="max-h-[320px] min-h-0 flex-1 overflow-y-auto md:max-h-none">
            {pickerLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : records.length === 0 ? (
              <EmptyState title="暂无数据" description={keyword ? '换个关键词试试' : undefined} />
            ) : (
              <motion.div key={keyword} variants={stagger.container} initial="hidden" animate="show">
                {records.map((r) => (
                  <PickerItem key={r.id} record={r} selected={r.id === activeId} onClick={() => open(r.id)} />
                ))}
              </motion.div>
            )}
          </div>
          {records.length ? (
            <div className="text-muted-foreground border-t px-4 py-2.5 text-xs tabular-nums">
              {recordTotal > records.length
                ? t('显示前 {{shown}} 条，共 {{total}} 条', { shown: records.length, total: recordTotal })
                : t('共 {{count}} 条', { count: recordTotal })}
            </div>
          ) : null}
        </Panel>

        {/* Detail */}
        <Panel className="min-w-0 md:min-h-[480px]">
          {activeId === null ? (
            pickerLoading ? (
              <DetailSkeleton />
            ) : (
              <EmptyState icon={FileSearch} title="暂无可查看的记录" />
            )
          ) : detailLoading ? (
            <DetailSkeleton />
          ) : !record || !detail ? (
            <EmptyState icon={FileSearch} title="记录不存在或已删除" description="从左侧重新选择一条记录" />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className="space-y-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {record.cover ? (
                      <img src={fileUrl(record.cover)} alt="" className="bg-muted ring-border size-12 shrink-0 rounded-xl object-cover ring-1" />
                    ) : (
                      <span className="bg-brand-gradient-strong flex size-12 shrink-0 items-center justify-center rounded-xl text-base font-semibold text-white">
                        {(record.name || '?').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold tracking-tight">{record.name}</h2>
                        {record.status ? (
                          <StatusBadge tone={statusTone(record.status)} dot>
                            {statusLabel(record.status)}
                          </StatusBadge>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                        <span className="font-mono text-xs">{record.code}</span>
                        {record.owner ? <span>{t('负责人：{{name}}', { name: record.owner })}</span> : null}
                        {detail.parent ? (
                          <button type="button" onClick={() => open(detail.parent?.id ?? null)} className="hover:text-foreground inline-flex items-center gap-1">
                            <CornerLeftUp className="size-3.5" />
                            {detail.parent.name}
                          </button>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  {canEdit || canDelete ? (
                    <div className="flex shrink-0 gap-2">
                      {canEdit ? (
                        <Button variant="outline" size="sm" onClick={openEdit}>
                          <Pencil />
                          {t('编辑')}
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <ConfirmAction
                          title={t('确定删除「{{name}}」？', { name: record.name })}
                          description="删除后不可恢复；有下级记录时不能删除。"
                          confirmText="删除"
                          onConfirm={remove}
                        >
                          <Button variant="outline" size="sm" className="text-danger hover:text-danger">
                            <Trash2 />
                            {t('删除')}
                          </Button>
                        </ConfirmAction>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <SegmentedTabs value={tab} onChange={setTab} items={tabs} />

                {tab === 'overview' ? (
                  <Overview record={record} parent={detail.parent} onOpen={open} />
                ) : tab === 'children' ? (
                  <ChildRecords records={detail.children} onOpen={open} />
                ) : (
                  <TagsAndExtra record={record} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </Panel>
      </div>

      <FormDialog open={formOpen} onOpenChange={setFormOpen} title="编辑" size="lg" form={form} onSubmit={submit}>
        <FormGrid>
          <FormInput control={form.control} name="name" label="名称" rules={{ required: '请输入名称' }} />
          <FormInput control={form.control} name="code" label="编码" rules={{ required: '请输入编码' }} />
          <FormSelect control={form.control} name="category" label="分类" options={CATEGORY_OPTIONS} clearable />
          <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} />
          <FormInput control={form.control} name="owner" label="负责人" />
          <FormNumber control={form.control} name="priority" label="优先级" step={1} />
          <FormNumber control={form.control} name="amount" label="金额" min={0} step={0.01} />
          <FormNumber control={form.control} name="quantity" label="数量" min={0} step={1} />
          <FormDate control={form.control} name="start_date" label="开始日期" />
          <FormDate
            control={form.control}
            name="end_date"
            label="结束日期"
            rules={{ validate: (end, values) => !end || !values.start_date || end >= values.start_date || '开始日期不能晚于结束日期' }}
          />
          <FormNumber
            control={form.control}
            name="progress"
            label="进度"
            min={0}
            max={100}
            step={1}
            rules={{ min: { value: 0, message: '进度范围 0–100' }, max: { value: 100, message: '进度范围 0–100' } }}
          />
          <FormSwitch control={form.control} name="is_active" label="是否启用" className="self-end" />
        </FormGrid>
        <FormTags control={form.control} name="tags" label="标签" placeholder="输入后回车添加" />
        <FormTextarea control={form.control} name="description" label="描述" rows={3} />
      </FormDialog>
    </div>
  )
}
