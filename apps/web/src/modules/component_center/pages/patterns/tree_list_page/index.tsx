/**
 * Page patterns → Tree list: the reference implementation of the tree + children table pattern, on the shared demo
 * API (/api/admin/component-center/demo-records, see modules/component-center/demo-record in apps/api).
 *
 * Use it for records nested by a parent id (categories, org units, project / task breakdowns) where each level can
 * hold more children than a tree shows comfortably. Left: the whole hierarchy (GET …/tree via getNodeTree, searched
 * on the server, which keeps the ancestors of each match) in a TreeView. Right: the children of the selected record
 * (GET … with parent_id = id, or 'root' for the top level, ordered by sort_order) in a DataTable with a breadcrumb.
 *
 * What to copy:
 * - the tree fetch (full tree for the parent picker / breadcrumb / child counts, the search result for the panel)
 *   and the two expansion states (the user's, and "everything" while searching)
 * - the list as useCrudList with parent_id as one more filter (navigating = handleSearch({ parent_id }))
 * - the parent picker: FormTreeSelect over the full tree, excluding the record itself and its descendants on edit
 * - ordering: PUT …/reorder — up / down moves a record among its siblings and renumbers them; a record created under
 *   or moved to a parent is put after its new siblings
 * - delete: the API refuses a record that still has children; toast.apiError shows its message
 */
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, FileText, Folder, Layers, ListTree, Pencil, Plus, Search, X } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  createItem,
  deleteItem,
  getItems,
  getNodeTree,
  reorder,
  updateItem,
  type DemoRecord as Row,
  type DemoRecordNode,
} from '@/modules/component_center/api/demo_record'
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  enabledOption,
  STATUS_OPTIONS,
  statusOption,
  type DemoCategory as Category,
  type DemoStatus as Status,
} from '@/modules/component_center/pages/patterns/demo-record-options'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import EmptyState from '@/shared/components/EmptyState'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormGrid, FormInput, FormSelect, FormSwitch, FormTextarea, FormTreeSelect } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import RowActions from '@/shared/components/RowActions'
import StatusBadge from '@/shared/components/StatusBadge'
import type { TreeSelectNode } from '@/shared/components/TreeSelect'
import TreeView, { type TreeNode } from '@/shared/components/TreeView'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'

/** The list shows one level: 'root' (records without a parent) or a record's id, siblings in sort_order */
const parentFilter = (id: number | null) => (id === null ? 'root' : String(id))
const SIBLING_ORDER = { sort_field: 'sort_order', sort_dir: 'asc' } as const

/** A TreeView node: the record id is the key, the record rides along */
interface RecordTreeNode extends TreeNode {
  key: number
  label: string
  record: DemoRecordNode
}

const toTreeNodes = (nodes: readonly DemoRecordNode[]): RecordTreeNode[] =>
  nodes.map((n) => ({ key: n.id, label: n.name ?? '', record: n, children: toTreeNodes(n.children) }))

const toSelectNodes = (nodes: readonly DemoRecordNode[]): TreeSelectNode<number>[] =>
  nodes.map((n) => ({ id: n.id, name: n.name ?? '', code: n.code, children: toSelectNodes(n.children) }))

const collectIds = (nodes: readonly DemoRecordNode[]): number[] => nodes.flatMap((n) => [n.id, ...collectIds(n.children)])

/** id → node of the whole tree (child counts, the breadcrumb, the next sort order under a parent) */
function indexTree(nodes: readonly DemoRecordNode[], index = new Map<number, DemoRecordNode>()) {
  for (const node of nodes) {
    index.set(node.id, node)
    indexTree(node.children, index)
  }
  return index
}

/** What the form holds and submits */
interface FormValues {
  name: string
  code: string
  parent_id: number | null
  category: Category | null
  status: Status | null
  owner: string
  is_active: boolean
  description: string
}

const emptyValues = (parentId: number | null): FormValues => ({
  name: '',
  code: '',
  parent_id: parentId,
  category: null,
  status: 'todo',
  owner: '',
  is_active: true,
  description: '',
})

/** Edit: only the form fields (id / timestamps / sort_order are not sent back) */
const toFormValues = (record: Row | DemoRecordNode): FormValues => ({
  name: record.name ?? '',
  code: record.code ?? '',
  parent_id: record.parent_id,
  category: record.category,
  status: record.status,
  owner: record.owner ?? '',
  is_active: record.is_active ?? true,
  description: record.description ?? '',
})

export default function TreeListPage() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const canAdd = hasPermission('cc_patterns_add')
  const canEdit = hasPermission('cc_patterns_edit')
  const canDelete = hasPermission('cc_patterns_delete')

  // ── Left: the tree ────────────────────────────────────────────────────────
  const [treeSearch, setTreeSearch] = useState('')
  const debouncedSearch = useDebouncedValue(treeSearch.trim(), 300)
  const [treeVersion, setTreeVersion] = useState(0)
  const treeKey = `${debouncedSearch}|${treeVersion}`
  // full: the whole tree; shown: what the panel lists (the search result while searching); key: the request it answers
  const [tree, setTree] = useState<{ key: string; full: DemoRecordNode[]; shown: DemoRecordNode[] }>({ key: '', full: [], shown: [] })
  // The user's expansion (null until the first load opens the top level) and, while searching, every match open
  const [expandedKeys, setExpandedKeys] = useState<number[] | null>(null)
  const [searchExpanded, setSearchExpanded] = useState<number[]>([])

  useEffect(() => {
    let alive = true
    Promise.all([getNodeTree(), debouncedSearch ? getNodeTree({ search: debouncedSearch }) : null])
      .then(([full, matched]) => {
        if (!alive) return
        setTree({ key: treeKey, full, shown: matched ?? full })
        if (matched) setSearchExpanded(collectIds(matched))
        setExpandedKeys((prev) => prev ?? full.map((n) => n.id))
      })
      .catch((err: unknown) => {
        if (!alive) return
        setTree((prev) => ({ ...prev, key: treeKey }))
        toast.apiError(err, '加载失败')
      })
    return () => {
      alive = false
    }
  }, [debouncedSearch, treeKey])
  const treeLoading = tree.key !== treeKey
  const treeNodes = useMemo(() => toTreeNodes(tree.shown), [tree.shown])
  const selectTree = useMemo(() => toSelectNodes(tree.full), [tree.full])
  const nodeById = useMemo(() => indexTree(tree.full), [tree.full])

  /** The children of `parentId` (null = the top level) in tree order */
  const childrenOf = (parentId: number | null) => (parentId === null ? tree.full : (nodeById.get(parentId)?.children ?? []))
  /** Sort order that puts a record after the current children of `parentId` */
  const nextSortOrder = (parentId: number | null) => Math.max(0, ...childrenOf(parentId).map((n) => n.sort_order ?? 0)) + 1

  /** Open `parentId` in the tree, so a record saved under it is visible */
  const expandParent = (parentId: number | null) => {
    if (parentId !== null) setExpandedKeys((prev) => [...new Set([...(prev ?? []), parentId])])
  }

  // ── Right: the children of the selected record ────────────────────────────
  const list = useCrudList(
    (params) =>
      getItems(params).catch((err: unknown) => {
        toast.apiError(err, '加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list
  const [parentId, setParentId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    list.handleSearch({ parent_id: parentFilter(null), ...SIBLING_ORDER })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch only once on mount
  }, [])

  /** Show the children of `id` (null = the top level); the table's own filters start over */
  const navigateTo = (id: number | null) => {
    setParentId(id)
    setSearch('')
    setStatus('')
    list.handleSearch({ parent_id: parentFilter(id), search: '', status: '' })
  }
  const runSearch = () => list.handleSearch({ search: search.trim(), status })
  const resetFilters = () => {
    setSearch('')
    setStatus('')
    list.handleSearch({ search: '', status: '' })
  }

  const reloadAll = () => {
    setTreeVersion((v) => v + 1)
    fetchData()
  }

  // The selected record and its ancestors, top level first
  const breadcrumb: DemoRecordNode[] = []
  for (let node = parentId === null ? undefined : nodeById.get(parentId); node; node = node.parent_id === null ? undefined : nodeById.get(node.parent_id)) {
    breadcrumb.unshift(node)
  }

  // ── Create / edit ─────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<Row | DemoRecordNode | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const form = useForm<FormValues>({ defaultValues: emptyValues(null) })

  const openCreate = (underId: number | null) => {
    setEditing(null)
    form.reset(emptyValues(underId))
    setFormOpen(true)
  }

  const openEdit = (record: Row | DemoRecordNode) => {
    setEditing(record)
    form.reset(toFormValues(record))
    setFormOpen(true)
  }

  // On throw, FormDialog stays open; the backend {error} message (e.g. a parent that would make a cycle) is shown by toast.apiError
  const submit = async (values: FormValues) => {
    // A new record, or one moved to another parent, goes after its new siblings
    const moved = !editing || values.parent_id !== editing.parent_id
    const body = moved ? { ...values, sort_order: nextSortOrder(values.parent_id) } : values
    try {
      if (editing) {
        await updateItem(editing.id, body)
        toast.success('更新成功')
      } else {
        await createItem(body)
        toast.success('创建成功')
      }
      expandParent(values.parent_id)
      setFormOpen(false)
      reloadAll()
    } catch (err) {
      toast.apiError(err, '保存失败')
      throw err
    }
  }

  // ── Delete / reorder ──────────────────────────────────────────────────────
  // The API answers 400 "存在下级记录，不能删除" for a record with children: rethrow so the confirmation stays open
  const remove = async (record: Row) => {
    try {
      await deleteItem(record.id)
      toast.success('删除成功')
      reloadAll()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  /**
   * Up / down: move a record one place among all of its siblings (tree order, so a filtered or paged table doesn't
   * matter) and number them 1..n: equal or gappy sort orders come out distinct, and reorder writes only what changed
   */
  const shift = async (record: Row, delta: -1 | 1) => {
    const ids = childrenOf(record.parent_id).map((n) => n.id)
    const from = ids.indexOf(record.id)
    ids.splice(from + delta, 0, ...ids.splice(from, 1))
    try {
      await reorder(ids.map((id, i) => ({ id, sort_order: i + 1 })))
      reloadAll()
    } catch (err) {
      toast.apiError(err, '排序失败')
    }
  }

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      render: (value, record) => {
        const childCount = nodeById.get(record.id)?.children.length ?? 0
        const Icon = childCount ? Folder : FileText
        return (
          <button
            type="button"
            onClick={() => navigateTo(record.id)}
            title={t('查看下级')}
            className="group/name hover:text-primary flex max-w-full items-center gap-2 text-left font-medium transition-colors"
          >
            <Icon className="text-muted-foreground group-hover/name:text-primary size-3.5 shrink-0 transition-colors" />
            <span className="truncate">{value}</span>
          </button>
        )
      },
    },
    { key: 'code', title: '编码', dataIndex: 'code', width: 130, className: 'text-muted-foreground font-mono text-xs' },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 90,
      render: (value) => {
        const label = categoryLabel(value)
        return label ? t(label) : '-'
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value) => {
        const option = statusOption(value)
        return option ? (
          <StatusBadge tone={option.tone} dot>
            {option.label}
          </StatusBadge>
        ) : (
          '-'
        )
      },
    },
    { key: 'owner', title: '负责人', dataIndex: 'owner', width: 90, render: (value) => value || '-' },
    {
      key: 'children',
      title: '下级',
      width: 64,
      align: 'right',
      className: 'tabular-nums',
      render: (_, record) => nodeById.get(record.id)?.children.length ?? 0,
    },
    { key: 'sort_order', title: '排序', dataIndex: 'sort_order', width: 64, align: 'right', className: 'tabular-nums' },
    {
      key: 'is_active',
      title: '是否启用',
      dataIndex: 'is_active',
      width: 90,
      render: (value) => {
        // null counts as enabled
        const option = enabledOption(value !== false)
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
      width: 150,
      render: (_, record) => {
        const siblings = childrenOf(record.parent_id)
        const position = siblings.findIndex((n) => n.id === record.id)
        return (
          <RowActions
            actions={[
              { label: '编辑', onClick: () => openEdit(record), hidden: !canEdit },
              {
                label: '删除',
                hidden: !canDelete,
                render: () => (
                  <ConfirmAction
                    title="确认删除该记录？"
                    description="有下级记录时不能删除，请先删除或移走下级记录。"
                    confirmText="删除"
                    onConfirm={() => remove(record)}
                  >
                    <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
                      {t('删除')}
                    </Button>
                  </ConfirmAction>
                ),
              },
              { label: '上移', icon: ArrowUp, onClick: () => shift(record, -1), disabled: position <= 0, hidden: !canEdit },
              {
                label: '下移',
                icon: ArrowDown,
                onClick: () => shift(record, 1),
                disabled: position < 0 || position >= siblings.length - 1,
                hidden: !canEdit,
              },
            ]}
          />
        )
      },
    },
  ]

  const current = breadcrumb[breadcrumb.length - 1]
  const hasFilters = Boolean(filters.search || filters.status)

  return (
    <div>
      <PageHeader
        title="树形列表"
        actions={
          canAdd ? (
            <Button size="sm" variant="brand" onClick={() => openCreate(parentId)}>
              <Plus />
              {t('新建记录')}
            </Button>
          ) : null
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[288px_minmax(0,1fr)]">
        {/* ── Left: the tree ── */}
        <Panel padded={false} className="flex max-h-[420px] flex-col lg:max-h-[calc(100vh-11rem)]" bodyClassName="flex min-h-0 flex-1 flex-col">
          <div className="space-y-3 border-b px-3 pt-4 pb-3">
            <div className="flex items-center justify-between px-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                <ListTree className="text-muted-foreground size-4" />
                {t('层级')}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">{t('{{count}} 条记录', { count: nodeById.size })}</span>
            </div>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
                placeholder={t('搜索名称 / 编码')}
                aria-label={t('搜索名称 / 编码')}
                className="h-8 pr-7 pl-8 text-[13px]"
              />
              {treeSearch ? (
                <button
                  type="button"
                  aria-label={t('清空')}
                  onClick={() => setTreeSearch('')}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="px-2 pt-2">
            <button
              type="button"
              onClick={() => navigateTo(null)}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] transition-colors',
                parentId === null ? 'bg-brand-soft text-primary font-medium' : 'hover:bg-muted/60',
              )}
            >
              <Layers className="size-3.5" />
              {t('顶级记录')}
            </button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-2 pt-1 pb-3">
              {treeLoading && treeNodes.length === 0 ? (
                <div className="space-y-1.5 px-1 pt-1">
                  {[0, 16, 32, 16, 0, 16].map((indent, i) => (
                    <Skeleton key={i} className="h-6" style={{ marginLeft: indent }} />
                  ))}
                </div>
              ) : treeNodes.length === 0 ? (
                <EmptyState
                  className="py-10"
                  title={debouncedSearch ? '没有匹配的记录' : '暂无数据'}
                  description={debouncedSearch ? '换个关键词试试' : undefined}
                />
              ) : (
                <TreeView
                  aria-label="树形列表"
                  nodes={treeNodes}
                  selectedKey={parentId ?? undefined}
                  expandedKeys={debouncedSearch ? searchExpanded : (expandedKeys ?? [])}
                  onExpandedChange={debouncedSearch ? setSearchExpanded : setExpandedKeys}
                  onSelect={(node) => navigateTo(node.key)}
                  className={cn('transition-opacity', treeLoading && 'opacity-60')}
                  renderLabel={(node) => (
                    <span className={cn('flex min-w-0 items-center gap-1.5', node.record.is_active === false && 'text-muted-foreground')}>
                      {node.record.children.length ? (
                        <Folder className="text-muted-foreground size-3.5 shrink-0" />
                      ) : (
                        <FileText className="text-muted-foreground size-3.5 shrink-0" />
                      )}
                      <span className="truncate">{node.label}</span>
                      {node.record.children.length ? (
                        <span className="bg-muted text-muted-foreground shrink-0 rounded px-1 text-[10px] leading-4 tabular-nums">{node.record.children.length}</span>
                      ) : null}
                    </span>
                  )}
                  renderActions={(node) => (
                    <>
                      {canAdd ? (
                        <Button variant="ghost" size="icon" className="size-6" aria-label={t('新建下级')} title={t('新建下级')} onClick={() => openCreate(node.key)}>
                          <Plus className="size-3.5" />
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <Button variant="ghost" size="icon" className="size-6" aria-label={t('编辑')} title={t('编辑')} onClick={() => openEdit(node.record)}>
                          <Pencil className="size-3.5" />
                        </Button>
                      ) : null}
                    </>
                  )}
                />
              )}
            </div>
          </ScrollArea>
        </Panel>

        {/* ── Right: the children of the selected record ── */}
        <div className="min-w-0">
          <div className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-2">
            <Breadcrumb>
              <BreadcrumbList className="gap-1 text-[13px] sm:gap-1.5">
                <BreadcrumbItem>
                  {current ? (
                    <BreadcrumbLink asChild>
                      <button type="button" onClick={() => navigateTo(null)}>
                        {t('顶级记录')}
                      </button>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{t('顶级记录')}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {breadcrumb.map((node) => (
                  <Fragment key={node.id}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {node === current ? (
                        <BreadcrumbPage className="font-medium">{node.name}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <button type="button" onClick={() => navigateTo(node.id)}>
                            {node.name}
                          </button>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            {loading ? null : <span className="text-muted-foreground text-xs tabular-nums">{t('共 {{count}} 条', { count: total })}</span>}
          </div>

          <FilterBar onSearch={runSearch} onReset={resetFilters}>
            <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="名称 / 编码" />
            <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="状态" />
          </FilterBar>

          <DataTable
            columns={columns}
            data={data}
            loading={loading}
            pagination={{ page, perPage, total, onChange: handlePageChange }}
            minWidth={820}
            emptyTitle={hasFilters ? '没有符合条件的记录' : current ? '该记录暂无下级' : '暂无数据'}
            emptyAction={
              canAdd && !hasFilters ? (
                <Button variant="outline" size="sm" onClick={() => openCreate(parentId)}>
                  <Plus />
                  {t(current ? '新建下级' : '新建记录')}
                </Button>
              ) : null
            }
          />
        </div>
      </div>

      <FormDialog open={formOpen} onOpenChange={setFormOpen} title={editing ? '编辑记录' : '新建记录'} form={form} onSubmit={submit}>
        <FormGrid>
          <FormInput control={form.control} name="name" label="名称" rules={{ required: '请输入名称' }} />
          <FormInput control={form.control} name="code" label="编码" rules={{ required: '请输入编码' }} inputClassName="font-mono text-[13px]" />
        </FormGrid>
        <FormTreeSelect
          control={form.control}
          name="parent_id"
          label="上级记录"
          description={editing ? '不能选择记录自身及其下级' : undefined}
          tree={selectTree}
          excludeId={editing?.id}
          placeholder="不选则为顶级记录"
          noneLabel="（无）作为顶级记录"
        />
        <FormGrid>
          <FormSelect control={form.control} name="category" label="分类" options={CATEGORY_OPTIONS} clearable />
          <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} rules={{ required: '请选择状态' }} />
          <FormInput control={form.control} name="owner" label="负责人" />
        </FormGrid>
        <FormSwitch control={form.control} name="is_active" label="是否启用" />
        <FormTextarea control={form.control} name="description" label="描述" />
      </FormDialog>
    </div>
  )
}
