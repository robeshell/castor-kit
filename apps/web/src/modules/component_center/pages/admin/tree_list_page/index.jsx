import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import {
  Download,
  File,
  Folder,
  FolderInput,
  Layers,
  ListTree,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  createTreeListPage,
  deleteTreeListPage,
  downloadTreeListPageTemplate,
  exportTreeListPage,
  getTreeListPageList,
  getTreeListPageTree,
  importTreeListPage,
  updateTreeListPage,
} from '@/modules/component_center/api/tree_list_page'
import ParentSelect from '@/modules/component_center/pages/admin/tree_list_page/ParentSelect'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import EmptyState from '@/shared/components/EmptyState'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { DescriptionList, DetailSheet, FormDialog } from '@/shared/components/FormDialog'
import {
  FormCustom,
  FormGrid,
  FormInput,
  FormNumber,
  FormSelect,
  FormSwitch,
  FormTextarea,
} from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'
import TreeView from '@/shared/components/TreeView'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { downloadBlobFile } from '@/shared/utils/file'

// ── Constants ──────────────────────────────────────────────────────────────
const PER_PAGE = 20
const NODE_TYPE_OPTIONS = [
  { label: '分类', value: 'category' },
  { label: '条目', value: 'item' },
  { label: '分组', value: 'group' },
]
const STATUS_OPTIONS = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
  { label: '已归档', value: 'archived' },
]
const STATUS_META = {
  active: { label: '启用', tone: 'success' },
  inactive: { label: '停用', tone: 'neutral' },
  archived: { label: '已归档', tone: 'warning' },
}
const NODE_TYPE_META = {
  category: { label: '分类', tone: 'brand', icon: Folder },
  item: { label: '条目', tone: 'info', icon: File },
  group: { label: '分组', tone: 'neutral', icon: Layers },
}

const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '节点名称', value: 'name' },
  { label: '节点编码', value: 'node_code' },
  { label: '父节点ID', value: 'parent_id' },
  { label: '节点类型', value: 'node_type' },
  { label: '状态', value: 'status' },
  { label: '负责人', value: 'owner' },
  { label: '排序', value: 'sort_order' },
  { label: '启用', value: 'is_active' },
  { label: '描述', value: 'description' },
  { label: '创建时间', value: 'created_at' },
  { label: '更新时间', value: 'updated_at' },
]

const normalizeFileType = (raw) => (raw === 'xlsx' ? 'xlsx' : raw === 'xls' ? 'xls' : 'csv')

// ── Helpers ──────────────────────────────────────────────────────────
/** API tree → TreeView nodes (key is the id as a string; raw keeps the full node data) */
function toTreeNodes(nodes) {
  return (nodes || []).map((n) => ({
    key: String(n.id),
    label: n.name,
    raw: n,
    children: n.children?.length ? toTreeNodes(n.children) : undefined,
  }))
}

function collectKeys(nodes) {
  const keys = []
  const walk = (list) =>
    list.forEach((n) => {
      keys.push(n.key)
      if (n.children?.length) walk(n.children)
    })
  walk(nodes)
  return keys
}

/** Find the path to the node with the given id (for the breadcrumb) */
function findPath(nodes, targetId, path = []) {
  for (const node of nodes || []) {
    const current = [...path, { id: node.id, name: node.name }]
    if (node.id === targetId) return current
    if (node.children?.length) {
      const found = findPath(node.children, targetId, current)
      if (found) return found
    }
  }
  return null
}

function nodeTypeBadge(value) {
  const meta = NODE_TYPE_META[value]
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

function toFormValues(record, parentId = null) {
  if (!record) {
    return {
      name: '',
      node_code: '',
      parent_id: parentId,
      node_type: 'category',
      icon: '',
      owner: '',
      sort_order: 0,
      is_active: true,
      status: 'active',
      description: '',
    }
  }
  return {
    name: record.name,
    node_code: record.node_code,
    parent_id: record.parent_id ?? null,
    node_type: record.node_type || 'category',
    icon: record.icon || '',
    owner: record.owner || '',
    sort_order: record.sort_order ?? 0,
    is_active: record.is_active !== false,
    status: record.status || 'active',
    description: record.description || '',
  }
}

// ── Delete confirmation (controlled; opened from a tree node's "more" menu) ────────────
function DeleteNodeDialog({ open, node, onOpenChange, onConfirm }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <AlertDialogContent className="sm:max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('确认删除节点「{{name}}」？', { name: node?.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('子节点的父节点关联将被清除。')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t('取消')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            variant="destructive"
            onClick={async (e) => {
              e.preventDefault()
              try {
                setLoading(true)
                await onConfirm(node)
                onOpenChange(false)
              } catch {
                /* already reported; keep the dialog open */
              } finally {
                setLoading(false)
              }
            }}
          >
            {loading ? <Spinner /> : null}
            {t('删除')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TreeListPage() {
  const { t } = useTranslation()
  // Left-hand tree
  const [treeSearch, setTreeSearch] = useState('')
  const debouncedTreeSearch = useDebouncedValue(treeSearch.trim(), 300)
  const [treeVersion, setTreeVersion] = useState(0)
  const [treeState, setTreeState] = useState({ key: null, nodes: [] })
  const [fullTree, setFullTree] = useState([])
  const [expandedKeys, setExpandedKeys] = useState(null)
  const expandedBeforeSearch = useRef(null)

  // Right-hand table
  const [selectedNodeId, setSelectedNodeId] = useState(null) // null = root level
  const [page, setPage] = useState(1)
  const [tableSearch, setTableSearch] = useState('')
  const debouncedTableSearch = useDebouncedValue(tableSearch.trim(), 300)
  const [filterNodeType, setFilterNodeType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [tableVersion, setTableVersion] = useState(0)
  const [tableState, setTableState] = useState({ key: null, items: [], total: 0 })
  const [selectedKeys, setSelectedKeys] = useState([])

  // Dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [moving, setMoving] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm({ defaultValues: toFormValues(null) })
  const moveForm = useForm({ defaultValues: { parent_id: null } })

  // ── Fetch the tree (debounced search; fullTree always holds the unfiltered tree for the parent picker and breadcrumb) ──
  const treeKey = `${debouncedTreeSearch}|${treeVersion}`
  useEffect(() => {
    let alive = true
    getTreeListPageTree({ search: debouncedTreeSearch || undefined })
      .then((res) => {
        if (!alive) return
        const list = Array.isArray(res) ? res : []
        setTreeState({ key: treeKey, nodes: list })
        if (!debouncedTreeSearch) setFullTree(list)
        else {
          // While searching the tree is filtered, so refresh the full tree separately
          getTreeListPageTree({})
            .then((full) => alive && setFullTree(Array.isArray(full) ? full : []))
            .catch(() => {})
        }
        const keys = collectKeys(toTreeNodes(list))
        if (debouncedTreeSearch) {
          // While searching, expand every match; remember the pre-search expansion and restore it once the search is cleared
          setExpandedKeys((prev) => {
            if (expandedBeforeSearch.current === null) expandedBeforeSearch.current = prev
            return keys
          })
        } else if (expandedBeforeSearch.current !== null) {
          const restore = expandedBeforeSearch.current
          expandedBeforeSearch.current = null
          setExpandedKeys(restore ?? keys.slice(0, 20))
        } else {
          setExpandedKeys((prev) => prev ?? keys.slice(0, 20))
        }
      })
      .catch((err) => {
        if (!alive) return
        setTreeState((s) => ({ ...s, key: treeKey }))
        toast.apiError(err, '树形数据加载失败')
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- treeKey is derived from search/version
  }, [debouncedTreeSearch, treeVersion])
  const treeLoading = treeState.key !== treeKey
  const treeNodes = useMemo(() => toTreeNodes(treeState.nodes), [treeState.nodes])

  // ── Fetch the table ──────────────────────────────────────────────────────
  const tableParams = useMemo(
    () => ({
      page,
      per_page: PER_PAGE,
      parent_id: selectedNodeId === null ? 'root' : selectedNodeId,
      search: debouncedTableSearch || undefined,
      node_type: filterNodeType || undefined,
      status: filterStatus || undefined,
    }),
    [page, selectedNodeId, debouncedTableSearch, filterNodeType, filterStatus],
  )
  const tableKey = `${JSON.stringify(tableParams)}|${tableVersion}`
  useEffect(() => {
    let alive = true
    getTreeListPageList(tableParams)
      .then((res) => {
        if (!alive) return
        const items = res?.items || []
        // Deleting the last row of the last page leaves the page out of range: go back one page
        if (!items.length && (res?.total || 0) > 0 && page > 1) {
          setPage((p) => p - 1)
          return
        }
        setTableState({ key: tableKey, items, total: res?.total || 0 })
      })
      .catch((err) => {
        if (!alive) return
        setTableState((s) => ({ ...s, key: tableKey }))
        toast.apiError(err, '列表加载失败')
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tableKey is derived from tableParams/version
  }, [tableParams, tableVersion])
  const tableLoading = tableState.key !== tableKey

  const reloadAll = () => {
    setTreeVersion((v) => v + 1)
    setTableVersion((v) => v + 1)
  }

  // ── Navigation: switch the current parent node ────────────────────────────────────────────
  const navigateTo = (id, { resetFilters = true } = {}) => {
    setSelectedNodeId(id)
    setPage(1)
    if (resetFilters) {
      setTableSearch('')
      setFilterNodeType('')
      setFilterStatus('')
    }
  }

  const breadcrumbPath = selectedNodeId
    ? findPath(fullTree, selectedNodeId) || findPath(treeState.nodes, selectedNodeId) || [{ id: selectedNodeId, name: t('当前节点') }]
    : []

  const nodeNameOf = (id) => {
    if (id === null || id === undefined) return null
    const path = findPath(fullTree, id)
    return path ? path[path.length - 1].name : null
  }

  // ── CRUD ──────────────────────────────────────────────────────────
  const openCreate = (parentId = selectedNodeId) => {
    setEditing(null)
    form.reset(toFormValues(null, parentId || null))
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.reset(toFormValues(record))
    setFormOpen(true)
  }

  const openMove = (record) => {
    setMoving(record)
    moveForm.reset({ parent_id: record.parent_id ?? null })
  }

  const openDetail = (record) => {
    setDetail(record)
    setDetailOpen(true)
  }

  /** Expand the target parent after saving so a created / moved node is visible in the tree */
  const expandParent = (parentId) => {
    if (parentId === null || parentId === undefined) return
    setExpandedKeys((prev) => Array.from(new Set([...(prev || []), String(parentId)])))
  }

  const submit = async (values) => {
    const parentId = editing?.id ? values.parent_id : values.parent_id ?? (selectedNodeId || null)
    try {
      if (editing?.id) await updateTreeListPage(editing.id, values)
      else await createTreeListPage({ ...values, parent_id: parentId })
      expandParent(parentId)
      toast.success(editing?.id ? '编辑成功' : '新建成功')
      setFormOpen(false)
      reloadAll()
    } catch (err) {
      toast.apiError(err, editing?.id ? '编辑失败' : '新建失败')
      throw err
    }
  }

  const submitMove = async (values) => {
    try {
      await updateTreeListPage(moving.id, { parent_id: values.parent_id ?? null })
      expandParent(values.parent_id)
      toast.success('移动成功')
      setMoving(null)
      reloadAll()
    } catch (err) {
      toast.apiError(err, '移动失败')
      throw err
    }
  }

  const remove = async (record) => {
    try {
      await deleteTreeListPage(record.id)
      toast.success('删除成功')
      setSelectedKeys((keys) => keys.filter((k) => k !== record.id))
      if (record.id === selectedNodeId) navigateTo(record.parent_id ?? null)
      reloadAll()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  // ── Export ──────────────────────────────────────────────────────────
  const handleExport = async ({ fields, fileType }) => {
    const ext = normalizeFileType(fileType)
    const payload = {
      fields,
      file_type: ext,
      export_mode: selectedKeys.length > 0 ? 'selected' : 'filtered',
      ids: selectedKeys,
      filters: { search: debouncedTableSearch, node_type: filterNodeType, status: filterStatus },
    }
    try {
      const blob = await exportTreeListPage(payload)
      downloadBlobFile(blob, `tree_list_page_export.${ext}`)
      toast.success('导出成功')
      setExportOpen(false)
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  // ── Table columns ────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'name',
      title: '节点名称',
      dataIndex: 'name',
      minWidth: 160,
      render: (name, record) => {
        const Icon = NODE_TYPE_META[record.node_type]?.icon || Folder
        return (
          <button
            type="button"
            onClick={() => navigateTo(record.id)}
            className="group/name hover:text-primary flex max-w-full items-center gap-2 text-left font-medium transition-colors"
            title={t('查看子节点')}
          >
            <Icon className="text-muted-foreground group-hover/name:text-primary size-3.5 shrink-0 transition-colors" />
            <span className="truncate">{name}</span>
          </button>
        )
      },
    },
    {
      key: 'node_code',
      title: '编码',
      dataIndex: 'node_code',
      width: 150,
      render: (v) => (v ? <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{v}</code> : null),
    },
    { key: 'node_type', title: '类型', dataIndex: 'node_type', width: 80, render: nodeTypeBadge },
    { key: 'status', title: '状态', dataIndex: 'status', width: 90, render: statusBadge },
    { key: 'owner', title: '负责人', dataIndex: 'owner', width: 100, render: (v) => v || '-' },
    { key: 'sort_order', title: '排序', dataIndex: 'sort_order', width: 64, align: 'right', className: 'tabular-nums', render: (v) => v ?? 0 },
    {
      key: 'is_active',
      title: '启用',
      dataIndex: 'is_active',
      width: 76,
      render: (v) => (
        <StatusBadge tone={v ? 'success' : 'neutral'} variant="plain">
          {v ? '启用' : '停用'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 160,
      render: (_, record) => (
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openDetail(record)}>
            {t('详情')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>
            {t('编辑')}
          </Button>
          <ConfirmAction
            title="确认删除该节点？"
            description="子节点的父节点关联将被清除。"
            confirmText="删除"
            onConfirm={() => remove(record)}
          >
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              {t('删除')}
            </Button>
          </ConfirmAction>
        </div>
      ),
    },
  ]

  const treeCount = collectKeys(treeNodes).length
  const currentName = breadcrumbPath.length ? breadcrumbPath[breadcrumbPath.length - 1].name : null

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <PageHeader
        title="树形列表页"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reloadAll}>
              <RefreshCw className={cn((treeLoading || tableLoading) && 'animate-spin')} />
              {t('刷新')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload />
              {t('导入')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <Download />
              {t('导出')}
            </Button>
            <Button size="sm" variant="brand" onClick={() => openCreate()}>
              <Plus />
              {t('新建节点')}
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[288px_minmax(0,1fr)]">
        {/* ══ Left: node tree ══ */}
        <Panel padded={false} className="flex max-h-[420px] flex-col lg:max-h-[calc(100vh-11rem)]" bodyClassName="flex min-h-0 flex-1 flex-col">
          <div className="space-y-3 border-b px-3 pt-4 pb-3">
            <div className="flex items-center justify-between px-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                <ListTree className="text-muted-foreground size-4" />
                {t('节点树')}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">{t('{{count}} 个节点', { count: treeCount })}</span>
            </div>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
                placeholder={t('搜索节点名称…')}
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
                selectedNodeId === null ? 'bg-brand-soft text-primary font-medium' : 'hover:bg-muted/60',
              )}
            >
              <Layers className="size-3.5" />
              {t('全部根节点')}
            </button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-2 pt-1 pb-3">
              {treeLoading && treeNodes.length === 0 ? (
                <div className="space-y-1.5 px-1 pt-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-6" style={{ marginLeft: (i % 3) * 16 }} />
                  ))}
                </div>
              ) : treeNodes.length === 0 ? (
                <EmptyState
                  className="py-10"
                  title={debouncedTreeSearch ? '没有匹配的节点' : '暂无节点数据'}
                  description={debouncedTreeSearch ? '换个关键词试试' : undefined}
                />
              ) : (
                <TreeView
                  nodes={treeNodes}
                  selectedKey={selectedNodeId !== null ? String(selectedNodeId) : undefined}
                  expandedKeys={expandedKeys || []}
                  onExpandedChange={setExpandedKeys}
                  onSelect={(node) => navigateTo(node.raw.id)}
                  className={cn('transition-opacity', treeLoading && 'opacity-60')}
                  renderLabel={(node) => {
                    const Icon = NODE_TYPE_META[node.raw.node_type]?.icon || Folder
                    const count = node.raw.children_count || 0
                    return (
                      <span className={cn('flex min-w-0 items-center gap-1.5', node.raw.is_active === false && 'text-muted-foreground')}>
                        <Icon className="text-muted-foreground size-3.5 shrink-0" />
                        <span className="truncate">{node.label}</span>
                        {count > 0 ? (
                          <span className="bg-muted text-muted-foreground shrink-0 rounded px-1 text-[10px] leading-4 tabular-nums">{count}</span>
                        ) : null}
                      </span>
                    )
                  }}
                  renderActions={(node) => (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={t('新建子节点')}
                        title={t('新建子节点')}
                        onClick={() => openCreate(node.raw.id)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-6" aria-label={t('更多操作')}>
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-36">
                          <DropdownMenuItem onSelect={() => openEdit(node.raw)}>
                            <Pencil />
                            {t('编辑')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openMove(node.raw)}>
                            <FolderInput />
                            {t('移动到…')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              setDeleting(node.raw)
                              setDeleteOpen(true)
                            }}
                          >
                            <Trash2 />
                            {t('删除')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                />
              )}
            </div>
          </ScrollArea>
        </Panel>

        {/* ══ Right: content ══ */}
        <div className="min-w-0">
          <div className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-2">
            <Breadcrumb>
              <BreadcrumbList className="gap-1 text-[13px] sm:gap-1.5">
                <BreadcrumbItem>
                  {breadcrumbPath.length ? (
                    <BreadcrumbLink asChild>
                      <button type="button" onClick={() => navigateTo(null)}>
                        {t('根节点')}
                      </button>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{t('根节点')}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {breadcrumbPath.map((seg, idx) => (
                  <Fragment key={seg.id}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {idx < breadcrumbPath.length - 1 ? (
                        <BreadcrumbLink asChild>
                          <button type="button" onClick={() => navigateTo(seg.id, { resetFilters: false })}>
                            {seg.name}
                          </button>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage className="font-medium">{seg.name}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <span className="text-muted-foreground text-xs tabular-nums">
              {currentName ? t('「{{name}}」的子节点', { name: currentName }) : t('根级节点')} · {t('共 {{count}} 条', { count: tableState.total })}
            </span>
          </div>

          <FilterBar
            onReset={
              tableSearch || filterNodeType || filterStatus
                ? () => {
                    setTableSearch('')
                    setFilterNodeType('')
                    setFilterStatus('')
                    setPage(1)
                  }
                : undefined
            }
          >
            <SearchInput
              value={tableSearch}
              onChange={(v) => {
                setTableSearch(v)
                setPage(1)
              }}
              placeholder="搜索名称/编码/负责人"
            />
            <FilterSelect
              value={filterNodeType}
              onChange={(v) => {
                setFilterNodeType(v)
                setPage(1)
              }}
              options={NODE_TYPE_OPTIONS}
              placeholder="节点类型"
              allLabel="全部类型"
              className="w-32"
            />
            <FilterSelect
              value={filterStatus}
              onChange={(v) => {
                setFilterStatus(v)
                setPage(1)
              }}
              options={STATUS_OPTIONS}
              placeholder="状态"
              allLabel="全部状态"
              className="w-32"
            />
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
            data={tableState.items}
            loading={tableLoading}
            selectable
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            pagination={{ page, perPage: PER_PAGE, total: tableState.total, onChange: setPage }}
            minWidth={880}
            emptyTitle={selectedNodeId ? '该节点暂无子节点' : '暂无根节点数据'}
            emptyAction={
              !tableSearch && !filterNodeType && !filterStatus ? (
                <Button variant="outline" size="sm" onClick={() => openCreate()}>
                  <Plus />
                  {t(selectedNodeId ? '新建子节点' : '新建节点')}
                </Button>
              ) : null
            }
          />
        </div>
      </div>

      {/* ── Create / edit ── */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing?.id ? '编辑节点' : '新建节点'}
        description={editing?.id ? t('正在编辑 {{name}}', { name: editing.name }) : undefined}
        form={form}
        onSubmit={submit}
        size="md"
      >
        <FormGrid>
          <FormInput control={form.control} name="name" label="节点名称" rules={{ required: '请输入节点名称' }} />
          <FormInput
            control={form.control}
            name="node_code"
            label="节点编码"
            placeholder="例如：root_001"
            rules={{ required: '请输入节点编码' }}
            disabled={Boolean(editing?.id)}
          />
          <FormCustom
            control={form.control}
            name="parent_id"
            label="父节点"
            render={({ value, onChange }) => (
              <ParentSelect value={value} onChange={onChange} tree={fullTree} excludeId={editing?.id} />
            )}
          />
          <FormSelect control={form.control} name="node_type" label="节点类型" options={NODE_TYPE_OPTIONS} />
          <FormInput control={form.control} name="owner" label="负责人" placeholder="例如：admin" />
          <FormInput control={form.control} name="icon" label="图标" placeholder="图标名称（可选）" />
          <FormNumber
            control={form.control}
            name="sort_order"
            label="排序"
            min={0}
            max={9999}
            step={1}
            rules={{
              min: { value: 0, message: '排序范围 0–9999' },
              max: { value: 9999, message: '排序范围 0–9999' },
            }}
          />
          <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} />
        </FormGrid>
        <FormSwitch control={form.control} name="is_active" label="启用" />
        <FormTextarea
          control={form.control}
          name="description"
          label="描述"
          rows={3}
          inputClassName="min-h-20"
          rules={{ maxLength: { value: 300, message: '描述最多 300 字' } }}
        />
      </FormDialog>

      {/* ── Move to another parent ── */}
      <FormDialog
        open={Boolean(moving)}
        onOpenChange={(open) => !open && setMoving(null)}
        title="移动节点"
        description={moving ? t('将「{{name}}」移动到新的父节点下；不选则移动到根级。', { name: moving.name }) : undefined}
        form={moveForm}
        onSubmit={submitMove}
        submitText="移动"
        size="sm"
      >
        <FormCustom
          control={moveForm.control}
          name="parent_id"
          label="目标父节点"
          description="不可选择节点自身及其子节点"
          render={({ value, onChange }) => <ParentSelect value={value} onChange={onChange} tree={fullTree} excludeId={moving?.id} />}
        />
      </FormDialog>

      <DeleteNodeDialog open={deleteOpen} node={deleting} onOpenChange={setDeleteOpen} onConfirm={remove} />

      {/* ── Detail ── */}
      <DetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="节点详情"
        description={detail?.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              {t('关闭')}
            </Button>
            <Button
              onClick={() => {
                setDetailOpen(false)
                openEdit(detail)
              }}
            >
              {t('编辑')}
            </Button>
          </>
        }
      >
        {detail ? (
          <div className="space-y-5">
            <DescriptionList
              items={[
                { label: 'ID', value: <span className="tabular-nums">{detail.id}</span> },
                { label: '节点名称', value: detail.name },
                { label: '节点编码', value: <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{detail.node_code}</code> },
                {
                  label: '父节点ID',
                  value:
                    detail.parent_id === null || detail.parent_id === undefined ? (
                      '-'
                    ) : (
                      <span className="tabular-nums">
                        {detail.parent_id}
                        {nodeNameOf(detail.parent_id) ? <span className="text-muted-foreground ml-1.5">（{nodeNameOf(detail.parent_id)}）</span> : null}
                      </span>
                    ),
                },
                { label: '节点类型', value: nodeTypeBadge(detail.node_type) },
                { label: '图标', value: detail.icon || '-' },
                { label: '状态', value: statusBadge(detail.status) },
                {
                  label: '启用',
                  value: (
                    <StatusBadge tone={detail.is_active ? 'success' : 'neutral'} dot>
                      {detail.is_active ? '启用' : '停用'}
                    </StatusBadge>
                  ),
                },
                { label: '负责人', value: detail.owner || '-' },
                { label: '排序', value: <span className="tabular-nums">{detail.sort_order ?? 0}</span> },
                { label: '创建时间', value: <span className="tabular-nums">{formatDateTime(detail.created_at)}</span> },
                { label: '更新时间', value: <span className="tabular-nums">{formatDateTime(detail.updated_at)}</span> },
              ]}
            />
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
        ) : null}
      </DetailSheet>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="树形列表页导出字段"
        ruleHint={selectedKeys.length > 0 ? t('已勾选 {{count}} 条，将优先导出勾选数据', { count: selectedKeys.length }) : '未勾选时，将按当前筛选条件导出'}
        fieldOptions={EXPORT_FIELDS}
        defaultFields={['name', 'node_code', 'parent_id', 'node_type', 'status', 'owner', 'updated_at']}
        onConfirm={handleExport}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入树形列表页数据"
        targetLabel="树形列表页"
        onDownloadTemplate={(fileType) => {
          const ext = normalizeFileType(fileType)
          downloadTreeListPageTemplate(ext)
            .then((blob) => {
              downloadBlobFile(blob, `tree_list_page_import_template.${ext}`)
              toast.success('模板下载成功')
            })
            .catch((err) => toast.apiError(err, '模板下载失败'))
        }}
        onImport={(file) => importTreeListPage(file)}
        onImported={(res) => {
          toast.success(t('导入成功：新增 {{created}} 条，更新 {{updated}} 条', { created: res?.created || 0, updated: res?.updated || 0 }))
          reloadAll()
        }}
        errorExportFileName="tree_list_page_import_error_rows.csv"
      />
    </div>
  )
}
