import { isValidElement, memo, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy } from 'lucide-react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import './markdown.css'

/** Extract the language and plain text from <pre><code class="language-xx">…</code></pre> */
function readCode(children: ReactNode) {
  // The <code> element react-markdown renders inside <pre> (other nodes have no props and read as plain text)
  const child: unknown = Array.isArray(children) ? children[0] : children
  const props = isValidElement<{ className?: string; children?: ReactNode }>(child) ? child.props : {}
  const className = props.className || ''
  const language = /language-([\w+#-]+)/.exec(className)?.[1] || ''
  const raw = props.children
  const text = (Array.isArray(raw) ? raw.join('') : String(raw ?? '')).replace(/\n$/, '')
  return { language, text }
}

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const copy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => toast.error('复制失败'))
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] transition-colors duration-150"
    >
      {copied ? <Check className="text-success size-3" /> : <Copy className="size-3" />}
      {copied ? t('已复制') : t('复制')}
    </button>
  )
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const { language, text } = readCode(children)
  return (
    <div className="md-code-block bg-muted/50 overflow-hidden rounded-[10px] shadow-[0_0_0_1px_var(--border)]">
      <div className="bg-muted/60 flex h-8 items-center justify-between border-b pr-1.5 pl-3">
        <span className="text-muted-foreground font-mono text-[11px] lowercase">{language || 'text'}</span>
        <CopyButton text={text} />
      </div>
      <pre>{children}</pre>
    </div>
  )
}

/** GFM task-list box: read-only, and named by its state (the item's text follows it) */
function TaskCheckbox({ checked }: { checked?: boolean }) {
  const { t } = useTranslation()
  return <input type="checkbox" checked={Boolean(checked)} disabled readOnly aria-label={checked ? t('已完成') : t('未完成')} />
}

const COMPONENTS: Components = {
  input: ({ type, checked, node: _node, ...rest }) => (type === 'checkbox' ? <TaskCheckbox checked={checked} /> : <input type={type} {...rest} />),
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  table: ({ children }) => (
    <div className="md-table-wrap">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
}

const REMARK_PLUGINS = [remarkGfm]

export interface MarkdownViewProps {
  /** Markdown source */
  children?: string | null
  className?: string
}

/**
 * Markdown rendering (react-markdown + GFM): headings / lists / tables / blockquotes / task lists / code blocks with a copy button.
 *   <MarkdownView>{text}</MarkdownView>
 */
function MarkdownView({ children, className }: MarkdownViewProps) {
  return (
    <div className={cn('md-prose', className)}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}

export default memo(MarkdownView)
