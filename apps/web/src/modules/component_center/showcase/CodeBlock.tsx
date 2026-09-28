import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import type { TokensResult } from 'shiki/core'
import type { GrammarName } from '@/components/ai-elements/code-highlighter'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import './showcase.css'

export interface CodeBlockProps {
  code: string
  language?: GrammarName
  className?: string
}

/**
 * Shiki tokens for `code`, or null until they are ready. The highlighter (shiki core + one grammar) is imported on
 * first use, so a page that never shows code never downloads it.
 */
function useTokens(code: string, language: GrammarName): TokensResult | null {
  const [result, setResult] = useState<{ code: string; tokens: TokensResult } | null>(null)
  useEffect(() => {
    let active = true
    import('@/components/ai-elements/code-highlighter')
      .then(({ tokensFor }) => tokensFor(code, language))
      .then((tokens) => {
        if (active) setResult({ code, tokens })
      })
      // Highlighting is cosmetic: on failure the plain text stays
      .catch(() => {})
    return () => {
      active = false
    }
  }, [code, language])
  return result?.code === code ? result.tokens : null
}

/** Read-only source with syntax highlighting (light / dark) under a header with the language and a copy button */
export default function CodeBlock({ code, language = 'tsx', className }: CodeBlockProps) {
  const { t } = useTranslation()
  // ?raw sources end with a newline; drop it so the highlighted, plain and copied text are the same
  const source = code.replace(/\n$/, '')
  const tokens = useTokens(source, language)

  const copy = () => {
    navigator.clipboard
      .writeText(source)
      .then(() => toast.success('已复制'))
      .catch(() => toast.error('复制失败'))
  }

  return (
    <div className={cn('bg-muted/40', className)}>
      <div className="flex h-8 items-center justify-between border-b pr-1.5 pl-4">
        <span className="text-muted-foreground font-mono text-[11px]">{language}</span>
        <Button variant="ghost" size="xs" onClick={copy}>
          <Copy />
          {t('复制')}
        </Button>
      </div>
      {/* Long code scrolls: focusable so the keyboard can scroll it */}
      <pre
        tabIndex={0}
        className="showcase-code focus-visible:outline-ring max-h-[480px] overflow-auto p-4 font-mono text-xs leading-relaxed focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <code>
          {tokens
            ? tokens.tokens.map((line, i) => (
                <Fragment key={i}>
                  {i > 0 ? '\n' : null}
                  {line.map((token, j) => (
                    <span key={j} style={token.htmlStyle}>
                      {token.content}
                    </span>
                  ))}
                </Fragment>
              ))
            : source}
        </code>
      </pre>
    </div>
  )
}
