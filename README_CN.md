<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/wordmark-dark.svg">
  <img src=".github/assets/wordmark-light.svg" alt="castor-kit" height="110">
</picture>

### 开箱即用的管理后台，新功能一句话生成

用户、角色、权限、菜单、日志这些后台必备功能已经做好。<br>
要加新页面，告诉 AI 你要什么，它会生成数据表、接口和页面，并自动检查能否正常运行。

[![CI](https://github.com/robeshell/castor-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/robeshell/castor-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb)](LICENSE)
![Node ≥ 22](https://img.shields.io/badge/node-%E2%89%A5%2022-0284c7)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-2563eb)
![i18n](https://img.shields.io/badge/i18n-zh%20%C2%B7%20en%20%C2%B7%20ja-0284c7)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-22d3ee)](CONTRIBUTING.md)

[English](README.md) · **简体中文** · [日本語](README.ja.md)

[文档](website/guide/index.md) · [快速开始](#快速开始) · [用 AI 做一个功能](#用-ai-做一个功能) · [参与贡献](CONTRIBUTING.md)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/screenshot-zh-dark.webp">
  <img src=".github/assets/screenshot-zh-light.webp" alt="castor-kit 管理后台界面" width="900">
</picture>

</div>

## castor-kit 是什么？

castor-kit 是一个开源的管理后台：今天就能直接用，以后可以让 AI 帮你加功能。

- **开箱即用**：登录、用户、角色、按钮级权限、菜单、日志、数据字典、定时任务、消息通知、公告都已做好，界面精致，支持浅色和深色。
- **为 AI 扩展而设计**：项目的开发规范写成了 AI 编程工具（Claude Code、Cursor、Copilot、Codex CLI 等）能直接遵循的文档。说一句需求，就能得到数据表、接口、页面和权限，并经过自动检查才算完成。

## 功能

<table>
  <tr>
    <td width="33%"><b>权限管理</b><br>用户、角色、菜单，细到每个按钮。</td>
    <td width="33%"><b>AI 就绪</b><br>一句话生成数据表、接口、页面和权限。</td>
    <td width="33%"><b>自动检查</b><br>15 项检查：类型、迁移、路由、权限、测试、构建。</td>
  </tr>
  <tr>
    <td><b>主题与布局</b><br>六种主题色、三种布局、深浅色、标签栏。</td>
    <td><b>中英日三语</b><br>界面和报错信息都能切换语言。</td>
    <td><b>导入导出</b><br>每个表格都能导入导出 Excel、CSV，逐行校验。</td>
  </tr>
  <tr>
    <td><b>25+ 示例页面</b><br>数据大屏、图表、看板、3D、AI 对话、编辑器等。</td>
    <td><b>清晰的架构</b><br>分层明确、TypeScript 严格模式、可审查的 SQL 迁移。</td>
    <td><b>一条命令部署</b><br>Docker Compose 一键启动数据库和整个系统。</td>
  </tr>
</table>

## 快速开始

**用 Docker**（推荐，只需要安装 Docker）：

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh
```

安装向导会让你设置管理员密码和端口（默认 `5000`）。完成后打开 `http://localhost:5000`，用 `admin` 登录。

<details>
<summary><b>本地开发</b>（Node.js 22+、pnpm、PostgreSQL 14+）</summary>

```bash
pnpm install
cp apps/api/.env.example apps/api/.env.development   # 设置 DEV_DATABASE_URL
createdb castor_kit
pnpm db:migrate
pnpm seed:rbac
pnpm dev                                              # API :5001 · 前端 :5173
```

</details>

## 用 AI 做一个功能

1. **告诉 AI 你要什么**：「做一个设备台账：名称、编号、状态、采购日期、负责人。」
2. **确认预览**：AI 自己推断字段类型、数据表、菜单和权限，给你一份业务预览确认。
3. **生成并检查**：AI 依次运行脚手架、数据库迁移、权限同步，最后跑交付检查：

```text
$ pnpm scaffold -- --name equipment --domain admin --fields "name:str,code:str50,status:str20,purchase_date:date,owner:str"
$ pnpm db:migrate
$ pnpm seed:rbac -- --incremental
$ pnpm verify -- --module equipment
✓ typescript_compile  ✓ migration_chain  ✓ router_registration  ✓ rbac_sync
✓ api_tests  ✓ frontend_tests  ✓ frontend_build
```

AI 遵循的规则都在 [`AGENTS.md`](AGENTS.md) 里，详见 [AI 驱动开发](website/guide/ai-workflow.md)。

## 技术栈

| 层 | 技术 |
|---|---|
| **后端** | Node.js 22 · TypeScript · Fastify 5 · Zod 4 · Drizzle ORM · PostgreSQL |
| **前端** | React 19 · Vite · React Router 7 · shadcn/ui · Tailwind CSS v4 · Motion · i18next |
| **数据与图表** | TanStack Table · react-hook-form · ECharts 6 · Three.js |
| **工具链** | pnpm workspaces · Vitest · ESLint · MCP Server · Docker Compose |

<details>
<summary><b>目录结构</b></summary>

```text
apps/
  api/        Fastify 接口：db/schema → modules/<domain>/<name>/{schema,repository,service,routes}.ts
  web/        React 应用：modules/<module>/pages/**、公共组件、多语言文案
  mcp/        MCP Server，提供 scaffold / verify / seed / 迁移工具
docs/         架构说明和脚手架模板
website/      文档与官网（VitePress）
AGENTS.md     人和 AI 工具共同遵循的开发规范
```

</details>

## 文档

| 分类 | 页面 |
|---|---|
| 入门 | [介绍](website/guide/index.md) · [快速开始](website/guide/getting-started.md) · [项目结构](website/guide/project-structure.md) |
| 开发 | [AI 驱动开发](website/guide/ai-workflow.md) · [后端开发](website/guide/backend.md) · [前端开发](website/guide/frontend.md) |
| 专题 | [权限 RBAC](website/guide/rbac.md) · [多语言](website/guide/i18n.md) · [主题与布局](website/guide/appearance.md) |
| 参考 | [命令速查](website/reference/commands.md) · [配置项](website/reference/configuration.md) · [部署指南](website/deploy/index.md) |

本地浏览文档站：`npm --prefix website install && npm --prefix website run dev`。

## 参与贡献

欢迎提交 Issue 和 Pull Request，请先阅读[贡献指南](CONTRIBUTING.md)和[行为准则](CODE_OF_CONDUCT.md)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。重要变更记录在[更新日志](CHANGELOG.md)。

## 许可证

[MIT](LICENSE) © castor-kit contributors

<div align="center">
<br>
<sub><i>Castor</i> 是河狸的拉丁名。河狸是自然界的工程师，一根一根木头，搭起整座水坝。</sub>
</div>
