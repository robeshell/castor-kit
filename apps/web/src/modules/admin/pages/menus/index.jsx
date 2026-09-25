import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, ChevronRight, ChevronsDownUp, ChevronsUpDown, Download, Info, Plus, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/lib/toast'
import { resolveMenuIcon } from '@/lib/menu-icons'
import { cn } from '@/lib/utils'
import {
  createMenu,
  deleteMenu,
  downloadMenusTemplate,
  exportMenus,
  getMenus,
  importMenus,
  sortMenu,
  updateMenu,
} from '@/modules/admin/api/menus'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import { FilterBar, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormGrid, FormInput, FormNumber, FormSelect, FormSwitch } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatusBadge from '@/shared/components/StatusBadge'
import { downloadBlobFile } from '@/shared/utils/file'
import { Trans, useTranslation } from 'react-i18next'

const MENU_TYPE_OPTIONS = [
  { label: '目录', value: 'directory' },
  { label: '菜单', value: 'menu' },
  { label: '按钮', value: 'button' },
]
const MENU_TYPE_TONE = { directory: 'brand', menu: 'info', button: 'warning' }
const MENU_EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '菜单名称', value: 'name' },
  { label: '菜单编码', value: 'code' },
  { label: '类型', value: 'menu_type' },
  { label: '路径', value: 'path' },
  { label: '组件', value: 'component' },
  { label: '图标', value: 'icon' },
  { label: '父级编码', value: 'parent_code' },
  { label: '排序', value: 'sort_order' },
  { label: '是否显示', value: 'is_visible' },
  { label: '是否启用', value: 'is_active' },
  { label: '描述', value: 'description' },
]
const VIEW_ITEMS = [
  { value: 'tree', label: '树形' },
  { value: 'flat', label: '平铺' },
]
const DEFAULT_VALUES = {
  name: '',
  code: '',
  menu_type: 'menu',
  parent_id: null,
  path: '',
  component: '',
  icon: '',
  sort_order: 0,
  is_visible: true,
  is_active: true,
}
const normalizeFileType = (raw) => (['csv', 'xls', 'xlsx'].includes(raw) ? raw : 'xlsx')

// Recursively flatten the tree for the parent menu picker.
// The label is a ReactNode, not a string, so FormSelect shows the stored menu name as-is instead of translating it.
const flattenTree = (menus, depth = 0) =>
  menus.flatMap((m) => [
    { label: <>{'\u00a0\u00a0\u00a0\u00a0'.repeat(depth) + m.name}</>, value: m.id },
    ...(m.children?.length ? flattenTree(m.children, depth + 1) : []),
  ])

const collectParentIds = (menus) => menus.flatMap((m) => (m.children?.length ? [m.id, ...collectParentIds(m.children)] : []))

// Tree -> table rows (with depth); expanded = null means show everything flat
const toRows = (menus, expanded, depth = 0) =>
  menus.flatMap((m) => {
    const hasChildren = Boolean(m.children?.length)
    const row = { ...m, _depth: depth, _hasChildren: hasChildren }
    if (!hasChildren) return [row]
    if (expanded && !expanded.has(m.id)) return [row]
    return [row, ...toRows(m.children, expanded, depth + 1)]
  })

function YesNo({ value }) {
  return (
    <StatusBadge tone={value ? 'success' : 'neutral'} variant="plain">
      {value ? '是' : '否'}
    </StatusBadge>
  )
}

function IconButton({ label, onClick, children }) {
  const { t } = useTranslation()
  const text = t(label)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground size-7" aria-label={text} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

export default function Menus() {
  const { t } = useTranslation()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [querySearch, setQuerySearch] = useState('')
  const [view, setView] = useState('tree')
  const [expanded, setExpanded] = useState(() => new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedKeys, setSelectedKeys] = useState([])
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm({ defaultValues: DEFAULT_VALUES })

  const load = (searchValue) =>
    getMenus({ format: 'tree', search: searchValue })
      .then((res) => {
        const list = Array.isArray(res) ? res : []
        setData(list)
        // Same as the old page's expandAllRows: expand everything after each load
        setExpanded(new Set(collectParentIds(list)))
      })
      .catch(() => toast.error('加载失败'))
      .finally(() => setLoading(false))

  const fetchData = (searchValue = querySearch) => {
    setQuerySearch(searchValue)
    setLoading(true)
    return load(searchValue)
  }

  useEffect(() => {
    load('')
  }, [])

  const parentOptions = useMemo(() => flattenTree(data), [data])
  const rows = useMemo(() => toRows(data, view === 'tree' ? expanded : null), [data, expanded, view])
  const allParentIds = useMemo(() => collectParentIds(data), [data])
  const allExpanded = allParentIds.length > 0 && allParentIds.every((id) => expanded.has(id))

  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const openCreate = (parentId = null) => {
    setEditing(null)
    form.reset({ ...DEFAULT_VALUES, parent_id: parentId })
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.reset({
      name: record.name ?? '',
      code: record.code ?? '',
      menu_type: record.menu_type ?? 'menu',
      parent_id: record.parent_id ?? null,
      path: record.path ?? '',
      component: record.component ?? '',
      icon: record.icon ?? '',
      sort_order: record.sort_order ?? 0,
      is_visible: Boolean(record.is_visible),
      is_active: Boolean(record.is_active),
    })
    setFormOpen(true)
  }

  const submit = async (values) => {
    try {
      if (editing) await updateMenu(editing.id, values)
      else await createMenu(values)
      toast.success(editing ? '修改成功' : '创建成功')
      setFormOpen(false)
      fetchData(querySearch)
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async (record) => {
    try {
      await deleteMenu(record.id)
      toast.success('删除成功')
      setSelectedKeys((keys) => keys.filter((k) => k !== record.id))
      fetchData(querySearch)
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const handleSort = (id, direction) => {
    sortMenu(id, direction)
      .then((res) => {
        if (res?.changed) toast.success('排序成功')
        else toast.info(res?.message || '无需调整')
        fetchData(querySearch)
      })
      .catch((err) => toast.apiError(err, '排序失败'))
  }

  const runSearch = () => {
    setSelectedKeys([])
    fetchData(search.trim())
  }
  const reset = () => {
    setSearch('')
    setSelectedKeys([])
    fetchData('')
  }

  const handleExport = async ({ fields, fileType }) => {
    const type = normalizeFileType(fileType)
    const payload = { fields, file_type: type, export_mode: selectedKeys.length ? 'selected' : 'filtered' }
    if (selectedKeys.length) payload.ids = selectedKeys
    else payload.filters = { search: querySearch }
    try {
      const blob = await exportMenus(payload)
      downloadBlobFile(blob, `menus_export.${type}`)
      toast.success('导出成功')
      setExportOpen(false)
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  const columns = [
    {
      key: 'name',
      title: '菜单名称',
      dataIndex: 'name',
      width: 220,
      render: (value, row) => {
        const Icon = resolveMenuIcon(row)
        const indent = view === 'tree' ? row._depth * 18 : 0
        return (
          <div className="flex items-center gap-1.5" style={{ paddingLeft: indent }}>
            {view === 'tree' ? (
              <button
                type="button"
                aria-label={expanded.has(row.id) ? t('收起') : t('展开')}
                onClick={() => toggleExpand(row.id)}
                className={cn(
                  'text-muted-foreground hover:bg-muted flex size-5 shrink-0 items-center justify-center rounded transition-colors',
                  !row._hasChildren && 'invisible',
                )}
              >
                <ChevronRight className={cn('size-3.5 transition-transform duration-200', expanded.has(row.id) && 'rotate-90')} />
              </button>
            ) : null}
            <Icon className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate font-medium">{value}</span>
          </div>
        )
      },
    },
    {
      key: 'code',
      title: '编码',
      dataIndex: 'code',
      render: (v) => (v ? <StatusBadge tone="neutral" className="font-mono">{v}</StatusBadge> : null),
    },
    {
      key: 'menu_type',
      title: '类型',
      dataIndex: 'menu_type',
      width: 76,
      render: (v) => (
        <StatusBadge tone={MENU_TYPE_TONE[v] || 'neutral'}>{MENU_TYPE_OPTIONS.find((o) => o.value === v)?.label || v}</StatusBadge>
      ),
    },
    { key: 'path', title: '路径', dataIndex: 'path', width: 180, ellipsis: true, className: 'font-mono text-xs' },
    { key: 'component', title: '组件', dataIndex: 'component', width: 170, ellipsis: true, className: 'text-muted-foreground font-mono text-xs' },
    { key: 'icon', title: '图标', dataIndex: 'icon', width: 120, ellipsis: true, className: 'text-muted-foreground text-xs' },
    { key: 'sort_order', title: '排序', dataIndex: 'sort_order', width: 60, align: 'right', className: 'tabular-nums' },
    { key: 'is_visible', title: '显示', dataIndex: 'is_visible', width: 64, render: (v) => <YesNo value={v} /> },
    { key: 'is_active', title: '启用', dataIndex: 'is_active', width: 64, render: (v) => <YesNo value={v} /> },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 236,
      render: (_, record) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openCreate(record.id)}>
            {t('添加子项')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>
            {t('编辑')}
          </Button>
          <IconButton label="上移" onClick={() => handleSort(record.id, 'up')}>
            <ArrowUp />
          </IconButton>
          <IconButton label="下移" onClick={() => handleSort(record.id, 'down')}>
            <ArrowDown />
          </IconButton>
          <ConfirmAction title="确认删除该菜单？" description="有子菜单时无法删除" confirmText="删除" onConfirm={() => remove(record)}>
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
        title="菜单管理"
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
            <Button size="sm" variant="brand" onClick={() => openCreate()}>
              <Plus />
              {t('新建菜单')}
            </Button>
          </>
        }
      />

      <FilterBar
        onSearch={runSearch}
        onReset={reset}
        extra={
          <>
            {view === 'tree' && allParentIds.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-8"
                onClick={() => setExpanded(allExpanded ? new Set() : new Set(allParentIds))}
              >
                {allExpanded ? <ChevronsDownUp /> : <ChevronsUpDown />}
                {allExpanded ? t('全部收起') : t('全部展开')}
              </Button>
            ) : null}
            <SegmentedTabs variant="pill" value={view} onChange={setView} items={VIEW_ITEMS} />
          </>
        }
      >
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="搜索菜单名称/编码" />
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
                  components={[<span key="count" className="font-medium tabular-nums" />]}
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
        data={rows}
        loading={loading}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        dense
        minWidth={1320}
        emptyTitle="没有找到菜单"
        emptyDescription={querySearch ? '换个关键词试试' : '点击右上角「新建菜单」添加第一个菜单'}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? '编辑菜单' : '新建菜单'}
        description={editing ? t('正在编辑 {{name}}', { name: editing.name }) : undefined}
        form={form}
        onSubmit={submit}
        footerExtra={
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground inline-flex cursor-help items-center gap-1 text-xs">
                <Info className="size-3.5" />
                {t('动态路由模式下，菜单的路径和组件名都需要配置')}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              {t('组件名需对应 src/modules/**/pages/**/index.jsx，例如 admin/users → /modules/admin/pages/users/index.jsx')}
            </TooltipContent>
          </Tooltip>
        }
      >
        <FormGrid>
          <FormInput control={form.control} name="name" label="名称" rules={{ required: '请输入菜单名称' }} />
          <FormInput control={form.control} name="code" label="编码" rules={{ required: '请输入菜单编码' }} inputClassName="font-mono" />
          <FormSelect control={form.control} name="menu_type" label="类型" options={MENU_TYPE_OPTIONS} />
          <FormSelect control={form.control} name="parent_id" label="父菜单" options={parentOptions} placeholder="无（顶级菜单）" clearable />
        </FormGrid>
        <FormInput control={form.control} name="path" label="路径" placeholder="/example" inputClassName="font-mono" />
        <FormInput
          control={form.control}
          name="component"
          label="组件"
          placeholder="例如：admin/users、component_center/list_page"
          inputClassName="font-mono"
        />
        <FormGrid>
          <FormInput control={form.control} name="icon" label="图标" placeholder="图标名称" />
          <FormNumber control={form.control} name="sort_order" label="排序" min={0} />
        </FormGrid>
        <FormGrid>
          <FormSwitch control={form.control} name="is_visible" label="显示" />
          <FormSwitch control={form.control} name="is_active" label="启用" />
        </FormGrid>
      </FormDialog>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="菜单导出字段"
        ruleHint={selectedKeys.length ? t('已勾选 {{count}} 条，将优先导出勾选数据', { count: selectedKeys.length }) : '未勾选数据时，将导出当前列表全部结果'}
        fieldOptions={MENU_EXPORT_FIELDS}
        defaultFields={['name', 'code', 'menu_type', 'path', 'component', 'parent_code', 'sort_order']}
        onConfirm={handleExport}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入菜单"
        targetLabel="菜单管理"
        onDownloadTemplate={(fileType) =>
          downloadMenusTemplate(normalizeFileType(fileType))
            .then((blob) => {
              downloadBlobFile(blob, `menus_import_template.${normalizeFileType(fileType)}`)
              toast.success('模板下载成功')
            })
            .catch((err) => toast.apiError(err, '模板下载失败'))
        }
        onImport={(file) => importMenus(file)}
        onImported={(res) => {
          toast.success(t('导入成功：新增 {{created}} 条，更新 {{updated}} 条', { created: res?.created || 0, updated: res?.updated || 0 }))
          fetchData()
        }}
        errorExportFileName="menus_import_error_rows.csv"
      />
    </div>
  )
}
