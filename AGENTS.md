# castor-kit — Agent Context

> **通用上下文文档**，适用于所有 AI 工具（Claude Code、Cursor、Windsurf、GitHub Copilot、Codex CLI、MCP Client 等）。
> 实现任何新功能前必须完整阅读本文件。AI 应从本文件自行推断所有技术决策，无需向 PM 询问技术细节。
>
> 各工具专属配置：`CLAUDE.md`（Claude Code）| `CODEX.md`（Codex CLI）| `.cursor/rules/`（Cursor）| `.github/copilot-instructions.md`（Copilot）| `.windsurfrules`（Windsurf）| `llms.txt`（入口索引）
> 架构说明：`docs/architecture.md`（技术栈、分层与反模式、横切约定、迁移、工具链、部署、设计决定）。
> 功能路线图：`docs/roadmap.md`（计划中的新功能及其数据模型、接口、验收标准；实现其中任何一项前先读对应章节，完成后更新状态）。
> 前端 UI 方案：`docs/frontend-redesign-plan.md`（Semi Design → shadcn/ui + Tailwind CSS v4 + motion，设计 tokens 与公共组件约定）。

---

## 项目定位

**Node.js/TypeScript + React + RBAC 的 AI-First 脚手架。**

目标：PM 用自然语言描述业务意图 → AI Agent 自动推断技术决策 → 展示业务预览供确认 → 端到端交付符合规范的新功能模块（数据表、接口、页面、权限、迁移）。

castor-kit 是一个 pnpm monorepo：后端 `apps/api`（Fastify 5 + Zod + Drizzle + PostgreSQL），前端 `apps/web`（React 19 + **shadcn/ui + Tailwind CSS v4 + motion**，见 `docs/frontend-redesign-plan.md`），`apps/mcp` 把 scaffold / verify / seed / 迁移等工具链暴露给 MCP Client。整体架构与设计决定见 `docs/architecture.md`。

---

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 运行时 | Node + TypeScript（strict） | Node 22（`.nvmrc`），TypeScript 5 |
| 包管理 | pnpm workspaces（monorepo） | pnpm 11 |
| 后端框架 | Fastify + `fastify-type-provider-zod` | 5.x |
| 校验 / 类型 | Zod | 4.x |
| ORM / 迁移 | Drizzle ORM + drizzle-kit | 0.45 / 0.31 |
| 数据库 | PostgreSQL（`pg` 驱动） | 14+ |
| 日志 | pino（Fastify 内置） | - |
| 会话 | `@fastify/secure-session`（cookie `castor_session`） | - |
| 其他插件 | `@fastify/cors` / `compress` / `static` / `multipart` / `websocket` / `swagger` | - |
| 导入 / 导出 | `csv-parse` + `exceljs`（**只支持 csv / xlsx，`.xls` 已不支持**） | - |
| 测试 | Vitest + 真实 PostgreSQL | - |
| 前端框架 | React + Vite + React Router + Axios（JavaScript / JSX） | 19 / 5 / 7 |
| UI 组件 | shadcn/ui（new-york 风格，Radix 原语，源码在 `apps/web/src/components/ui/`，JSX） | - |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite`）+ CSS 变量主题（亮 / 暗，`apps/web/src/index.css`） | 4.x |
| 动效 | `motion`（`motion/react`）+ `tw-animate-css`（弹层进出） | - |
| 图标 | `lucide-react` | - |
| 表格 / 表单 / 提示 | `@tanstack/react-table`（封装为 DataTable）/ `react-hook-form` / `sonner` | - |
| 日期 / 命令面板 | `react-day-picker` + `date-fns` / `cmdk`（⌘K） | - |
| 图表 | ECharts 6 + echarts-for-react（主题色取自 `@/lib/chart-theme`） | - |
| 3D | Three.js | 0.176 |
| 代码编辑器 | @monaco-editor/react | - |
| 富文本 | react-quill-new（React 19 兼容） | - |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable | - |
| MCP | `@modelcontextprotocol/sdk` | 1.x |

**开发环境：**
- 端口：api 5001、web 5173（Vite proxy 把 `/api`、`/ws` 转发到 5001）；测试环境 5002；生产 5000
- 数据库：`postgresql://wangwenyu@localhost/castor_kit`（写在 `apps/api/.env.development` 的 `DEV_DATABASE_URL`；未设置时默认 `postgresql://localhost/castor_kit_dev`）
- 本地配置：`apps/api/.env.development`（参考 `apps/api/.env.example`，已被 gitignore；仓库根目录的 `.env.<NODE_ENV>` 也会被读取）
- 默认账号：`admin` / `admin123`
- 测试库：`createdb -T castor_kit castor_kit_test`（克隆）或 `createdb castor_kit_test`（空库，测试会自动执行迁移）；`pnpm test`

---

## 目录结构

```
castor-kit/
├── package.json                       # pnpm workspaces 根（所有 pnpm 命令在根目录执行）
├── pnpm-workspace.yaml
├── AGENTS.md / CLAUDE.md / CODEX.md / llms.txt / .windsurfrules / .cursor/ / .github/copilot-instructions.md
├── apps/
│   ├── api/                           # @castor-kit/api —— Fastify 后端
│   │   ├── src/
│   │   │   ├── main.ts                # web 进程入口
│   │   │   ├── worker.ts              # 独立调度器进程入口
│   │   │   ├── app.ts                 # buildApp()：插件 / 路由 / 错误处理 / 静态资源 / SPA
│   │   │   ├── config.ts              # 多环境配置（Zod 校验，生产 fail-closed）
│   │   │   ├── router.ts              # 一级路由装配（新增域在这里注册）
│   │   │   ├── common/                # 横切能力
│   │   │   │   ├── auth.ts            # loginRequired / hasMenuPermission / hasAnyMenuPermission / menuPermissionRequired
│   │   │   │   ├── rbac.ts            # 纯函数：isSuperAdmin / 菜单编码收集
│   │   │   │   ├── csrf.ts            # 双提交校验
│   │   │   │   ├── errors.ts          # ServiceError + 统一错误处理器
│   │   │   │   ├── http.ts            # intParam / parseIntParam / jsonBody / queryString / getUploadedFile
│   │   │   │   ├── pagination.ts      # parsePagination（MAX_PER_PAGE=200，默认 20）
│   │   │   │   ├── serialize.ts       # toIso() 等，统一时间输出格式
│   │   │   │   ├── tabular.ts         # csv/xlsx 读写 + 公式注入防护 + 5MB 上限
│   │   │   │   ├── request-meta.ts    # clientIp / userAgent / safePayload（脱敏）
│   │   │   │   ├── password.ts        # pbkdf2:sha256 密码哈希
│   │   │   │   └── scheduler/         # 定时任务 runner（租约模型）+ cron 匹配器 + SSRF 防护
│   │   │   ├── db/
│   │   │   │   ├── client.ts          # pg Pool + drizzle 实例 + 类型解析器
│   │   │   │   ├── readonly.ts        # AI SQL 专用只读 Pool
│   │   │   │   ├── migrate.ts         # 迁移执行器（drizzle-orm migrator）
│   │   │   │   ├── migrate-cli.ts     # pnpm db:migrate 入口
│   │   │   │   └── schema/            # ← model 层：Drizzle 表定义 + toDict
│   │   │   │       ├── columns.ts     # createdAt() / updatedAt()
│   │   │   │       ├── admin/         # rbac / audit-logs / dicts / scheduled-task / notification / announcement
│   │   │   │       ├── component-center/
│   │   │   │       └── index.ts       # 汇总导出（新增表在这里注册）
│   │   │   └── modules/
│   │   │       ├── admin/             # 系统管理域
│   │   │       │   ├── router.ts      # 域内路由装配
│   │   │       │   └── users/         # {schema,repository,service,routes}.ts
│   │   │       │   └── auth/ roles/ menu/ logs/ dicts/ scheduled-task/ notification/ announcement/ dashboard/
│   │   │       └── component-center/  # 组件示例中心域
│   │   │           ├── router.ts
│   │   │           └── list-page/ stats-list-page/ card-list-page/ tree-list-page/ dynamic-form-page/
│   │   │               kanban/ detail-tabs/ gantt/ advanced-table/ map-heatmap/
│   │   │               ai-chat/ ai-prompt/ ai-sql/ devtools/
│   │   ├── drizzle/                   # SQL 迁移 + meta/_journal.json（drizzle-kit 生成）
│   │   ├── scripts/                   # 工具链：scaffold / verify-feature / seed-rbac / setup-once /
│   │   │                              #         init-ro-role / generate-openapi / import-apifox
│   │   ├── test/                      # Vitest（真实 PostgreSQL）
│   │   └── drizzle.config.ts
│   ├── web/                           # @castor-kit/web —— React 19 + shadcn/ui + Tailwind v4（JSX）
│   │   ├── components.json            # shadcn CLI 配置（new-york / zinc / lucide / 别名）
│   │   ├── scripts/shadcn-add.sh      # 经本地中转执行 npx shadcn@latest add（见「新增 shadcn 原子组件」）
│   │   └── src/
│   │       ├── App.jsx                # 动态路由（import.meta.glob）
│   │       ├── index.css              # Tailwind v4 入口 + 设计 tokens（亮 / 暗）+ 品牌渐变工具类
│   │       ├── context/               # AuthContext / ThemeContext（html.dark 切换）
│   │       ├── components/
│   │       │   ├── ui/                # shadcn 原子组件（button / input / dialog / sheet / table / select / …）
│   │       │   └── app/               # 应用外壳：AppLayout / AppSidebar / TopBar / CommandMenu / ThemeToggle / …
│   │       ├── lib/                   # utils(cn) / toast / format / motion / chart-theme / menu-icons
│   │       ├── modules/
│   │       │   ├── admin/{pages,api}/
│   │       │   └── component_center/
│   │       │       ├── pages/{admin,dataviz,creative,ai,editor,devtools}/
│   │       │       └── api/
│   │       └── shared/
│   │           ├── api/request.js     # Axios 实例（baseURL='/api', withCredentials, CSRF 头）
│   │           ├── utils/file.js      # downloadBlobFile
│   │           ├── hooks/             # useCrudList / useIsMobile / useDebouncedValue
│   │           └── components/        # 业务公共组件：PageHeader / DataTable / Filters / FormDialog / FormFields /
│   │                                  #   ConfirmAction / StatusBadge / data-transfer/{ImportDialog,ExportDialog} / upload/ …
│   └── mcp/                           # @castor-kit/mcp —— MCP Server（src/index.ts）
├── docs/
│   ├── architecture.md                # 架构说明
│   ├── frontend-redesign-plan.md      # 前端 UI 方案（Semi → shadcn/ui）
│   ├── apifox-full.openapi.json       # OpenAPI 文档（pnpm openapi:generate 补齐）
│   └── templates/                     # 代码骨架模板（AI 临摹用）
│       ├── backend/                   # db-schema / schema / repository / service / routes（.ts）+ README.md
│       └── frontend/                  # list_page / detail_page
├── website/                           # VitePress 文档站（独立 npm 项目，不在 pnpm workspace 内）
└── Dockerfile / docker-compose.yml / docker-entrypoint.sh / setup.sh
```

> 命名：后端目录与文件名一律小写连字符（`component-center`、`scheduled-task`、`customer-order.ts`）；表名、前端目录、菜单 `component` 保持下划线（`component_center/admin/list_page`），与数据库和前端路由保持一致。

---

## 后端架构约定

### 分层规则（严格执行）

```
db/schema/<domain>/<name>.ts → modules/<domain>/<name>/{schema,repository,service,routes}.ts
  → modules/<domain>/router.ts → src/router.ts
```

| 层 | 文件 | 职责 | 禁止 |
|---|---|---|---|
| model | `db/schema/<domain>/<name>.ts` | Drizzle `pgTable(...)` 表定义 + `xxxToDict()` 序列化 | 业务逻辑 |
| schema | `modules/<domain>/<name>/schema.ts` | Zod 请求 schema、`EXPORT_FIELD_MAP` / `IMPORT_HEADER_MAP` | 数据库操作 |
| repository | `modules/<domain>/<name>/repository.ts` | 纯 DB 读写（Drizzle 查询） | 业务逻辑、HTTP |
| service | `modules/<domain>/<name>/service.ts` | 业务逻辑，出错抛 `ServiceError(message, status, payload)` | 碰 `reply` / `session` 等 HTTP 对象 |
| routes | `modules/<domain>/<name>/routes.ts` | Fastify 路由 + 权限检查 + 调 service | 直接写 SQL |
| 域装配 | `modules/<domain>/router.ts` | `await registerXxxRoutes(app)` | — |
| 一级装配 | `src/router.ts` + `db/schema/index.ts` | 注册域 / 导出表 | — |

路径别名：后端 `@/*` → `apps/api/src/*`（如 `@/common/auth`）；前端 `@` → `apps/web/src`（如 `@/shared/api/request`）。

**表定义写法（model 层）：**
```ts
import { pgTable, serial, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const customers = pgTable('customers', {
  id: serial().primaryKey().notNull(),
  name: varchar({ length: 100 }).notNull(),
  created_at: createdAt(),   // 应用侧默认 timezone('utc', now())，库里没有 DEFAULT
  updated_at: updatedAt(),
})

export type Customer = typeof customers.$inferSelect

export function customerToDict(item: Customer) {
  return { id: item.id, name: item.name, created_at: toIso(item.created_at), updated_at: toIso(item.updated_at) }
}
```

**路由写法（routes 层）：**
```ts
export async function registerCustomerRoutes(app: FastifyInstance): Promise<void> {
  const service = new CustomerService(app.db)
  const opts = { preHandler: loginRequired }
  app.get('/api/admin/customers', opts, async (request, reply) => { ... })
}
```

### API 路由规范

```
所有路由前缀：/api/admin/
标准 CRUD（资源名用连字符复数，如 customer_order → /api/admin/customer-orders）：
  GET    /api/admin/<resource>s              列表（page, per_page, search）→ { items, total, page, per_page }
  POST   /api/admin/<resource>s              新建（201）
  GET    /api/admin/<resource>s/<id>         详情（按需）
  PUT    /api/admin/<resource>s/<id>         编辑
  DELETE /api/admin/<resource>s/<id>         删除
  POST   /api/admin/<resource>s/export       导出（responseType: blob）
  GET    /api/admin/<resource>s/template     下载导入模板（file_type=csv|xlsx）
  POST   /api/admin/<resource>s/import       导入（multipart/form-data，字段名 file）
错误响应：{ error: string, ...payload }；5xx 一律「服务器内部错误，请稍后重试」
```

- 带 id 的路由：路径用 `intParam('item_id')` 生成（只匹配数字），先 `service.getOr404(id)`（404）再做权限检查（403）
- 请求体用 `jsonBody(request)`，查询参数用 `queryString(request, key)`，分页用 `parsePagination(request.query)`

### 权限检查规范

```ts
// ✅ 正确
import { hasMenuPermission, loginRequired } from '@/common/auth'

app.get('/api/admin/customers', { preHandler: loginRequired }, async (request, reply) => {
  if (!(await hasMenuPermission(request, 'system_customer'))) {
    return reply.status(403).send({ error: '无权限' })
  }
  ...
})

// 也可用 preHandler 形式：{ preHandler: [loginRequired, menuPermissionRequired('system_customer')] }
// 多个编码任一满足：await hasAnyMenuPermission(request, 'a', 'b')

// ❌ 禁止：routes.ts 内自定义权限函数
function hasPermission(code: string) { ... }   // 绝对禁止（verify 的 no_local_has_permission 会拦截）
```

`hasMenuPermission` 是异步函数，第一个参数是 `request`（当前用户按请求缓存），忘记 `await` 会让判断恒为真。

### 权限编码规则

```
菜单权限：  <domain>_<resource>              system_users（admin 域前缀 system_，component_center 域前缀 cc_）
按钮权限：  <domain>_<resource>_add          system_users_add
           <domain>_<resource>_edit
           <domain>_<resource>_delete
           <domain>_<resource>_export        （标准列表页必有）
           <domain>_<resource>_import        （标准列表页必有）
```

> 历史遗留：组件示例中心的 31/33/34/35/36/37 号菜单使用 `system_*` 编码（如 `system_list_page`），已入库勿改；新 component_center 模块一律 `cc_<name>`（与 scaffold 的 Perm prefix 一致）。

### 新增域注册

新增业务域时必须同时更新：
1. `src/router.ts` — `await registerXxxRoutes(app)`（域内再建 `modules/<domain>/router.ts`）
2. `db/schema/index.ts` — `export * from './<domain>/<name>'`

在已有域（admin / component_center）内新增模块时，`pnpm scaffold` 会自动完成两处注册（`db/schema/index.ts` + `modules/<domain>/router.ts`）；手写时照 `docs/templates/backend/README.md` 操作。

### 横切约定（详见 `docs/architecture.md`「横切约定」）

- **时间**：pg `timestamp`/`date` 保留文本不经过 JS `Date`；输出一律 `toIso()`（`YYYY-MM-DDTHH:mm:ss[.ffffff]`，无 `Z`）。**禁止** `Date#toISOString()`
- **数值**：`numeric` 列保持字符串（如 `"12.50"`），`toDict()` 里不要 `parseFloat`
- **请求校验**：请求 schema 一律宽松（`.passthrough()` / `z.record(...)` + 全可选），归一化逻辑在 service 里做；收紧校验是独立任务
- **错误**：service 抛 `ServiceError`，全局错误处理器转成 `{ error, ...payload }`；`/api/*` 下 404/405/500 均返回 JSON
- **操作日志**：由 logs 模块注册的全局 `onResponse` hook 集中写 `operation_logs`，不要在 service 里散写
- **CSRF**：`/api/*` 的写请求需带 `X-CSRF-Token`（前端 request.js 已自动处理），登录接口豁免
- **公开演示（`DEMO_MODE`）**：`common/demo.ts` 的白名单之外的写请求一律 403——目前只放行登录 / 登出、`/api/admin/component-center/*`、通知已读；新增的业务域在演示环境默认只读，需要演示可写时把路径加进 `DEMO_WRITABLE`，并在 `src/demo/fixtures.ts` 补示例数据（恢复逻辑见 `src/demo/reset.ts`）

---

## 前端架构约定

前端由动态路由（`App.jsx`）、API 层（`shared/api/request.js`）、`AuthContext`、`useCrudList` 与各页面组成；UI 体系见 `docs/frontend-redesign-plan.md`：**shadcn/ui + Tailwind CSS v4 + motion + lucide-react**，语言为 JavaScript（JSX），文案中文。

### 动态路由机制

`apps/web/src/App.jsx` 使用 `import.meta.glob('./modules/**/pages/**/index.jsx')` 扫描页面。

**菜单 `component` 字段格式：** `<module>/<subdir>/<page_name>`

```
admin/users                              → modules/admin/pages/users/index.jsx
component_center/admin/list_page         → modules/component_center/pages/admin/list_page/index.jsx
component_center/dataviz/dashboard_page  → modules/component_center/pages/dataviz/dashboard_page/index.jsx
```

### 文件位置规则

```
apps/web/src/modules/<module>/pages/<subdir>/<page_name>/index.jsx   ← 页面组件
apps/web/src/modules/<module>/api/<page_name>.js                      ← API 调用层
```

scaffold 生成位置：admin 域 → `pages/<name>/index.jsx`；component_center 域 → `pages/admin/<name>_page/index.jsx`。

### API 调用规范

```javascript
// ✅ 必须使用共享 request 实例（vite 已配置 @ → src/ alias）
import request from '@/shared/api/request'

const BASE = '/admin/<resource>s'

export const getItems = (params) => request.get(BASE, { params })
export const createItem = (data) => request.post(BASE, data)
export const updateItem = (id, data) => request.put(`${BASE}/${id}`, data)
export const deleteItem = (id) => request.delete(`${BASE}/${id}`)

// 导出（responseType: 'blob'）
export const exportItems = (data) => request.post(`${BASE}/export`, data, { responseType: 'blob' })
// 下载导入模板
export const downloadTemplate = (fileType = 'xlsx') =>
  request.get(`${BASE}/template`, { params: { file_type: fileType }, responseType: 'blob' })
// 导入（multipart/form-data）
export const importItems = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`${BASE}/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}
```

- 响应拦截器已 unwrap：直接用 `res.items` / `res.total`，**不要** `res.data.items`
- 401 自动跳转登录页；写请求自动带 CSRF 头

### UI 组件规范

- **组件体系**：shadcn/ui 原子组件（`@/components/ui/*`，源码在仓库里，可按需改）+ 业务公共组件（`@/shared/components/*`）；图标只用 `lucide-react`
- **禁止**：`@douyinfe/*`（Semi 已下线）、antd / material-ui 等其他 UI 库、`var(--semi-*)`、页面里写死十六进制颜色（例外：canvas / WebGL 内部着色、图表数据色——图表先用 `useChartColors`）、大段 inline style 做布局、emoji 当图标
- **参考实现**：`apps/web/src/modules/admin/pages/users/index.jsx`（标准 CRUD 列表页）、`apps/web/src/modules/admin/pages/dashboard/index.jsx`（卡片 / 图表 / 动效）、`apps/web/src/modules/admin/pages/profile/index.jsx`（表单页）；模板见 `docs/templates/frontend/`
- **文档优先**：实现 shadcn 组件前先查 shadcn/ui 官方文档（https://ui.shadcn.com/docs/components ，有 shadcn MCP 时优先用它）；技能说明见 `.claude/skills/shadcn-ui-skills/SKILL.md`。文档与仓库现有实现冲突时以仓库为准（`components/ui` 里的组件可能已按本项目 tokens 调整过）

**页面结构（列表页照 users 页）：**

```
PageHeader（标题 + 右侧操作：导入 / 导出 outline，新增 variant="brand"，每页最多一个 brand 按钮；标题下不写功能介绍）
→ FilterBar（SearchInput / FilterSelect，查询 + 重置）
→ DataTable（分页 page/perPage/total、勾选 selectable、行操作 ghost 按钮 + ConfirmAction 删除）
→ FormDialog / FormSheet（react-hook-form + FormFields，提交失败 toast.apiError 后 throw 保持弹窗）
→ ImportDialog / ExportDialog（csv / xlsx）
分区用 Panel；状态用 StatusBadge；空态用 EmptyState；反馈统一 toast（@/lib/toast）
```

**公共组件速查（`apps/web/src/shared/components/`）：**

| 组件 | 用途 |
|---|---|
| `PageHeader` / `Panel` | 页头（title / actions；description 只放数据类信息，如「4 列 · 8 张卡片」）/ 卡片分区（`padded={false}` 贴边） |
| `DataTable` + `DataPagination` | 列定义 `{ key, title, dataIndex, width, align, className, ellipsis, render(value, row, index) }`；`pagination={{ page, perPage, total, onChange }}`；`selectable` / `selectedKeys` / `onSelectionChange`；`loading` 骨架与空态内置 |
| `Filters`：`FilterBar` / `SearchInput` / `FilterSelect` | 筛选栏；`FilterSelect` 的 `''` 表示全部；防抖用 `@/shared/hooks/useDebouncedValue` |
| `FormDialog` / `FormSheet` / `DetailSheet` / `DescriptionList` | 新建编辑弹窗 / 侧边抽屉 / 只读详情抽屉 / 键值列表 |
| `FormFields`：`FormInput` / `FormTextarea` / `FormNumber` / `FormSelect` / `FormMultiSelect` / `FormSwitch` / `FormRadioGroup` / `FormCheckboxGroup` / `FormDate` / `FormDateTime` / `FormTags` / `FormCustom` / `FormGrid` | react-hook-form 字段：`<FormInput control={form.control} name="x" label="…" rules={{ required: '请输入…' }} />` |
| `ConfirmAction` / `RowActions` | 危险操作二次确认（替代 Popconfirm）/ 行操作 |
| `StatusBadge` | `tone`: neutral / brand / info / success / warning / danger，`dot`，`variant="plain"` |
| `EmptyState` / `SegmentedTabs` / `TreeView` / `StatCard` | 空态 / 带滑动指示条的分段标签 / 树 / 指标卡 |
| `DatePicker` / `DateTimePicker` / `MultiSelect` / `TagInput` | 值格式 `'YYYY-MM-DD'` / `'YYYY-MM-DD HH:mm:ss'` |
| `data-transfer/ImportDialog` / `data-transfer/ExportDialog` | 导入 / 导出弹窗（`open` / `onOpenChange`） |
| `upload/FileUpload` / `upload/ImageUpload` | 上传（fileList 条目 `{ uid, name, url, status, response }`） |

lib：`@/lib/utils`（`cn`）、`@/lib/toast`（`toast.success / error / warning`、`toast.apiError(err, fallback)`）、`@/lib/format`（`formatDate / formatDateTime / formatNumber / formatRelative`）、`@/lib/motion`（`fadeUp / stagger / pageTransition / layoutSpring`）、`@/lib/chart-theme`（`useChartColors` 等，ECharts 必须用它取主题色）、`@/lib/menu-icons`。

**字段类型 → 表单组件 / 表格列（scaffold 按此生成）：**

| scaffold 类型 | 表单组件 | 表格列渲染 | 默认值 |
|---|---|---|---|
| `str` / `str20` / `str50` / `str500` | `FormInput` | 原样 | `''` |
| `text` | `FormTextarea` | `ellipsis: true` | `''` |
| `int` / `float` | `FormNumber`（`step={1}` / `step={0.01}`） | 右对齐 + `tabular-nums` | `null` |
| `bool` | `FormSwitch` | `StatusBadge`（是 / 否） | `false` |
| `date` | `FormDate` | `formatDate` | `''`（编辑回填 `formatDate(v, '')`） |
| `datetime` | `FormDateTime` | `formatDateTime` | `''`（编辑回填 `formatDateTime(v, '')`） |
| 枚举 / 状态（手写） | `FormSelect` / `FormRadioGroup` | `StatusBadge` + tone 映射 | - |

**设计 tokens 与动效**（详见 `docs/frontend-redesign-plan.md` §3）：

- 颜色一律用语义类：`bg-background` / `bg-card` / `text-foreground` / `text-muted-foreground` / `border` / `bg-muted` / `text-primary` / `bg-brand-soft` / `text-success` / `bg-success-soft` / `text-warning` / `text-danger` / `bg-danger-soft` / `text-info`；只用语义类，暗色模式（`<html class="dark">`）天然正确
- 强调色可由用户在顶栏「外观设置」切换（预设见 `src/lib/appearance.js`，默认 Ocean；`index.css` 的 `[data-accent]` 预设只定义 `--brand-from/via/to`，`--primary`、`--ring`、图表色、`brand-soft/glow/shadow` 都由这三个派生）。页面里一律用 `primary` / `brand-*` 语义类，不要写死某个强调色，否则切换后不跟随。导航模式（侧边栏 / 顶部 / 混合）、侧边栏样式、内容宽度也在同一面板，由 `AppLayout` 处理，页面无需关心
- 标签栏（默认开启，外观设置可关）：打开过的页面以标签保留，状态在 `src/context/TagsViewContext.jsx`。开启时每个标签页用 React `<Activity>` 保活：切走时页面 state（筛选、分页、表单输入）保留，但 effect 会被清理、切回时重新执行（`useEffect` 里的请求会重新拉一次数据，定时器 / 轮询 / WebSocket 在隐藏期间自动停止）。所以页面的副作用必须写在 effect 里并正确清理，不要在模块级或渲染中启动定时器
- 中性灰为底，强调色（默认 Ocean 渐变 blue → sky → cyan）只做点缀：`bg-brand-gradient`（装饰）/ `bg-brand-gradient-strong`（承载白字）/ `text-brand-gradient` / `border-brand-gradient` / `shadow-brand` / `bg-brand-glow`（只用于小块装饰，不铺在内容区大背景上，浅色下像污渍）；不用紫色
- 间距用 Tailwind（`space-y-4` / `gap-4`），数字 `tabular-nums`；移动端（<768px）不能横向撑破（表格容器横向滚动）
- 动效克制：交互 150–250ms ease-out；列表错峰入场、指示条 layoutId、数字滚动、弹层进出已由公共组件提供；`prefers-reduced-motion` 已全局处理

**菜单图标**：`menus.icon` 存的是历史 Semi 图标名（如 `IconUser`），由 `apps/web/src/lib/menu-icons.js` 映射到 lucide；新增菜单沿用映射表里已有的名字，需要新图标时在映射表补一条。

### 多语言（i18n）与代码注释

界面支持简体中文 / English / 日本語，**中文原文就是翻译 key**（设计见 `apps/web/src/i18n/index.js`、`apps/api/src/common/i18n.ts`）。

- **前端**：`const { t } = useTranslation()`，写 `t('保存')`、`t('共 {{count}} 条', { count })`。英文 / 日文写在**页面目录下** `locales/en-US.json`、`locales/ja-JP.json`（「中文 → 译文」，两份 key 相同）；公共文案在 `src/locales/`，菜单名按菜单 code 在 `src/locales/menus/`。
  - 传给公共组件的字符串属性（PageHeader / Panel 标题、DataTable 列 title、FormFields 的 label / placeholder / options / rules 文案、FilterSelect / SegmentedTabs / StatusBadge / StatCard / RowActions / ConfirmAction / FormDialog 等）由组件自动翻译，直接写中文、补译文即可；`toast.success('固定中文')` 也会自动翻译。
  - 必须包 `t()`：JSX 里直接写的中文、原生元素的 aria-label / title / placeholder、带变量的文案（不要用中文模板字符串）、图表坐标轴 / 图例等其他显示渠道。
  - 演示内容（示例数据、示例文档）不翻译，用 `// i18n-ignore-next-line` 或文件级 `i18n-ignore-file` 标出。
  - 检查：`node apps/web/scripts/i18n-scan.mjs <目录>` 必须 0 问题（前端测试 `test/i18n.test.js` 会对全部页面执行）。
- **后端**：继续抛中文报错（`new ServiceError('用户名已存在')`），响应钩子按请求头 `Accept-Language` 翻译 `error` / `message` / 导入错误行 `reason`；新增文案要在 `apps/api/src/i18n/messages.ts` 登记英日译文（带变量的放 `PATTERNS`），`test/i18n-messages.test.ts` 会拦下漏登记的。导入导出文件的表头保持中文。
- **代码注释一律英文**（前端、后端、脚本、测试、scaffold 生成的代码）。界面文案仍写中文原文作为 key。

### 新增 shadcn 原子组件

组件源码直接进仓库（`apps/web/src/components/ui/`，配置 `apps/web/components.json`）。本机 shadcn CLI（node）直连 ui.shadcn.com 会失败，统一用中转脚本：

```bash
apps/web/scripts/shadcn-add.sh hover-card           # 启动本地中转 → REGISTRY_URL=http://127.0.0.1:<port>/r npx shadcn@latest add … → 关闭中转
apps/web/scripts/shadcn-add.sh --view badge         # 只查看 registry 内容，不写文件
apps/web/scripts/shadcn-add.sh badge -o -y          # 覆盖已有文件（会丢掉本地改动，先确认）
```

脚本会清掉 `HTTP(S)_PROXY` 再执行 CLI（npm 包下载仍经 `npm_config_proxy` 走原代理），并把 registry 源码里的 `import { cn } from "cn"` 改回 `@/lib/utils`、撤掉误装的 `cn` 包。新增后检查 `git diff apps/web/package.json`，并确认组件只用语义色类。

### 纯前端页面（无后端 API）

```
component_center/creative/*
component_center/devtools/websocket_page      （WebSocket /ws/devtools 由后端提供）
component_center/devtools/perf_monitor_page   （指标来自 /ws/devtools）
component_center/dataviz/heatmap_page
component_center/dataviz/realtime_chart_page
```

---

## 导入导出规范

**后端**（`apps/api/src/common/tabular.ts`）
- 支持格式：`SUPPORTED_TABLE_FILE_TYPES = ['csv', 'xlsx']`。**`.xls` 已不支持**：上传 `.xls` 返回 `400 {error:'不支持 .xls 格式，请另存为 .xlsx 后重新上传'}`；导出 / 模板的 `file_type=xls` 按默认值处理
- 工具函数：
  - `buildTable(headers, rows, baseFilename, fileType)` → 表格载荷（csv 带 BOM）；`sendTable(reply, table)` → 设置 `Content-Type` / `Content-Disposition` 并发送
  - `readTableFile(file)` → `{ fieldnames, rows, fileType }`（rows 带行号，5MB 上限，csv 自动去 BOM）
  - `normalizeTableFileType(raw, fallback)` → 标准化文件类型；`sanitizeFormula()` 做公式注入防护
  - 上传文件用 `getUploadedFile(request)`（`@/common/http`）
- 在 `modules/<domain>/<name>/schema.ts` 定义 `EXPORT_FIELD_MAP`（字段 → 中文表头，值取 toDict 的同名字段；需要转换时写成 `[中文表头, 取值函数]`，如枚举显示中文）和 `IMPORT_HEADER_MAP`（中文表头 → 字段）
- 导入整批一个事务：有错误行时抛 `ServiceError('导入失败，存在错误数据', 400, { error_rows, error_count })` 整体回滚
- 路由：`POST /export`、`GET /template`、`POST /import`（挂在资源路径下）；权限编码 `<perm>_export` / `<perm>_import`
- 参考实现：`apps/api/src/modules/admin/users/`

**前端**
- 导出弹窗：`@/shared/components/data-transfer/ExportDialog`（`open` / `onOpenChange` / `fieldOptions` / `ruleHint` / `onConfirm({ fields, fileType })`）
- 导入弹窗：`@/shared/components/data-transfer/ImportDialog`（`onDownloadTemplate(fileType)` / `onImport(file)` / `onImported(res)`；格式只有 CSV / XLSX，错误行可下载）
- 下载：`import { downloadBlobFile } from '@/shared/utils/file'`
- 参考实现：`apps/web/src/modules/admin/pages/users/index.jsx`（勾选优先导出 + 模板下载 + 导入结果提示）

---

## RBAC 约定

### 数据结构

```
menus 表：
  menu_type = 'menu'    → 页面菜单（显示在侧边栏）
  menu_type = 'button'  → 按钮权限（不显示在侧边栏）

role_menus：角色-菜单 多对多（复合主键）
user_roles：用户-角色 多对多（复合主键）
```

### 超级管理员

`code = 'super_admin'` 的角色拥有所有权限：`hasMenuPermission` 直接放行；`seed-rbac` 每次都会把全部菜单授予它。注意 `GET /api/admin/my-menus` 没有 super_admin 短路，按角色实际授予的菜单返回。

### 菜单变更流程

1. 在 `apps/api/scripts/seed-rbac.ts` 的 `MENUS_DATA`（唯一事实源）中添加 / 修改菜单条目和按钮权限
2. 运行 `pnpm seed:rbac -- --incremental`
3. `--incremental` 按 `code` upsert，只新增 / 更新、**不删除**已有记录，并刷新超级管理员权限；插入后同步 `menus` 序列
4. 删除菜单需手动执行 SQL：`DELETE FROM menus WHERE id = xxx`
5. **不带 `--incremental` 是全量重建**（清空 user_roles / role_menus / admin_users / roles / menus），只用于空库初始化

### 菜单 ID 分配规则

```
系统管理域（parent_id=2）：    ID 21-39（消息通知/公告为历史遗留 100002/100003）
组件示例中心（parent_id=3）：  ID 40-499
  管理系统（parent_id=40）：   ID 401-409
  数据可视化（parent_id=41）： ID 411-419
  3D/创意（parent_id=42）：    ID 421-429
  AI 应用（parent_id=44）：    ID 441-449
  编辑器（parent_id=45）：     ID 451-459
  工具类（parent_id=46）：     ID 461-469
新业务域菜单：                  从 1000 开始
```

> **取 ID 前先查实际占用**，不要按「区间里的下一个数」推算——区间里夹着历史遗留 ID：31、33–37 属于组件示例中心，32 是定时任务，都落在系统管理的 21–39 区间里。
> ```bash
> grep -oE "id: [0-9]+" apps/api/scripts/seed-rbac.ts | awk '{print $2}' | sort -n | uniq
> ```

> 注：`31/33/34/35/36/37`（组件页）与 `100002/100003`（系统管理）为历史遗留 ID，与现行区间不符但已入库并被 role_menus 引用，勿重排；新菜单请严格遵循上述区间。按钮权限 ID 在 `MENUS_DATA` 中写死，规则为「菜单 ID × 10 + 序号」（如用户管理 21 → 211 新增 / 212 编辑 / 213 删除 / 214 导出 / 215 导入 / 216 启用停用；拖拽看板 401 → 4011…；消息通知 100002 → 1000021…）。

---

## 字段类型推断规则

AI 根据业务描述自动推断，**无需 PM 指定技术类型**。scaffold 类型键用于 `pnpm scaffold -- --fields "name:str,phone:str20"`；Drizzle 写法用于 `db/schema/<domain>/<name>.ts`（映射见 `apps/api/scripts/scaffold.ts` 的 `FIELD_TYPE_MAP`）。

| 业务描述关键词 | scaffold 类型 | Drizzle 写法 | 备注 |
|---|---|---|---|
| 名称、标题、姓名、名字 | `str` | `varchar({ length: 100 })` | - |
| 编码、代码、code、编号 | `str50` | `varchar({ length: 50 })` | - |
| 描述、备注、简介、说明 | `text` | `text()` | - |
| 手机、电话、phone | `str20` | `varchar({ length: 20 })` | - |
| 邮箱、email | `str` | `varchar({ length: 100 })` | - |
| 状态、status、类型、type | `str20` | `varchar({ length: 20 })` | - |
| 金额、价格、费用、成本 | `float` | `numeric({ precision: 10, scale: 2 })` | 输出为字符串 |
| 数量、次数、个数 | `int` | `integer()` | - |
| 进度、百分比、完成度 | `int` | `integer()` | 0-100 |
| 日期（无时间） | `date` | `date({ mode: 'string' })` | `YYYY-MM-DD` 文本 |
| 时间 | `datetime` | `timestamp({ mode: 'string' })` | 输出走 `toIso()` |
| 创建时间、更新时间 | （自动） | `createdAt()` / `updatedAt()` | scaffold 自动添加 |
| 是否、启用、禁用、开关 | `bool` | `boolean()` | 手写时加 `.$default(() => true)` |
| 排序、权重、优先级数字 | `int` | `integer()` | 手写时加 `.$default(() => 0)` |
| 颜色、color | `str20` | `varchar({ length: 20 })` | - |
| URL、链接、地址 | `str500` | `varchar({ length: 500 })` | - |
| 图片、头像、封面 | `str500` | `varchar({ length: 500 })` | 存 URL |
| 内容、正文、详情 | `text` | `text()` | 富文本 |
| 标签、tags | `text` | `text()` | JSON 字符串 |

**scaffold 的已知限制**（详见 `new-feature-autopilot` 技能 4a）：`--fields` 表达不了必填 / 唯一 / 默认值——用 `--skip-migration` 生成后改 `db/schema` 再 `pnpm db:generate`，一张表只出一个迁移，违反约束自动返回 400（`common/db-errors.ts`）；生成的标签是英文占位；`bool` 列可为空；枚举字段按 `str20` 生成，存英文代码、界面显示中文需手写映射；表名在资源名后固定加 `s`。scaffold 同时生成接口基础测试 `apps/api/test/<admin|cc>-<name>.test.ts`，加业务规则后要同步维护。

---

## 反模式清单（❌ 禁止）

```
❌ routes.ts 内自定义 hasPermission()（必须 import 自 @/common/auth）
❌ routes.ts 内直接调用 db.select()/sql``（必须经 repository）
❌ db/schema 内写业务逻辑（只放 pgTable + toDict）
❌ 直接 Date#toISOString() 输出时间（必须用 @/common/serialize 的 toIso）
❌ toDict() 里把 numeric 转成数字（保持字符串）
❌ 前端导入 @douyinfe/*（Semi 已下线；verify 的 frontend_no_legacy_ui 会拦截）或引入 antd / material-ui 等其他 UI 库
❌ 前端用 var(--semi-*)、写死十六进制颜色、大段 inline style 布局（用 Tailwind 语义类）
❌ 页面各写一套表格 / 弹窗 / 确认框（必须复用 DataTable / FormDialog / ConfirmAction / ImportDialog / ExportDialog）
❌ 前端用 fetch/XMLHttpRequest 写请求（必须用 @/shared/api/request）
❌ 硬编码菜单 ID（先查菜单树取下一个可用 ID）
❌ 新增域不在 src/router.ts + db/schema/index.ts 注册
❌ 迁移 SQL 手写而不经 drizzle-kit generate（破坏 journal 链）
❌ 迁移只生成不落库，或不用 psql \d 实证就声明完成
❌ 跳过 verify-feature 门禁直接声明完成
❌ 前端页面不放在 modules/<module>/pages/<subdir>/<page>/index.jsx（动态路由失效）
❌ 在导入导出里重新支持 .xls（已决定只支持 csv / xlsx）
❌ 向 PM 询问路由路径、权限编码、字段类型等技术细节（AI 应自行推断）
```

---

## 交付流程（每次新功能严格执行）

```
Step 1  读取上下文
        → 阅读本文件（AGENTS.md）
        → 阅读 docs/templates/ 中的代码骨架模板（backend/README.md 有替换规则）
        → 查看现有相似模块了解命名规范（后端参考 modules/admin/users/，前端参考 apps/web/src/modules/admin/pages/users/index.jsx）
        → 查询当前菜单树（apps/api/scripts/seed-rbac.ts 的 MENUS_DATA），确定 parent_id 和下一个可用 ID

Step 2  生成内部 Spec（AI 内部文档，PM 不直接看）
        → 推断：API 路径、字段类型与长度、权限编码、文件路径、菜单 ID、迁移名称

Step 3  展示业务预览（给 PM 确认）
        仅展示业务层面信息：
        · 功能名称和位置（在哪个菜单下）
        · 字段列表（中文名，必填标注）
        · 可执行操作（增删改查、导入导出等）
        · 等待确认或调整；如有调整回到 Step 2

Step 4  执行实现
        → pnpm scaffold -- --name <name> --domain <admin|component_center> --fields "..."
          （生成 db/schema + modules 四个文件 + 前端 api/页面，自动注册 router.ts 与 db/schema/index.ts，
            并自动执行 drizzle-kit generate --name <name> 生成迁移）
        → 按 db/schema → schema → repository → service → routes 顺序填充业务逻辑与中文表头
        → 若之后又改了表结构：pnpm db:generate --name <描述>（注意这里没有 --）
        → 在 seed-rbac.ts 添加菜单 + 按钮权限（_add/_edit/_delete/_export/_import），运行 pnpm seed:rbac -- --incremental
        → 审查 apps/api/drizzle/ 下新生成的 SQL，运行 pnpm db:migrate
        → 在本文件「当前菜单树」补上新菜单
        → pnpm openapi:generate，在 docs/apifox-full.openapi.json 补全新接口 schema（建议项，verify 只提醒）

Step 5  验证门禁（强制，不得跳过）
        → pnpm verify -- --module <name>（含前端构建与前后端单元测试；调试中途可 --skip-build / --skip-api-tests）
        → 如有失败项，自动修复后重新验证
        → 全部通过后输出交付报告
```

> **迁移必须落库（强制）**：生成 / 修改迁移后，仅靠静态检查（verify 的 `migration_chain`）**不算完成**。必须实际执行并确认：
> 0. 库名以 `apps/api/.env.development` 的 `DEV_DATABASE_URL` 为准（本地默认 `castor_kit`，下面的命令按实际库名替换）
> 1. 写操作前记录当前版本：`psql -d castor_kit -c 'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id'`
> 2. `pnpm db:migrate` 应用变更
> 3. 涉及新表 / 索引 / 字段时，用 `psql -d castor_kit -c '\d <table>'` 确认对象真实存在
> 4. `pnpm verify -- --module <name>` 的 `migration_applied` 项通过（它会比对 journal 与 `drizzle.__drizzle_migrations`，并用 `to_regclass` 确认模块表存在），其 detail 形如「已迁移至 0001_customer（castor_kit）」
> 5. 交付报告中注明「已迁移至 <tag>」（tag 即 `apps/api/drizzle/` 下的迁移名，如 `0001_customer`）

**交付报告格式：**
```
✅ 功能交付完成：<功能名>

变更文件：
  后端：apps/api/src/db/schema/<domain>/<name>.ts
        apps/api/src/modules/<domain>/<name>/{schema,repository,service,routes}.ts
        apps/api/src/db/schema/index.ts、apps/api/src/modules/<domain>/router.ts（注册）
        apps/api/test/<admin|cc>-<name>.test.ts（接口测试，已按业务规则更新）
  前端：apps/web/src/modules/<module>/pages/<subdir>/<page>/index.jsx
        apps/web/src/modules/<module>/api/<name>.js
  RBAC：apps/api/scripts/seed-rbac.ts（已运行 --incremental）
  迁移：apps/api/drizzle/<tag>.sql —— 已迁移至 <tag>（psql \d <table> 已确认）
  门禁：pnpm verify -- --module <name> 全部通过（含前后端单元测试）

用户下一步操作：
  1. 刷新页面，在 <位置> 找到 <功能名>
  2. （其他环境部署时）pnpm db:migrate && pnpm seed:rbac -- --incremental
```

---

## 文档站与开源规范文件

- 文档站与官网在 `website/`（VitePress，独立 npm 项目，不在 pnpm workspace 内）：中文是根语言（`website/guide/…`），英文 `website/en/`、日文 `website/ja/`，三种语言页面一一对应；首页是 `.vitepress/theme/components/Landing.vue`，文案在 `landing-content.js`
- 落地页与 README 的界面图都是真实截图（`website/public/screenshots/`、`.github/assets/screenshot-*.webp`），由 `npm --prefix website run screenshots` 在 `pnpm dev` 运行时自动截取（会提示输入 admin 密码）；界面外观有明显变化时重新截图
- 功能行为、命令、环境变量有变化时，同一个 PR 里同步更新三种语言的文档；本地预览 `npm --prefix website run dev`，提交前 `npm --prefix website run build`（会检查死链）
- 文档站由 `.github/workflows/docs.yml` 发布到 GitHub Pages（https://robeshell.github.io/castor-kit/）：`website/` 的改动合入 main 后自动部署，PR 只构建检查
- 仓库根目录的 `README.md`（英文）/ `README_CN.md` / `README.ja.md`、`CONTRIBUTING.md`、`SECURITY.md`、`CHANGELOG.md` 面向外部贡献者；用户可见的变化记到 `CHANGELOG.md` 的 `[Unreleased]`

## 常用命令速查

所有命令在仓库根目录执行。castor-kit 自己的脚本（scaffold / verify / seed:rbac / openapi:*）参数前的 `--` 可写可不写；**`pnpm db:generate` 后面不能写 `--`**（drizzle-kit 不认识）。

```bash
# 安装 / 启动
pnpm install
pnpm dev                     # api(5001) + web(5173)
pnpm dev:api                 # 只起后端（tsx watch）
pnpm dev:web                 # 只起前端（vite）
pnpm --filter @castor-kit/api worker   # 独立调度器进程（RUN_SCHEDULER_IN_WEB=false 时）

# 质量
pnpm typecheck               # tsc --noEmit（api / mcp）
pnpm test                    # vitest（需要 castor_kit_test 库）+ web 单测
pnpm lint
pnpm build                   # web(vite) + api(tsup) + mcp

# 数据库迁移（Drizzle）
pnpm db:generate --name <描述>          # drizzle-kit generate，生成 apps/api/drizzle/<nnnn>_<描述>.sql
pnpm db:migrate                         # 应用迁移（记录在 drizzle.__drizzle_migrations）
psql -d castor_kit -c '\d <table>'       # 实证落库（库名取 apps/api/.env.development 的 DEV_DATABASE_URL）

# RBAC（菜单变更后必跑）
pnpm seed:rbac -- --incremental         # 增量 upsert，不删除
pnpm seed:rbac                          # 全量重建（仅空库初始化）

# 一次性初始化（迁移 + RBAC 增量 + AI SQL 只读账号，advisory lock 保证并发安全）
pnpm setup-once
pnpm --filter @castor-kit/api init-ro-role   # 单独创建只读账号 castor_kit_ro（需 POSTGRES_RO_PASSWORD）

# 验证门禁
pnpm verify -- --module <name>                 # 全部检查（含 vite build）
pnpm verify -- --module <name> --skip-build    # 跳过前端构建
pnpm verify -- --module <name> --json          # 结构化 JSON（stdout 只有 JSON，供 AI/MCP 读取）
#   其他参数：--skip-frontend-tests --skip-api-tests --skip-db --strict-docs --run-rbac-sync --database-url <url>

# 代码骨架生成
pnpm scaffold -- --name <name> --domain admin --fields "name:str,status:str20"
pnpm scaffold -- --name <name> --domain component_center --fields "..." --dry-run   # 只打印不写文件
#   --domain 只能是 admin 或 component_center；--skip-migration 不调用 drizzle-kit

# OpenAPI
pnpm openapi:generate                    # 从 Fastify 路由补齐 docs/apifox-full.openapi.json
pnpm openapi:generate -- --dry-run       # 只统计覆盖率不写回（--strict：存在骨架路径则非 0 退出）
pnpm openapi:apifox                      # 推送到 Apifox（APIFOX_PROJECT_ID / APIFOX_ACCESS_TOKEN，或 --project-id / --access-token）

# MCP Server
pnpm mcp
```

---

## MCP Server

`apps/mcp/src/index.ts` 把工具链暴露为 MCP 协议，工具：`get_project_context` / `get_menu_tree` / `scaffold_feature` / `run_verify` / `init_rbac` / `run_migration` / `list_templates`。

Claude Desktop 配置（`claude_desktop_config.json`）：
```json
{
  "mcpServers": {
    "castor-kit": { "command": "pnpm", "args": ["--dir", "/path/to/castor-kit", "-s", "mcp"] }
  }
}
```
也可 `pnpm --filter @castor-kit/mcp build` 后用 `node apps/mcp/dist/index.js`；仓库根目录可用环境变量 `CASTOR_KIT_ROOT` 覆盖。

---

## 当前菜单树（ID 参考）

> 唯一事实源：`apps/api/scripts/seed-rbac.ts`（菜单 + 按钮权限）。新增功能菜单后同步补到下面；有出入时以 seed-rbac.ts 为准。

```
ID=1   首页 (dashboard) → /dashboard → admin/dashboard
ID=2   系统管理 (system)
  ID=21  用户管理 → /system/users → admin/users
  ID=22  角色权限 → /system/roles → admin/roles
  ID=23  菜单管理 → /system/menus → admin/menus
  ID=24  日志管理 → /system/logs → admin/logs
  ID=25  数据字典 → /system/dicts → admin/dicts
  ID=32  定时任务 → /system/scheduled-tasks → admin/scheduled_tasks
  ID=100002 消息通知 → /system/notifications → admin/notifications
  ID=100003 公告管理 → /system/announcements → admin/announcement_page
ID=3   组件示例中心 (component_center)
  ID=40  管理系统 (cc_admin)
    ID=31  列表页 → /component-center/list-page → component_center/admin/list_page
    ID=33  统计列表页 → /component-center/stats-list-page → component_center/admin/stats_list_page
    ID=34  卡片列表页 → /component-center/card-list-page → component_center/admin/card_list_page
    ID=35  树形列表页 → /component-center/tree-list-page → component_center/admin/tree_list_page
    ID=36  动态表单页 → /component-center/dynamic-form-page → component_center/admin/dynamic_form_page
    ID=401 拖拽看板页 → /component-center/admin/kanban → component_center/admin/kanban_page
    ID=402 详情标签页 → /component-center/admin/detail-tabs → component_center/admin/detail_tabs_page
    ID=403 甘特图页 → /component-center/admin/gantt → component_center/admin/gantt_page
    ID=404 高级表格页 → /component-center/admin/advanced-table → component_center/admin/advanced_table_page
  ID=41  数据可视化 (cc_dataviz)
    ID=37  数据大屏 → /component-center/dashboard-page → component_center/dataviz/dashboard_page
    ID=411 实时折线图 → /component-center/dataviz/realtime-chart → component_center/dataviz/realtime_chart_page
    ID=412 热力日历图 → /component-center/dataviz/heatmap → component_center/dataviz/heatmap_page
    ID=413 地图热力图 → /component-center/dataviz/map-heatmap → component_center/dataviz/map_heatmap_page
  ID=42  3D / 创意 (cc_3d)
    ID=421 粒子连线动画 → /component-center/creative/particle → component_center/creative/particle_canvas_page
    ID=422 CSS 3D 卡片 → /component-center/creative/css-3d → component_center/creative/css_3d_page
    ID=423 Three.js 地球 → /component-center/creative/globe → component_center/creative/threejs_globe_page
    ID=424 粒子形态变换 → /component-center/creative/morphing → component_center/creative/morphing_particles_page
  ID=44  AI 应用 (cc_ai)
    ID=441 AI 对话 → /component-center/ai/chat → component_center/ai/ai_chat_page
    ID=442 AI 提示词工坊 → /component-center/ai/prompt → component_center/ai/ai_prompt_page
    ID=443 AI 数据查询 → /component-center/ai/sql → component_center/ai/ai_sql_page
  ID=45  编辑器 / 低代码 (cc_editor)
    ID=451 富文本编辑器 → /component-center/editor/rich-text → component_center/editor/rich_text_page
    ID=452 代码编辑器 → /component-center/editor/code → component_center/editor/code_editor_page
    ID=453 JSON 编辑器 → /component-center/editor/json → component_center/editor/json_editor_page
    ID=454 Markdown 预览 → /component-center/editor/markdown → component_center/editor/markdown_page
  ID=46  工程 / 工具类 (cc_devtools)
    ID=461 拖拽布局 → /component-center/devtools/drag-layout → component_center/devtools/drag_layout_page
    ID=462 虚拟滚动列表 → /component-center/devtools/virtual-scroll → component_center/devtools/virtual_scroll_page
    ID=463 WebSocket 通信 → /component-center/devtools/websocket → component_center/devtools/websocket_page
    ID=464 性能监控面板 → /component-center/devtools/perf-monitor → component_center/devtools/perf_monitor_page
```

---

## 已拍板的决定（不要再问）

- 项目名 `castor-kit`；命名一律小写连字符，不用驼峰、不用 Stack 后缀
- 后端：Node 22 + TypeScript + Fastify 5 + Zod + Drizzle + pg + pino；不用 NestJS
- 前端：React 19 + Vite + shadcn/ui + Tailwind CSS v4 + motion + lucide-react（JSX，文案中文），UI 体系见 `docs/frontend-redesign-plan.md`
- `.xls` 不支持，只支持 csv / xlsx
- 密码哈希格式 `pbkdf2:sha256:<iter>$<salt>$<hex>`（`common/password.ts`，异步 pbkdf2）
- 会话：`@fastify/secure-session`，cookie 名 `castor_session`，密钥用 HKDF 从 `SECRET_KEY` 派生
- 时间字段不经过 JS `Date`：pg 类型 1114/1082 保留文本，`toIso()` 把空格换 `T` 并把小数秒右补 0 到 6 位（pg 文本输出会去掉末尾 0，补齐后格式稳定）
- cron 匹配器自研（日/周为 AND 语义，与标准 cron 的 OR 不同），不用 `cron-parser`
- 请求 schema `.passthrough()` + 全可选，归一化逻辑在 service 里做
- 操作日志用全局 `onResponse` hook 集中写，不散到 service
- 运行环境由 `NODE_ENV` 决定；生产环境缺 `SECRET_KEY` / `ADMIN_PASSWORD` / `AI_SQL_DATABASE_URL` 拒绝启动
