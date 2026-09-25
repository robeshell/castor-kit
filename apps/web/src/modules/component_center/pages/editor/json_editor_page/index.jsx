import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { AlertTriangle, Braces, ChevronRight, Minimize2, Sparkles, WandSparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useMonacoTheme } from '@/lib/monaco-theme'
import { EXAMPLE_JSON } from '@/modules/component_center/pages/editor/json_editor_page/demo-content'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

// Type colors: semantic colors only (adapt to light / dark automatically)
const TYPE_CLASS = {
  string: 'text-success',
  number: 'text-primary',
  boolean: 'text-warning',
  null: 'text-muted-foreground italic',
  key: 'text-info',
}

const LEGEND = [
  { label: '字符串', className: TYPE_CLASS.string },
  { label: '数字', className: TYPE_CLASS.number },
  { label: '布尔值', className: TYPE_CLASS.boolean },
  { label: 'null', className: TYPE_CLASS.null },
  { label: '键 / 对象 / 数组', className: TYPE_CLASS.key },
]

// ── Recursive JSON tree node ─────────────────────────────────────────────────

function NodeKey({ nodeKey }) {
  if (nodeKey === undefined) return null
  return <span className={TYPE_CLASS.key}>{typeof nodeKey === 'number' ? `[${nodeKey}]` : `"${nodeKey}"`}:</span>
}

function JsonNode({ nodeKey, value, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
  const indent = { paddingLeft: depth * 16 }

  if (type !== 'object' && type !== 'array') {
    return (
      <div className="flex gap-1 leading-6" style={indent}>
        <span className="w-3.5 shrink-0" />
        <NodeKey nodeKey={nodeKey} />
        <span className={cn('break-all', TYPE_CLASS[type])}>
          {type === 'string' ? `"${value}"` : type === 'null' ? 'null' : String(value)}
        </span>
      </div>
    )
  }

  const entries = type === 'array' ? value.map((v, i) => [i, v]) : Object.entries(value)
  const [open, close] = type === 'array' ? ['[', ']'] : ['{', '}']
  const summary = type === 'array' ? `Array(${value.length})` : `Object(${Object.keys(value).length})`

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="hover:bg-muted/70 -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1 rounded px-1 text-left leading-6 transition-colors duration-150"
        style={indent}
      >
        <ChevronRight
          className={cn('text-muted-foreground size-3.5 shrink-0 transition-transform duration-200', expanded && 'rotate-90')}
        />
        <NodeKey nodeKey={nodeKey} />
        <span className="text-muted-foreground">{open}</span>
        {!expanded ? (
          <>
            <span className="bg-muted text-muted-foreground rounded px-1 text-[11px]">{summary}</span>
            <span className="text-muted-foreground">{close}</span>
          </>
        ) : null}
      </button>
      {expanded ? (
        <>
          {entries.map(([k, v]) => (
            <JsonNode key={String(k)} nodeKey={k} value={v} depth={depth + 1} />
          ))}
          <div className="text-muted-foreground leading-6" style={{ paddingLeft: depth * 16 + 18 }}>
            {close}
          </div>
        </>
      ) : null}
    </div>
  )
}

// title is Chinese source text, translated here
function PaneHeader({ icon: Icon, title, extra }) {
  const { t } = useTranslation()
  return (
    <div className="bg-muted/40 flex h-10 shrink-0 items-center justify-between gap-3 border-b px-4">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Icon className="size-3.5" />
        {t(title)}
      </span>
      {extra}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function JsonEditorPage() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const monacoTheme = useMonacoTheme()
  const [jsonText, setJsonText] = useState(JSON.stringify(EXAMPLE_JSON, null, 2))
  const [parsedJson, setParsedJson] = useState(EXAMPLE_JSON)
  const [parseError, setParseError] = useState(null)
  // The tree preview is rebuilt after "load sample / format" so expansion resets to the default
  const [treeVersion, setTreeVersion] = useState(0)

  const parseJson = (text) => {
    try {
      const parsed = JSON.parse(text)
      setParsedJson(parsed)
      setParseError(null)
      return parsed
    } catch (e) {
      setParseError(e.message)
      setParsedJson(null)
      return null
    }
  }

  const handleEditorChange = (val) => {
    const text = val || ''
    setJsonText(text)
    parseJson(text)
  }

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonText)
      setJsonText(JSON.stringify(parsed, null, 2))
      setParsedJson(parsed)
      setParseError(null)
      toast.success('JSON 已格式化')
    } catch {
      toast.error('JSON 格式错误，无法格式化')
    }
  }

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(jsonText)
      setJsonText(JSON.stringify(parsed))
      setParsedJson(parsed)
      setParseError(null)
      toast.success('JSON 已压缩')
    } catch {
      toast.error('JSON 格式错误，无法压缩')
    }
  }

  const handleExample = () => {
    setJsonText(JSON.stringify(EXAMPLE_JSON, null, 2))
    setParsedJson(EXAMPLE_JSON)
    setParseError(null)
    setTreeVersion((v) => v + 1)
    toast.success('已加载示例数据')
  }

  const status = parseError ? (
    <StatusBadge tone="danger" dot className="max-w-[260px] sm:max-w-[360px]">
      <span className="truncate" title={parseError}>
        {t('JSON 错误：{{message}}', { message: parseError })}
      </span>
    </StatusBadge>
  ) : parsedJson !== null ? (
    <StatusBadge tone="success" dot>
      {t('JSON 有效')}
    </StatusBadge>
  ) : null

  return (
    <div>
      <PageHeader
        title="JSON 编辑器"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExample}>
              <Sparkles />
              {t('示例数据')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleMinify}>
              <Minimize2 />
              {t('压缩')}
            </Button>
            <Button variant="brand" size="sm" onClick={handleFormat}>
              <WandSparkles />
              {t('格式化')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:h-[560px] md:grid-cols-2">
        <Panel padded={false} className="flex min-h-0 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
          <PaneHeader icon={Braces} title="编辑器" extra={status} />
          <div className="min-h-0 flex-1">
            <Editor
              height={isMobile ? '320px' : '100%'}
              language="json"
              theme={monacoTheme}
              value={jsonText}
              onChange={handleEditorChange}
              loading={<Spinner className="text-muted-foreground" />}
              options={{
                fontSize: 13,
                fontFamily: 'Geist Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 10, bottom: 10 },
                formatOnPaste: true,
                formatOnType: false,
              }}
            />
          </div>
        </Panel>

        <Panel padded={false} className="flex min-h-[320px] flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
          <PaneHeader icon={ChevronRight} title="树形预览" />
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-[13px]">
            {parseError ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center">
                <div className="bg-danger-soft text-danger flex size-10 items-center justify-center rounded-xl">
                  <AlertTriangle className="size-[18px]" />
                </div>
                <p className="text-danger font-sans text-sm font-medium">{t('JSON 解析失败')}</p>
                <p className="text-muted-foreground max-w-sm text-xs break-all">{parseError}</p>
              </div>
            ) : parsedJson !== null ? (
              <JsonNode key={treeVersion} value={parsedJson} depth={0} />
            ) : (
              <p className="text-muted-foreground mt-10 text-center font-sans text-[13px]">{t('输入 JSON 后在此展示树形结构')}</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span>{t('点击树节点可展开 / 折叠子节点 · 颜色区分类型：')}</span>
        {LEGEND.map((item) => (
          <span key={item.label} className={cn('not-italic', item.className)}>
            {t(item.label)}
          </span>
        ))}
      </div>
    </div>
  )
}
