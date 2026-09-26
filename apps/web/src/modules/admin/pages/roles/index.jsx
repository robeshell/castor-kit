import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import { Trans, useTranslation } from 'react-i18next'
import { Download, Lock, Plus, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { roleDescription, roleName } from '@/lib/role-label'
import { toast } from '@/lib/toast'
import { formatDateTime } from '@/lib/format'
import { menuLabel } from '@/lib/menu-label'
import { getDepartments } from '@/modules/admin/api/departments'
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
import CheckableTree from '@/shared/components/CheckableTree'
import { FormInput, FormSelect } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { downloadBlobFile } from '@/shared/utils/file'

const ROLE_EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '角色名称', value: 'name' },
  { label: '角色编码', value: 'code' },
  { label: '描述', value: 'description' },
  { label: '数据范围', value: 'data_scope' },
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

function MenuTreeChecklist({ tree, value, onChange }) {
  // Subscribe to language changes: menuLabel reads i18n directly
  useTranslation()
  return (
    <CheckableTree tree={tree} value={value} onChange={onChange} renderText={(node) => menuLabel({ code: node.code, name: node.label })} />
  )
}

// Department tree -> CheckableTree nodes
const toDeptNodes = (depts = []) =>
  depts.map((d) => ({ key: d.id, label: d.name, children: d.children?.length ? toDeptNodes(d.children) : undefined }))

const DATA_SCOPE_OPTIONS = [
  { label: '全部数据', value: 'all' },
  { label: '本部门及下级', value: 'dept_and_children' },
  { label: '本部门', value: 'dept' },
  { label: '仅本人', value: 'self' },
  { label: '自定义部门', value: 'custom' },
]
const DATA_SCOPE_LABEL = Object.fromEntries(DATA_SCOPE_OPTIONS.map((o) => [o.value, o.label]))

/** The built-in super admin role: always all data and all menus, can't be deleted (enforced by the API too) */
const isSuperRole = (role) => role?.code === 'super_admin'

function LockedNote({ children }) {
  return (
    <p className="bg-muted/60 text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px]">
      <Lock className="size-3.5 shrink-0" />
      {children}
    </p>
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
  const [deptTree, setDeptTree] = useState([])
  const [checkedDepts, setCheckedDepts] = useState([])
  const [selectedKeys, setSelectedKeys] = useState([])
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm({ defaultValues: { name: '', code: '', description: '', data_scope: 'all' } })
  const dataScope = useWatch({ control: form.control, name: 'data_scope' })

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
    getDepartments()
      .then((res) => setDeptTree(toDeptNodes(Array.isArray(res) ? res : [])))
      .catch(() => {})
  }, [])

  const openCreate = () => {
    setEditing(null)
    setCheckedMenus([])
    setCheckedDepts([])
    form.reset({ name: '', code: '', description: '', data_scope: 'all' })
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    setCheckedMenus(Array.isArray(record.menu_ids) ? record.menu_ids : record.menus?.map((m) => m.id) || [])
    setCheckedDepts(record.dept_ids || [])
    form.reset({
      name: record.name ?? '',
      code: record.code ?? '',
      description: record.description ?? '',
      data_scope: record.data_scope || 'all',
    })
    setFormOpen(true)
  }

  const lockedRole = isSuperRole(editing)

  const submit = async (values) => {
    const payload = { ...values, menu_ids: checkedMenus }
    if (values.data_scope === 'custom') payload.dept_ids = checkedDepts
    if (lockedRole) {
      // Only name / description are editable on the super admin role
      delete payload.menu_ids
      delete payload.data_scope
      delete payload.code
    }
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
      key: 'data_scope',
      title: '数据范围',
      dataIndex: 'data_scope',
      width: 130,
      render: (v, record) =>
        v === 'custom' ? (
          <StatusBadge tone="info">{t('自定义 {{count}} 个部门', { count: record.dept_ids?.length || 0 })}</StatusBadge>
        ) : (
          <StatusBadge tone={v === 'all' || !v ? 'neutral' : 'info'}>{DATA_SCOPE_LABEL[v || 'all']}</StatusBadge>
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
          {isSuperRole(record) ? null : (
            <ConfirmAction title="确认删除该角色？" description="删除后不可恢复" confirmText="删除" onConfirm={() => remove(record)}>
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
                {t('删除')}
              </Button>
            </ConfirmAction>
          )}
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
        minWidth={960}
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
        <FormSelect
          control={form.control}
          name="data_scope"
          label="数据范围"
          options={DATA_SCOPE_OPTIONS}
          disabled={lockedRole}
          description={lockedRole ? '超级管理员始终能看到全部数据' : '决定该角色能看到哪些数据；用户有多个角色时取并集'}
        />
        {dataScope === 'custom' && !lockedRole ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium">{t('可见部门')}</span>
              <span className="text-muted-foreground text-xs tabular-nums">{t('已选 {{count}} 项', { count: checkedDepts.length })}</span>
            </div>
            <div className="max-h-56 overflow-auto rounded-lg border p-1.5">
              {deptTree.length > 0 ? (
                <CheckableTree tree={deptTree} value={checkedDepts} onChange={setCheckedDepts} />
              ) : (
                <p className="text-muted-foreground px-2 py-3 text-[13px]">{t('还没有部门，先到「部门管理」添加')}</p>
              )}
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">{t('菜单权限')}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{t('已选 {{count}} 项', { count: checkedMenus.length })}</span>
          </div>
          {lockedRole ? (
            <LockedNote>{t('超级管理员始终拥有全部菜单权限，不能修改')}</LockedNote>
          ) : (
            <div className="max-h-72 overflow-auto rounded-lg border p-1.5">
              {menuTree.length > 0 ? (
                <MenuTreeChecklist tree={menuTree} value={checkedMenus} onChange={setCheckedMenus} />
              ) : (
                <p className="text-muted-foreground px-2 py-3 text-[13px]">{t('暂无菜单数据')}</p>
              )}
            </div>
          )}
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
