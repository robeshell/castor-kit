import { Info } from 'lucide-react'
import { useAppInfo } from '@/shared/hooks/useAppInfo'
import { useTranslation } from 'react-i18next'

const REPO_URL = 'https://github.com/robeshell/castor-kit'

/** Thin notice above the top bar on the public demo (DEMO_MODE) */
export default function DemoBanner() {
  const { t } = useTranslation()
  const info = useAppInfo()
  if (!info?.demo_mode) return null
  return (
    <div className="bg-brand-soft text-primary flex min-h-8 shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-b px-4 py-1 text-center text-xs">
      <Info className="size-3.5 shrink-0" />
      <span>{t('演示环境：系统管理为只读，数据每 {{hours}} 小时自动恢复', { hours: info.demo_reset_hours ?? 24 })}</span>
      <a href={REPO_URL} target="_blank" rel="noreferrer" className="font-medium underline-offset-2 hover:underline">
        {t('在 GitHub 上查看')}
      </a>
    </div>
  )
}
