import { ExternalLink, FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAppInfo } from '@/shared/hooks/useAppInfo'

const REPO_URL = 'https://github.com/robeshell/castor-kit'

/** Compact "Demo" pill in the top bar on the public demo (DEMO_MODE); the details open in a popover */
export default function DemoBadge() {
  const { t } = useTranslation()
  const info = useAppInfo()
  if (!info?.demo_mode) return null
  const notes = [
    t('系统管理为只读，可以随意浏览'),
    t('组件示例可以增删改，数据每 {{hours}} 小时自动恢复', { hours: info.demo_reset_hours ?? 24 }),
    t('AI 功能有调用次数限制'),
  ]
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="bg-brand-soft text-primary hover:bg-brand-soft/70 mr-1 flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors"
        >
          <span className="relative flex size-1.5">
            <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-60" />
            <span className="bg-primary relative inline-flex size-1.5 rounded-full" />
          </span>
          {t('演示')}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="bg-brand-soft text-primary flex size-7 items-center justify-center rounded-md">
            <FlaskConical className="size-4" />
          </span>
          <span className="text-sm font-medium">{t('公开演示环境')}</span>
        </div>
        <ul className="text-muted-foreground space-y-1.5 px-4 py-3 text-xs">
          {notes.map((note) => (
            <li key={note} className="flex gap-2">
              <span className="bg-muted-foreground/60 mt-1.5 size-1 shrink-0 rounded-full" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
        <div className="border-t px-4 py-3">
          <Button asChild size="sm" variant="outline" className="w-full">
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              {t('在 GitHub 上查看')}
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
