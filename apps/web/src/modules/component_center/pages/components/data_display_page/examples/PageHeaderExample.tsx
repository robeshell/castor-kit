import { useTranslation } from 'react-i18next'
import { Download, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'

export default function PageHeaderExample() {
  const { t } = useTranslation()
  return (
    // PageHeader keeps a fixed 24px gap (mb-6) below itself; don't override it with mb-*
    <div>
      {/* The usual list page: title and actions; the title is Chinese source text, translated by the header */}
      <PageHeader
        title="订单管理"
        actions={
          <>
            <Button variant="outline">
              <Download />
              {t('导出')}
            </Button>
            <Button>
              <Plus />
              {t('新建订单')}
            </Button>
          </>
        }
      />
      {/* description only for facts about the data; children go under the title (badges, meta) */}
      <PageHeader title="SO-1001" description={t('更新于 {{time}}', { time: '2026-09-28 10:24' })}>
        <div className="flex gap-1.5 pt-1">
          {/* StatusBadge translates a Chinese string child */}
          <StatusBadge tone="info" dot>
            {'已付款'}
          </StatusBadge>
          <StatusBadge tone="warning" variant="plain">
            {'加急'}
          </StatusBadge>
        </div>
      </PageHeader>
    </div>
  )
}
