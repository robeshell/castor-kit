# castor-kit — GitHub Copilot Instructions

**完整项目上下文见 `AGENTS.md`，实现任何功能前必须阅读。**

## 项目定位

Node.js/TypeScript + React + RBAC 的 AI-First 脚手架。pnpm monorepo：后端 `apps/api`（Fastify 5 + Zod + Drizzle，端口 5001），前端 `apps/web`（Vite dev server 5173，`/api` 请求通过 proxy 转发），MCP Server `apps/mcp`。

## 必须遵守的约定

### 后端（apps/api）
- 所有 API 路由前缀：`/api/admin/`
- 权限检查：`import { hasMenuPermission, loginRequired } from '@/common/auth'`，`if (!(await hasMenuPermission(request, 'system_xxx'))) return reply.status(403).send({ error: '无权限' })`（禁止在 routes 文件内自定义 hasPermission）
- 分层严格：`db/schema → schema → repository → service → routes`，每个模块一个目录 `modules/<domain>/<name>/`
- 表定义：`pgTable(...)` + `xxxToDict()`，时间列 `createdAt()/updatedAt()`，输出用 `toIso()`（禁止 `Date#toISOString()`）
- 业务错误：service 抛 `ServiceError(message, status, payload)`
- 导入导出：使用 `common/tabular.ts` 中的 `buildTable` / `sendTable` / `readTableFile`（只支持 csv / xlsx）

### 前端（apps/web）
- UI 组件：shadcn/ui（`@/components/ui/*`）+ 业务公共组件（`@/shared/components/*`）+ `lucide-react` 图标，Tailwind CSS v4 语义色类；禁止 `@douyinfe/*`（Semi 已下线）、antd 等其他 UI 库、`var(--semi-*)`、写死十六进制颜色
- 列表页结构照 `apps/web/src/modules/admin/pages/users/index.jsx`（PageHeader → FilterBar → DataTable → FormDialog → ImportDialog / ExportDialog，ConfirmAction 删除，`@/lib/toast` 提示）；方案见 `docs/frontend-redesign-plan.md`
- API 请求：`import request from '@/shared/api/request'`（Vite 已配置 `@` alias → `src/`）
- 路由响应数据：Axios 拦截器已 unwrap，直接用 `res.items` / `res.total`，**不要** `res.data.items`
- 页面文件位置：`src/modules/<module>/pages/<subdir>/<page>/index.jsx`
- 导入导出组件：`@/shared/components/data-transfer/ImportDialog` + `@/shared/components/data-transfer/ExportDialog`
- 表单：`react-hook-form` + `@/shared/components/FormFields`（str→FormInput、text→FormTextarea、int/float→FormNumber、bool→FormSwitch、date→FormDate、datetime→FormDateTime）
- 文件下载：`import { downloadBlobFile } from '@/shared/utils/file'`

### RBAC
- 菜单变更后必须运行：`pnpm seed:rbac -- --incremental`

## 新功能开发流程

1. 读取 `AGENTS.md` 和 `docs/templates/` 中的骨架模板
2. 运行 scaffold：`pnpm scaffold -- --name <name> --domain admin --fields "..."`（自动注册路由与表定义并生成迁移）
3. 按 db/schema → schema → repository → service → routes 顺序填充业务逻辑
4. 在 `apps/api/scripts/seed-rbac.ts` 中添加菜单 + 按钮权限，运行 `pnpm seed:rbac -- --incremental`
5. `pnpm db:migrate`，并用 `psql -d castor_kit -c '\d <table>'` 确认落库（改表结构后用 `pnpm db:generate --name <描述>` 生成新迁移，不能写 `--`）
6. 运行 `pnpm verify -- --module <name>` 验证

## 字段类型速查

| 业务关键词 | scaffold 类型 | Drizzle 写法 |
|---|---|---|
| 名称、标题 | `str` | `varchar({ length: 100 })` |
| 手机、电话 | `str20` | `varchar({ length: 20 })` |
| 状态、类型 | `str20` | `varchar({ length: 20 })` |
| 金额、价格 | `float` | `numeric({ precision: 10, scale: 2 })` |
| 描述、内容 | `text` | `text()` |
| 是否、开关 | `bool` | `boolean()` |
| 链接（外部地址） | `str500` | `varchar({ length: 500 })` |
| 图片、头像、封面 | `image` | `varchar({ length: 36 })`（文件中心 ID） |
| 附件、文件 | `file` | `varchar({ length: 36 })`（文件中心 ID） |
| 日期 | `date` | `date({ mode: 'string' })` |
