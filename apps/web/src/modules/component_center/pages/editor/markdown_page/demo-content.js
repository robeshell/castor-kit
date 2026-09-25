// i18n-ignore-file: sample Markdown document is demo content, not UI copy

/** Sample Markdown document loaded into the editor */
export const INITIAL_MARKDOWN = `# castor-kit 项目文档

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

