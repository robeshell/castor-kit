import { CARD_STYLE } from '@/shared/styles'
import { useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import Editor from '@monaco-editor/react'
import { Button, Space, Toast, Typography } from '@douyinfe/semi-ui'


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

const EXAMPLE_JSON = {
  project: {
    name: 'castor-kit',
    version: '2.0.0',
    description: 'Fastify + React + RBAC AI-First 脚手架',
    active: true,
    stars: 1024,
    license: null,
    tags: ['fastify', 'typescript', 'react', 'rbac', 'ai', 'scaffold'],
    author: {
      name: '研发团队',
      email: 'dev@castor-kit.dev',
      roles: ['maintainer', 'committer'],
    },
    dependencies: {
      backend: {
        node: '22.x',
        fastify: '5.x',
        drizzle: '0.x',
        postgresql: '15+',
      },
      frontend: {
        react: '18.x',
        vite: '5.x',
        semiUI: '2.x',
      },
    },
    features: [
      {
        id: 1,
        name: 'RBAC 权限',
        enabled: true,
        config: { strict: true, superAdmin: 'super_admin' },
      },
      {
        id: 2,
        name: '组件示例中心',
        enabled: true,
        config: { modules: 12, categories: 6 },
      },
      {
        id: 3,
        name: 'AI 集成',
        enabled: false,
        config: null,
      },
    ],
    stats: {
      totalUsers: 256,
      activeUsers: 128,
      dailyRequests: 50000,
      uptime: 99.9,
    },
  },
}

// ── 递归 JSON 树节点 ──────────────────────────────────────────────────────────

const TYPE_COLOR = {
  string: C.green,
  number: C.blue,
  boolean: C.orange,
  null: C.text2,
  object: C.purple,
  array: C.purple,
}

function JsonNode({ nodeKey, value, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2)

  const indent = depth * 16
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value

  const isPrimitive = type !== 'object' && type !== 'array'

  const renderValue = () => {
    if (type === 'null') return <span style={{ color: C.text2, fontStyle: 'italic' }}>null</span>
    if (type === 'string')
      return <span style={{ color: C.green }}>&quot;{String(value)}&quot;</span>
    if (type === 'number') return <span style={{ color: C.blue }}>{value}</span>
    if (type === 'boolean')
      return <span style={{ color: C.orange }}>{value ? 'true' : 'false'}</span>
    return null
  }

  if (isPrimitive) {
    return (
      <div
        style={{
          paddingLeft: indent,
          lineHeight: '24px',
          fontSize: 13,
          fontFamily: 'monospace',
        }}
      >
        {nodeKey !== undefined && (
          <span style={{ color: C.purple, marginRight: 4 }}>
            {typeof nodeKey === 'number' ? `[${nodeKey}]` : `"${nodeKey}"`}:
          </span>
        )}
        {renderValue()}
      </div>
    )
  }

  // object or array
  const entries = type === 'array' ? value.map((v, i) => [i, v]) : Object.entries(value)
  const bracket = type === 'array' ? ['[', ']'] : ['{', '}']
  const summary =
    type === 'array' ? `Array(${value.length})` : `Object(${Object.keys(value).length})`

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
      <div
        style={{
          paddingLeft: indent,
          lineHeight: '24px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          userSelect: 'none',
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Expand/collapse icon */}
        <span
          style={{
            display: 'inline-block',
            width: 14,
            textAlign: 'center',
            color: C.text2,
            fontSize: 10,
            transition: 'transform 0.15s',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▶
        </span>

        {/* Key */}
        {nodeKey !== undefined && (
          <span style={{ color: C.purple }}>
            {typeof nodeKey === 'number' ? `[${nodeKey}]` : `"${nodeKey}"`}:
          </span>
        )}

        {/* Opening bracket */}
        <span style={{ color: C.text1 }}>{bracket[0]}</span>

        {/* Collapsed summary */}
        {!expanded && (
          <>
            <span style={{ color: C.text2, fontSize: 11 }}>{summary}</span>
            <span style={{ color: C.text1 }}>{bracket[1]}</span>
          </>
        )}
      </div>

      {expanded && (
        <>
          {entries.map(([k, v]) => (
            <JsonNode key={String(k)} nodeKey={k} value={v} depth={depth + 1} />
          ))}
          <div style={{ paddingLeft: indent, lineHeight: '24px', color: C.text1 }}>
            {bracket[1]}
          </div>
        </>
      )}
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function JsonEditorPage() {
  const isMobile = useIsMobile()
  const [jsonText, setJsonText] = useState(JSON.stringify(EXAMPLE_JSON, null, 2))
  const [parsedJson, setParsedJson] = useState(EXAMPLE_JSON)
  const [parseError, setParseError] = useState(null)

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
      const formatted = JSON.stringify(parsed, null, 2)
      setJsonText(formatted)
      setParsedJson(parsed)
      setParseError(null)
      Toast.success('JSON 已格式化')
    } catch (e) {
      Toast.error('JSON 格式错误，无法格式化')
    }
  }

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(jsonText)
      const minified = JSON.stringify(parsed)
      setJsonText(minified)
      setParsedJson(parsed)
      setParseError(null)
      Toast.success('JSON 已压缩')
    } catch (e) {
      Toast.error('JSON 格式错误，无法压缩')
    }
  }

  const handleExample = () => {
    const text = JSON.stringify(EXAMPLE_JSON, null, 2)
    setJsonText(text)
    setParsedJson(EXAMPLE_JSON)
    setParseError(null)
    Toast.success('已加载示例数据')
  }

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 20 }}>
        <Typography.Title heading={4} style={{ marginBottom: 4 }}>
          JSON 编辑器
        </Typography.Title>
        <Typography.Text type="tertiary">
          基于 Monaco Editor 的 JSON 编辑器，支持语法高亮、实时校验和树形可视化
        </Typography.Text>
      </div>

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
            <Button type="primary" onClick={handleFormat}>
              格式化
            </Button>
            <Button onClick={handleMinify}>压缩</Button>
            <Button onClick={handleExample}>示例数据</Button>
          </Space>

          {parseError && (
            <div
              style={{
                color: C.red,
                fontSize: 12,
                background: '#fff2f0',
                border: `1px solid #ffccc7`,
                borderRadius: 4,
                padding: '3px 10px',
                maxWidth: 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={parseError}
            >
              ✗ JSON 错误: {parseError}
            </div>
          )}

          {!parseError && parsedJson !== null && (
            <div
              style={{
                color: C.green,
                fontSize: 12,
                background: '#f6ffed',
                border: `1px solid #b7eb8f`,
                borderRadius: 4,
                padding: '3px 10px',
              }}
            >
              ✓ JSON 有效
            </div>
          )}
        </div>

        {/* 左右分屏 */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, height: isMobile ? 'auto' : 500 }}>
          {/* 左侧：Monaco 编辑器 */}
          <div
            style={{
              flex: 1,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '6px 12px',
                background: 'var(--semi-color-fill-0)',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 12,
                color: C.text2,
                fontWeight: 500,
              }}
            >
              编辑器
            </div>
            <Editor
              height={isMobile ? '300px' : 'calc(100% - 33px)'}
              language="json"
              theme="vs"
              value={jsonText}
              onChange={handleEditorChange}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 8, bottom: 8 },
                formatOnPaste: true,
                formatOnType: false,
              }}
            />
          </div>

          {/* 右侧：JSON 树形可视化 */}
          <div
            style={{
              flex: 1,
              minHeight: isMobile ? 300 : 'auto',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '6px 12px',
                background: 'var(--semi-color-fill-0)',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 12,
                color: C.text2,
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              树形预览
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px 12px',
                background: 'var(--semi-color-fill-0)',
              }}
            >
              {parseError ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: C.red,
                    fontSize: 13,
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 24 }}>⚠</span>
                  <span>JSON 解析失败</span>
                  <span style={{ fontSize: 11, color: C.text2, textAlign: 'center' }}>
                    {parseError}
                  </span>
                </div>
              ) : parsedJson !== null ? (
                <JsonNode value={parsedJson} depth={0} />
              ) : (
                <div
                  style={{
                    color: C.text2,
                    fontSize: 13,
                    textAlign: 'center',
                    marginTop: 40,
                  }}
                >
                  输入 JSON 后在此展示树形结构
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部提示 */}
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: C.text2,
          }}
        >
          点击树节点中的 ▶ 可展开/折叠子节点 · 颜色区分类型：
          <span style={{ color: C.green, marginLeft: 6 }}>字符串</span>
          <span style={{ color: C.blue, marginLeft: 6 }}>数字</span>
          <span style={{ color: C.orange, marginLeft: 6 }}>布尔值</span>
          <span style={{ color: C.text2, marginLeft: 6 }}>null</span>
          <span style={{ color: C.purple, marginLeft: 6 }}>对象/数组</span>
        </div>
      </div>
    </div>
  )
}
