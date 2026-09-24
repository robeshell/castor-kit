import { CARD_STYLE } from '@/shared/styles'
import { useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import Editor from '@monaco-editor/react'
import { Button, Select, Space, Toast, Typography } from '@douyinfe/semi-ui'


const C = {
  blue: 'var(--semi-color-primary)',
  green: '#00B96B',
  orange: '#FA8C16',
  purple: '#9254DE',
  red: '#FF4D4F',
  cyan: '#13C2C2',
  border: 'var(--semi-color-border)',
  text0: 'var(--semi-color-text-0)',
  text1: 'var(--semi-color-text-1)',
  text2: 'var(--semi-color-text-2)',
}

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

const THEME_OPTIONS = [
  { label: '浅色 (vs)', value: 'vs' },
  { label: '深色 (vs-dark)', value: 'vs-dark' },
]

const INITIAL_CODE = `// castor-kit 示例代码
// 基于 Monaco Editor 的代码编辑器

/**
 * 防抖函数 - 在指定延迟后执行函数
 * @param {Function} fn - 需要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖处理后的函数
 */
function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
      timer = null
    }, delay)
  }
}

/**
 * 深拷贝对象
 * @param {any} obj - 需要深拷贝的对象
 * @returns {any} 拷贝后的对象
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, deepClone(value)])
  )
}

// 示例：使用防抖处理搜索输入
const handleSearch = debounce((query) => {
  console.log('搜索关键词:', query)
  // 在这里调用 API
  fetch(\`/api/search?q=\${encodeURIComponent(query)}\`)
    .then(res => res.json())
    .then(data => console.log('搜索结果:', data))
    .catch(err => console.error('搜索失败:', err))
}, 500)

// 示例：对象操作
const config = {
  theme: 'dark',
  language: 'zh-CN',
  features: {
    autoSave: true,
    lineNumbers: true,
    minimap: false,
  },
}

const newConfig = deepClone(config)
newConfig.theme = 'light'

console.log('原始配置:', config.theme)   // dark
console.log('新配置:', newConfig.theme)  // light
`

export default function CodeEditorPage() {
  const isMobile = useIsMobile()
  const editorRef = useRef(null)
  const [language, setLanguage] = useState('javascript')
  const [theme, setTheme] = useState('vs')
  const [code, setCode] = useState(INITIAL_CODE)
  const [lineCount, setLineCount] = useState(0)
  const [charCount, setCharCount] = useState(0)

  const handleEditorMount = (editor) => {
    editorRef.current = editor
    const model = editor.getModel()
    if (model) {
      setLineCount(model.getLineCount())
      setCharCount(model.getValue().length)
    }
    editor.onDidChangeModelContent(() => {
      const m = editor.getModel()
      if (m) {
        setLineCount(m.getLineCount())
        setCharCount(m.getValue().length)
      }
    })
  }

  const handleChange = (val) => {
    setCode(val || '')
  }

  const handleFormat = () => {
    if (!editorRef.current) return
    editorRef.current
      .getAction('editor.action.formatDocument')
      ?.run()
      .then(() => {
        Toast.success('代码已格式化')
      })
  }

  const handleCopy = () => {
    const content = editorRef.current ? editorRef.current.getValue() : code
    navigator.clipboard.writeText(content).then(() => {
      Toast.success('代码已复制到剪贴板')
    })
  }

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 20 }}>
        <Typography.Title heading={4} style={{ marginBottom: 4 }}>
          代码编辑器
        </Typography.Title>
        <Typography.Text type="tertiary">
          基于 Monaco Editor 的代码编辑组件，支持多语言语法高亮和主题切换
        </Typography.Text>
      </div>

      {/* 编辑器卡片 */}
      <div style={CARD_STYLE}>
        {/* 工具栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Space wrap>
            <Select
              value={language}
              onChange={setLanguage}
              optionList={LANGUAGE_OPTIONS}
              style={{ width: 150 }}
              prefix={<span style={{ fontSize: 12, color: C.text2 }}>语言</span>}
            />
            <Select
              value={theme}
              onChange={setTheme}
              optionList={THEME_OPTIONS}
              style={{ width: 150 }}
              prefix={<span style={{ fontSize: 12, color: C.text2 }}>主题</span>}
            />
            <Button type="primary" onClick={handleFormat}>
              格式化代码
            </Button>
            <Button onClick={handleCopy}>复制代码</Button>
          </Space>

          {/* 状态栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '4px 12px',
              background: 'var(--semi-color-bg-0)',
              borderRadius: 6,
              fontSize: 12,
              color: C.text2,
            }}
          >
            <span>
              行数：<span style={{ fontWeight: 600, color: C.blue }}>{lineCount}</span>
            </span>
            <span>
              字符：<span style={{ fontWeight: 600, color: C.green }}>{charCount}</span>
            </span>
            <span
              style={{
                padding: '1px 6px',
                background: theme === 'vs-dark' ? '#333' : 'var(--semi-color-primary-light-default)',
                color: theme === 'vs-dark' ? '#ddd' : 'var(--semi-color-primary)',
                borderRadius: 4,
              }}
            >
              {language}
            </span>
          </div>
        </div>

        {/* Monaco 编辑器 */}
        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <Editor
            height={isMobile ? '320px' : '500px'}
            language={language}
            theme={theme}
            value={code}
            onChange={handleChange}
            onMount={handleEditorMount}
            options={{
              fontSize: 14,
              lineHeight: 22,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              tabSize: 2,
              automaticLayout: true,
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>

        {/* 底部提示 */}
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: C.text2,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>支持智能补全 · 错误提示 · 括号匹配 · 多光标编辑</span>
          <span>Ctrl+S 格式化 · Ctrl+Z 撤销 · Ctrl+/ 注释</span>
        </div>
      </div>
    </div>
  )
}
