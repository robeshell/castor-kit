# 介绍

castor-kit 是一个 AI-First 的全栈管理后台脚手架。你用自然语言描述一个业务功能，AI 编程工具按照仓库里写好的约定，生成数据表、接口、页面、权限和数据库迁移，最后由验证门禁确认交付质量。

名字里的 Castor 是河狸的拉丁属名，河狸被称为“自然界的工程师”；Kit 指脚手架和工具套件。

## 技术栈

castor-kit 是一个 pnpm monorepo，包含三个应用：

| 应用 | 包名 | 技术 |
|---|---|---|
| 后端 `apps/api` | `@castor-kit/api` | Node 22、TypeScript（strict）、Fastify 5、Zod、Drizzle ORM、PostgreSQL 14+、pino |
| 前端 `apps/web` | `@castor-kit/web` | React 19、Vite、React Router、shadcn/ui（Radix）、Tailwind CSS v4、motion、lucide-react、i18next（JavaScript / JSX） |
| MCP Server `apps/mcp` | `@castor-kit/mcp` | `@modelcontextprotocol/sdk`，把脚手架、验证、RBAC 同步、迁移等工具暴露给 MCP 客户端 |

其他常用依赖：表格 `@tanstack/react-table`、表单 `react-hook-form`、图表 ECharts、3D Three.js、代码编辑器 Monaco、富文本 react-quill-new、拖拽 dnd-kit。

## 适合谁

- **想让 AI 真正交付功能的团队**：产品经理或开发者用一句话描述需求，AI 负责推断路由、字段类型、权限编码、菜单 ID 等技术细节。
- **需要一个规范的管理后台起点的开发者**：开箱即有登录、用户、角色、菜单、日志、数据字典、定时任务、消息通知、公告等功能，以及 RBAC 权限体系。
- **想参考常见后台页面写法的前端开发者**：组件示例中心内置 28 个示例页面，覆盖列表、看板、甘特图、数据大屏、3D、AI 对话、编辑器等场景。

## 核心能力

- **AI 驱动开发**：`AGENTS.md` 是所有 AI 工具共用的项目上下文，Claude Code、Codex CLI、Cursor、GitHub Copilot、Windsurf 以及 MCP 客户端都已预先配置。详见 [AI 驱动开发](/guide/ai-workflow)。
- **代码骨架生成**：`pnpm scaffold` 一次生成表定义、后端四层文件、前端页面与 API、接口测试，并自动注册和生成迁移。
- **验证门禁**：`pnpm verify` 检查类型、分层规则、迁移链与落库状态、文件与注册、RBAC 种子、前端构建和前后端测试，全部通过才算交付。
- **完整的 RBAC**：用户、角色、菜单、按钮四级权限，菜单树由 `seed-rbac.ts` 统一维护。详见 [权限 RBAC](/guide/rbac)。
- **多语言**：界面支持简体中文、English、日本語，中文原文即翻译 key，并有扫描工具和测试守卫。详见 [多语言](/guide/i18n)。
- **主题与布局**：浅色 / 深色、6 种强调色、3 种导航模式、标签栏与页面保活。详见 [主题与布局](/guide/appearance)。
- **导入导出**：列表页标配 CSV / XLSX 导入导出，带公式注入防护和整批事务回滚。
- **定时任务**：基于数据库租约的调度器，支持多副本部署，并带管理页面。
- **Docker 部署**：`bash setup.sh` 生成配置并启动 PostgreSQL 和应用，容器启动时自动完成迁移与 RBAC 同步。详见 [部署指南](/deploy/)。

## 和其他脚手架的区别

大多数管理后台脚手架提供的是“一套可以复制修改的代码”。castor-kit 在此之上多做了两件事：

1. **约定写给 AI 看。** 分层规则、命名、字段类型推断表、权限编码规则、菜单 ID 分配、反模式清单都写在 `AGENTS.md` 里。AI 读完后可以自行做出技术决策，不需要反复向你确认路由或字段类型。
2. **交付由门禁判定。** AI 生成的代码必须通过 `pnpm verify`。门禁不只做静态检查：它会确认迁移已经真实应用到数据库，确认页面没有引入已下线的 UI 库，并运行前端构建与前后端测试。

这样，“AI 说做完了”和“功能真的可用”之间有一道可以自动执行的检查。

## 下一步

- [快速开始](/guide/getting-started)：用 Docker 或本地环境跑起来
- [项目结构](/guide/project-structure)：了解目录和各部分职责
- [AI 驱动开发](/guide/ai-workflow)：用 AI 交付第一个功能
