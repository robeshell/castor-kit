import { useDeferredValue, useRef, useState } from 'react'
import { Copy, Eye, FileText, PencilLine, Trash2 } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import MarkdownView from '@/shared/components/markdown/MarkdownView'
import { INITIAL_MARKDOWN } from '@/modules/component_center/pages/editor/markdown_page/demo-content'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'

// label and insert are Chinese source text, translated when rendered / inserted
const SHORTCUTS = [
  { label: '# 标题', insert: '# 标题\n' },
  { label: '**加粗**', insert: '**加粗文字**' },
  { label: '*斜体*', insert: '*斜体文字*' },
  { label: '---', insert: '\n---\n' },
  { label: '`代码`', insert: '`代码`' },
  { label: '链接', insert: '[链接文字](https://example.com)' },
  { label: '表格', insert: '\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 值1 | 值2 | 值3 |\n' },
  { label: '代码块', insert: '\n```javascript\n// 代码块\nconsole.log("Hello")\n```\n' },
]

function countMarkdownWords(text) {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = (trimmed.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b\w+\b/g) || []).length
  return chineseChars + englishWords
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

export default function MarkdownPage() {
  const { t } = useTranslation()
  const [content, setContent] = useState(INITIAL_MARKDOWN)
  // The preview uses a deferred value so typing stays responsive on long documents
  const deferredContent = useDeferredValue(content)
  const textareaRef = useRef(null)

  const wordCount = countMarkdownWords(content)

  const replaceSelection = (snippet) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    setContent(content.slice(0, start) + snippet + content.slice(end))
    // Restore the caret after React writes the value back
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + snippet.length, start + snippet.length)
    }, 0)
  }

  const handleKeyDown = (e) => {
    // Tab inserts a two-space indent (instead of moving focus)
    if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      replaceSelection('  ')
    }
  }

  const handleCopy = () => {
    navigator.clipboard
      .writeText(content)
      .then(() => toast.success('Markdown 内容已复制'))
      .catch(() => toast.error('复制失败'))
  }

  const handleClear = () => {
    setContent('')
    toast.success('内容已清空')
  }

  return (
    <div>
      <PageHeader
        title="Markdown 预览"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleClear}>
              <Trash2 />
              {t('清空')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy />
              {t('复制内容')}
            </Button>
          </>
        }
      />

      <div className="surface-card mb-4 flex flex-wrap items-center gap-1.5 p-2">
        <span className="text-muted-foreground px-1.5 text-xs">{t('快捷插入')}</span>
        {SHORTCUTS.map((s) => (
          <Button
            key={s.label}
            variant="ghost"
            size="sm"
            className="h-7 px-2 font-mono text-xs"
            onClick={() => replaceSelection(t(s.insert))}
          >
            {t(s.label)}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:h-[640px] md:grid-cols-2">
        <Panel padded={false} className="flex min-h-[360px] flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
          <PaneHeader
            icon={PencilLine}
            title="编辑"
            extra={
              <span className="text-muted-foreground text-xs">
                <Trans i18nKey="字数 <0>{{count}}</0>" values={{ count: wordCount }} components={[<span className="text-foreground font-medium tabular-nums" />]} />
              </span>
            }
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('在此输入 Markdown 内容...')}
            spellCheck={false}
            aria-label={t('Markdown 编辑区')}
            className="placeholder:text-muted-foreground min-h-[320px] flex-1 resize-none bg-transparent px-4 py-3 font-mono text-[13px] leading-relaxed outline-none"
          />
        </Panel>

        <Panel padded={false} className="flex min-h-[360px] flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
          <PaneHeader icon={Eye} title="预览" />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {deferredContent.trim() ? (
              <MarkdownView>{deferredContent}</MarkdownView>
            ) : (
              <div className="text-muted-foreground flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-[13px]">
                <FileText className="size-5" />
                {t('左侧输入 Markdown 内容后在此实时预览')}
              </div>
            )}
          </div>
        </Panel>
      </div>

    </div>
  )
}
