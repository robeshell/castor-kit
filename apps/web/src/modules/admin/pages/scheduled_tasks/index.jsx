import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { History, Play, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/lib/toast'
import { formatDateTime } from '@/lib/format'
import {
  createScheduledTask,
  deleteScheduledTask,
  getScheduledTaskList,
  getScheduledTaskRunLogs,
  runScheduledTaskNow,
  updateScheduledTask,
} from '@/modules/admin/api/scheduled_tasks'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { DetailSheet, FormDialog } from '@/shared/components/FormDialog'
import { FormGrid, FormInput, FormNumber, FormSelect, FormSwitch, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { useTranslation } from 'react-i18next'

const STATUS_OPTIONS = [
  { label: 'idle', value: 'idle' },
  { label: 'running', value: 'running' },
  { label: 'success', value: 'success' },
  { label: 'failed', value: 'failed' },
]
const ACTIVE_OPTIONS = [
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
]
const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => ({ label: m, value: m }))
const DEFAULT_VALUES = {
  name: '',
  task_code: '',
  cron_expression: '',
  request_method: 'GET',
  request_url: '',
  timeout_seconds: 10,
  request_headers: '{"Content-Type":"application/json"}',
  request_body: '',
  is_active: true,
  remark: '',
}
const RUN_PER_PAGE = 20

const statusTone = (status) => {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'info'
  return 'neutral'
}

const RUN_COLUMNS = [
  { key: 'id', title: 'ID', dataIndex: 'id', width: 64, className: 'text-muted-foreground tabular-nums' },
  { key: 'task_name', title: '任务', dataIndex: 'task_name', width: 140, className: 'font-medium' },
  { key: 'task_code', title: '任务编码', dataIndex: 'task_code', width: 160, ellipsis: true, className: 'font-mono text-xs' },
  { key: 'trigger_type', title: '触发方式', dataIndex: 'trigger_type', width: 84 },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    width: 90,
    render: (v) => (v ? <StatusBadge tone={statusTone(v)} dot>{v}</StatusBadge> : null),
  },
  { key: 'response_status', title: '响应码', dataIndex: 'response_status', width: 72, className: 'tabular-nums', render: (v) => v || '-' },
  { key: 'duration_ms', title: '耗时(ms)', dataIndex: 'duration_ms', width: 84, align: 'right', className: 'tabular-nums', render: (v) => v || 0 },
  { key: 'started_at', title: '开始时间', dataIndex: 'started_at', width: 160, className: 'text-muted-foreground tabular-nums whitespace-nowrap', render: (v) => formatDateTime(v) },
  { key: 'finished_at', title: '结束时间', dataIndex: 'finished_at', width: 160, className: 'text-muted-foreground tabular-nums whitespace-nowrap', render: (v) => formatDateTime(v) },
  { key: 'error_message', title: '错误信息', dataIndex: 'error_message', width: 220, ellipsis: true, className: 'text-danger text-xs', render: (v) => v || '-' },
]

export default function ScheduledTasks() {
  const { t } = useTranslation()
  const list = useCrudList(
    (params) =>
      getScheduledTaskList(params).catch(() => {
        toast.error('加载定时任务失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [isActive, setIsActive] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [runningTaskId, setRunningTaskId] = useState(null)

  const [runsOpen, setRunsOpen] = useState(false)
  const [runLogs, setRunLogs] = useState([])
  const [runLogsTotal, setRunLogsTotal] = useState(0)
  const [runLogsLoading, setRunLogsLoading] = useState(true)
  const [runLogsPage, setRunLogsPage] = useState(1)

  const form = useForm({ defaultValues: DEFAULT_VALUES })
  const remarkLength = (useWatch({ control: form.control, name: 'remark' }) || '').length

  const loadRunLogs = (nextPage) =>
    getScheduledTaskRunLogs({ page: nextPage, per_page: RUN_PER_PAGE })
      .then((res) => {
        setRunLogs(res.items || [])
        setRunLogsTotal(res.total || 0)
        setRunLogsPage(nextPage)
      })
      .catch(() => toast.error('加载执行记录失败'))
      .finally(() => setRunLogsLoading(false))

  const fetchRunLogs = (nextPage = 1) => {
    setRunLogsLoading(true)
    return loadRunLogs(nextPage)
  }

  useEffect(() => {
    fetchData()
    loadRunLogs(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [])

  const handleSearch = () => {
    list.handleSearch({ search: search.trim(), status: status || '', is_active: isActive || '' })
  }
  const handleReset = () => {
    setSearch('')
    setStatus('')
    setIsActive('')
    list.handleReset()
  }

  const openCreate = () => {
    setEditing(null)
    form.reset(DEFAULT_VALUES)
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.reset({
      name: record.name ?? '',
      task_code: record.task_code ?? '',
      cron_expression: record.cron_expression ?? '',
      request_method: record.request_method || 'GET',
      request_url: record.request_url ?? '',
      timeout_seconds: record.timeout_seconds ?? 10,
      request_headers:
        record.request_headers && typeof record.request_headers === 'object'
          ? JSON.stringify(record.request_headers)
          : record.request_headers ?? '',
      request_body: record.request_body ?? '',
      is_active: Boolean(record.is_active),
      remark: record.remark ?? '',
    })
    setFormOpen(true)
  }

  const submit = async (values) => {
    const payload = {
      ...values,
      name: (values.name || '').trim(),
      task_code: (values.task_code || '').trim(),
      cron_expression: (values.cron_expression || '').trim(),
      request_url: (values.request_url || '').trim(),
      request_headers: (values.request_headers || '').trim(),
      request_body: (values.request_body || '').trim(),
      remark: (values.remark || '').trim(),
    }
    try {
      if (editing) await updateScheduledTask(editing.id, payload)
      else await createScheduledTask(payload)
      toast.success(editing ? '更新成功' : '创建成功')
      setFormOpen(false)
      fetchData()
    } catch (err) {
      toast.apiError(err, '保存失败')
      throw err
    }
  }

  const remove = async (record) => {
    try {
      await deleteScheduledTask(record.id)
      toast.success('删除成功')
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const handleRunNow = (record) => {
    setRunningTaskId(record.id)
    runScheduledTaskNow(record.id)
      .then((res) => {
        if (res?.run?.status === 'success') toast.success('执行成功')
        else toast.warning(res?.error || '执行失败')
        fetchData()
        fetchRunLogs(runLogsPage)
      })
      .catch((err) => {
        toast.apiError(err, '执行失败')
        // A failed run is still logged and updates the task status on the backend, so refresh both here
        fetchData()
        fetchRunLogs(runLogsPage)
      })
      .finally(() => setRunningTaskId(null))
  }

  const openRuns = () => {
    setRunsOpen(true)
    fetchRunLogs(runLogsPage)
  }

  const columns = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 64, className: 'text-muted-foreground tabular-nums' },
    { key: 'name', title: '任务名称', dataIndex: 'name', width: 160, className: 'font-medium' },
    {
      key: 'task_code',
      title: '任务编码',
      dataIndex: 'task_code',
      width: 170,
      render: (v) => (v ? <StatusBadge tone="neutral" className="font-mono">{v}</StatusBadge> : null),
    },
    {
      key: 'cron_expression',
      title: 'Cron 表达式',
      dataIndex: 'cron_expression',
      width: 140,
      render: (v) => (v ? <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{v}</code> : null),
    },
    { key: 'request_method', title: '方法', dataIndex: 'request_method', width: 72, className: 'font-mono text-xs' },
    { key: 'request_url', title: '请求地址', dataIndex: 'request_url', width: 240, ellipsis: true, className: 'text-muted-foreground text-xs' },
    {
      key: 'last_status',
      title: '状态',
      dataIndex: 'last_status',
      width: 96,
      render: (v) => (
        <StatusBadge tone={statusTone(v)} dot>
          {v || 'idle'}
        </StatusBadge>
      ),
    },
    { key: 'next_run_at', title: '下次执行', dataIndex: 'next_run_at', width: 160, className: 'tabular-nums whitespace-nowrap', render: (v) => formatDateTime(v) },
    {
      key: 'last_run_at',
      title: '最近执行',
      dataIndex: 'last_run_at',
      width: 160,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (v) => formatDateTime(v),
    },
    { key: 'run_count', title: '执行次数', dataIndex: 'run_count', width: 80, align: 'right', className: 'tabular-nums', render: (v) => v || 0 },
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
      // Many columns scroll horizontally: pin the action column to the right
      key: 'actions',
      title: '',
      align: 'right',
      width: 196,
      // A sticky column needs an opaque background: bg-card underneath, plus the same muted/40 overlay as the header / row hover
      className:
        'sticky right-0 bg-card shadow-[inset_1px_0_0_var(--border)] group-hover/row:bg-linear-to-r group-hover/row:from-muted/40 group-hover/row:to-muted/40',
      headerClassName: 'sticky right-0 bg-card bg-linear-to-r from-muted/40 to-muted/40 shadow-[inset_1px_0_0_var(--border)]',
      render: (_, record) => (
        <div className="flex justify-end gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary h-7 px-2"
            disabled={runningTaskId === record.id}
            onClick={() => handleRunNow(record)}
          >
            {runningTaskId === record.id ? <Spinner /> : <Play />}
            {t('立即执行')}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>
            {t('编辑')}
          </Button>
          <ConfirmAction title="确认删除该定时任务？" description="删除后不可恢复" confirmText="删除" onConfirm={() => remove(record)}>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              {t('删除')}
            </Button>
          </ConfirmAction>
        </div>
      ),
    },
  ]

  const hasFilters = Boolean(filters.search || filters.status || filters.is_active)

  return (
    <div>
      <PageHeader
        title="定时任务"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={openRuns}>
              <History />
              {t('执行记录')}
              {runLogsTotal ? (
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[11px] font-normal tabular-nums">{runLogsTotal}</span>
              ) : null}
            </Button>
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              {t('新建任务')}
            </Button>
          </>
        }
      />

      <FilterBar onSearch={handleSearch} onReset={handleReset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={handleSearch} placeholder="任务名称/编码/请求地址" className="sm:w-72" />
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="执行状态" allLabel="全部执行状态" />
        <FilterSelect value={isActive} onChange={setIsActive} options={ACTIVE_OPTIONS} placeholder="启用状态" allLabel="全部启用状态" />
      </FilterBar>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        minWidth={1740}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        emptyTitle="暂无定时任务"
        emptyDescription={hasFilters ? '换个筛选条件试试' : '点击右上角「新建任务」创建第一个定时任务'}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? '编辑定时任务' : '新建定时任务'}
        description={editing ? t('正在编辑 {{name}}', { name: editing.name }) : undefined}
        form={form}
        onSubmit={submit}
        size="lg"
      >
        <FormGrid>
          <FormInput control={form.control} name="name" label="任务名称" rules={{ required: '请输入任务名称' }} />
          <FormInput
            control={form.control}
            name="task_code"
            label="任务编码"
            placeholder="例如：sync_orders_job"
            rules={{ required: '请输入任务编码' }}
            disabled={Boolean(editing)}
            inputClassName="font-mono"
          />
          <FormInput
            control={form.control}
            name="cron_expression"
            label="Cron 表达式"
            placeholder="例如：*/5 * * * *"
            rules={{ required: '请输入 Cron 表达式' }}
            inputClassName="font-mono"
          />
          <FormNumber
            control={form.control}
            name="timeout_seconds"
            label="超时(秒)"
            rules={{
              min: { value: 1, message: '超时时间范围为 1–120 秒' },
              max: { value: 120, message: '超时时间范围为 1–120 秒' },
            }}
          />
        </FormGrid>
        <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <FormSelect control={form.control} name="request_method" label="请求方法" options={METHOD_OPTIONS} />
          <FormInput
            control={form.control}
            name="request_url"
            label="请求地址"
            placeholder="例如：https://api.example.com/tasks/sync"
            rules={{ required: '请输入请求地址' }}
            inputClassName="font-mono text-[13px]"
          />
        </div>
        <FormTextarea
          control={form.control}
          name="request_headers"
          label="请求头(JSON)"
          placeholder='例如：{"Content-Type":"application/json","Authorization":"Bearer xxx"}'
          rows={3}
          inputClassName="min-h-16 font-mono text-xs"
        />
        <FormTextarea
          control={form.control}
          name="request_body"
          label="请求体"
          placeholder='例如：{"biz_date":"2026-03-19"}'
          rows={3}
          inputClassName="min-h-16 font-mono text-xs"
        />
        <FormSwitch control={form.control} name="is_active" label="启用任务" description="停用后不会再按 Cron 自动触发" />
        <FormTextarea control={form.control} name="remark" label="备注" rows={2} description={`${remarkLength} / 500`} />
      </FormDialog>

      <DetailSheet
        open={runsOpen}
        onOpenChange={setRunsOpen}
        title="执行记录"
        width={1040}
        footer={
          <Button variant="outline" size="sm" onClick={() => fetchRunLogs(1)} disabled={runLogsLoading}>
            {runLogsLoading ? <Spinner /> : <RefreshCw />}
            {t('刷新记录')}
          </Button>
        }
      >
        <DataTable
          columns={RUN_COLUMNS}
          data={runLogs}
          loading={runLogsLoading}
          dense
          minWidth={1240}
          pagination={{ page: runLogsPage, perPage: RUN_PER_PAGE, total: runLogsTotal, onChange: (p) => fetchRunLogs(p) }}
          emptyTitle="暂无执行记录"
          emptyDescription="任务被定时触发或手动执行后会出现在这里"
        />
      </DetailSheet>
    </div>
  )
}
