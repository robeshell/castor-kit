# castor-kit — Agent Context

> **通用上下文文档**，适用于所有 AI 工具（Claude Code、Cursor、Windsurf、GitHub Copilot、Codex CLI、MCP Client 等）。
> 实现任何新功能前必须完整阅读本文件。AI 应从本文件自行推断所有技术决策，无需向 PM 询问技术细节。
>
> 各工具专属配置：`CLAUDE.md`（Claude Code）| `CODEX.md`（Codex CLI）| `.cursor/rules/`（Cursor）| `.github/copilot-instructions.md`（Copilot）| `.windsurfrules`（Windsurf）| `llms.txt`（入口索引）
> 重写方案与验收基线：`docs/rewrite-plan.md`（§2 兼容契约、§4 分层与反模式、§7 工具链）。

---

## 项目定位

**Node.js/TypeScript + React + RBAC 的 AI-First 脚手架。**

目标：PM 用自然语言描述业务意图 → AI Agent 自动推断技术决策 → 展示业务预览供确认 → 端到端交付符合规范的新功能模块（数据表、接口、页面、权限、迁移）。

castor-kit 是 AuraStack（Flask 版）的 Node.js/TypeScript 重写：**后端换成 Node，前端不动，数据库不动，API 契约兼容**。原项目在本机 `/Users/wangwenyu/Documents/Code/AuraStack`（GitHub `robeshell/AuraStack`），移植或排查行为差异时以那里的 Python 实现为行为基准。

---

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 运行时 | Node + TypeScript（strict） | Node 22（`.nvmrc`），TS 7 |
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
| 前端框架 | React + Vite + React Router + Axios | 18 / 5 / 7 |
| UI 组件库 | Semi Design（`@douyinfe/semi-ui`） | ^2.93.0 |
| 图标 | `@douyinfe/semi-icons` | ^2.93.0 |
| 图表 | ECharts 6 + echarts-for-react | - |
| 3D | Three.js | 0.176 |
| 代码编辑器 | @monaco-editor/react | - |
| 富文本 | react-quill | - |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable | - |
| MCP | `@modelcontextprotocol/sdk` | 1.x |

**开发环境：**
- 端口：api 5001、web 5173（Vite proxy 把 `/api`、`/ws` 转发到 5001）；测试环境 5002；生产 5000
- 数据库：`postgresql://wangwenyu@localhost/aurastack`（与 AuraStack 共用，写在 `apps/api/.env.development` 的 `DEV_DATABASE_URL`；未设置时默认 `postgresql://localhost/aurastack_dev`）
- 本地配置：`apps/api/.env.development`（参考 `apps/api/.env.example`，已被 gitignore；仓库根目录的 `.env.<NODE_ENV>` 也会被读取）
- 默认账号：`admin` / `admin123`
- 测试库：`createdb -T aurastack aurastack_test`（克隆）或 `createdb aurastack_test`（空库，测试会自动跑 baseline）；`pnpm test`

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
│   │   │   │   ├── serialize.ts       # toIso() 等，对齐 Python isoformat 输出
│   │   │   │   ├── tabular.ts         # csv/xlsx 读写 + 公式注入防护 + 5MB 上限
│   │   │   │   ├── request-meta.ts    # clientIp / userAgent / safePayload（脱敏）
│   │   │   │   ├── password.ts        # werkzeug pbkdf2:sha256 哈希兼容
│   │   │   │   └── scheduler/         # 定时任务 runner（租约模型）+ cron 匹配器 + SSRF 防护
│   │   │   ├── db/
│   │   │   │   ├── client.ts          # pg Pool + drizzle 实例 + 类型解析器
│   │   │   │   ├── readonly.ts        # AI SQL 专用只读 Pool
│   │   │   │   ├── migrate.ts         # 迁移执行器（含 baseline 逻辑）
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
│   │   │                              #         init-ro-role / generate-openapi / import-apifox / shadow-diff
│   │   ├── test/                      # Vitest（真实 PostgreSQL）
│   │   └── drizzle.config.ts
│   ├── web/                           # @castor-kit/web —— 从 AuraStack frontend/ 原样迁入
│   │   └── src/
│   │       ├── App.jsx                # 动态路由（import.meta.glob）
│   │       ├── context/AuthContext.jsx
│   │       ├── components/Layout/     # 侧边栏 + PrivateRoute
│   │       ├── modules/
│   │       │   ├── admin/{pages,api}/
│   │       │   └── component_center/
│   │       │       ├── pages/{admin,dataviz,creative,ai,editor,devtools}/
│   │       │       └── api/
│   │       └── shared/
│   │           ├── api/request.js     # Axios 实例（baseURL='/api', withCredentials, CSRF 头）
│   │           ├── utils/file.js      # downloadBlobFile
│   │           ├── hooks/             # useCrudList / useIsMobile
│   │           └── components/import-export/{ExportFieldsModal,ImportCsvModal}.jsx
│   └── mcp/                           # @castor-kit/mcp —— MCP Server（src/index.ts）
├── docs/
│   ├── rewrite-plan.md                # 重写方案
│   ├── apifox-full.openapi.json       # OpenAPI 文档（pnpm openapi:generate 补齐）
│   └── templates/                     # 代码骨架模板（AI 临摹用）
│       ├── backend/                   # db-schema / schema / repository / service / routes（.ts）+ README.md
│       └── frontend/                  # list_page / detail_page
├── website/                           # VitePress 文档站（独立 npm 项目，不在 pnpm workspace 内）
└── Dockerfile / docker-compose.yml / docker-entrypoint.sh / setup.sh
```

> 命名：后端目录与文件名一律小写连字符（`component-center`、`scheduled-task`、`customer-order.ts`）；表名、前端目录、菜单 `component` 保持下划线（`component_center/admin/list_page`），与现库和前端路由兼容。

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

### 横切约定（移植期契约，见 `docs/rewrite-plan.md` §2）

- **时间**：pg `timestamp`/`date` 保留文本不经过 JS `Date`；输出一律 `toIso()`（`YYYY-MM-DDTHH:mm:ss[.ffffff]`，无 `Z`）。**禁止** `Date#toISOString()`
- **数值**：`numeric` 列保持字符串（如 `"12.50"`），`toDict()` 里不要 `parseFloat`
- **请求校验**：移植期请求 schema 一律宽松（`.passthrough()` / `z.record(...)` + 全可选），归一化逻辑在 service 里做；收紧校验是独立任务
- **错误**：service 抛 `ServiceError`，全局错误处理器转成 `{ error, ...payload }`；`/api/*` 下 404/405/500 均返回 JSON
- **操作日志**：由 logs 模块注册的全局 `onResponse` hook 集中写 `operation_logs`，不要在 service 里散写
- **CSRF**：`/api/*` 的写请求需带 `X-CSRF-Token`（前端 request.js 已自动处理），登录接口豁免

---

## 前端架构约定

前端从 AuraStack 原样迁入，约定不变，只是路径从 AuraStack 的 frontend 目录变为 `apps/web/`。

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

- **必须**使用 Semi Design（`@douyinfe/semi-ui`）与 `@douyinfe/semi-icons`
- **禁止**引入 antd、material-ui 等其他 UI 库
- **参考实现**：`apps/web/src/modules/component_center/pages/admin/list_page/index.jsx`
- **MCP-First**：实现 UI 组件前，优先通过 `semi-mcp` 工具读取 Semi Design 官方文档，确保 API 用法正确；文档与现有实现冲突时以现有实现为准

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
- 在 `modules/<domain>/<name>/schema.ts` 定义 `EXPORT_FIELD_MAP`（字段 → [中文表头, 取值函数]）和 `IMPORT_HEADER_MAP`（中文表头 → 字段）
- 导入整批一个事务：有错误行时抛 `ServiceError('导入失败，存在错误数据', 400, { error_rows, error_count })` 整体回滚
- 路由：`POST /export`、`GET /template`、`POST /import`（挂在资源路径下）；权限编码 `<perm>_export` / `<perm>_import`
- 参考实现：`apps/api/src/modules/admin/users/`

**前端**
- 导出弹窗：`@/shared/components/import-export/ExportFieldsModal`
- 导入弹窗：`@/shared/components/import-export/ImportCsvModal`（格式选项只有 CSV / XLSX）
- 下载：`import { downloadBlobFile } from '@/shared/utils/file'`

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

`code = 'super_admin'` 的角色拥有所有权限：`hasMenuPermission` 直接放行；`seed-rbac` 每次都会把全部菜单授予它。注意 `GET /api/admin/menus/my-menus` 没有 super_admin 短路，按角色实际授予的菜单返回。

### 菜单变更流程

1. 在 `apps/api/scripts/seed-rbac.ts` 的 `MENUS_DATA`（唯一事实源）中添加 / 修改菜单条目和按钮权限
2. 运行 `pnpm seed:rbac -- --incremental`
3. `--incremental` 按 `code` upsert，只新增 / 更新、**不删除**已有记录，并刷新超级管理员权限；插入后同步 `menus` 序列
4. 删除菜单需手动执行 SQL：`DELETE FROM menus WHERE id = xxx`
5. **不带 `--incremental` 是全量重建**（清空 user_roles / role_menus / admin_users / roles / menus），只用于空库初始化

### 菜单 ID 分配规则

```
系统管理域（parent_id=2）：    ID 21-39（已用到 32；消息通知/公告为历史遗留 100002/100003）
组件示例中心（parent_id=3）：  ID 40-499
  管理系统（parent_id=40）：   ID 401-409（已用到 404；列表/统计/卡片/树形/动态表单为历史遗留 31/33/34/35/36）
  数据可视化（parent_id=41）： ID 411-419（已用到 413；数据大屏为历史遗留 37）
  3D/创意（parent_id=42）：    ID 421-429（已用到 424）
  AI 应用（parent_id=44）：    ID 441-449（已用到 443）
  编辑器（parent_id=45）：     ID 451-459（已用到 454）
  工具类（parent_id=46）：     ID 461-469（已用到 464）
新业务域菜单：                  从 1000 开始
```

> 注：`31/33/34/35/36/37`（组件页）与 `100002/100003`（系统管理）为历史遗留 ID，与现行区间不符但已入库并被 role_menus 引用，勿重排；新菜单请严格遵循上述区间。按钮权限 ID 在 `MENUS_DATA` 中写死，规则为「菜单 ID × 10 + 序号」（如用户管理 21 → 211 新增 / 212 编辑 / 213 删除 / 214 导出 / 215 导入；拖拽看板 401 → 4011…；消息通知 100002 → 1000021…）。

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

---

## 反模式清单（❌ 禁止）

```
❌ routes.ts 内自定义 hasPermission()（必须 import 自 @/common/auth）
❌ routes.ts 内直接调用 db.select()/sql``（必须经 repository）
❌ db/schema 内写业务逻辑（只放 pgTable + toDict）
❌ 直接 Date#toISOString() 输出时间（必须用 @/common/serialize 的 toIso）
❌ toDict() 里把 numeric 转成数字（保持字符串）
❌ 使用非 Semi Design 的 UI 组件库
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
        → 查看现有相似模块了解命名规范（参考 modules/admin/users/）
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

Step 5  验证门禁（强制，不得跳过）
        → pnpm verify -- --module <name>
        → 如有失败项，自动修复后重新验证
        → 全部通过后输出交付报告
```

> **迁移必须落库（强制）**：生成 / 修改迁移后，仅靠静态检查（verify 的 `migration_chain`）**不算完成**。必须实际执行并确认：
> 1. 写操作前记录当前版本：`psql -d aurastack -c 'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id'`
> 2. `pnpm db:migrate` 应用变更
> 3. 涉及新表 / 索引 / 字段时，用 `psql -d aurastack -c '\d <table>'` 确认对象真实存在
> 4. `pnpm verify -- --module <name>` 的 `migration_applied` 项通过（它会比对 journal 与 `drizzle.__drizzle_migrations`，并用 `to_regclass` 确认模块表存在），其 detail 形如「已迁移至 0001_customer（aurastack）」
> 5. 交付报告中注明「已迁移至 <tag>」（tag 即 `apps/api/drizzle/` 下的迁移名，如 `0001_customer`）

**交付报告格式：**
```
✅ 功能交付完成：<功能名>

变更文件：
  后端：apps/api/src/db/schema/<domain>/<name>.ts
        apps/api/src/modules/<domain>/<name>/{schema,repository,service,routes}.ts
        apps/api/src/db/schema/index.ts、apps/api/src/modules/<domain>/router.ts（注册）
  前端：apps/web/src/modules/<module>/pages/<subdir>/<page>/index.jsx
        apps/web/src/modules/<module>/api/<name>.js
  RBAC：apps/api/scripts/seed-rbac.ts（已运行 --incremental）
  迁移：apps/api/drizzle/<tag>.sql —— 已迁移至 <tag>（psql \d <table> 已确认）
  门禁：pnpm verify -- --module <name> 全部通过

用户下一步操作：
  1. 刷新页面，在 <位置> 找到 <功能名>
  2. （其他环境部署时）pnpm db:migrate && pnpm seed:rbac -- --incremental
```

---

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
pnpm test                    # vitest（需要 aurastack_test 库）+ web 单测
pnpm lint
pnpm build                   # web(vite) + api(tsup) + mcp

# 数据库迁移（Drizzle）
pnpm db:generate --name <描述>          # drizzle-kit generate，生成 apps/api/drizzle/<nnnn>_<描述>.sql
pnpm db:migrate                         # 应用迁移（现库只标记 baseline，记录在 drizzle.__drizzle_migrations）
psql -d aurastack -c '\d <table>'       # 实证落库

# RBAC（菜单变更后必跑）
pnpm seed:rbac -- --incremental         # 增量 upsert，不删除
pnpm seed:rbac                          # 全量重建（仅空库初始化）

# 一次性初始化（迁移 + RBAC 增量 + AI SQL 只读账号，advisory lock 保证并发安全）
pnpm setup-once
pnpm --filter @castor-kit/api init-ro-role   # 单独创建只读账号 aurastack_ro（需 POSTGRES_RO_PASSWORD）

# 验证门禁
pnpm verify -- --module <name>                 # 全部检查（含 vite build）
pnpm verify -- --module <name> --skip-build    # 跳过前端构建
pnpm verify -- --module <name> --json          # 结构化 JSON（stdout 只有 JSON，供 AI/MCP 读取）
#   其他参数：--skip-frontend-tests --skip-db --strict-docs --run-rbac-sync --database-url <url>

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

# 与 Flask oracle 对照（移植期）
pnpm shadow-diff -- --flask http://localhost:5003 --node http://localhost:5001 [--only users]
bash apps/api/scripts/shadow-all.sh   # 集成对照：全部模块按组在 aurastack_test / aurastack_t1..t7 上对 Flask(production) 跑一遍
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

> 唯一事实源：`apps/api/scripts/seed-rbac.ts`（45 个菜单 + 按钮权限；ID 与 AuraStack 逐条一致）

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
- 前端：React 18 + Vite + Semi Design，从 AuraStack 原样复制到 `apps/web`，不换 UI 库
- 数据库：直连现有 PostgreSQL（同库同表同列），不做数据迁移；`alembic_version` 表保留（Drizzle 不建模它）
- `.xls` 不支持，只支持 csv / xlsx
- 密码哈希必须兼容 werkzeug `pbkdf2:sha256:<iter>$<salt>$<hex>`，并行期新哈希也写此格式
- 会话：`@fastify/secure-session`，cookie 名 `castor_session`，密钥用 HKDF 从 `SECRET_KEY` 派生；从 AuraStack 切换时所有用户需重新登录一次
- 时间字段不经过 JS `Date`：pg 类型 1114/1082 保留文本，`toIso()` 把空格换 `T` 并把小数秒右补 0 到 6 位（pg 文本输出会去掉末尾 0，Python 固定 6 位；P0 shadow-diff 实测）
- cron 匹配器从 AuraStack 原样移植（日/周为 AND 语义），不用 `cron-parser`
- 移植期请求 schema `.passthrough()` + 全可选，归一化逻辑在 service 里照搬
- 操作日志用全局 `onResponse` hook 集中写，不散到 service
- 环境变量名沿用 AuraStack，仅 `FLASK_ENV` → `NODE_ENV`；生产环境缺 `SECRET_KEY` / `ADMIN_PASSWORD` / `AI_SQL_DATABASE_URL` 拒绝启动

---

## 移植期实测事实与已知差异

### P0 实施中确认的事实（shadow-diff 对 Flask 实测，覆盖方案里的推测）

- 404/405：Flask 的 SPA catch-all 对任意路径接受 GET，所以**未命中的 GET/HEAD → 404（/api）或 SPA，未命中的其他方法一律 405**（含未知路径的 POST；“只注册了 POST 的路径被 GET”是 404 不是 405）
- CSRF 检查挂 `preValidation`：被拒请求的请求体仍要进操作日志（Flask 的 after_request 会记）；未命中路由的已登录写请求也先 403
- `created_at/updated_at` 在现库没有 DB DEFAULT（是 SQLAlchemy 应用侧默认），Node 插入用 `db/schema/columns.ts` 的 `createdAt()/updatedAt()`（`timezone('utc', now())`）
- `menu_codes` 与角色顺序在 Python 侧不保证，契约比较按集合
- `my-menus` 没有 super_admin 短路；叶子节点没有 `children` 键
- Flask 实际响应是 `ensure_ascii` + 排序键 + debug 缩进的 JSON；Node 输出 UTF-8 紧凑 JSON。二者 JSON 语义一致（shadow-diff 按解析后比较），字节不同

### P1 注意

- `pyJsonDumps` 把 `1.0` 输出成 `1`（Python 保留 `1.0`），只影响浮点请求体写进 `operation_logs.payload` 的文本
- 非 `/api` 路径的未命中写请求返回 JSON 405，Flask 是 Werkzeug HTML 405（前端不会触发）
- 非 P0 表的 `toDict` 与应用侧默认值（`createdAt()` 等）在移植对应模块时按 Python 模型补齐

### 工具链与 AuraStack 的有意差异

- `setup-once` 里的 RBAC 同步用增量模式（Python 版实际走了全量重建，会清空账号与角色）
- `generate-openapi` 输出标准 OpenAPI 路径参数（`{user_id}`），同一路径的多个方法合并生成
- AI SQL 只读账号名仍为 `aurastack_ro`，advisory lock key 仍为 `0x41555341`（与现库和 AuraStack 部署兼容）

### 与 Flask oracle 对照（移植期）

Flask 跑 5003 作参考，Node 跑 5001（或并行验证期的 5002），两者连同一个库：

```bash
# 在 AuraStack 仓库
FLASK_ENV=development ENABLE_TASK_SCHEDULER=false venv/bin/python app.py 5003
# 在 castor-kit 仓库
pnpm shadow-diff -- --flask http://localhost:5003 --node http://localhost:5001
```

用例在 `apps/api/scripts/shadow-cases/`（按模块一个文件）；写接口用例会真实写库，只在测试库上跑。
