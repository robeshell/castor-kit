import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Info, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime, formatRelative } from '@/lib/format'
import { menuLabel } from '@/lib/menu-label'
import { toast } from '@/lib/toast'
import { userDisplayName } from '@/lib/user'
import { getApiTokens, getMyApiTokens, revokeApiToken } from '@/modules/admin/api/api_tokens'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'

const STATUS_OPTIONS = [
  { label: '有效', value: 'active' },
  { label: '已过期', value: 'expired' },
  { label: '已吊销', value: 'revoked' },
]
const STATUS_BADGE = {
  active: { tone: 'success', label: '有效' },
  expired: { tone: 'neutral', label: '已过期' },
  revoked: { tone: 'danger', label: '已吊销' },
}

function tokenStatus(token) {
  if (token.revoked_at) return 'revoked'
  if (token.expires_at && new Date(token.expires_at) <= new Date()) return 'expired'
  return 'active'
}

/**
 * Every API token in the admin's data scope (by creator). Users create their own tokens in the profile;
 * here they can be reviewed and revoked (system_api_tokens_revoke), e.g. after someone leaves or a token leaked.
 */
export default function ApiTokens() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const canRevoke = hasPermission('system_api_tokens_revoke')
  const list = useCrudList(
    (params) =>
      getApiTokens(params).catch((err) => {
        toast.apiError(err, '加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    fetchData()
    getMyApiTokens()
      .then((res) => setEnabled(res.enabled))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const revoke = async (record) => {
    try {
      await revokeApiToken(record.id)
      toast.success('已吊销')
      fetchData(page)
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const runSearch = () => list.handleSearch({ search: search.trim(), status })
  const reset = () => {
    setSearch('')
    setStatus('')
    list.handleReset()
  }

  const columns = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      minWidth: 180,
      render: (value, record) => (
        <div className="grid min-w-0 leading-tight">
          <span className="truncate font-medium">{value}</span>
          <code className="text-muted-foreground truncate font-mono text-xs">{record.token_prefix}…</code>
        </div>
      ),
    },
    {
      key: 'creator',
      title: '创建人',
      dataIndex: 'creator_username',
      minWidth: 120,
      render: (value, record) => (
        <span className="truncate">
          {userDisplayName({
            username: value,
            nickname: record.creator_nickname,
          })}
        </span>
      ),
    },
    {
      key: 'scopes',
      title: '权限',
      dataIndex: 'scopes',
      width: 110,
      render: (value = []) => (
        <span className="text-muted-foreground tabular-nums" title={value.map((code) => menuLabel({ code, name: code })).join('\n')}>
          {t('{{count}} 项', { count: value.length })}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 96,
      render: (_, record) => {
        const badge = STATUS_BADGE[tokenStatus(record)]
        return (
          <StatusBadge tone={badge.tone} dot>
            {badge.label}
          </StatusBadge>
        )
      },
    },
    {
      key: 'expires_at',
      title: '到期时间',
      dataIndex: 'expires_at',
      width: 160,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (value) => (value ? formatDateTime(value) : t('永不过期')),
    },
    {
      key: 'last_used_at',
      title: '最近使用',
      dataIndex: 'last_used_at',
      minWidth: 150,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (value, record) =>
        value ? (
          <span title={formatDateTime(value)}>
            {formatRelative(value)}
            {record.last_used_ip ? ` · ${record.last_used_ip}` : ''}
          </span>
        ) : (
          t('从未使用')
        ),
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 80,
      render: (_, record) =>
        canRevoke && tokenStatus(record) === 'active' ? (
          <ConfirmAction
            title={t('吊销「{{name}}」？', { name: record.name })}
            description="使用它的脚本或系统会立即无法调用接口。"
            confirmText="吊销"
            onConfirm={() => revoke(record)}
          >
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              {t('吊销')}
            </Button>
          </ConfirmAction>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader
        title="API Token"
        description={loading ? undefined : t('共 {{count}} 个 Token', { count: total })}
        actions={
          <Button variant="outline" size="sm" onClick={() => fetchData(page)}>
            <RefreshCw />
            {t('刷新')}
          </Button>
        }
      />
      {!enabled ? (
        <div className="bg-info-soft text-foreground mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs leading-relaxed">
          <Info className="text-info mt-0.5 size-3.5 shrink-0" />
          <span>
            {t('API Token 当前未开启：所有 Token 都不能使用，用户也不能创建。')}
            {hasPermission('system_settings') ? (
              <Link to="/system/settings" className="text-primary ml-1 font-medium hover:underline">
                {t('到系统设置开启')}
              </Link>
            ) : null}
          </span>
        </div>
      ) : null}
      <FilterBar onSearch={runSearch} onReset={reset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="搜索名称、前缀、创建人" className="sm:w-72" />
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="状态" />
      </FilterBar>
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        minWidth={1000}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        emptyTitle="还没有 API Token"
        emptyDescription={filters.search || filters.status ? '换个条件试试' : '用户可以在「个人设置」里创建自己的 Token'}
      />
    </div>
  )
}
