import { useMemo, useState } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { Code2, Copy, Eraser, Keyboard } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import { INITIAL_CONTENT } from '@/modules/component_center/pages/editor/rich_text_page/demo-content'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import './quill-theme.css'

const MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link'],
    ['clean'],
  ],
}

// Quill 2: ordered and bullet lists are both the list format (there is no separate bullet format)
const FORMATS = ['header', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'list', 'blockquote', 'code-block', 'link']

// Quill draws its header picker and link tooltip labels with CSS ::before / ::after content;
// quill-theme.css reads them from these custom properties so they follow the current language
const QUILL_LABELS = {
  '--rt-label-normal': '正文',
  '--rt-label-h1': '标题 1',
  '--rt-label-h2': '标题 2',
  '--rt-label-h3': '标题 3',
  '--rt-label-visit': '访问链接：',
  '--rt-label-enter': '输入链接：',
  '--rt-label-edit': '编辑',
  '--rt-label-remove': '移除',
  '--rt-label-save': '保存',
}

function countWords(html) {
  const text = html.replace(/<[^>]+>/g, '')
  const decoded = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
  const trimmed = decoded.trim()
  if (!trimmed) return 0
  // Count Chinese by character and English by word
  const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = (trimmed.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b\w+\b/g) || []).length
  return chineseChars + englishWords
}

export default function RichTextPage() {
  const { t } = useTranslation()
  const [value, setValue] = useState(INITIAL_CONTENT)
  const [htmlOpen, setHtmlOpen] = useState(false)

  const wordCount = useMemo(() => countWords(value), [value])
  // Translated labels as CSS strings, e.g. { '--rt-label-save': '"Save"' }
  const quillLabels = useMemo(
    () => Object.fromEntries(Object.entries(QUILL_LABELS).map(([name, text]) => [name, JSON.stringify(t(text))])),
    [t],
  )

  const handleClear = () => {
    setValue('')
    toast.success('内容已清空')
  }

  const handleCopyHtml = () => {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success('已复制到剪贴板'))
      .catch(() => toast.error('复制失败'))
  }

  return (
    <div>
      <PageHeader
        title="富文本编辑器"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleClear}>
              <Eraser />
              {t('清空内容')}
            </Button>
            <Button variant="brand" size="sm" onClick={() => setHtmlOpen(true)}>
              <Code2 />
              {t('查看 HTML')}
            </Button>
          </>
        }
      />

      <Panel padded={false}>
        <div className="rt-editor" style={quillLabels}>
          <ReactQuill theme="snow" value={value} onChange={setValue} modules={MODULES} formats={FORMATS} bounds=".rt-editor" placeholder={t('开始输入内容…')} />
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs">
          <span className="flex items-center gap-1.5">
            <Keyboard className="size-3.5" />
            {t('支持粘贴带格式文本 · 支持快捷键（Ctrl+B 加粗、Ctrl+I 斜体、Ctrl+U 下划线）')}
          </span>
          <span>
            <Trans i18nKey="字数统计 <0>{{count}}</0> 字" values={{ count: wordCount }} components={[<span className="text-foreground font-medium tabular-nums" />]} />
          </span>
        </div>
      </Panel>

      <Dialog open={htmlOpen} onOpenChange={setHtmlOpen}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{t('HTML 源码')}</DialogTitle>
            <DialogDescription>{t('编辑器当前内容对应的 HTML')}</DialogDescription>
          </DialogHeader>
          <pre className="bg-muted/60 max-h-[400px] overflow-y-auto rounded-[10px] p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap shadow-[0_0_0_1px_var(--border)]">
            {value || '<p><br></p>'}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHtmlOpen(false)}>
              {t('关闭')}
            </Button>
            <Button onClick={handleCopyHtml}>
              <Copy />
              {t('复制 HTML')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
