import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import { Trans, useTranslation } from 'react-i18next'
import { Download, Lock, Plus, ShieldCheck, ShieldOff, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { toast } from '@/lib/toast'
import { profileDefaults, userDisplayName } from '@/lib/user'
import { formatDateTime, formatRelative } from '@/lib/format'
import ProfileFields from '@/modules/admin/components/ProfileFields'
import { getDepartments } from '@/modules/admin/api/departments'
import { getRoles } from '@/modules/admin/api/roles'
import {
  createUser,
  deleteUser,
  downloadUsersTemplate,
  exportUsers,
  getUsers,
  importUsers,
  resetUserTwoFactor,
  setUserStatus,
  updateUser,
} from '@/modules/admin/api/users'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormInput, FormMultiSelect, FormTreeSelect } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import TreeSelect from '@/shared/components/TreeSelect'
import UserAvatar from '@/shared/components/UserAvatar'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { usePasswordPolicy } from '@/shared/hooks/usePasswordPolicy'
import { downloadBlobFile } from '@/shared/utils/file'

const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '用户名', value: 'username' },
  { label: '昵称', value: 'nickname' },
  { label: '邮箱', value: 'email' },
  { label: '手机', value: 'phone' },
  { label: '部门', value: 'dept_name' },
  { label: '状态', value: 'status' },
  { label: '角色名称', value: 'role_names' },
  { label: '角色编码', value: 'role_codes' },
  { label: '最后登录时间', value: 'last_login_at' },
  { label: '最后登录 IP', value: 'last_login_ip' },
  { label: '创建时间', value: 'created_at' },
]
const STATUS_OPTIONS = [
  { label: '正常', value: 'active' },
  { label: '停用', value: 'disabled' },
]
const emptyForm = () => ({ username: '', password: '', role_ids: [], dept_id: null, ...profileDefaults(null) })
const normalizeFileType = (raw) => (['csv', 'xlsx'].includes(raw) ? raw : 'xlsx')

/**
 * User management: the reference list page (other CRUD pages follow this structure):
 * PageHeader (title + primary actions) -> FilterBar (filters) -> DataTable (pagination / selection / row actions)
 * -> FormDialog (create / edit, react-hook-form) -> ImportDialog / ExportDialog
 *
 * i18n: Chinese source text is the key. Strings passed to shared components (PageHeader, DataTable columns,
 * FormDialog, FormFields, ExportDialog, toast, ...) are translated inside them; text written in JSX, native
 * attributes and interpolated strings go through t(). Translations live in ./locales/<lang>.json.
 */
export default function Users() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const passwordPolicy = usePasswordPolicy()
  const list = useCrudList(
    (params) =>
      getUsers(params).catch((err) => {
        toast.apiError(err, '加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [deptId, setDeptId] = useState(null)
  const [deptTree, setDeptTree] = useState([])
  const [roles, setRoles] = useState([])
  const [selectedKeys, setSelectedKeys] = useState([])
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm({ defaultValues: emptyForm() })

  useEffect(() => {
    fetchData()
    getRoles()
      .then((res) => setRoles(Array.isArray(res) ? res : []))
      .catch(() => {})
    getDepartments()
      .then((res) => setDeptTree(Array.isArray(res) ? res : []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Only super admins may grant the super admin role or touch super admin accounts (the API enforces the same)
  const currentIsSuper = Boolean(currentUser?.roles?.some((r) => r.code === 'super_admin'))
  const isSuperAccount = (record) => Boolean(record?.roles?.some((r) => r.code === 'super_admin'))
  const roleOptions = useMemo(
    () => roles.filter((r) => currentIsSuper || r.code !== 'super_admin').map((r) => ({ label: r.name, value: r.id })),
    [roles, currentIsSuper],
  )
  const editingSelf = Boolean(editing && editing.id === currentUser?.id)

  const openCreate = () => {
    setEditing(null)
    form.reset(emptyForm())
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.reset({
      username: record.username,
      password: '',
      role_ids: record.roles?.map((r) => r.id) || [],
      dept_id: record.dept_id ?? null,
      ...profileDefaults(record),
    })
    setFormOpen(true)
  }

  const submit = async (values) => {
    try {
      const { username, password, ...rest } = values
      if (editing) {
        const payload = { ...rest }
        if (password) payload.password = password
        await updateUser(editing.id, payload)
        toast.success('用户已更新')
      } else {
        await createUser({ username, password, ...rest })
        toast.success('用户已创建')
      }
      setFormOpen(false)
      fetchData()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async (record) => {
    try {
      await deleteUser(record.id)
      toast.success('用户已删除')
      setSelectedKeys((keys) => keys.filter((k) => k !== record.id))
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const changeStatus = async (record, next) => {
    try {
      await setUserStatus(record.id, next)
      toast.success(next === 'disabled' ? '用户已停用' : '用户已启用')
      fetchData(page)
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const resetTwoFactor = async (record) => {
    try {
      await resetUserTwoFactor(record.id)
      toast.success('已重置两步验证')
      setEditing((current) => (current?.id === record.id ? { ...current, totp_enabled: false } : current))
      fetchData(page)
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const runSearch = () => {
    setSelectedKeys([])
    list.handleSearch({ search: search.trim(), status, dept_id: deptId ?? '' })
  }
  const reset = () => {
    setSearch('')
    setStatus('')
    setDeptId(null)
    setSelectedKeys([])
    list.handleReset()
  }

  const handleExport = async ({ fields, fileType }) => {
    const type = normalizeFileType(fileType)
    const payload = { fields, file_type: type, export_mode: selectedKeys.length ? 'selected' : 'filtered' }
    if (selectedKeys.length) payload.ids = selectedKeys
    else payload.filters = { search: filters.search ?? '', status: filters.status ?? '', dept_id: filters.dept_id || null }
    try {
      const blob = await exportUsers(payload)
      downloadBlobFile(blob, `users_export.${type}`)
      toast.success('导出成功')
      setExportOpen(false)
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  const columns = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 72, className: 'text-muted-foreground tabular-nums' },
    {
      key: 'username',
      title: '用户',
      dataIndex: 'username',
      minWidth: 180,
      render: (value, record) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar src={record.avatar} name={userDisplayName(record)} className="size-7" />
          <div className="grid min-w-0 leading-tight">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate font-medium">{userDisplayName(record)}</span>
              {record.totp_enabled ? (
                <span title={t('已开启两步验证')} className="shrink-0">
                  <ShieldCheck className="text-success size-3.5" aria-label={t('已开启两步验证')} />
                </span>
              ) : null}
            </span>
            {record.nickname ? <span className="text-muted-foreground truncate text-xs">@{value}</span> : null}
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      title: '联系方式',
      dataIndex: 'email',
      minWidth: 180,
      render: (value, record) =>
        value || record.phone ? (
          <div className="grid min-w-0 leading-tight">
            {value ? <span className="truncate">{value}</span> : null}
            {record.phone ? <span className="text-muted-foreground truncate text-xs tabular-nums">{record.phone}</span> : null}
          </div>
        ) : null,
    },
    {
      key: 'dept_name',
      title: '部门',
      dataIndex: 'dept_name',
      width: 130,
      render: (value) => (value ? <span className="truncate">{value}</span> : null),
    },
    {
      key: 'roles',
      title: '角色',
      dataIndex: 'roles',
      render: (value) =>
        value?.length ? (
          <div className="flex flex-wrap gap-1">
            {value.map((role) => (
              <StatusBadge key={role.id} tone={role.code === 'super_admin' ? 'brand' : 'neutral'}>
                {role.name}
              </StatusBadge>
            ))}
          </div>
        ) : null,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 88,
      render: (value) =>
        value === 'disabled' ? (
          <StatusBadge tone="neutral" dot>
            {t('停用')}
          </StatusBadge>
        ) : (
          <StatusBadge tone="success" dot>
            {t('正常')}
          </StatusBadge>
        ),
    },
    {
      key: 'last_login_at',
      title: '最后登录',
      dataIndex: 'last_login_at',
      width: 150,
      className: 'text-muted-foreground tabular-nums',
      render: (value, record) =>
        value ? (
          <span title={[formatDateTime(value), record.last_login_ip].filter(Boolean).join(' · ')}>{formatRelative(value)}</span>
        ) : (
          t('从未登录')
        ),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 172,
      render: (_, record) =>
        !currentIsSuper && isSuperAccount(record) ? (
          <span
            className="text-muted-foreground inline-flex items-center gap-1 text-xs"
            title={t('只有超级管理员可以操作超级管理员账号')}
          >
            <Lock className="size-3" />
            {t('超级管理员')}
          </span>
        ) : (
          <div className="flex justify-end gap-0.5">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>
              {t('编辑')}
            </Button>
            {record.status === 'disabled' ? (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => changeStatus(record, 'active').catch(() => {})}>
                {t('启用账号')}
              </Button>
            ) : record.username !== currentUser?.username ? (
              <ConfirmAction
                title={t('停用用户 {{name}}？', { name: userDisplayName(record) })}
                description="停用后该账号无法登录，已登录的设备会立即退出。"
                confirmText="停用账号"
                onConfirm={() => changeStatus(record, 'disabled')}
              >
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  {t('停用账号')}
                </Button>
              </ConfirmAction>
            ) : null}
            <ConfirmAction
              title={t('删除用户 {{name}}？', { name: record.username })}
              description="删除后不可恢复。"
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

  return (
    <div>
      <PageHeader
        title="用户管理"
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
              {t('新建用户')}
            </Button>
          </>
        }
      />

      <FilterBar onSearch={runSearch} onReset={reset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="搜索用户名、昵称、邮箱、手机" className="sm:w-72" />
        <TreeSelect
          value={deptId}
          onChange={setDeptId}
          tree={deptTree}
          placeholder="全部部门"
          searchPlaceholder="搜索部门名称 / 编码"
          emptyText="没有匹配的部门"
          aria-label={t('按部门筛选')}
          className="h-8 w-full text-[13px] sm:w-44"
        />
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="状态" />
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
        data={data}
        loading={loading}
        minWidth={1080}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        emptyTitle="没有找到用户"
        emptyDescription={filters.search || filters.status || filters.dept_id ? '换个关键词试试' : '点击右上角「新建用户」添加第一个账号'}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? '编辑用户' : '新建用户'}
        description={editing ? t('正在编辑 {{name}}', { name: editing.username }) : undefined}
        form={form}
        onSubmit={submit}
        footerExtra={
          editing?.totp_enabled ? (
            <ConfirmAction
              title={t('重置 {{name}} 的两步验证？', { name: userDisplayName(editing) })}
              description="用于手机和恢复码都丢失的情况。重置后该用户登录只需要密码；如果所在角色要求两步验证，下次登录时会重新绑定。"
              confirmText="重置"
              onConfirm={() => resetTwoFactor(editing)}
            >
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                <ShieldOff />
                {t('重置两步验证')}
              </Button>
            </ConfirmAction>
          ) : null
        }
      >
        {!editing ? (
          <FormInput control={form.control} name="username" label="用户名" placeholder="例如 zhangsan" rules={{ required: '请输入用户名' }} />
        ) : null}
        <FormInput
          control={form.control}
          name="password"
          type="password"
          autoComplete="new-password"
          label={editing ? '新密码' : '密码'}
          placeholder={editing ? t('留空则不修改（{{rule}}）', { rule: passwordPolicy.hint }) : passwordPolicy.hint}
          rules={editing ? { validate: passwordPolicy.validate } : { required: '请输入密码', validate: passwordPolicy.validate }}
        />
        <ProfileFields control={form.control} name={editing?.username} />
        <FormTreeSelect
          control={form.control}
          name="dept_id"
          label="部门"
          tree={deptTree}
          placeholder="不属于任何部门"
          noneLabel="（无）不属于任何部门"
          searchPlaceholder="搜索部门名称 / 编码"
          emptyText="没有匹配的部门"
        />
        <FormMultiSelect
          control={form.control}
          name="role_ids"
          label="角色"
          options={roleOptions}
          placeholder="选择角色"
          disabled={editingSelf}
          description={editingSelf ? '不能修改自己的角色' : undefined}
        />
      </FormDialog>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="导出用户"
        ruleHint={
          selectedKeys.length
            ? t('已勾选 {{count}} 条，将优先导出勾选数据。', { count: selectedKeys.length })
            : '未勾选数据时，按当前查询条件导出全部结果。'
        }
        fieldOptions={EXPORT_FIELDS}
        defaultFields={['username', 'nickname', 'email', 'dept_name', 'status', 'role_names', 'last_login_at']}
        onConfirm={handleExport}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入用户"
        targetLabel="用户管理"
        onDownloadTemplate={(fileType) =>
          downloadUsersTemplate(normalizeFileType(fileType))
            .then((blob) => {
              downloadBlobFile(blob, `users_import_template.${normalizeFileType(fileType)}`)
              toast.success('模板已下载')
            })
            .catch((err) => toast.apiError(err, '模板下载失败'))
        }
        onImport={(file) => importUsers(file)}
        onImported={(res) => {
          toast.success(t('导入成功：新增 {{created}} 条，更新 {{updated}} 条', { created: res?.created || 0, updated: res?.updated || 0 }))
          fetchData()
        }}
        errorExportFileName="users_import_error_rows.csv"
      />
    </div>
  )
}
