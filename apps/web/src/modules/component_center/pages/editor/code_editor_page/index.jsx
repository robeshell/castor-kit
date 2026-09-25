import { useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Copy, FileCode2, RotateCcw, WandSparkles } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/lib/toast'
import { useMonacoTheme } from '@/lib/monaco-theme'
import { INITIAL_CODE } from '@/modules/component_center/pages/editor/code_editor_page/demo-content'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

const LANGUAGE_OPTIONS = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Python', value: 'python' },
  { label: 'SQL', value: 'sql' },
  { label: 'JSON', value: 'json' },
  { label: 'HTML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'Java', value: 'java' },
]

// Follows the app's light / dark theme by default; can also be pinned to light / dark
const THEME_OPTIONS = [
  { label: '跟随界面主题', value: 'auto' },
  { label: '浅色 (vs)', value: 'light' },
  { label: '深色 (vs-dark)', value: 'dark' },
]

// label and option labels are Chinese source text, translated here
function LabeledSelect({ label, value, onChange, options }) {
  const { t } = useTranslation()
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="h-8 w-[180px] text-[13px]">
        <span className="text-muted-foreground text-xs">{t(label)}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {t(opt.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function CodeEditorPage() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const editorRef = useRef(null)
  const [language, setLanguage] = useState('javascript')
  const [themeMode, setThemeMode] = useState('auto')
  const [code, setCode] = useState(INITIAL_CODE)
  const monacoTheme = useMonacoTheme(themeMode)

  const lineCount = code ? code.split('\n').length : 0
  const charCount = code.length

  const handleEditorMount = (editor) => {
    editorRef.current = editor
  }

  const handleFormat = () => {
    const action = editorRef.current?.getAction('editor.action.formatDocument')
    if (!action) return
    action.run().then(() => toast.success('代码已格式化'))
  }

  const handleCopy = () => {
    const content = editorRef.current ? editorRef.current.getValue() : code
    navigator.clipboard
      .writeText(content)
      .then(() => toast.success('代码已复制到剪贴板'))
      .catch(() => toast.error('复制失败'))
  }

  const handleResetSample = () => {
    setLanguage('javascript')
    setCode(INITIAL_CODE)
    toast.success('已恢复示例代码')
  }

  return (
    <div>
      <PageHeader
        title="代码编辑器"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleResetSample}>
              <RotateCcw />
              {t('示例代码')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy />
              {t('复制代码')}
            </Button>
            <Button variant="brand" size="sm" onClick={handleFormat}>
              <WandSparkles />
              {t('格式化代码')}
            </Button>
          </>
        }
      />

      <Panel padded={false} bodyClassName="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <LabeledSelect label="语言" value={language} onChange={setLanguage} options={LANGUAGE_OPTIONS} />
            <LabeledSelect label="主题" value={themeMode} onChange={setThemeMode} options={THEME_OPTIONS} />
          </div>
          <div className="text-muted-foreground flex items-center gap-4 text-xs">
            <span>
              <Trans i18nKey="行数 <0>{{count}}</0>" values={{ count: lineCount }} components={[<span className="text-foreground font-medium tabular-nums" />]} />
            </span>
            <span>
              <Trans i18nKey="字符 <0>{{count}}</0>" values={{ count: charCount }} components={[<span className="text-foreground font-medium tabular-nums" />]} />
            </span>
            <span className="bg-brand-soft text-primary inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px]">
              <FileCode2 className="size-3" />
              {language}
            </span>
          </div>
        </div>

        <Editor
          height={isMobile ? '360px' : '540px'}
          language={language}
          theme={monacoTheme}
          value={code}
          onChange={(val) => setCode(val || '')}
          onMount={handleEditorMount}
          loading={<Spinner className="text-muted-foreground" />}
          options={{
            fontSize: 14,
            lineHeight: 22,
            fontFamily: 'Geist Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace',
            minimap: { enabled: !isMobile },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
          }}
        />

        <div className="text-muted-foreground flex flex-wrap justify-between gap-2 border-t px-4 py-2.5 text-xs">
          <span>{t('支持智能补全 · 错误提示 · 括号匹配 · 多光标编辑')}</span>
          <span>{t('Shift+Alt+F 格式化 · Ctrl+Z 撤销 · Ctrl+/ 注释')}</span>
        </div>
      </Panel>
    </div>
  )
}
