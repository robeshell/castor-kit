# 后端模板使用说明

> 优先用脚手架生成（会自动完成下面的替换、注册和迁移生成）：
>
> ```bash
> pnpm scaffold -- --name <resource> --domain <admin|component_center> --fields "name:str,phone:str"
> ```
>
> 脚手架不可用或需要手写时，再临摹本目录的模板。

## 文件说明

| 文件 | 目标位置 | 对应层 | 说明 |
|---|---|---|---|
| `db-schema.ts` | `apps/api/src/db/schema/<domain>/<resource>.ts` | model 层 | Drizzle `pgTable` + `toDict`，只放表结构与序列化 |
| `schema.ts` | `apps/api/src/modules/<domain>/<resource>/schema.ts` | schema 层 | 请求体归一化、导入导出字段映射 |
| `repository.ts` | `apps/api/src/modules/<domain>/<resource>/repository.ts` | crud 层 | 纯数据库读写（Drizzle 查询） |
| `service.ts` | `apps/api/src/modules/<domain>/<resource>/service.ts` | service 层 | 业务逻辑 + `ServiceError` |
| `routes.ts` | `apps/api/src/modules/<domain>/<resource>/routes.ts` | api 层 | Fastify 路由 + 权限检查 |

后端目录名、文件名一律小写连字符（customer_order → customer-order 目录，component_center 域 → component-center 目录）；
表名、前端路径保持下划线。

## 使用方式

1. 复制文件到上表对应位置
2. 全局替换占位符：
   - `<Resource>` → 类型/类名（大驼峰，如 `Customer`）
   - `<resource>` → 资源名（下划线，如 `customer`；表名为 `<resource>s`；URL 用连字符复数，如 `/api/admin/customer-orders`；多词资源的 `<resource>ToDict` 写成 camelCase）
   - `<domain>` → 所属域目录（`admin` 或 `component-center`）
   - `<domain_resource>` → 权限编码前缀（如 `system_customer`；component_center 域用 `cc_` 前缀）
3. 补充实际业务字段（搜索 `TODO` 注释）
4. 注册：
   - `apps/api/src/db/schema/index.ts`：`export * from './<domain>/<resource>'`
   - `apps/api/src/modules/<domain>/router.ts`：
     ```ts
     import { register<Resource>Routes } from './<resource>/routes'
     await register<Resource>Routes(app)
     ```
5. 迁移：`pnpm db:generate --name add_<resource>_table` → 审查 SQL → `pnpm db:migrate` → `psql -d <db> -c '\d <resource>s'` 确认落库
6. RBAC：在 `apps/api/scripts/seed-rbac.ts` 添加菜单 + 按钮权限，运行 `pnpm seed:rbac -- --incremental`
7. 前端：临摹 `docs/templates/frontend/`（`list_page` 列表页 + `api.js`，shadcn/ui 体系，约定见 `docs/frontend-redesign-plan.md`），
   页面放 `apps/web/src/modules/<module>/pages/<subdir>/<page>/index.jsx`；scaffold 会直接生成同结构的页面
8. 门禁：`pnpm verify -- --module <resource>`（含 `frontend_no_legacy_ui`：页面目录不得导入 `@douyinfe/*`）

## 约定

- 权限判断一律 `import { hasMenuPermission, loginRequired } from '@/common/auth'`，禁止在 routes 里自定义 `hasPermission`
- routes 不直接写 SQL；service 不碰 `reply` / `session`
- 带 id 的路由先 get_or_404（404）再做权限检查（403）
- 时间输出一律 `toIso()`，禁止 `Date#toISOString()`；numeric 保持字符串
- 导入整批一个事务，有错误行时抛 `ServiceError(400, { error_rows, error_count })` 整体回滚

## 参考实现

- `apps/api/src/modules/admin/users/`（标准 CRUD + 导入导出）
- `apps/api/test/admin-users.test.ts`（对应的 vitest 用例写法）
