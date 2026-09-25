import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Check, CheckCheck, ChevronsUpDown, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { FormControl } from '@/components/ui/form'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from '@/lib/toast'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { createNotification, deleteNotification, getNotifications, markAllAsRead, markAsRead } from '@/modules/admin/api/notifications'
import { getUsers } from '@/modules/admin/api/users'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormCustom, FormInput, FormSelect, FormSwitch, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'

const TYPE_TONE_MAP = { info: 'info', success: 'success', warning: 'warning', error: 'danger' }
const TYPE_LABEL_MAP = { info: '信息', success: '成功', warning: '警告', error: '错误' }
const FILTER_ITEMS = [
  { label: '全部', value: 'all' },
  { label: '未读', value: 'false' },
  { label: '已读', value: 'true' },
]
const TYPE_OPTIONS = [
  { label: '信息 (info)', value: 'info' },
  { label: '成功 (success)', value: 'success' },
  { label: '警告 (warning)', value: 'warning' },
  { label: '错误 (error)', value: 'error' },
]
const DEFAULT_VALUES = { title: '', content: '', noti_type: 'info', link: '', is_global: true }

/** 可搜索单选，用于“指定用户” */
function SearchableSelect({ value, onChange, options, placeholder, invalid }) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => String(o.value) === String(value))
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FormControl>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            className="h-9 w-full justify-between px-3 font-normal"
          >
            <span className={cn('truncate', !current && 'text-muted-foreground')}>{current ? current.label : placeholder}</span>
            <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索用户名…" />
          <CommandList>
            <CommandEmpty>没有匹配的用户</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={String(opt.value)}
                  value={`${opt.label} ${opt.value}`}
                  onSelect={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('size-4', String(opt.value) === String(value) ? 'opacity-100' : 'opacity-0')} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function Notifications() {
  const list = useCrudList(
    (params) =>
      getNotifications(params).catch(() => {
        toast.error('加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handleSearch, handlePageChange } = list
  const [formOpen, setFormOpen] = useState(false)
  const [users, setUsers] = useState([])

  // shouldUnregister：隐藏（已卸载）的“指定用户”字段不进入提交数据
  const form = useForm({ defaultValues: DEFAULT_VALUES, shouldUnregister: true })
  const isGlobal = useWatch({ control: form.control, name: 'is_global' })

  useEffect(() => {
    handleSearch({ is_read: 'all' })
    getUsers({ page: 1, per_page: 100 })
      .then((res) => setUsers(Array.isArray(res.items) ? res.items : []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首次加载
  }, [])

  const userOptions = useMemo(() => users.map((u) => ({ label: u.username, value: u.id })), [users])

  const handleMarkRead = (id) => {
    markAsRead(id)
      .then(() => {
        toast.success('已标记为已读')
        fetchData()
      })
      .catch((err) => toast.apiError(err, '操作失败'))
  }

  const handleMarkAllRead = () => {
    markAllAsRead()
      .then((res) => {
        toast.success(`已将 ${res?.marked ?? 0} 条通知标记为已读`)
        fetchData()
      })
      .catch((err) => toast.apiError(err, '操作失败'))
  }

  const remove = async (record) => {
    try {
      await deleteNotification(record.id)
      toast.success('删除成功')
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const openCreate = () => {
    form.reset(DEFAULT_VALUES)
    setFormOpen(true)
  }

  const submit = async (values) => {
    try {
      await createNotification(values)
      toast.success('通知创建成功')
      setFormOpen(false)
      handleSearch()
    } catch (err) {
      toast.apiError(err, '创建失败')
      throw err
    }
  }

  const columns = [
    {
      key: 'noti_type',
      title: '类型',
      dataIndex: 'noti_type',
      width: 80,
      render: (v) => <StatusBadge tone={TYPE_TONE_MAP[v] || 'info'}>{TYPE_LABEL_MAP[v] || v}</StatusBadge>,
    },
    {
      key: 'title',
      title: '标题',
      dataIndex: 'title',
      width: 260,
      render: (v, record) => (
        <span className={cn('flex items-center gap-2', record.is_read ? 'text-muted-foreground' : 'text-foreground font-semibold')}>
          {!record.is_read ? <span className="bg-primary size-1.5 shrink-0 rounded-full" aria-hidden /> : null}
          <span className="truncate">{v}</span>
        </span>
      ),
    },
    { key: 'content', title: '内容', dataIndex: 'content', ellipsis: true, className: 'text-muted-foreground' },
    {
      key: 'is_read',
      title: '状态',
      dataIndex: 'is_read',
      width: 80,
      render: (v) => (v ? <StatusBadge tone="neutral">已读</StatusBadge> : <StatusBadge tone="brand">未读</StatusBadge>),
    },
    {
      key: 'created_at',
      title: '时间',
      dataIndex: 'created_at',
      width: 170,
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
          {!record.is_read ? (
            <Button variant="ghost" size="sm" className="h-7 px-2" title="标记为已读" onClick={() => handleMarkRead(record.id)}>
              已读
            </Button>
          ) : null}
          <ConfirmAction title="确认删除该通知？" description="删除后不可恢复" confirmText="删除" onConfirm={() => remove(record)}>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              删除
            </Button>
          </ConfirmAction>
        </div>
      ),
    },
  ]

  const readFilter = filters.is_read ?? 'all'

  return (
    <div>
      <PageHeader
        title="消息通知"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck />
              全部已读
            </Button>
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              新建通知
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <SegmentedTabs variant="pill" value={readFilter} onChange={(val) => handleSearch({ is_read: val })} items={FILTER_ITEMS} />
        <Button variant="ghost" size="sm" className="text-muted-foreground h-8" onClick={() => fetchData()}>
          <RefreshCw className={cn(loading && 'animate-spin')} />
          刷新
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        minWidth={820}
        rowClassName={(record) => (!record.is_read ? 'bg-brand-soft/40' : undefined)}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        emptyTitle={readFilter === 'false' ? '没有未读通知' : '暂无通知'}
        emptyDescription={readFilter === 'all' ? '点击右上角「新建通知」发送一条' : undefined}
      />

      <FormDialog open={formOpen} onOpenChange={setFormOpen} title="新建通知" form={form} onSubmit={submit}>
        <FormInput control={form.control} name="title" label="标题" placeholder="请输入通知标题" rules={{ required: '请输入通知标题' }} />
        <FormTextarea control={form.control} name="content" label="内容" placeholder="请输入通知内容（可选）" rows={4} inputClassName="min-h-20 max-h-40" />
        <FormSelect control={form.control} name="noti_type" label="类型" options={TYPE_OPTIONS} />
        <FormInput control={form.control} name="link" label="跳转链接" placeholder="可选，如 /system/users" inputClassName="font-mono text-[13px]" />
        <FormSwitch control={form.control} name="is_global" label="全局通知" description="关闭后仅发送给指定用户" />
        {!isGlobal ? (
          <FormCustom
            control={form.control}
            name="user_id"
            label="指定用户"
            rules={{ required: '请选择目标用户' }}
            render={({ value, onChange, fieldState }) => (
              <SearchableSelect
                value={value}
                onChange={onChange}
                options={userOptions}
                placeholder="请选择目标用户"
                invalid={Boolean(fieldState.error)}
              />
            )}
          />
        ) : null}
      </FormDialog>
    </div>
  )
}
