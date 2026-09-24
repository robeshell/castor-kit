# castor-kit

AI-First 的 Node.js 全栈脚手架：PM 用自然语言描述需求，AI Agent 端到端交付功能模块（数据表、接口、页面、权限、迁移）。

> Castor 是河狸的拉丁属名——"自然界的工程师"，不需要图纸就能把整座水坝建起来并持续扩建。

castor-kit 是 [AuraStack](https://github.com/robeshell/AuraStack)（Flask + React）的 Node.js/TypeScript 重写版，直连同一套 PostgreSQL，API 契约完全兼容。

## 技术栈（规划）

| 层 | 选型 |
|---|---|
| 后端 | Node 22 + TypeScript + Fastify 5 + Zod + Drizzle ORM + pg |
| 前端 | React 18 + Vite + Semi Design（从 AuraStack 原样迁入） |
| 数据库 | PostgreSQL |
| 仓库 | pnpm workspaces：`apps/api` · `apps/web` · `apps/mcp` · `packages/shared` |

## 状态

设计阶段。完整方案见 [docs/rewrite-plan.md](docs/rewrite-plan.md)。

## 命名约定

全部小写连字符：`castor-kit`、`@castor-kit/api`、`castor_session`（cookie 例外用下划线）。不用驼峰，不用 Stack 后缀。
