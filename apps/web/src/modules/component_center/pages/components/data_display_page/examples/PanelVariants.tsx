import { useTranslation } from 'react-i18next'
import { MoreHorizontal, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'

const SERVICES = [
  { name: 'api-gateway', region: 'us-east-1', healthy: true },
  { name: 'billing-worker', region: 'eu-west-1', healthy: true },
  { name: 'search-indexer', region: 'ap-northeast-1', healthy: false },
]

export default function PanelVariants() {
  const { t } = useTranslation()
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Title, a description that carries information, and controls on the right */}
      <Panel
        title="服务状态"
        description={t('共 {{count}} 个服务', { count: SERVICES.length })}
        actions={
          <Button variant="ghost" size="icon-sm" aria-label={t('刷新')}>
            <RefreshCw />
          </Button>
        }
        padded={false}
      >
        {/* padded={false}: rows run edge to edge */}
        <ul className="divide-y border-t">
          {SERVICES.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate font-mono text-xs">{s.name}</div>
                <div className="text-muted-foreground text-xs">{s.region}</div>
              </div>
              <StatusBadge tone={s.healthy ? 'success' : 'danger'} dot>
                {s.healthy ? '运行中' : '异常'}
              </StatusBadge>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="space-y-4">
        <Panel
          title="备注"
          actions={
            <Button variant="ghost" size="icon-sm" aria-label={t('更多')}>
              <MoreHorizontal />
            </Button>
          }
        >
          <p className="text-muted-foreground text-sm">{t('默认有内边距，内容直接放进去。')}</p>
        </Panel>
        {/* No title: just the card with padding */}
        <Panel>
          <p className="text-muted-foreground text-sm">{t('不传标题时只是一张带内边距的卡片。')}</p>
        </Panel>
      </div>
    </div>
  )
}
