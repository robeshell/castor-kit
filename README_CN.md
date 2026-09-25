<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/wordmark-dark.svg">
    <img src=".github/assets/wordmark-light.svg" alt="castor-kit" height="96">
  </picture>
</p>

<p align="center">
  <strong>AI-First 全栈管理脚手架。</strong><br>
  用自然语言描述需求，得到一个完整且通过验证的功能模块：<br>
  数据表、接口、页面、权限与迁移。
</p>

<p align="center">
  <a href="https://github.com/robeshell/castor-kit/actions/workflows/ci.yml"><img src="https://github.com/robeshell/castor-kit/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A5%2022-0284c7" alt="Node ≥ 22">
  <img src="https://img.shields.io/badge/pnpm-workspace-22d3ee" alt="pnpm workspace">
  <img src="https://img.shields.io/badge/i18n-zh%20%C2%B7%20en%20%C2%B7%20ja-0284c7" alt="i18n: zh · en · ja">
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-2563eb" alt="PRs welcome"></a>
</p>

<p align="center">
  <a href="website/guide/index.md">文档</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="CONTRIBUTING.md">参与贡献</a> ·
  <a href="README.md">English</a> ·
  <b>简体中文</b> ·
  <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/screenshot-dark.png">
    <img src=".github/assets/screenshot-light.png" alt="castor-kit 管理后台界面" width="880">
  </picture>
</p>

---

## 为什么是 castor-kit

大多数脚手架只给一个起点，剩下的全靠自觉。castor-kit 把"自觉"写了下来：[`AGENTS.md`](AGENTS.md) 用所有 AI 编程工具都能遵循的形式，记录了架构分层、命名、字段类型推断、权限与多语言规则；脚手架和验证门禁再把这些规则变成可以强制执行的流程。结果是：无论由人还是由 AI 编写，第一千个功能都和第一个一样整洁。

> *Castor* 是河狸的拉丁属名。河狸是自然界的工程师，一根一根木头，把整座水坝搭起来。

## 亮点

- **AI 驱动工作流**：已为 Claude Code、Cursor、GitHub Copilot、Windsurf、Codex CLI 与 MCP 客户端预先配置。一句自然语言需求，生成数据表、接口、页面、权限条目与迁移。
- **交付门禁**：`pnpm verify` 执行 15 项检查，包括类型检查、分层规则、迁移链、路由注册、RBAC 种子与同步、OpenAPI 同步、前后端测试与生产构建。
- **完整 RBAC**：用户、角色、菜单、按钮级权限，新功能自动纳入权限体系。
- **认真设计过的界面**：shadcn/ui + Tailwind CSS v4，六种强调色、浅色与深色、三种导航模式，以及能保留页面状态的标签栏。
- **三语国际化**：界面与接口报错支持中文、英文、日文，由扫描脚本和测试守护。
- **25+ 示例页面**：表格、仪表盘、图表、Three.js 地球、AI 对话、编辑器、看板、WebSocket 工具等。
- **导入导出**：前后端都支持 CSV 与 XLSX，逐行校验。
- **一行部署**：`bash setup.sh` 通过 Docker Compose 启动 PostgreSQL、API 与前端，并自动迁移和初始化数据。

## 工作方式

```text
你    ▸ 做一个「设备台账」：名称、编号、状态、采购日期、负责人

AI    ▸ 推断技术规格（类型、表、菜单、按钮权限），展示业务预览供确认
      $ pnpm scaffold -- --name equipment --domain admin --fields "name:str,code:str50,status:str20,purchase_date:date,owner:str"
      $ pnpm db:migrate
      $ pnpm seed:rbac -- --incremental
      $ pnpm verify -- --module equipment
      ✓ typescript_compile ✓ migration_chain ✓ router_registration ✓ rbac_sync ✓ api_tests ✓ frontend_tests ✓ frontend_build
```

完整流程见 [AI 驱动开发](website/guide/ai-workflow.md)。

## 快速开始

**Docker（推荐）**，只需要安装 Docker：

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh
```

安装向导会设置管理员密码和端口（默认 `5000`），并可选配置 AI 功能。完成后打开 `http://localhost:5000`，用 `admin` 登录。

**本地开发**，需要 Node 22+、pnpm 与 PostgreSQL 14+：

```bash
pnpm install
cp apps/api/.env.example apps/api/.env.development   # 设置 DEV_DATABASE_URL
createdb castor_kit
pnpm db:migrate
pnpm seed:rbac
pnpm dev                                              # API :5001 · 前端 :5173
```

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js 22 · TypeScript · Fastify 5 · Zod 4 |
| 数据库 | PostgreSQL · Drizzle ORM（可审查的 SQL 迁移） |
| 前端 | React 19 · Vite · React Router 7 · i18next |
| UI | shadcn/ui（Radix）· Tailwind CSS v4 · Motion · lucide-react |
| 数据与图表 | TanStack Table · react-hook-form · ECharts 6 · Three.js |
| 工具链 | pnpm workspaces · Vitest · ESLint · MCP Server · Docker Compose |

## 目录结构

```text
apps/
  api/        Fastify 接口：db/schema → modules/<domain>/<name>/{schema,repository,service,routes}.ts
  web/        React 应用：modules/<module>/pages/**、公共组件、多语言文案
  mcp/        MCP Server，提供 scaffold / verify / seed / 迁移工具
docs/         架构说明、脚手架使用的模板
website/      文档与官网（VitePress）
AGENTS.md     人和 AI 工具共同遵循的唯一规范来源
```

## 文档

文档位于 [`website/`](website)，包括[介绍](website/guide/index.md)、[快速开始](website/guide/getting-started.md)、[后端开发](website/guide/backend.md)、[前端开发](website/guide/frontend.md)、[权限 RBAC](website/guide/rbac.md)、[多语言](website/guide/i18n.md)、[主题与布局](website/guide/appearance.md)和[部署](website/deploy/index.md)。本地浏览：

```bash
npm --prefix website install
npm --prefix website run dev
```

## 参与贡献

欢迎提交 Issue 和 Pull Request，请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 与[行为准则](CODE_OF_CONDUCT.md)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，不要公开提 Issue。

## 许可证

[MIT](LICENSE) © castor-kit contributors
