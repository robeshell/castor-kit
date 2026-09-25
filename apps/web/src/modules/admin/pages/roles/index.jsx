import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import { Trans, useTranslation } from 'react-i18next'
import { Check, Download, Minus, Plus, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { roleDescription, roleName } from '@/lib/role-label'
import { toast } from '@/lib/toast'
import { formatDateTime } from '@/lib/format'
import { menuLabel } from '@/lib/menu-label'
import { cn } from '@/lib/utils'
import { getMenus } from '@/modules/admin/api/menus'
import {
  createRole,
  deleteRole,
  downloadRolesTemplate,
  exportRoles,
  getRoles,
  importRoles,
  updateRole,
} from '@/modules/admin/api/roles'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import { FilterBar, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormInput } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import TreeView from '@/shared/components/TreeView'
import { downloadBlobFile } from '@/shared/utils/file'

const ROLE_EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '角色名称', value: 'name' },
  { label: '角色编码', value: 'code' },
  { label: '描述', value: 'description' },
  { label: '菜单编码', value: 'menu_codes' },
  { label: '菜单名称', value: 'menu_names' },
  { label: '创建时间', value: 'created_at' },
]
const normalizeFileType = (raw) => (['csv', 'xls', 'xlsx'].includes(raw) ? raw : 'xlsx')

// Backend menu tree -> TreeView nodes (key is the numeric menu id; code is kept for the translated label)
const convertToTreeData = (menus = []) =>
  menus.map((m) => ({
    key: m.id,
    code: m.code,
    label: m.name,
    children: m.children?.length ? convertToTreeData(m.children) : undefined,
  }))

const collectDescendants = (node) => (node.children || []).flatMap((child) => [child.key, ...collectDescendants(child)])

/**
 * Cascading parent/child checks (multi-select):
 * - the checked set holds every fully checked node (parents included); half-checked parents are not in it
 * - a parent in the set -> all of its descendants count as checked
 * - a parent is checked if and only if all of its children are checked
 */
function expandDown(nodes, set) {
  const walk = (list, parentChecked) =>
    list.forEach((node) => {
      const checked = parentChecked || set.has(node.key)
      if (checked) set.add(node.key)
      if (node.children) walk(node.children, checked)
    })
  walk(nodes, false)
  return set
}

function recomputeUp(nodes, set) {
  const walk = (node) => {
    if (!node.children?.length) return set.has(node.key)
    const results = node.children.map(walk)
    const all = results.every(Boolean)
    if (all) set.add(node.key)
    else set.delete(node.key)
    return all
  }
  nodes.forEach(walk)
  return set
}

/** Display-only checkbox (the whole row toggles it): checked / indeterminate / unchecked */
function CheckMark({ state }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-colors duration-150',
        state === 'unchecked' ? 'border-input dark:bg-input/30' : 'bg-primary border-primary text-primary-foreground',
      )}
    >
      {state === 'checked' ? <Check className="size-3.5" /> : null}
      {state === 'indeterminate' ? <Minus className="size-3.5" /> : null}
    </span>
  )
}

function MenuTreeChecklist({ tree, value, onChange }) {
  // Subscribe to language changes: menuLabel reads i18n directly
  useTranslation()
  const checked = useMemo(() => recomputeUp(tree, expandDown(tree, new Set(value))), [tree, value])

  const isIndeterminate = (node) => !checked.has(node.key) && collectDescendants(node).some((k) => checked.has(k))

  const toggle = (node) => {
    const next = new Set(checked)
    const keys = [node.key, ...collectDescendants(node)]
    if (checked.has(node.key)) keys.forEach((k) => next.delete(k))
    else keys.forEach((k) => next.add(k))
    onChange([...recomputeUp(tree, next)])
  }

  return (
    <TreeView
      nodes={tree}
      defaultExpandAll
      onSelect={toggle}
      renderLabel={(node) => (
        <span className="flex items-center gap-2">
          <CheckMark state={checked.has(node.key) ? 'checked' : isIndeterminate(node) ? 'indeterminate' : 'unchecked'} />
          <span className="truncate">{menuLabel({ code: node.code, name: node.label })}</span>
        </span>
      )}
    />
  )
}

export default function Roles() {
  const { t } = useTranslation()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [querySearch, setQuerySearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [menuTree, setMenuTree] = useState([])
  const [checkedMenus, setCheckedMenus] = useState([])
  const [selectedKeys, setSelectedKeys] = useState([])
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm({ defaultValues: { name: '', code: '', description: '' } })

  const load = () =>
    getRoles()
      .then((res) => setData(Array.isArray(res) ? res : []))
      .catch(() => toast.error('加载失败'))
      .finally(() => setLoading(false))

  const fetchData = () => {
    setLoading(true)
    return load()
  }

  useEffect(() => {
    load()
    getMenus({ format: 'tree' })
      .then((res) => setMenuTree(convertToTreeData(Array.isArray(res) ? res : [])))
      .catch(() => {})
  }, [])

  const openCreate = () => {
    setEditing(null)
    setCheckedMenus([])
    form.reset({ name: '', code: '', description: '' })
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    setCheckedMenus(Array.isArray(record.menu_ids) ? record.menu_ids : record.menus?.map((m) => m.id) || [])
    form.reset({ name: record.name ?? '', code: record.code ?? '', description: record.description ?? '' })
    setFormOpen(true)
  }

  const submit = async (values) => {
    const payload = { ...values, menu_ids: checkedMenus }
    try {
      if (editing) await updateRole(editing.id, payload)
      else await createRole(payload)
      toast.success(editing ? '修改成功' : '创建成功')
      setFormOpen(false)
      fetchData()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async (record) => {
    try {
      await deleteRole(record.id)
      toast.success('删除成功')
      setSelectedKeys((keys) => keys.filter((k) => k !== record.id))
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const runSearch = () => {
    setQuerySearch(search.trim())
    setSelectedKeys([])
  }
  const reset = () => {
    setSearch('')
    setQuerySearch('')
    setSelectedKeys([])
  }

  const handleExport = async ({ fields, fileType }) => {
    const type = normalizeFileType(fileType)
    const payload = { fields, file_type: type, export_mode: selectedKeys.length ? 'selected' : 'filtered' }
    if (selectedKeys.length) payload.ids = selectedKeys
    else payload.filters = { search: querySearch }
    try {
      const blob = await exportRoles(payload)
      downloadBlobFile(blob, `roles_export.${type}`)
      toast.success('导出成功')
      setExportOpen(false)
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  const filteredData = useMemo(() => {
    if (!querySearch) return data
    const keyword = querySearch.toLowerCase()
    return data.filter(
      (item) => String(item.name || '').toLowerCase().includes(keyword) || String(item.code || '').toLowerCase().includes(keyword),
    )
  }, [data, querySearch])

  const columns = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 72, className: 'text-muted-foreground tabular-nums' },
    { key: 'name', title: '角色名称', dataIndex: 'name', render: (_, record) => <span className="font-medium">{roleName(record)}</span> },
    {
      key: 'code',
      title: '角色编码',
      dataIndex: 'code',
      render: (v) => (v ? <StatusBadge tone="neutral" className="font-mono">{v}</StatusBadge> : null),
    },
    { key: 'description', title: '描述', dataIndex: 'description', ellipsis: true, className: 'text-muted-foreground', render: (_, record) => roleDescription(record) },
    {
      key: 'menus',
      title: '菜单权限',
      dataIndex: 'menus',
      width: 110,
      render: (menus) => (
        <StatusBadge tone={menus?.length ? 'success' : 'neutral'}>
          <Trans
            i18nKey="<0>{{count}}</0> 个"
            values={{ count: menus?.length || 0 }}
            components={[<span className="tabular-nums" />]}
          />
        </StatusBadge>
      ),
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (v) => formatDateTime(v, ''),
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
          <ConfirmAction title="确认删除该角色？" description="删除后不可恢复" confirmText="删除" onConfirm={() => remove(record)}>
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
        title="角色管理"
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
              {t('新建角色')}
            </Button>
          </>
        }
      />

      <FilterBar onSearch={runSearch} onReset={reset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="搜索角色名称/编码" />
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
        data={filteredData}
        loading={loading}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        minWidth={820}
        emptyTitle="没有找到角色"
        emptyDescription={querySearch ? '换个关键词试试' : '点击右上角「新建角色」添加第一个角色'}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? '编辑角色' : '新建角色'}
        description={editing ? t('正在编辑 {{name}}', { name: editing.name }) : undefined}
        form={form}
        onSubmit={submit}
      >
        <FormInput control={form.control} name="name" label="角色名称" rules={{ required: '请输入角色名称' }} />
        <FormInput
          control={form.control}
          name="code"
          label="角色编码"
          rules={{ required: '请输入角色编码' }}
          disabled={Boolean(editing)}
          inputClassName="font-mono"
        />
        <FormInput control={form.control} name="description" label="描述" />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">{t('菜单权限')}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{t('已选 {{count}} 项', { count: checkedMenus.length })}</span>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border p-1.5">
            {menuTree.length > 0 ? (
              <MenuTreeChecklist tree={menuTree} value={checkedMenus} onChange={setCheckedMenus} />
            ) : (
              <p className="text-muted-foreground px-2 py-3 text-[13px]">{t('暂无菜单数据')}</p>
            )}
          </div>
        </div>
      </FormDialog>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="角色导出字段"
        ruleHint={
          selectedKeys.length
            ? t('已勾选 {{count}} 条，将优先导出勾选数据', { count: selectedKeys.length })
            : '未勾选数据时，将导出当前列表全部结果'
        }
        fieldOptions={ROLE_EXPORT_FIELDS}
        defaultFields={['name', 'code', 'description', 'menu_codes']}
        onConfirm={handleExport}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入角色"
        targetLabel="角色管理"
        onDownloadTemplate={(fileType) =>
          downloadRolesTemplate(normalizeFileType(fileType))
            .then((blob) => {
              downloadBlobFile(blob, `roles_import_template.${normalizeFileType(fileType)}`)
              toast.success('模板下载成功')
            })
            .catch((err) => toast.apiError(err, '模板下载失败'))
        }
        onImport={(file) => importRoles(file)}
        onImported={(res) => {
          toast.success(t('导入成功：新增 {{created}} 条，更新 {{updated}} 条', { created: res?.created || 0, updated: res?.updated || 0 }))
          fetchData()
        }}
        errorExportFileName="roles_import_error_rows.csv"
      />
    </div>
  )
}
