/**
 * Page patterns → Card list: the reference implementation of the card list pattern, on the shared demo API
 * (/api/admin/component-center/demo-records, see modules/component-center/demo-record in apps/api).
 *
 * Use it when a record is recognised by a picture or a few badges rather than compared column by column (products,
 * articles, templates, projects). It is the standard list with the table swapped for a card grid: useCrudList for
 * the paging and the filters, FilterBar, a responsive grid of cards (+ Skeleton cards while loading, EmptyState when
 * empty) with DataPagination under it, and FormDialog for create / edit.
 *
 * What to copy: ItemCard (cover from a file-center id via fileUrl with a placeholder when it is missing or fails to
 * load, category / status badges in the tones of the shared options (../demo-record-options), tags, owner, actions
 * in the footer); the form's FormImageUpload (stores the file id) and FormTags (a string list); buttons shown by
 * permission (useAuth().hasPermission) — the API checks the same codes.
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { stagger } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { createItem, deleteItem, getItems, updateItem, type DemoRecord as Row } from '@/modules/component_center/api/demo_record'
import {
  CATEGORY_OPTIONS,
  categoryOption,
  ENABLED_OPTIONS,
  STATUS_OPTIONS,
  statusOption,
  type DemoCategory as Category,
  type DemoStatus as Status,
} from '@/modules/component_center/pages/patterns/demo-record-options'
import { fileUrl } from '@/shared/api/files'
import ConfirmAction from '@/shared/components/ConfirmAction'
import { DataPagination } from '@/shared/components/DataTable'
import EmptyState from '@/shared/components/EmptyState'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormGrid, FormImageUpload, FormInput, FormNumber, FormSelect, FormSwitch, FormTags, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'

/** What the form holds and submits: the fields a card shows (the other record fields keep their values on edit) */
interface FormValues {
  name: string
  code: string
  category: Category | null
  status: Status | null
  owner: string
  priority: number | null
  is_active: boolean
  /** File-center id of the cover image */
  cover: string | null
  tags: string[]
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
  cover: null,
  tags: [],
  description: '',
}

/** Edit: only the form fields (id / timestamps are not sent back) */
const toFormValues = (record: Row): FormValues => ({
  name: record.name ?? '',
  code: record.code ?? '',
  category: record.category,
  status: record.status,
  owner: record.owner ?? '',
  priority: record.priority,
  is_active: record.is_active ?? true,
  cover: record.cover,
  tags: record.tags,
  description: record.description ?? '',
})

/* ─── Card ─────────────────────────────────────────────────────────────── */

/** Cover image from a file-center id; a placeholder when there is none or it fails to load */
function CardCover({ fileId, alt }: { fileId: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (fileId && !failed) {
    return (
      <div className="bg-muted h-36 overflow-hidden border-b">
        <img
          src={fileUrl(fileId)}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      </div>
    )
  }
  return (
    <div className="bg-muted/60 text-muted-foreground/60 flex h-36 items-center justify-center border-b">
      <LayoutGrid className="size-7" strokeWidth={1.5} />
    </div>
  )
}

interface ItemCardProps {
  record: Row
  canEdit: boolean
  canDelete: boolean
  onEdit: (record: Row) => void
  onDelete: (record: Row) => Promise<void>
}

function ItemCard({ record, canEdit, canDelete, onEdit, onDelete }: ItemCardProps) {
  const { t } = useTranslation()
  const category = categoryOption(record.category)
  const status = statusOption(record.status)
  const name = record.name ?? ''

  return (
    <motion.article
      variants={stagger.item}
      className="group surface-card flex min-w-0 flex-col overflow-hidden transition-[translate,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* key: a new cover id gets a fresh load (and a fresh failed flag) */}
      <CardCover key={record.cover} fileId={record.cover} alt={name} />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1">
          {category ? <StatusBadge tone={category.tone}>{category.label}</StatusBadge> : null}
          {status ? (
            <StatusBadge tone={status.tone} dot>
              {status.label}
            </StatusBadge>
          ) : null}
          {record.is_active === false ? <StatusBadge tone="neutral">{t('停用')}</StatusBadge> : null}
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium" title={name}>
            {name}
          </h2>
          {record.description ? <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{record.description}</p> : null}
        </div>

        {record.tags.length ? (
          <div className="flex flex-wrap gap-1">
            {record.tags.map((tag) => (
              <span key={tag} className="text-muted-foreground inline-flex h-5 items-center rounded-md border px-1.5 text-xs">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="text-muted-foreground mt-auto flex items-center justify-between gap-2 pt-1 text-xs">
          <span className="flex min-w-0 items-center gap-1">
            <UserRound className="size-3 shrink-0" />
            <span className="truncate">{record.owner || '-'}</span>
          </span>
          <span className="truncate font-mono">{record.code}</span>
        </div>
      </div>

      {canEdit || canDelete ? (
        <div className="flex items-center justify-end gap-0.5 border-t px-2 py-1.5">
          {canEdit ? (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onEdit(record)}>
              <Pencil />
              {t('编辑')}
            </Button>
          ) : null}
          {canDelete ? (
            <ConfirmAction title="确认删除该卡片？" description="删除后不可恢复。" confirmText="删除" onConfirm={() => onDelete(record)}>
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
                <Trash2 />
                {t('删除')}
              </Button>
            </ConfirmAction>
          ) : null}
        </div>
      ) : null}
    </motion.article>
  )
}

/** Same shape as ItemCard, so the grid doesn't jump when the data arrives */
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
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4'

export default function CardListPage() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const canAdd = hasPermission('cc_patterns_add')
  const canEdit = hasPermission('cc_patterns_edit')
  const canDelete = hasPermission('cc_patterns_delete')

  const list = useCrudList(
    (params) =>
      getItems(params).catch((err: unknown) => {
        toast.apiError(err, '加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 12 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [isActive, setIsActive] = useState('')
  const [editing, setEditing] = useState<Row | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const form = useForm<FormValues>({ defaultValues: EMPTY_VALUES })

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch only once on mount
  }, [])

  const runSearch = () => list.handleSearch({ search: search.trim(), category, status, is_active: isActive })
  const reset = () => {
    setSearch('')
    setCategory('')
    setStatus('')
    setIsActive('')
    list.handleReset()
  }

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

  // On throw, FormDialog stays open; the backend {error} message is shown by toast.apiError
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
      toast.apiError(err, '保存失败')
      throw err
    }
  }

  const remove = async (record: Row) => {
    try {
      await deleteItem(record.id)
      toast.success('删除成功')
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const hasFilters = Boolean(filters.search || filters.category || filters.status || filters.is_active)

  return (
    <div>
      <PageHeader
        title="卡片列表"
        actions={
          canAdd ? (
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              {t('新建卡片')}
            </Button>
          ) : null
        }
      />

      <FilterBar onSearch={runSearch} onReset={reset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="名称 / 编码" />
        <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} placeholder="分类" allLabel="全部分类" className="w-[calc(50%-4px)] sm:w-32" />
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="状态" allLabel="全部状态" className="w-[calc(50%-4px)] sm:w-32" />
        <FilterSelect value={isActive} onChange={setIsActive} options={ENABLED_OPTIONS} placeholder="是否启用" allLabel="启用与停用" className="w-[calc(50%-4px)] sm:w-32" />
      </FilterBar>

      {/* First load: skeleton cards; a reload keeps the cards and dims them instead */}
      {loading && data.length === 0 ? (
        <div className={GRID}>
          {Array.from({ length: 8 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={LayoutGrid}
            title="暂无卡片"
            description={hasFilters ? '没有符合条件的卡片，换个筛选条件试试' : canAdd ? '点击右上角「新建卡片」创建第一张卡片' : undefined}
          />
        </div>
      ) : (
        <motion.div
          // A new page or filter replays the staggered entrance
          key={`${page}-${JSON.stringify(filters)}`}
          variants={stagger.container}
          initial="hidden"
          animate="show"
          className={cn(GRID, 'transition-opacity duration-200', loading && 'pointer-events-none opacity-60')}
        >
          {data.map((record) => (
            <ItemCard key={record.id} record={record} canEdit={canEdit} canDelete={canDelete} onEdit={openEdit} onDelete={remove} />
          ))}
        </motion.div>
      )}

      {total > 0 ? (
        <div className="surface-card mt-4 overflow-hidden">
          <DataPagination page={page} perPage={perPage} total={total} onChange={handlePageChange} className="border-t-0" />
        </div>
      ) : null}

      <FormDialog open={formOpen} onOpenChange={setFormOpen} title={editing ? '编辑卡片' : '新建卡片'} form={form} onSubmit={submit} size="lg">
        <FormGrid>
          <FormInput control={form.control} name="name" label="名称" rules={{ required: '请输入名称' }} />
          <FormInput control={form.control} name="code" label="编码" placeholder="例如：PRJ-WEB" rules={{ required: '请输入编码' }} inputClassName="font-mono text-[13px]" />
          <FormSelect control={form.control} name="category" label="分类" options={CATEGORY_OPTIONS} clearable />
          <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} rules={{ required: '请选择状态' }} />
          <FormInput control={form.control} name="owner" label="负责人" />
          <FormNumber control={form.control} name="priority" label="优先级" step={1} placeholder="留空为 0" />
        </FormGrid>
        <FormImageUpload control={form.control} name="cover" label="封面" />
        <FormTags control={form.control} name="tags" label="标签" placeholder="输入后回车添加" />
        <FormSwitch control={form.control} name="is_active" label="是否启用" />
        <FormTextarea control={form.control} name="description" label="描述" />
      </FormDialog>
    </div>
  )
}
