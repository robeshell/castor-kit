import { useMemo, useState } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { Code2, Copy, Eraser, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import './quill-theme.css'

const INITIAL_CONTENT = `<h1>欢迎使用富文本编辑器</h1>
<p>这是一个基于 <strong>Quill.js</strong> 的富文本编辑器示例，支持以下功能：</p>
<ul>
  <li>文字<strong>加粗</strong>、<em>斜体</em>、<u>下划线</u>、<s>删除线</s></li>
  <li>标题 H1、H2、H3 格式</li>
  <li>有序列表和无序列表</li>
  <li>代码块和内联代码</li>
  <li>链接插入</li>
  <li>字体颜色设置</li>
</ul>
<h2>代码示例</h2>
<pre class="ql-syntax">function greet(name) {
  console.log('Hello, ' + name + '!');
}
greet('World');</pre>
<h3>引用示例</h3>
<blockquote>这是一段引用文字，可以用来强调重要内容。</blockquote>
<p>欢迎开始编辑，体验丰富的格式化功能！</p>`

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

// Quill 2：有序 / 无序列表都属于 list 格式（不再有单独的 bullet）
const FORMATS = ['header', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'list', 'blockquote', 'code-block', 'link']

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
  // 中文按字计，英文按词计
  const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = (trimmed.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b\w+\b/g) || []).length
  return chineseChars + englishWords
}

export default function RichTextPage() {
  const [value, setValue] = useState(INITIAL_CONTENT)
  const [htmlOpen, setHtmlOpen] = useState(false)

  const wordCount = useMemo(() => countWords(value), [value])

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
              清空内容
            </Button>
            <Button variant="brand" size="sm" onClick={() => setHtmlOpen(true)}>
              <Code2 />
              查看 HTML
            </Button>
          </>
        }
      />

      <Panel padded={false}>
        <div className="rt-editor">
          <ReactQuill theme="snow" value={value} onChange={setValue} modules={MODULES} formats={FORMATS} bounds=".rt-editor" placeholder="开始输入内容…" />
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs">
          <span className="flex items-center gap-1.5">
            <Keyboard className="size-3.5" />
            支持粘贴带格式文本 · 支持快捷键（Ctrl+B 加粗、Ctrl+I 斜体、Ctrl+U 下划线）
          </span>
          <span>
            字数统计 <span className="text-foreground font-medium tabular-nums">{wordCount}</span> 字
          </span>
        </div>
      </Panel>

      <Dialog open={htmlOpen} onOpenChange={setHtmlOpen}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>HTML 源码</DialogTitle>
            <DialogDescription>编辑器当前内容对应的 HTML</DialogDescription>
          </DialogHeader>
          <pre className="bg-muted/60 max-h-[400px] overflow-y-auto rounded-[10px] p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap shadow-[0_0_0_1px_var(--border)]">
            {value || '<p><br></p>'}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHtmlOpen(false)}>
              关闭
            </Button>
            <Button onClick={handleCopyHtml}>
              <Copy />
              复制 HTML
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
