import { useEffect, useState } from 'react'
import { Monitor, RefreshCw, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime, formatRelative } from '@/lib/format'
import { toast } from '@/lib/toast'
import { userDisplayName } from '@/lib/user'
import { describeUserAgent } from '@/lib/user-agent'
import { getSessions, revokeSession } from '@/modules/admin/api/sessions'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import { FilterBar, SearchInput } from '@/shared/components/Filters'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'

/**
 * Online users: every signed-in session the admin's data scope covers, most recently active first.
 * Force sign-out (system_sessions_revoke) ends a session at once: its next request gets 401.
 */
export default function Sessions() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const canRevoke = hasPermission('system_sessions_revoke')
  const list = useCrudList(
    (params) =>
      getSessions(params).catch((err) => {
        toast.apiError(err, '加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const revoke = async (record) => {
    try {
      await revokeSession(record.key)
      toast.success('已下线')
      fetchData(page)
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const runSearch = () => list.handleSearch({ search: search.trim() })
  const reset = () => {
    setSearch('')
    list.handleReset()
  }

  const columns = [
    {
      key: 'user',
      title: '用户',
      dataIndex: 'username',
      minWidth: 160,
      render: (value, record) => (
        <div className="grid min-w-0 leading-tight">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium">{userDisplayName(record)}</span>
            {record.current ? <StatusBadge tone="success">{t('当前会话')}</StatusBadge> : null}
          </span>
          {record.nickname ? <span className="text-muted-foreground truncate text-xs">@{value}</span> : null}
        </div>
      ),
    },
    {
      key: 'device',
      title: '设备',
      dataIndex: 'user_agent',
      minWidth: 180,
      render: (value) => {
        const device = describeUserAgent(value)
        const Icon = device.mobile ? Smartphone : Monitor
        return (
          <span className="flex min-w-0 items-center gap-2" title={value || undefined}>
            <Icon className="text-muted-foreground size-3.5 shrink-0" />
            <span className="truncate">{device.label || t('未知设备')}</span>
          </span>
        )
      },
    },
    { key: 'ip', title: 'IP', dataIndex: 'ip', width: 130, className: 'text-muted-foreground tabular-nums' },
    {
      key: 'created_at',
      title: '登录时间',
      dataIndex: 'created_at',
      width: 160,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'last_seen_at',
      title: '最近活动',
      dataIndex: 'last_seen_at',
      width: 100,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (value) => <span title={formatDateTime(value)}>{formatRelative(value)}</span>,
    },
    {
      key: 'expires_at',
      title: '到期时间',
      dataIndex: 'expires_at',
      width: 160,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 96,
      render: (_, record) =>
        canRevoke && !record.current ? (
          <ConfirmAction
            title={t('强制 {{name}} 下线？', { name: userDisplayName(record) })}
            description="该会话会立即失效，对方下一次操作时回到登录页。"
            confirmText="强制下线"
            onConfirm={() => revoke(record)}
          >
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              {t('强制下线')}
            </Button>
          </ConfirmAction>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader
        title="在线用户"
        description={loading ? undefined : t('共 {{count}} 个会话', { count: total })}
        actions={
          <Button variant="outline" size="sm" onClick={() => fetchData(page)}>
            <RefreshCw />
            {t('刷新')}
          </Button>
        }
      />
      <FilterBar onSearch={runSearch} onReset={reset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="搜索用户名、昵称、IP" className="sm:w-72" />
      </FilterBar>
      <DataTable
        columns={columns}
        data={data}
        rowKey="key"
        loading={loading}
        minWidth={920}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        emptyTitle="没有在线的会话"
        emptyDescription={filters.search ? '换个关键词试试' : undefined}
      />
    </div>
  )
}
