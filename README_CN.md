# castor-kit

> **AI-First 全栈管理脚手架**
> Node.js + TypeScript（Fastify 5 · Zod · Drizzle）+ React 18 + PostgreSQL + Semi Design — 为 AI 驱动的端到端功能开发而生。

![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![Node 22+](https://img.shields.io/badge/node-22%2B-green)
![pnpm](https://img.shields.io/badge/pnpm-workspaces-orange)

**[📖 在线文档](https://robeshell.github.io/castor-kit/)** · **[English](README.md)**

> Castor 是河狸的拉丁属名——“自然界的工程师”，不需要图纸就能把整座水坝建起来并持续扩建。
>
> castor-kit 是 [AuraStack](https://github.com/robeshell/AuraStack)（Flask + React）的 Node.js/TypeScript 重写版：直连同一套 PostgreSQL 表结构，API 契约兼容，React 前端原样沿用。

---

## 特性

- **AI-First 工作流** — 预配置 Claude Code、Cursor、Copilot、Windsurf、Codex CLI 与 MCP 客户端；PM 用自然语言描述需求，AI 自动生成完整模块
- **类型化工具链** — `pnpm scaffold` 一次生成数据表 + 接口 + 页面，`pnpm verify` 作为交付门禁（类型检查、分层、迁移真实落库、RBAC 种子、文档路径）
- **完整 RBAC** — 用户 / 角色 / 菜单权限系统，支持按钮级别的权限控制
- **30+ 组件示例** — 管理列表、看板、甘特图、数据大屏、AI 对话、3D 创意、编辑器、WebSocket 等
- **导入 / 导出内置** — 每个列表页标配 CSV、XLSX 导入导出
- **定时任务** — 基于数据库租约的调度器，自带管理 UI
- **生产级 Docker** — 一条命令启动完整服务栈，自动完成 Drizzle 迁移和 RBAC 初始化

---

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node 22 · TypeScript · Fastify 5 · Zod · pino |
| 数据库 | PostgreSQL 14+ · Drizzle ORM + drizzle-kit（SQL 迁移） |
| 前端 | React 18 · Vite 5 · React Router 7 · Axios |
| UI | Semi Design 2.93 |
| 图表 | ECharts 6 · echarts-for-react |
| 3D | Three.js 0.176 |
| 编辑器 | Monaco Editor · react-quill |
| 仓库 | pnpm workspaces：`apps/api` · `apps/web` · `apps/mcp` |

---

## 快速开始（Docker）

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh          # 交互式向导：设置管理员密码与端口，可选配置 AI 功能
```

打开 **http://localhost:5000**（或向导中设置的端口），使用 `admin` 和向导中设置的密码登录。

## 本地开发

需要 Node 22+、pnpm 与本机 PostgreSQL。

```bash
pnpm install
cp apps/api/.env.example apps/api/.env.development   # 按需修改 DEV_DATABASE_URL
createdb aurastack
pnpm db:migrate        # 建表（Drizzle baseline）
pnpm seed:rbac         # 菜单、超级管理员角色、admin / admin123
pnpm dev               # api :5001 + web :5173
```

AI 工具的上下文入口：[AGENTS.md](AGENTS.md)（所有工具通用）、[CLAUDE.md](CLAUDE.md)、[CODEX.md](CODEX.md)、`.cursor/rules/`、`.windsurfrules`、`.github/copilot-instructions.md`。完整重写方案见 [docs/rewrite-plan.md](docs/rewrite-plan.md)。

> 部署方式、环境变量、AI 工具集成等详细说明，请查阅 **[在线文档](https://robeshell.github.io/castor-kit/)**。

---

## 命名约定

全部小写连字符：`castor-kit`、`@castor-kit/api`（会话 cookie `castor_session` 例外用下划线）。不用驼峰，不用 Stack 后缀。

---

## 许可证

MIT
