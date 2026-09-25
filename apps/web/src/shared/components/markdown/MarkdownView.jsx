import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy } from 'lucide-react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import './markdown.css'

/** 从 <pre><code class="language-xx">…</code></pre> 里取语言与纯文本 */
function readCode(children) {
  const child = Array.isArray(children) ? children[0] : children
  const className = child?.props?.className || ''
  const language = /language-([\w+#-]+)/.exec(className)?.[1] || ''
  const raw = child?.props?.children
  const text = (Array.isArray(raw) ? raw.join('') : String(raw ?? '')).replace(/\n$/, '')
  return { language, text }
}

function CopyButton({ text }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)
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

function CodeBlock({ children }) {
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

const COMPONENTS = {
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

/**
 * Markdown 渲染（react-markdown + GFM）：标题 / 列表 / 表格 / 引用 / 任务列表 / 带复制按钮的代码块。
 *   <MarkdownView>{text}</MarkdownView>
 */
function MarkdownView({ children, className }) {
  return (
    <div className={cn('md-prose', className)}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS}>
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}

export default memo(MarkdownView)
