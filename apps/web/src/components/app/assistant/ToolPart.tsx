import type { ReactNode } from 'react'
import type { ToolUIPart, UIDataTypes, UIMessage } from 'ai'
import { Check, Database, LoaderCircle, Search, ShieldAlert, X, type LucideIcon } from 'lucide-react'
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

/** What an API call made by a tool returns (apps/api/src/modules/admin/assistant/service.ts); data is the response body */
export interface ApiOutcome {
  status: number
  data: unknown
  /** Set when the body was cut down before reaching the model */
  note?: string
}

/** The query parameters of an api_get call */
type ApiGetQuery = Record<string, string | number | boolean>

/** The assistant's tools, as the API defines them (inputSchema / execute in apps/api/src/modules/admin/assistant/service.ts) */
export type AssistantTools = {
  search_api: { input: { query: string }; output: { results: unknown } }
  api_get: { input: { path: string; query?: ApiGetQuery }; output: ApiOutcome }
  api_write: {
    input: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; body?: Record<string, unknown>; summary: string }
    output: ApiOutcome
  }
}

/** A chat message of the assistant (its tool parts are typed from AssistantTools) */
export type AssistantUIMessage = UIMessage<unknown, UIDataTypes, AssistantTools>

/** One tool call in an assistant message */
export type AssistantToolPart = ToolUIPart<AssistantTools>

const running = (state: AssistantToolPart['state']) => state === 'input-streaming' || state === 'input-available'

/** Passwords and other secrets in a write's body are masked on the card (the operation log redacts the same keys) */
const SECRET_KEY = /pass(word)?|secret|token|api_key/i

function maskSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSecrets)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]: [string, unknown]) => [k, SECRET_KEY.test(k) && typeof v === 'string' ? '••••••' : maskSecrets(v)]))
  }
  return value
}

/** "/api/admin/users" + { page: 2 } → "/api/admin/users?page=2", so repeated reads with different parameters look different */
function withQuery(path: string | undefined, query: Partial<ApiGetQuery> | undefined): string | undefined {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/** Outcome of an API call made by a tool: { status, data } */
function Outcome({ output }: { output: ApiOutcome | undefined }) {
  const { t } = useTranslation()
  if (!output) return null
  const status = output.status
  if (status >= 200 && status < 300) {
    return (
      <span className="text-success inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
        <Check className="size-3" />
        {t('完成')}
      </span>
    )
  }
  if (status === 403) {
    return (
      <span className="text-warning inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
        <ShieldAlert className="size-3" />
        {t('没有权限')}
      </span>
    )
  }
  return <span className="text-danger shrink-0 whitespace-nowrap">{t('失败（{{status}}）', { status })}</span>
}

function Line({ icon: Icon, busy, children }: { icon: LucideIcon; busy: boolean; children: ReactNode }) {
  return (
    <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
      {busy ? <LoaderCircle className="size-3.5 shrink-0 animate-spin" /> : <Icon className="size-3.5 shrink-0" />}
      {children}
    </div>
  )
}

export interface ToolPartProps {
  part: AssistantToolPart
  /** Answer a write's approval request */
  onRespond: (approvalId: string, approved: boolean) => void
}

/**
 * One tool call in the assistant's reply: finding routes and reading are shown as a line each; writes are an
 * approval card with the exact method, path and body — nothing is sent until the user allows it.
 */
export default function ToolPart({ part, onRespond }: ToolPartProps) {
  const { t } = useTranslation()

  if (part.type === 'tool-search_api') {
    const input: Partial<AssistantTools['search_api']['input']> = part.input ?? {}
    return (
      <Line icon={Search} busy={running(part.state)}>
        <span className="truncate">{t('查找接口：{{query}}', { query: input.query ?? '' })}</span>
      </Line>
    )
  }

  if (part.type === 'tool-api_get') {
    // Still streaming, the query may hold undefined values too (withQuery skips them)
    const input: { path?: string; query?: Partial<ApiGetQuery> } = part.input ?? {}
    return (
      <Line icon={Database} busy={running(part.state)}>
        <code className="truncate font-mono" title={withQuery(input.path, input.query)}>
          GET {withQuery(input.path, input.query)}
        </code>
        <Outcome output={part.output} />
      </Line>
    )
  }

  if (part.type === 'tool-api_write') {
    const input: Partial<AssistantTools['api_write']['input']> = part.input ?? {}
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
            {/* ConfirmationRequest only renders while approval-requested, when approval is set */}
            <ConfirmationAction variant="outline" onClick={() => onRespond(part.approval!.id, false)}>
              <X />
              {t('拒绝')}
            </ConfirmationAction>
            <ConfirmationAction onClick={() => onRespond(part.approval!.id, true)}>
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
