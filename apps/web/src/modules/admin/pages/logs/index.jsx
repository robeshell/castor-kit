import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import { formatDateTime } from '@/lib/format'
import {
  exportLoginLogs,
  exportOperationLogs,
  getLoginLogs,
  getOperationLogs,
} from '@/modules/admin/api/logs'
import DataTable from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import PageHeader from '@/shared/components/PageHeader'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { downloadBlobFile } from '@/shared/utils/file'
import { Trans, useTranslation } from 'react-i18next'

const METHOD_TONE = { POST: 'success', PUT: 'info', DELETE: 'danger', GET: 'neutral' }
const LOGIN_STATUS_OPTIONS = [
  { label: '成功', value: 'success' },
  // The backend writes failed logins as 'failed' (the old page filtered by 'fail' and matched nothing)
  { label: '失败', value: 'failed' },
]
const LOGIN_EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '用户名', value: 'username' },
  { label: '状态', value: 'status' },
  { label: 'IP 地址', value: 'ip' },
  { label: 'User-Agent', value: 'user_agent' },
  { label: '说明', value: 'message' },
  { label: '时间', value: 'created_at' },
]
const OPERATION_EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '用户名', value: 'username' },
  { label: '模块', value: 'module' },
  { label: '操作', value: 'action' },
  { label: '方法', value: 'method' },
  { label: '路径', value: 'path' },
  { label: '目标ID', value: 'target_id' },
  { label: '状态码', value: 'status_code' },
  { label: 'IP 地址', value: 'ip' },
  { label: 'User-Agent', value: 'user_agent' },
  { label: '请求体', value: 'payload' },
  { label: '时间', value: 'created_at' },
]
const normalizeFileType = (raw) => (['csv', 'xls', 'xlsx'].includes(raw) ? raw : 'xlsx')
const withErrorToast = (fetcher) => (params) =>
  fetcher(params).catch((err) => {
    toast.apiError(err, '加载失败')
    return { items: [], total: 0 }
  })

const timeColumn = {
  key: 'created_at',
  title: '时间',
  dataIndex: 'created_at',
  width: 170,
  className: 'text-muted-foreground tabular-nums whitespace-nowrap',
  render: (v) => formatDateTime(v, ''),
}

const LOGIN_COLUMNS = [
  { key: 'id', title: 'ID', dataIndex: 'id', width: 72, className: 'text-muted-foreground tabular-nums' },
  { key: 'username', title: '用户名', dataIndex: 'username', width: 140, className: 'font-medium' },
  { key: 'ip', title: 'IP 地址', dataIndex: 'ip', width: 140, className: 'font-mono text-xs' },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 84,
    render: (v) => (
      <StatusBadge tone={v === 'success' ? 'success' : 'danger'} dot>
        {v === 'success' ? '成功' : '失败'}
      </StatusBadge>
    ),
  },
  {
    // The backend field is message (the old page read a nonexistent fail_reason, so the column was always empty); hidden for successful logins
    key: 'fail_reason',
    title: '失败原因',
    dataIndex: 'message',
    width: 180,
    ellipsis: true,
    render: (v, row) => (row.status === 'success' ? null : v || row.fail_reason),
  },
  { key: 'user_agent', title: 'User-Agent', dataIndex: 'user_agent', ellipsis: true, className: 'text-muted-foreground text-xs' },
  timeColumn,
]

const OPERATION_COLUMNS = [
  { key: 'id', title: 'ID', dataIndex: 'id', width: 72, className: 'text-muted-foreground tabular-nums' },
  { key: 'username', title: '用户名', dataIndex: 'username', width: 120, className: 'font-medium' },
  { key: 'module', title: '模块', dataIndex: 'module', width: 150, ellipsis: true },
  { key: 'action', title: '操作', dataIndex: 'action', width: 100, ellipsis: true },
  {
    key: 'method',
    title: '方法',
    dataIndex: 'method',
    width: 84,
    render: (v) => (v ? <StatusBadge tone={METHOD_TONE[v] || 'neutral'} className="font-mono">{v}</StatusBadge> : null),
  },
  { key: 'path', title: '路径', dataIndex: 'path', ellipsis: true, className: 'font-mono text-xs' },
  {
    key: 'status_code',
    title: '状态码',
    dataIndex: 'status_code',
    width: 84,
    render: (v) =>
      v === null || v === undefined ? null : (
        <StatusBadge tone={v < 300 ? 'success' : 'danger'} className="tabular-nums">
          {v}
        </StatusBadge>
      ),
  },
  timeColumn,
]

function SelectionBar({ count, onClear }) {
  const { t } = useTranslation()
  return (
    <AnimatePresence>
      {count > 0 ? (
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
                values={{ count }}
                components={[<span key="count" className="font-medium tabular-nums" />]}
              />
            </span>
            <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={onClear}>
              <X />
              {t('清空勾选')}
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default function Logs() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('login')

  // Login logs
  const loginList = useCrudList(withErrorToast(getLoginLogs), { defaultPerPage: 20 })
  const [loginUsername, setLoginUsername] = useState('')
  const [loginStatus, setLoginStatus] = useState('')
  const [loginSelectedKeys, setLoginSelectedKeys] = useState([])
  const [loginExportOpen, setLoginExportOpen] = useState(false)

  // Operation logs
  const opList = useCrudList(withErrorToast(getOperationLogs), { defaultPerPage: 20 })
  const [opUsername, setOpUsername] = useState('')
  const [opModule, setOpModule] = useState('')
  const [opSelectedKeys, setOpSelectedKeys] = useState([])
  const [opExportOpen, setOpExportOpen] = useState(false)

  useEffect(() => {
    loginList.handleSearch({ username: '', status: '' })
    opList.handleSearch({ username: '', module: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load both lists once on mount
  }, [])

  const handleLoginSearch = () => {
    setLoginSelectedKeys([])
    loginList.handleSearch({ username: loginUsername, status: loginStatus })
  }
  const handleLoginReset = () => {
    setLoginUsername('')
    setLoginStatus('')
    setLoginSelectedKeys([])
    loginList.handleReset()
  }
  const handleOpSearch = () => {
    setOpSelectedKeys([])
    opList.handleSearch({ username: opUsername, module: opModule })
  }
  const handleOpReset = () => {
    setOpUsername('')
    setOpModule('')
    setOpSelectedKeys([])
    opList.handleReset()
  }

  const handleLoginExport = async ({ fields, fileType }) => {
    const type = normalizeFileType(fileType)
    const payload = { fields, file_type: type, export_mode: loginSelectedKeys.length ? 'selected' : 'filtered' }
    if (loginSelectedKeys.length) payload.ids = loginSelectedKeys
    else payload.filters = { username: loginList.filters.username ?? '', status: loginList.filters.status ?? '' }
    try {
      const blob = await exportLoginLogs(payload)
      downloadBlobFile(blob, `login_logs_export.${type}`)
      setLoginExportOpen(false)
      toast.success('导出成功')
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  const handleOperationExport = async ({ fields, fileType }) => {
    const type = normalizeFileType(fileType)
    const payload = { fields, file_type: type, export_mode: opSelectedKeys.length ? 'selected' : 'filtered' }
    if (opSelectedKeys.length) payload.ids = opSelectedKeys
    else payload.filters = { username: opList.filters.username ?? '', module: opList.filters.module ?? '' }
    try {
      const blob = await exportOperationLogs(payload)
      downloadBlobFile(blob, `operation_logs_export.${type}`)
      setOpExportOpen(false)
      toast.success('导出成功')
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  const isLogin = tab === 'login'
  const tabItems = [
    { value: 'login', label: '登录日志', count: loginList.total },
    { value: 'operation', label: '操作日志', count: opList.total },
  ]

  return (
    <div>
      <PageHeader
        title="日志管理"
        actions={
          <Button variant="outline" size="sm" onClick={() => (isLogin ? setLoginExportOpen(true) : setOpExportOpen(true))}>
            <Download />
            {t('导出')}
          </Button>
        }
      />

      <SegmentedTabs value={tab} onChange={setTab} items={tabItems} className="mb-4" />

      {/* Keep both tabs mounted so each keeps its filters, page and selection when switching */}
      <div hidden={!isLogin}>
        <FilterBar onSearch={handleLoginSearch} onReset={handleLoginReset}>
          <SearchInput value={loginUsername} onChange={setLoginUsername} onSubmit={handleLoginSearch} placeholder="搜索用户名" className="sm:w-48" />
          <FilterSelect value={loginStatus} onChange={setLoginStatus} options={LOGIN_STATUS_OPTIONS} placeholder="登录状态" allLabel="全部状态" />
        </FilterBar>
        <SelectionBar count={loginSelectedKeys.length} onClear={() => setLoginSelectedKeys([])} />
        <DataTable
          columns={LOGIN_COLUMNS}
          data={loginList.data}
          loading={loginList.loading}
          selectable
          selectedKeys={loginSelectedKeys}
          onSelectionChange={setLoginSelectedKeys}
          minWidth={960}
          pagination={{ page: loginList.page, perPage: loginList.perPage, total: loginList.total, onChange: loginList.handlePageChange }}
          emptyTitle="暂无登录日志"
          emptyDescription={loginList.filters.username || loginList.filters.status ? '换个筛选条件试试' : undefined}
        />
      </div>

      <div hidden={isLogin}>
        <FilterBar onSearch={handleOpSearch} onReset={handleOpReset}>
          <SearchInput value={opUsername} onChange={setOpUsername} onSubmit={handleOpSearch} placeholder="搜索用户名" className="sm:w-48" />
          <Input
            value={opModule}
            onChange={(e) => setOpModule(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleOpSearch()
            }}
            placeholder={t('模块名')}
            className="h-8 w-full text-[13px] sm:w-36"
          />
        </FilterBar>
        <SelectionBar count={opSelectedKeys.length} onClear={() => setOpSelectedKeys([])} />
        <DataTable
          columns={OPERATION_COLUMNS}
          data={opList.data}
          loading={opList.loading}
          selectable
          selectedKeys={opSelectedKeys}
          onSelectionChange={setOpSelectedKeys}
          minWidth={1080}
          pagination={{ page: opList.page, perPage: opList.perPage, total: opList.total, onChange: opList.handlePageChange }}
          emptyTitle="暂无操作日志"
          emptyDescription={opList.filters.username || opList.filters.module ? '换个筛选条件试试' : undefined}
        />
      </div>

      <ExportDialog
        open={loginExportOpen}
        onOpenChange={setLoginExportOpen}
        title="登录日志导出字段"
        ruleHint={
          loginSelectedKeys.length
            ? t('已勾选 {{count}} 条，将优先导出勾选数据', { count: loginSelectedKeys.length })
            : '未勾选数据时，将按当前查询条件导出全部结果'
        }
        fieldOptions={LOGIN_EXPORT_FIELDS}
        defaultFields={['username', 'status', 'ip', 'message', 'created_at']}
        onConfirm={handleLoginExport}
      />

      <ExportDialog
        open={opExportOpen}
        onOpenChange={setOpExportOpen}
        title="操作日志导出字段"
        ruleHint={
          opSelectedKeys.length ? t('已勾选 {{count}} 条，将优先导出勾选数据', { count: opSelectedKeys.length }) : '未勾选数据时，将按当前查询条件导出全部结果'
        }
        fieldOptions={OPERATION_EXPORT_FIELDS}
        defaultFields={['username', 'module', 'action', 'method', 'path', 'status_code', 'created_at']}
        onConfirm={handleOperationExport}
      />
    </div>
  )
}
