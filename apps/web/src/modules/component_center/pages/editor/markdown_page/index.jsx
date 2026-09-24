import { useDeferredValue, useRef, useState } from 'react'
import { Copy, Eye, FileText, PencilLine, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import MarkdownView from '@/shared/components/markdown/MarkdownView'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'

const INITIAL_MARKDOWN = `# castor-kit 项目文档

> **castor-kit** 是一款基于 Node.js + Fastify + React + RBAC 的 **AI-First 脚手架**，让 PM 用自然语言描述需求，Agent 端到端实现。

## 技术栈

| 层级 | 技术选型 | 版本 |
|------|----------|------|
| 后端 | Node.js + Fastify + TypeScript | 22 / 5.x |
| 校验 / ORM | Zod + Drizzle ORM | - |
| 前端 | React + Vite | 19.x |
| UI | shadcn/ui + Tailwind CSS | 4.x |
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
│   ├── web/            # 前端：React + Vite + shadcn/ui
│   └── mcp/            # MCP Server
├── docs/               # 方案文档与代码模板
└── website/            # 文档站
\`\`\`

## 贡献指南

欢迎提交 PR！请遵循以下规范：

- [x] 代码风格：**ESLint + TypeScript strict**（后端）/ **ESLint** (前端)
- [x] 提交信息：遵循 [Conventional Commits](https://conventionalcommits.org)
- [ ] 交付前运行 \`pnpm verify -- --module <name>\`

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

function PaneHeader({ icon: Icon, title, extra }) {
  return (
    <div className="bg-muted/40 flex h-10 shrink-0 items-center justify-between gap-3 border-b px-4">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Icon className="size-3.5" />
        {title}
      </span>
      {extra}
    </div>
  )
}

export default function MarkdownPage() {
  const [content, setContent] = useState(INITIAL_MARKDOWN)
  // 预览走 deferred 值：长文档输入时编辑区保持跟手
  const deferredContent = useDeferredValue(content)
  const textareaRef = useRef(null)

  const wordCount = countMarkdownWords(content)

  const replaceSelection = (snippet) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    setContent(content.slice(0, start) + snippet + content.slice(end))
    // 等 React 写回 value 后再恢复光标
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + snippet.length, start + snippet.length)
    }, 0)
  }

  const handleKeyDown = (e) => {
    // Tab 插入两个空格缩进（而不是把焦点移走）
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
              清空
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy />
              复制内容
            </Button>
          </>
        }
      />

      <div className="surface-card mb-4 flex flex-wrap items-center gap-1.5 p-2">
        <span className="text-muted-foreground px-1.5 text-xs">快捷插入</span>
        {SHORTCUTS.map((s) => (
          <Button
            key={s.label}
            variant="ghost"
            size="sm"
            className="h-7 px-2 font-mono text-xs"
            onClick={() => replaceSelection(s.insert)}
          >
            {s.label}
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
                字数 <span className="text-foreground font-medium tabular-nums">{wordCount}</span>
              </span>
            }
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="在此输入 Markdown 内容..."
            spellCheck={false}
            aria-label="Markdown 编辑区"
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
                左侧输入 Markdown 内容后在此实时预览
              </div>
            )}
          </div>
        </Panel>
      </div>

    </div>
  )
}
