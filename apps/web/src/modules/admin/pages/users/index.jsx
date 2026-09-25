import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import { Trans, useTranslation } from 'react-i18next'
import { Download, Plus, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { formatDateTime } from '@/lib/format'
import { getRoles } from '@/modules/admin/api/roles'
import {
  createUser,
  deleteUser,
  downloadUsersTemplate,
  exportUsers,
  getUsers,
  importUsers,
  updateUser,
} from '@/modules/admin/api/users'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import { FilterBar, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormInput, FormMultiSelect } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { downloadBlobFile } from '@/shared/utils/file'

const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '用户名', value: 'username' },
  { label: '角色名称', value: 'role_names' },
  { label: '角色编码', value: 'role_codes' },
  { label: '创建时间', value: 'created_at' },
]
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
  const [roles, setRoles] = useState([])
  const [selectedKeys, setSelectedKeys] = useState([])
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm({ defaultValues: { username: '', password: '', role_ids: [] } })

  useEffect(() => {
    fetchData()
    getRoles()
      .then((res) => setRoles(Array.isArray(res) ? res : []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const roleOptions = useMemo(() => roles.map((r) => ({ label: r.name, value: r.id })), [roles])

  const openCreate = () => {
    setEditing(null)
    form.reset({ username: '', password: '', role_ids: [] })
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.reset({ username: record.username, password: '', role_ids: record.roles?.map((r) => r.id) || [] })
    setFormOpen(true)
  }

  const submit = async (values) => {
    try {
      if (editing) {
        const payload = { role_ids: values.role_ids }
        if (values.password) payload.password = values.password
        await updateUser(editing.id, payload)
        toast.success('用户已更新')
      } else {
        await createUser({ username: values.username, password: values.password, role_ids: values.role_ids })
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

  const runSearch = () => {
    setSelectedKeys([])
    list.handleSearch({ search: search.trim() })
  }
  const reset = () => {
    setSearch('')
    setSelectedKeys([])
    list.handleReset()
  }

  const handleExport = async ({ fields, fileType }) => {
    const type = normalizeFileType(fileType)
    const payload = { fields, file_type: type, export_mode: selectedKeys.length ? 'selected' : 'filtered' }
    if (selectedKeys.length) payload.ids = selectedKeys
    else payload.filters = { search: filters.search ?? '' }
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
      title: '用户名',
      dataIndex: 'username',
      render: (value) => (
        <div className="flex items-center gap-2.5">
          <span className="bg-muted ring-border flex size-7 items-center justify-center rounded-full text-xs font-medium ring-1">
            {(value || '?').slice(0, 1).toUpperCase()}
          </span>
          <span className="font-medium">{value}</span>
        </div>
      ),
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
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      className: 'text-muted-foreground tabular-nums',
      render: (value) => formatDateTime(value),
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
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="搜索用户名" />
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
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        emptyTitle="没有找到用户"
        emptyDescription={filters.search ? '换个关键词试试' : '点击右上角「新建用户」添加第一个账号'}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? '编辑用户' : '新建用户'}
        description={editing ? t('正在编辑 {{name}}', { name: editing.username }) : undefined}
        form={form}
        onSubmit={submit}
        size="sm"
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
          placeholder={editing ? '留空则不修改' : '请输入密码'}
          rules={editing ? undefined : { required: '请输入密码' }}
        />
        <FormMultiSelect
          control={form.control}
          name="role_ids"
          label="角色"
          options={roleOptions}
          placeholder="选择角色"
          disabled={editing?.username === 'admin'}
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
        defaultFields={['username', 'role_names', 'created_at']}
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
