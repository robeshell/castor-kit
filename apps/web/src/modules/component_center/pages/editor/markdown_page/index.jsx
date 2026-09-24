import { CARD_STYLE } from '@/shared/styles'
import { useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Space, Toast, Typography } from '@douyinfe/semi-ui'


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

const INITIAL_MARKDOWN = `# castor-kit 项目文档

> **castor-kit** 是一款基于 Node.js + Fastify + React + RBAC 的 **AI-First 脚手架**，让 PM 用自然语言描述需求，Agent 端到端实现。

## 技术栈

| 层级 | 技术选型 | 版本 |
|------|----------|------|
| 后端 | Node.js + Fastify + TypeScript | 22 / 5.x |
| 校验 / ORM | Zod + Drizzle ORM | - |
| 前端 | React + Vite | 18.x |
| UI | Semi Design | 2.x |
| 数据库 | PostgreSQL | 15+ |
| AI | OpenAI 兼容接口 | - |

## 核心功能

### 1. RBAC 权限系统

支持细粒度的菜单和按钮权限控制：

- **超级管理员**：拥有所有权限，代码为 \`super_admin\`
- **角色管理**：支持自定义角色和权限分配
- **菜单权限**：基于菜单 code 的权限校验

### 2. 组件示例中心

提供丰富的业务组件示例，涵盖：

1. 列表页（搜索、分页、导入导出）
2. 统计列表页
3. 卡片列表页
4. 树形列表页
5. 动态表单页
6. 看板页（拖拽排序）
7. 甘特图页
8. **编辑器组件**（富文本、代码、JSON、Markdown）

### 3. AI 集成

\`\`\`typescript
// 示例：调用 OpenAI 兼容接口
import { fetch } from 'undici'

export async function chatWithAi(prompt: string): Promise<string> {
  const res = await fetch(\`\${process.env.AI_API_BASE}/chat/completions\`, {
    method: 'POST',
    headers: { Authorization: \`Bearer \${process.env.AI_API_KEY}\`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.AI_MODEL, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = (await res.json()) as { choices: { message: { content: string } }[] }
  return data.choices[0].message.content
}
\`\`\`

## 快速开始

\`\`\`bash
# 1. 克隆项目
git clone https://github.com/your-org/castor-kit.git && cd castor-kit

# 2. 安装依赖（Node 22 + pnpm）
pnpm install

# 3. 配置数据库连接
cp apps/api/.env.example apps/api/.env.development

# 4. 初始化数据库（迁移 + RBAC 同步）
pnpm setup-once

# 5. 启动后端（5001）与前端（5173）
pnpm dev
\`\`\`

## 目录结构

\`\`\`
castor-kit/
├── apps/
│   ├── api/            # 后端：Fastify + Drizzle（src/modules/<域>/<模块>）
│   ├── web/            # 前端：React + Vite + Semi Design
│   └── mcp/            # MCP Server
├── docs/               # 方案文档与代码模板
└── website/            # 文档站
\`\`\`

## 贡献指南

欢迎提交 PR！请遵循以下规范：

- 代码风格：**ESLint + TypeScript strict**（后端）/ **ESLint** (前端)
- 提交信息：遵循 [Conventional Commits](https://conventionalcommits.org)
- 交付前运行 \`pnpm verify -- --module <name>\`

---

*本文档由 castor-kit 团队维护，最后更新于 2026-09-25*
`

const SHORTCUTS = [
  { label: '# 标题', insert: '# 标题\n' },
  { label: '**加粗**', insert: '**加粗文字**' },
  { label: '*斜体*', insert: '*斜体文字*' },
  { label: '---', insert: '\n---\n' },
  { label: '`代码`', insert: '`代码`' },
  { label: '链接', insert: '[链接文字](https://example.com)' },
  {
    label: '表格',
    insert: '\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 值1 | 值2 | 值3 |\n',
  },
  { label: '代码块', insert: '\n```javascript\n// 代码块\nconsole.log("Hello")\n```\n' },
]

const MARKDOWN_STYLES = `
.md-preview h1 { font-size: 1.7em; font-weight: 700; margin: 0.6em 0 0.4em; border-bottom: 2px solid var(--semi-color-border); padding-bottom: 0.3em; color: var(--semi-color-text-0); }
.md-preview h2 { font-size: 1.35em; font-weight: 700; margin: 1em 0 0.4em; border-bottom: 1px solid var(--semi-color-border); padding-bottom: 0.2em; color: var(--semi-color-text-0); }
.md-preview h3 { font-size: 1.1em; font-weight: 600; margin: 0.8em 0 0.3em; color: var(--semi-color-text-1); }
.md-preview p { margin: 0.5em 0; line-height: 1.75; color: var(--semi-color-text-1); }
.md-preview ul, .md-preview ol { padding-left: 1.5em; margin: 0.5em 0; }
.md-preview li { margin: 0.25em 0; line-height: 1.6; color: var(--semi-color-text-1); }
.md-preview blockquote { border-left: 4px solid var(--semi-color-primary); margin: 0.8em 0; padding: 0.4em 1em; background: var(--semi-color-primary-light-default); border-radius: 0 6px 6px 0; color: var(--semi-color-text-1); }
.md-preview blockquote p { margin: 0; }
.md-preview code { background: var(--semi-color-fill-0); padding: 1px 5px; border-radius: 3px; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.88em; color: var(--semi-color-primary); }
.md-preview pre { background: #1e1e1e; color: #d4d4d4; padding: 14px 16px; border-radius: 8px; overflow-x: auto; margin: 0.8em 0; line-height: 1.5; }
.md-preview pre code { background: none; color: inherit; padding: 0; font-size: 0.87em; }
.md-preview table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
.md-preview th { background: var(--semi-color-fill-1); font-weight: 600; color: var(--semi-color-text-0); }
.md-preview th, .md-preview td { border: 1px solid var(--semi-color-border); padding: 7px 12px; text-align: left; font-size: 0.93em; }
.md-preview tr:nth-child(even) { background: var(--semi-color-fill-0); }
.md-preview a { color: var(--semi-color-primary); text-decoration: none; }
.md-preview a:hover { text-decoration: underline; }
.md-preview hr { border: none; border-top: 1px solid var(--semi-color-border); margin: 1em 0; }
.md-preview strong { font-weight: 600; color: var(--semi-color-text-0); }
.md-preview em { font-style: italic; color: var(--semi-color-text-2); }
`

function countMarkdownWords(text) {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = (trimmed.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b\w+\b/g) || []).length
  return chineseChars + englishWords
}

export default function MarkdownPage() {
  const isMobile = useIsMobile()
  const [content, setContent] = useState(INITIAL_MARKDOWN)
  const textareaRef = useRef(null)

  const wordCount = countMarkdownWords(content)

  const insertText = (snippet) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const before = content.slice(0, start)
    const after = content.slice(end)
    const newContent = before + snippet + after
    setContent(newContent)
    // Restore cursor after state update
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + snippet.length, start + snippet.length)
    }, 0)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      Toast.success('Markdown 内容已复制')
    })
  }

  const handleClear = () => {
    setContent('')
    Toast.success('内容已清空')
  }

  return (
    <div>
      {/* 注入 Markdown 样式 */}
      <style>{MARKDOWN_STYLES}</style>

      {/* 页面标题 */}
      <div style={{ marginBottom: 20 }}>
        <Typography.Title heading={4} style={{ marginBottom: 4 }}>
          Markdown 预览
        </Typography.Title>
        <Typography.Text type="tertiary">
          左侧编辑 Markdown，右侧实时渲染预览，支持 GFM 扩展语法（表格、任务列表等）
        </Typography.Text>
      </div>

      <div style={CARD_STYLE}>
        {/* 快捷插入工具栏 */}
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
            {SHORTCUTS.map((s) => (
              <Button key={s.label} size="small" onClick={() => insertText(s.insert)}>
                {s.label}
              </Button>
            ))}
          </Space>
          <Space>
            <Button onClick={handleCopy}>复制内容</Button>
            <Button onClick={handleClear}>清空</Button>
          </Space>
        </div>

        {/* 左右分屏 */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, height: isMobile ? 'auto' : 600 }}>
          {/* 左侧：编辑区 */}
          <div
            style={{
              flex: 1,
              minHeight: isMobile ? 300 : 'auto',
              display: 'flex',
              flexDirection: 'column',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            {/* 编辑区标题 */}
            <div
              style={{
                padding: '6px 12px',
                background: 'var(--semi-color-fill-0)',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 12,
                color: C.text2,
                fontWeight: 500,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <span>✏️ 编辑</span>
              <span>
                字数：<span style={{ fontWeight: 600, color: C.blue }}>{wordCount}</span>
              </span>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{
                flex: 1,
                padding: '12px',
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                fontSize: 13,
                lineHeight: 1.7,
                color: C.text1,
                border: 'none',
                outline: 'none',
                resize: 'none',
                background: 'var(--semi-color-fill-0)',
                overflowY: 'auto',
              }}
              placeholder="在此输入 Markdown 内容..."
              spellCheck={false}
            />
          </div>

          {/* 右侧：预览区 */}
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
            {/* 预览区标题 */}
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
              👁️ 预览
            </div>

            {/* 渲染内容 */}
            <div
              className="md-preview"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
                background: 'var(--semi-color-bg-1)',
                fontSize: 14,
              }}
            >
              {content.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              ) : (
                <div
                  style={{
                    color: C.text2,
                    fontSize: 13,
                    textAlign: 'center',
                    marginTop: 60,
                  }}
                >
                  左侧输入 Markdown 内容后在此实时预览
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
          支持 GFM 语法（表格、删除线、任务列表）· 支持代码块语法高亮 · Tab 键插入缩进
        </div>
      </div>
    </div>
  )
}
