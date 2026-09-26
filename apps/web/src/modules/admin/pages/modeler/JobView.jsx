import { useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleDashed, CircleX, ExternalLink, LoaderCircle, MinusCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getJob } from '@/modules/admin/api/modeler'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'

const POLL_MS = 800

const STEP_ICON = {
  pending: <CircleDashed className="text-muted-foreground size-4" />,
  running: <LoaderCircle className="text-primary size-4 animate-spin" />,
  done: <CircleCheck className="text-success size-4" />,
  failed: <CircleX className="text-danger size-4" />,
  skipped: <MinusCircle className="text-muted-foreground size-4" />,
}

/**
 * A running (or finished) modeler job: its steps and the runner's output. Polls the job every 800 ms while it runs;
 * failed polls are ignored — the API restarts when the generated code lands, and answers again a few seconds later.
 * `onFinished(job)` fires once when the job ends.
 */
export default function JobView({ jobId, openPath, onFinished, onClose }) {
  const { t } = useTranslation()
  const [job, setJob] = useState(null)
  const [log, setLog] = useState('')
  const [reconnecting, setReconnecting] = useState(false)
  const logRef = useRef(null)
  const finished = useRef(false)

  useEffect(() => {
    let offset = 0
    let timer = null
    let alive = true
    const poll = async () => {
      try {
        const res = await getJob(jobId, offset)
        if (!alive) return
        offset = res.log.offset
        setReconnecting(false)
        setJob(res.job)
        if (res.log.text) setLog((text) => text + res.log.text)
        if (res.job.status !== 'running' && res.log.text === '') {
          if (!finished.current) {
            finished.current = true
            onFinished?.(res.job)
          }
          return
        }
      } catch {
        if (alive) setReconnecting(true)
      }
      if (alive) timer = setTimeout(poll, POLL_MS)
    }
    poll()
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // onFinished is only called once; a new job gets a new component (keyed by id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  // Keep the log scrolled to the end while it grows
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log])

  const status = job?.status
  const badge =
    status === 'success' ? (
      <StatusBadge tone="success" dot>
        {t('已完成')}
      </StatusBadge>
    ) : status === 'failed' ? (
      <StatusBadge tone="danger" dot>
        {t('失败')}
      </StatusBadge>
    ) : (
      <StatusBadge tone="info" dot>
        {t('进行中')}
      </StatusBadge>
    )

  return (
    <Panel
      title={job ? (job.kind === 'undo' ? t('撤销模块：{{title}}', { title: job.title }) : t('生成模块：{{title}}', { title: job.title })) : t('建模任务')}
      actions={badge}
    >
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ol className="space-y-2">
          {(job?.steps ?? []).map((s) => (
            <li key={s.key} className={cn('flex items-center gap-2 text-[13px]', s.status === 'pending' && 'text-muted-foreground')}>
              {STEP_ICON[s.status]}
              {t(s.label)}
            </li>
          ))}
        </ol>
        <div className="min-w-0 space-y-2">
          {reconnecting ? <p className="text-muted-foreground text-xs">{t('后端正在重启以加载新代码，稍后自动继续…')}</p> : null}
          <pre
            ref={logRef}
            className="bg-muted/50 h-80 overflow-auto rounded-lg border p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap"
          >
            {log || t('等待输出…')}
          </pre>
          {status === 'failed' ? (
            <p className="text-danger text-[13px]">
              {job.error}
              {job.rolledBack ? t('（本次生成的内容已全部撤销）') : ''}
            </p>
          ) : null}
          {status && status !== 'running' ? (
            <div className="flex flex-wrap gap-2">
              {status === 'success' && job.kind === 'generate' && openPath ? (
                <Button asChild size="sm" variant="brand">
                  <Link to={openPath}>
                    <ExternalLink />
                    {t('打开页面')}
                  </Link>
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={onClose}>
                {t('关闭')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}
