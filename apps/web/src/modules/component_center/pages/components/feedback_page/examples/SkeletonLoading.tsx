import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import StatusBadge from '@/shared/components/StatusBadge'
import UserAvatar from '@/shared/components/UserAvatar'

interface Member {
  id: number
  name: string
  email: string
  online: boolean
}

const MEMBERS: Member[] = [
  { id: 1, name: 'Mia Chen', email: 'mia@example.test', online: true },
  { id: 2, name: 'Leo Park', email: 'leo@example.test', online: false },
  { id: 3, name: 'Ava Kim', email: 'ava@example.test', online: true },
]

export default function SkeletonLoading() {
  const { t } = useTranslation()
  // Start as loading, and clear it in the request's callback (never set it synchronously inside the effect)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    // Stand-in for the request
    const timer = setTimeout(() => setLoading(false), 1200)
    return () => clearTimeout(timer)
  }, [version])

  const reload = () => {
    setLoading(true)
    setVersion((v) => v + 1)
  }

  return (
    <div className="max-w-md space-y-3">
      <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
        <RotateCw />
        {t('重新加载')}
      </Button>
      <ul className="divide-y rounded-lg border">
        {loading
          ? // Same shape as the loaded rows (avatar, two lines, badge), so nothing jumps when the data arrives
            MEMBERS.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-12" />
              </li>
            ))
          : MEMBERS.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <UserAvatar name={m.name} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{m.name}</div>
                  <div className="text-muted-foreground truncate text-xs">{m.email}</div>
                </div>
                <StatusBadge tone={m.online ? 'success' : 'neutral'} variant="plain">
                  {m.online ? '在线' : '离线'}
                </StatusBadge>
              </li>
            ))}
      </ul>
    </div>
  )
}
