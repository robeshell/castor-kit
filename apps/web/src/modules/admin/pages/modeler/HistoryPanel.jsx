import { ExternalLink, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'
import ConfirmAction from '@/shared/components/ConfirmAction'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'

const JOB_STATUS = {
  running: { tone: 'info', label: '进行中' },
  success: { tone: 'success', label: '成功' },
  failed: { tone: 'danger', label: '失败' },
}

/** Modules the modeler generated (they can be undone) and its recent jobs */
export default function HistoryPanel({ history, busy, onUndo, onOpenJob }) {
  const { t } = useTranslation()
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Panel title="已生成的模块" description="撤销会删除模块的代码、菜单、数据表和数据，只用于试错；已经在用的模块请手动维护">
        {history.modules.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-[13px]">{t('还没有用建模器生成的模块')}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {history.modules.map((m) => (
              <li key={m.name} className="flex items-center gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{m.title}</span>
                    <code className="text-muted-foreground font-mono text-xs">{m.name}</code>
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs tabular-nums">
                    {formatDateTime(m.created_at)} · {m.table}
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                  <Link to={m.path}>
                    <ExternalLink />
                    {t('打开')}
                  </Link>
                </Button>
                <ConfirmAction
                  title={t('撤销「{{title}}」？', { title: m.title })}
                  description="会删除它的代码文件、菜单与权限、数据表（包括其中的数据）和迁移记录，不能恢复。"
                  confirmText="撤销"
                  onConfirm={() => onUndo(m)}
                >
                  <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2" disabled={busy}>
                    <Undo2 />
                    {t('撤销')}
                  </Button>
                </ConfirmAction>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="最近的任务">
        {history.jobs.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-[13px]">{t('还没有任务')}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {history.jobs.map((job) => {
              const status = JOB_STATUS[job.status] ?? JOB_STATUS.failed
              return (
                <li key={job.id}>
                  <button type="button" className="hover:bg-muted/50 flex w-full items-center gap-3 px-3.5 py-2.5 text-left" onClick={() => onOpenJob(job)}>
                    <StatusBadge tone={status.tone} dot>
                      {status.label}
                    </StatusBadge>
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {job.kind === 'undo' ? t('撤销 {{title}}', { title: job.title }) : t('生成 {{title}}', { title: job.title })}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">{formatDateTime(job.created_at)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
