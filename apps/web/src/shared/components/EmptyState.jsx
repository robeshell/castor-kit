import { Inbox } from 'lucide-react'
import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'

export default function EmptyState({ icon: Icon = Inbox, title = '暂无数据', description, action, className }) {
  const tx = useTx()
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="bg-muted text-muted-foreground mb-3 flex size-10 items-center justify-center rounded-xl">
        <Icon className="size-[18px]" />
      </div>
      <p className="text-sm font-medium">{tx(title)}</p>
      {description ? <p className="text-muted-foreground mt-1 max-w-sm text-xs">{tx(description)}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
