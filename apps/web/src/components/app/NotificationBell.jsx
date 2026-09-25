import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/context/AuthContext'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { getNotifications, getUnreadCount, markAllAsRead, markAsRead } from '@/modules/admin/api/notifications'
import { useTranslation } from 'react-i18next'

const DOT = {
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-danger',
}

export default function NotificationBell() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState([])

  const fetchUnread = useCallback(() => {
    getUnreadCount()
      .then((res) => setUnread(res?.count ?? 0))
      .catch(() => {})
  }, [])

  const fetchRecent = useCallback(() => {
    getNotifications({ page: 1, per_page: 10 })
      .then((res) => setItems(res?.items || []))
      .catch(() => {})
  }, [])

  // 未读数轮询：标签页隐藏时暂停，避免后台空耗请求
  useEffect(() => {
    if (!user) return undefined
    let timer = null
    const start = () => {
      if (!timer) timer = setInterval(fetchUnread, 30000)
    }
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = null
    }
    const onVisibility = () => (document.hidden ? stop() : start())
    fetchUnread()
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user, fetchUnread])

  const onOpenChange = (next) => {
    setOpen(next)
    if (next) fetchRecent()
  }

  const openItem = (item) => {
    markAsRead(item.id).catch(() => {})
    setOpen(false)
    fetchUnread()
    if (item.link) navigate(item.link)
  }

  const readAll = () => {
    markAllAsRead()
      .then(() => {
        fetchUnread()
        fetchRecent()
      })
      .catch(() => {})
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8" aria-label={t('消息通知')}>
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="bg-brand-gradient-strong ring-background absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-medium text-white ring-2">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium">{t('消息通知')}</span>
          <Button variant="ghost" size="sm" className="text-muted-foreground h-7 px-2 text-xs" onClick={readAll}>
            <CheckCheck className="size-3.5" />
            {t('全部已读')}
          </Button>
        </div>
        <ScrollArea className="max-h-[380px]">
          {items.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-10 text-sm">
              <Bell className="size-5 opacity-50" />
              {t('暂无通知')}
            </div>
          ) : (
            <ul className="py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={cn(
                      'hover:bg-accent flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors',
                      !item.is_read && 'bg-brand-soft',
                    )}
                  >
                    <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', DOT[item.noti_type] || 'bg-info')} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[13px]', !item.is_read && 'font-medium')}>
                        {item.title}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">{formatRelative(item.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t p-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary w-full justify-center"
            onClick={() => {
              setOpen(false)
              navigate('/system/notifications')
            }}
          >
            {t('查看全部通知')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
