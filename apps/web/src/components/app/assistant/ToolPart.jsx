import { Check, Database, LoaderCircle, Search, ShieldAlert, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from '@/components/ai-elements/confirmation'
import { cn } from '@/lib/utils'

const running = (state) => state === 'input-streaming' || state === 'input-available'

/** Passwords and other secrets in a write's body are masked on the card (the operation log redacts the same keys) */
const SECRET_KEY = /pass(word)?|secret|token|api_key/i

function maskSecrets(value) {
  if (Array.isArray(value)) return value.map(maskSecrets)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) && typeof v === 'string' ? '••••••' : maskSecrets(v)]))
  }
  return value
}

/** "/api/admin/users" + { page: 2 } → "/api/admin/users?page=2", so repeated reads with different parameters look different */
function withQuery(path, query) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/** Outcome of an API call made by a tool: { status, data } */
function Outcome({ output }) {
  const { t } = useTranslation()
  if (!output) return null
  const status = output.status
  if (status >= 200 && status < 300) {
    return (
      <span className="text-success inline-flex items-center gap-1">
        <Check className="size-3" />
        {t('完成')}
      </span>
    )
  }
  if (status === 403) {
    return (
      <span className="text-warning inline-flex items-center gap-1">
        <ShieldAlert className="size-3" />
        {t('没有权限')}
      </span>
    )
  }
  return <span className="text-danger">{t('失败（{{status}}）', { status })}</span>
}

function Line({ icon: Icon, busy, children }) {
  return (
    <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
      {busy ? <LoaderCircle className="size-3.5 shrink-0 animate-spin" /> : <Icon className="size-3.5 shrink-0" />}
      {children}
    </div>
  )
}

/**
 * One tool call in the assistant's reply: finding routes and reading are shown as a line each; writes are an
 * approval card with the exact method, path and body — nothing is sent until the user allows it.
 */
export default function ToolPart({ part, onRespond }) {
  const { t } = useTranslation()
  const name = part.type.replace(/^tool-/, '')
  const input = part.input ?? {}

  if (name === 'search_api') {
    return (
      <Line icon={Search} busy={running(part.state)}>
        <span className="truncate">{t('查找接口：{{query}}', { query: input.query ?? '' })}</span>
      </Line>
    )
  }

  if (name === 'api_get') {
    return (
      <Line icon={Database} busy={running(part.state)}>
        <code className="truncate font-mono" title={withQuery(input.path, input.query)}>
          GET {withQuery(input.path, input.query)}
        </code>
        <Outcome output={part.output} />
      </Line>
    )
  }

  if (name === 'api_write') {
    return (
      <Confirmation approval={part.approval} state={part.state} className="text-[13px]">
        <ConfirmationTitle className="font-medium">{input.summary || t('执行一项操作')}</ConfirmationTitle>
        <div className="bg-muted/60 min-w-0 space-y-1 rounded-md px-2.5 py-2">
          <code className="block font-mono text-xs break-all">
            {input.method} {input.path}
          </code>
          {input.body && Object.keys(input.body).length > 0 ? (
            <pre className="max-h-40 overflow-auto font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
              {JSON.stringify(maskSecrets(input.body), null, 2)}
            </pre>
          ) : null}
        </div>
        <ConfirmationRequest>
          <ConfirmationActions className={cn('justify-end')}>
            <ConfirmationAction variant="outline" onClick={() => onRespond(part.approval.id, false)}>
              <X />
              {t('拒绝')}
            </ConfirmationAction>
            <ConfirmationAction onClick={() => onRespond(part.approval.id, true)}>
              <Check />
              {t('允许执行')}
            </ConfirmationAction>
          </ConfirmationActions>
        </ConfirmationRequest>
        <ConfirmationAccepted>
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            {part.state === 'output-available' ? <Outcome output={part.output} /> : <LoaderCircle className="size-3 animate-spin" />}
            <span>{t('已允许')}</span>
          </div>
        </ConfirmationAccepted>
        <ConfirmationRejected>
          <div className="text-muted-foreground text-xs">{t('已拒绝，没有执行')}</div>
        </ConfirmationRejected>
      </Confirmation>
    )
  }

  return null
}
