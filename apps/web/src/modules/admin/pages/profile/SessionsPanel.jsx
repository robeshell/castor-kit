import { useCallback, useEffect, useState } from 'react'
import { LogOut, Monitor, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatRelative } from '@/lib/format'
import { toast } from '@/lib/toast'
import { describeUserAgent } from '@/lib/user-agent'
import { getMySessions, revokeMyOtherSessions, revokeMySession } from '@/modules/admin/api/auth'
import ConfirmAction from '@/shared/components/ConfirmAction'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'

/** Where the signed-in user is logged in; other devices can be signed out one by one or all at once */
export default function SessionsPanel() {
  const { t } = useTranslation()
  const [items, setItems] = useState(null)

  const load = useCallback(
    () =>
      getMySessions({ per_page: 50 })
        .then((res) => setItems(res.items || []))
        .catch((err) => {
          toast.apiError(err, '加载失败')
          setItems([])
        }),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  const revoke = async (key) => {
    try {
      await revokeMySession(key)
      toast.success('已下线')
      load()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const revokeOthers = async () => {
    try {
      const res = await revokeMyOtherSessions()
      toast.success(t('已下线 {{count}} 个其他设备', { count: res.revoked ?? 0 }))
      load()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const others = (items || []).filter((s) => !s.current)

  return (
    <Panel
      title="登录设备"
      description="当前账号在这些地方处于登录状态"
      className="mb-4"
      actions={
        others.length > 0 ? (
          <ConfirmAction
            title={t('退出其他所有设备？')}
            description="这些设备需要重新登录。"
            confirmText="全部退出"
            onConfirm={revokeOthers}
          >
            <Button variant="outline" size="sm">
              <LogOut />
              {t('退出其他设备')}
            </Button>
          </ConfirmAction>
        ) : null
      }
    >
      {items === null ? (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((s) => {
            const device = describeUserAgent(s.user_agent)
            const Icon = device.mobile ? Smartphone : Monitor
            return (
              <li key={s.key} className="flex items-center gap-3 px-3.5 py-3">
                <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{device.label || t('未知设备')}</span>
                    {s.current ? <StatusBadge tone="success">{t('当前设备')}</StatusBadge> : null}
                  </div>
                  <div className="text-muted-foreground mt-1 truncate text-xs tabular-nums" title={formatDateTime(s.created_at)}>
                    {[s.ip, t('最近活动 {{time}}', { time: formatRelative(s.last_seen_at) })].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {!s.current ? (
                  <ConfirmAction
                    title={t('让这个设备退出登录？')}
                    description="该设备下一次操作时会回到登录页。"
                    confirmText="退出"
                    onConfirm={() => revoke(s.key)}
                  >
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                      {t('退出')}
                    </Button>
                  </ConfirmAction>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
