import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, RefreshCw, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { formatDateTime, formatRelative } from '@/lib/format'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { getWebhookDeliveries, redeliverWebhook } from '@/modules/admin/api/webhooks'
import { DataPagination } from '@/shared/components/DataTable'
import { FilterSelect } from '@/shared/components/Filters'
import { DescriptionList, DetailSheet } from '@/shared/components/FormDialog'
import StatusBadge from '@/shared/components/StatusBadge'

const PER_PAGE = 20

const STATUS_OPTIONS = [
  { label: '成功', value: 'success' },
  { label: '等待重试', value: 'pending' },
  { label: '失败', value: 'failed' },
]

/** Badge for a delivery; a pending row that was already tried is waiting for its retry */
export function DeliveryStatus({ status, attempts }) {
  const { t } = useTranslation()
  if (status === 'success')
    return (
      <StatusBadge tone="success" dot>
        {t('成功')}
      </StatusBadge>
    )
  if (status === 'failed')
    return (
      <StatusBadge tone="danger" dot>
        {t('失败')}
      </StatusBadge>
    )
  if (status === 'delivering')
    return (
      <StatusBadge tone="info" dot>
        {t('发送中')}
      </StatusBadge>
    )
  return (
    <StatusBadge tone="warning" dot>
      {attempts > 0 ? t('等待重试') : t('排队中')}
    </StatusBadge>
  )
}

function DeliveryRow({ delivery, canRedeliver, onRedelivered }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)

  const redeliver = async () => {
    setSending(true)
    try {
      const res = await redeliverWebhook(delivery.id)
      if (res.status === 'success') toast.success(t('已重新投递：HTTP {{code}}', { code: res.response_code }))
      else
        toast.error(
          t('重新投递失败：{{reason}}', {
            reason: res.response_code ? `HTTP ${res.response_code}` : res.response_body,
          }),
        )
      onRedelivered()
    } catch (err) {
      toast.apiError(err, '操作失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="hover:bg-muted/50 flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
      >
        <DeliveryStatus status={delivery.status} attempts={delivery.attempts} />
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{delivery.event}</code>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {delivery.response_code ? `HTTP ${delivery.response_code}` : null}
        </span>
        <span className="text-muted-foreground w-20 shrink-0 text-right text-xs tabular-nums" title={formatDateTime(delivery.created_at)}>
          {formatRelative(delivery.created_at)}
        </span>
        <ChevronDown className={cn('text-muted-foreground size-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="bg-muted/30 space-y-3 border-t px-3.5 py-3">
          <DescriptionList
            items={[
              {
                label: '事件 ID',
                value: <code className="font-mono text-xs break-all">{delivery.event_id}</code>,
              },
              {
                label: '尝试次数',
                value: <span className="tabular-nums">{delivery.attempts}</span>,
              },
              {
                label: '创建时间',
                value: <span className="tabular-nums">{formatDateTime(delivery.created_at)}</span>,
              },
              delivery.delivered_at
                ? {
                    label: '送达时间',
                    value: <span className="tabular-nums">{formatDateTime(delivery.delivered_at)}</span>,
                  }
                : null,
              delivery.next_retry_at
                ? {
                    label: '下次重试',
                    value: <span className="tabular-nums">{formatDateTime(delivery.next_retry_at)}</span>,
                  }
                : null,
            ]}
          />
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">{t('请求内容')}</div>
            <pre className="bg-card max-h-60 overflow-auto rounded-md border px-3 py-2 font-mono text-xs leading-relaxed">
              {JSON.stringify(delivery.payload, null, 2)}
            </pre>
          </div>
          {delivery.response_body ? (
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">{t('响应 / 错误')}</div>
              <pre className="bg-card max-h-40 overflow-auto rounded-md border px-3 py-2 font-mono text-xs break-all whitespace-pre-wrap">
                {delivery.response_body}
              </pre>
            </div>
          ) : null}
          {canRedeliver ? (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" disabled={sending} onClick={redeliver}>
                {sending ? <Spinner /> : <RotateCw />}
                {t('重新投递')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/**
 * Delivery log of one webhook, newest first; each row expands to the payload and the receiver's answer.
 * Mounted per webhook (keyed by its id), so it starts from a clean state.
 */
export default function DeliveriesSheet({ hook, onOpenChange, canRedeliver, onChanged }) {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const fetchPage = useCallback(
    (nextPage, nextStatus) =>
      getWebhookDeliveries(hook.id, {
        page: nextPage,
        per_page: PER_PAGE,
        status: nextStatus || undefined,
      })
        .then(setData)
        .catch((err) => {
          toast.apiError(err, '加载失败')
          setData({ items: [], total: 0 })
        }),
    [hook],
  )

  useEffect(() => {
    fetchPage(1, '')
  }, [fetchPage])

  const load = (nextPage = page, nextStatus = status) => {
    setPage(nextPage)
    setStatus(nextStatus)
    return fetchPage(nextPage, nextStatus)
  }

  return (
    <DetailSheet open onOpenChange={onOpenChange} title="投递记录" description={hook.name} width={600}>
      <div className="mb-3 flex items-center gap-2">
        <FilterSelect value={status} onChange={(next) => load(1, next)} options={STATUS_OPTIONS} placeholder="状态" />
        <Button variant="outline" size="sm" className="ml-auto h-8" onClick={() => load()}>
          <RefreshCw />
          {t('刷新')}
        </Button>
      </div>
      {data === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : data.items.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-8 text-center text-[13px]">{t('还没有投递记录')}</p>
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-lg border">
            {data.items.map((d) => (
              <DeliveryRow
                key={d.id}
                delivery={d}
                canRedeliver={canRedeliver}
                onRedelivered={() => {
                  load(1, status)
                  onChanged()
                }}
              />
            ))}
          </ul>
          {data.total > PER_PAGE ? (
            <DataPagination page={page} perPage={PER_PAGE} total={data.total} onChange={(next) => load(next)} className="mt-3" />
          ) : null}
        </>
      )}
    </DetailSheet>
  )
}
