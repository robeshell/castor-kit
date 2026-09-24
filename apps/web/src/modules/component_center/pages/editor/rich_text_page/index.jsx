import { CARD_STYLE } from '@/shared/styles'
import { useMemo, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { Button, Modal, Space, Toast, Typography } from '@douyinfe/semi-ui'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'


const C = {
  blue: '#4080FF',
  green: '#00B96B',
  orange: '#FA8C16',
  purple: '#9254DE',
  red: '#FF4D4F',
  cyan: '#13C2C2',
  border: '#eaedf1',
  text0: '#1a1a1a',
  text1: '#434343',
  text2: '#8c8c8c',
}

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
  // Count Chinese characters + English words
  const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = (trimmed.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b\w+\b/g) || []).length
  return chineseChars + englishWords
}

export default function RichTextPage() {
  const isMobile = useIsMobile()
  const [value, setValue] = useState(INITIAL_CONTENT)
  const [htmlModalVisible, setHtmlModalVisible] = useState(false)

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'code-block'],
        ['link'],
        ['clean'],
      ],
    }),
    []
  )

  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'color',
    'background',
    'list',
    'bullet',
    'blockquote',
    'code-block',
    'link',
  ]

  const wordCount = useMemo(() => countWords(value), [value])

  const handleClear = () => {
    setValue('')
    Toast.success('内容已清空')
  }

  const handleViewHtml = () => {
    setHtmlModalVisible(true)
  }

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 20 }}>
        <Typography.Title heading={4} style={{ marginBottom: 4 }}>
          富文本编辑器
        </Typography.Title>
        <Typography.Text type="tertiary">
          基于 Quill.js 的富文本编辑组件，支持格式化、字数统计和 HTML 源码预览
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
          <Space>
            <Button onClick={handleClear}>清空内容</Button>
            <Button type="primary" onClick={handleViewHtml}>
              查看 HTML
            </Button>
          </Space>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              background: 'var(--semi-color-bg-0)',
              borderRadius: 6,
              fontSize: 13,
              color: C.text2,
            }}
          >
            <span>字数统计：</span>
            <span style={{ fontWeight: 600, color: C.blue }}>{wordCount}</span>
            <span>字</span>
          </div>
        </div>

        {/* Quill 编辑器 */}
        <style>{`.rich-text-editor .ql-container { height: 360px; overflow-y: auto; } .rich-text-editor .ql-editor { min-height: 100%; }`}</style>
        <div className="rich-text-editor" style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <ReactQuill
            theme="snow"
            value={value}
            onChange={setValue}
            modules={modules}
            formats={formats}
          />
        </div>

        {/* 底部提示 */}
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${C.border}`,
            fontSize: 12,
            color: C.text2,
          }}
        >
          支持粘贴带格式文本 · 支持快捷键（Ctrl+B 加粗、Ctrl+I 斜体、Ctrl+U 下划线）
        </div>
      </div>

      {/* HTML 预览弹窗 */}
      <Modal
        title="HTML 源码"
        visible={htmlModalVisible}
        onCancel={() => setHtmlModalVisible(false)}
        footer={
          <Button
            type="primary"
            onClick={() => {
              navigator.clipboard.writeText(value).then(() => {
                Toast.success('已复制到剪贴板')
              })
            }}
          >
            复制 HTML
          </Button>
        }
        width={isMobile ? '95vw' : 680}
      >
        <pre
          style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: 16,
            borderRadius: 6,
            fontSize: 13,
            lineHeight: 1.6,
            maxHeight: 400,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            margin: 0,
          }}
        >
          {value || '<p><br></p>'}
        </pre>
      </Modal>
    </div>
  )
}
