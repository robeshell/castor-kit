# 开发指南

## 项目结构

castor-kit 是 pnpm monorepo，后端、前端、MCP Server 各是一个 workspace 包：

```
castor-kit/
├── package.json                    # workspace 根脚本（pnpm dev / verify / scaffold ...）
├── pnpm-workspace.yaml
├── AGENTS.md                       # AI 工具上下文（所有 AI 工具均读取）
├── apps/
│   ├── api/                        # @castor-kit/api —— Fastify + TypeScript 后端
│   │   ├── src/
│   │   │   ├── main.ts             # web 进程入口
│   │   │   ├── worker.ts           # 独立定时任务进程入口
│   │   │   ├── app.ts              # 插件 / 路由 / 错误处理 / 静态资源装配
│   │   │   ├── config.ts           # 多环境配置（Zod 校验）
│   │   │   ├── router.ts           # 一级路由装配
│   │   │   ├── common/             # auth / csrf / tabular / pagination / serialize / scheduler ...
│   │   │   ├── db/schema/          # Drizzle 表定义（admin/、component-center/、index.ts）
│   │   │   └── modules/
│   │   │       ├── admin/          # 系统管理域：users、roles、menu、logs、dicts、scheduled-task ...
│   │   │       │   └── users/      # schema.ts / repository.ts / service.ts / routes.ts
│   │   │       └── component-center/   # 组件示例域：list-page、kanban、gantt、ai-chat ...
│   │   ├── drizzle/                # Drizzle SQL 迁移文件 + meta/_journal.json
│   │   ├── scripts/
│   │   │   ├── scaffold.ts         # 代码骨架生成器
│   │   │   ├── verify-feature.ts   # 功能验证门禁
│   │   │   ├── seed-rbac.ts        # RBAC 种子数据（菜单树唯一事实源）
│   │   │   ├── setup-once.ts       # 迁移 + RBAC + 只读账号（容器启动时执行）
│   │   │   └── generate-openapi.ts / import-apifox.ts
│   │   └── test/                   # Vitest（连接真实 PostgreSQL）
│   ├── web/                        # @castor-kit/web —— React + Vite 前端
│   │   └── src/
│   │       ├── App.jsx             # 动态路由（import.meta.glob）
│   │       ├── context/AuthContext.jsx
│   │       ├── components/Layout/  # 侧边栏 + PrivateRoute
│   │       ├── modules/
│   │       │   ├── admin/          # 系统管理页面
│   │       │   └── component_center/   # 组件示例页面
│   │       └── shared/
│   │           ├── api/request.js  # Axios 实例（baseURL='/api'）
│   │           └── components/     # 共享 UI（导入导出 Modal 等）
│   └── mcp/                        # @castor-kit/mcp —— MCP Server
└── docs/
    └── templates/                  # AI 代码骨架模板（backend/*.ts、frontend/*）
```

后端分层：`db/schema → schema（Zod）→ repository → service → routes`，每个功能模块是 `modules/<域>/<模块>/` 下的 4 个文件，表定义放在 `db/schema/<域>/<模块>.ts`。

---

## 用 AI 生成功能

castor-kit 专为 AI 驱动开发而设计。最快的方式是使用 Claude Code 的 `/new-feature-autopilot` 技能。

**示例 Prompt：**

```
创建一个客户管理页面，字段：姓名、电话、公司、状态
```

AI 会自动：
1. 读取 `AGENTS.md` 和 `docs/templates/` 了解项目约定
2. 自动推断所有技术细节，无需追问
3. 展示**业务预览**供你确认
4. 生成完整模块：表定义 → Zod schema → repository → service → routes → 前端页面 → RBAC 权限 → 数据库迁移
5. 运行 `pnpm verify` 质量门禁

---

## 手动代码生成

如果你倾向于手动生成代码骨架：

```bash
# 先预览将生成哪些文件
pnpm scaffold -- --name customer --domain admin \
  --fields "name:str,phone:str20,company:str,status:str20" --dry-run

# 正式生成
pnpm scaffold -- --name customer --domain admin \
  --fields "name:str,phone:str20,company:str,status:str20"
```

脚手架会：

- 生成后端表定义 `db/schema/admin/customer.ts` 与模块 `modules/admin/customer/{schema,repository,service,routes}.ts`
- 生成前端 API 文件与列表页（含搜索、增删改、导入导出）
- 自动在 `db/schema/index.ts` 和域路由 `modules/admin/router.ts` 中注册
- 自动执行 `drizzle-kit generate` 生成迁移 SQL

`--domain` 可选 `admin` 或 `component_center`。字段类型：`str`（100）、`str20`、`str50`、`str500`、`text`、`int`、`float`（numeric 10,2）、`bool`、`date`、`datetime`。

---

## RBAC 与菜单管理

所有菜单项和按钮权限都定义在 `apps/api/scripts/seed-rbac.ts` 的 `MENUS_DATA` 中（唯一事实源）。新增菜单后执行：

```bash
pnpm seed:rbac -- --incremental
```

`--incremental` 按 `code` 增量 upsert，不删除任何已有数据，并自动把新菜单授予超级管理员。

**菜单条目格式（在 `seed-rbac.ts` 中）：**

```ts
{ id: 26, name: "客户管理", code: "system_customer", icon: "IconUser", path: "/system/customer",
  component: "admin/customer", parent_id: 2, sort_order: 10, menu_type: "menu", is_visible: true, is_active: true },
// 按钮权限：ID = 菜单 ID × 10 + 序号
{ id: 261, name: "新增", code: "system_customer_add",    icon: null, path: null, component: null, parent_id: 26, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
{ id: 262, name: "编辑", code: "system_customer_edit",   icon: null, path: null, component: null, parent_id: 26, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
{ id: 263, name: "删除", code: "system_customer_delete", icon: null, path: null, component: null, parent_id: 26, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
{ id: 264, name: "导出", code: "system_customer_export", icon: null, path: null, component: null, parent_id: 26, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
{ id: 265, name: "导入", code: "system_customer_import", icon: null, path: null, component: null, parent_id: 26, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
```

::: tip component 字段格式
`component` 字段映射到 `apps/web/src/modules/<module>/pages/<subdir>/<page>/index.jsx`（`admin/customer` → `modules/admin/pages/customer/index.jsx`）。
组件示例中心的页面使用子目录路径，例如 `component_center/admin/kanban_page`。
:::

菜单 ID 的分配区间见 `AGENTS.md`（系统管理 21–39、组件示例中心 40–499、新业务域从 1000 开始）。

---

## 数据库迁移

castor-kit 使用 Drizzle 管理迁移，迁移文件是可审查的纯 SQL（`apps/api/drizzle/`）。修改表定义后，生成并应用迁移：

```bash
# 生成迁移文件（注意：db:generate 后面不要写 --）
pnpm db:generate --name add_customer_table

# 应用迁移
pnpm db:migrate

# 确认表已真实落库
psql -d aurastack -c '\d customers'
```

::: warning 迁移必须真实落库
只生成迁移文件不算完成。必须执行 `pnpm db:migrate` 并用 `psql \d` 确认表 / 字段真实存在，`pnpm verify` 的 `migration_applied` 检查也会比对数据库中的迁移记录。
:::

::: info 从 AuraStack 数据库接管
对着 AuraStack 已有的数据库执行 `pnpm db:migrate` 时，baseline 迁移只会被标记为已应用（记录在 `drizzle.__drizzle_migrations`），不会执行任何 DDL；原有的 `alembic_version` 表保持不动。
:::

---

## 功能验证

实现功能后运行验证门禁：

```bash
pnpm verify -- --module customer --skip-build
```

它会检查 TypeScript 类型、分层规范（禁止自定义权限函数）、迁移链完整且已落库、OpenAPI 同步、AI 文档引用路径、前后端文件与注册、RBAC 种子等。在 CI 中去掉 `--skip-build` 可同时验证前端生产构建；加 `--json` 可输出结构化结果供 AI 读取。

---

## 常用命令

```bash
pnpm dev                       # api(5001) + web(5173)
pnpm typecheck                 # TypeScript 类型检查
pnpm test                      # Vitest（需要 aurastack_test 测试库）
pnpm build                     # 构建 web + api + mcp
pnpm db:generate --name <描述>  # 生成迁移
pnpm db:migrate                # 应用迁移
pnpm seed:rbac -- --incremental
pnpm verify -- --module <name>
pnpm openapi:generate          # 从路由补齐 docs/apifox-full.openapi.json
pnpm openapi:apifox            # 推送到 Apifox（需 APIFOX_PROJECT_ID / APIFOX_ACCESS_TOKEN）
pnpm mcp                       # 启动 MCP Server
```

测试库准备：`createdb -T aurastack aurastack_test`（克隆开发库）或 `createdb aurastack_test`（空库，测试会自动执行迁移）。

---

## AI 工具集成

castor-kit 为所有主流 AI 编码工具预配置了上下文文件：

| 工具 | 配置文件 | 能力 |
|---|---|---|
| Claude Code | `CLAUDE.md` + `.claude/skills/` | `/new-feature-autopilot` 端到端技能 |
| Cursor | `.cursor/rules/` | 自动触发 Autopilot 工作流 |
| GitHub Copilot | `.github/copilot-instructions.md` | 全局注入项目约定 |
| Windsurf | `.windsurfrules` | 全局注入项目约定 |
| Codex CLI | `CODEX.md` | 原生读取 `AGENTS.md` |
| MCP 客户端 | `apps/mcp` | scaffold / verify / RBAC / 迁移工具 |

所有工具共享 `AGENTS.md` 中的核心上下文，包含完整的项目架构、命名约定、反模式清单和交付流程。

---

## 环境变量说明

### 开发环境（`apps/api/.env.development`）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `NODE_ENV` | `development` | 运行环境：`development` / `production` / `test` |
| `DEV_DATABASE_URL` | `postgresql://localhost/aurastack_dev` | 本地 PostgreSQL 连接字符串 |
| `TEST_DATABASE_URL` | `postgresql://localhost/aurastack_test` | `pnpm test` 使用的测试库 |
| `SECRET_KEY` | 内置开发密钥 | 会话加密密钥（开发环境可不填） |
| `ADMIN_PASSWORD` | `admin123` | `pnpm seed:rbac` 创建管理员时使用的密码 |
| `PORT` | `5001` | 后端端口（Vite 代理指向 5001） |
| `AI_API_KEY` | — | AI 功能 API Key（开发环境可选） |
| `AI_API_BASE` | — | OpenAI 兼容接口地址（如 `https://api.openai.com/v1`） |
| `AI_MODEL` | — | 模型名称 |
| `RUN_SCHEDULER_IN_WEB` | `false` | 是否在 web 进程内运行定时任务调度器 |

### 生产环境（`.env.production`）

生产环境变量见 [部署指南](/deployment/#环境变量参考)。

::: warning 生产环境密钥
生产环境务必设置强随机 `SECRET_KEY`。会话密钥由它派生，轮换此密钥会使所有在线用户的会话失效。
:::
