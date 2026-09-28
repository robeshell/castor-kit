# 后端开发

后端位于 `apps/api`，技术栈是 Fastify 5 + Zod + Drizzle ORM + PostgreSQL，语言为 TypeScript（strict）。本页介绍分层规则、接口规范、权限检查、错误处理、数据库迁移和导入导出。

新功能建议先用 `pnpm scaffold` 生成骨架（见 [AI 驱动开发](/zh/guide/ai-workflow#pnpm-scaffold)），再按本页的规则补充业务逻辑。参考实现是 `apps/api/src/modules/admin/users/`。

## 分层

```text
db/schema/<domain>/<name>.ts
  → modules/<domain>/<name>/{schema,repository,service,routes}.ts
  → modules/<domain>/router.ts
  → src/router.ts
```

| 层 | 文件 | 职责 | 禁止 |
|---|---|---|---|
| model | `db/schema/<domain>/<name>.ts` | Drizzle `pgTable(...)` 表定义 + `xxxToDict()` 序列化 | 业务逻辑 |
| schema | `modules/<domain>/<name>/schema.ts` | 请求 schema、导入导出字段映射 `EXPORT_FIELD_MAP` / `IMPORT_HEADER_MAP` | 数据库操作 |
| repository | `modules/<domain>/<name>/repository.ts` | 纯数据库读写（Drizzle 查询） | 业务逻辑、HTTP |
| service | `modules/<domain>/<name>/service.ts` | 业务逻辑，出错抛 `ServiceError` | 使用 `reply`、`session` 等 HTTP 对象 |
| routes | `modules/<domain>/<name>/routes.ts` | Fastify 路由 + 权限检查 + 调用 service | 直接写 SQL |
| 域装配 | `modules/<domain>/router.ts` | `await registerXxxRoutes(app)` | — |
| 一级装配 | `src/router.ts` + `db/schema/index.ts` | 注册业务域、导出表定义 | — |

路径别名：后端 `@/*` 指向 `apps/api/src/*`，例如 `@/common/auth`。

### 表定义

```ts
import { pgTable, serial, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const customers = pgTable('customers', {
  id: serial().primaryKey().notNull(),
  name: varchar({ length: 100 }).notNull(),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

export type Customer = typeof customers.$inferSelect

export function customerToDict(item: Customer) {
  return {
    id: item.id,
    name: item.name,
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  }
}
```

### 注册

- 在已有域（`admin`、`component_center`）内新增模块时，`pnpm scaffold` 会自动注册到 `db/schema/index.ts` 和 `modules/<domain>/router.ts`。
- 新增业务域时，需要手动：在 `src/router.ts` 调用该域的注册函数，并在 `db/schema/index.ts` 中 `export * from './<domain>/<name>'`。

## 接口规范

所有业务接口挂在 `/api/admin/` 下。资源名用连字符复数，例如 `customer_order` 对应 `/api/admin/customer-orders`。

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/admin/<resource>s` | 列表，参数 `page`、`per_page`、`search` |
| `POST` | `/api/admin/<resource>s` | 新建，返回 201 |
| `GET` | `/api/admin/<resource>s/<id>` | 详情（按需） |
| `PUT` | `/api/admin/<resource>s/<id>` | 编辑 |
| `DELETE` | `/api/admin/<resource>s/<id>` | 删除 |
| `POST` | `/api/admin/<resource>s/export` | 导出 |
| `GET` | `/api/admin/<resource>s/template` | 下载导入模板，参数 `file_type=csv\|xlsx` |
| `POST` | `/api/admin/<resource>s/import` | 导入，`multipart/form-data`，字段名 `file` |

### 响应格式

- 列表：`{ items, total, page, per_page }`
- 错误：`{ error: string, ...payload }`
- 5xx 一律返回“服务器内部错误，请稍后重试”，不透传内部信息，堆栈写入日志
- `/api/*` 下的 404、405、500 都返回 JSON，不会落到前端的 `index.html`

### 请求处理工具

| 工具 | 来源 | 用途 |
|---|---|---|
| `intParam('item_id')` | `@/common/http` | 生成只匹配数字的路径参数 |
| `parseIntParam(value)` | `@/common/http` | 解析路径参数 |
| `routeBody(schema, 'create' \| 'patch' \| 'array')` + `field.*` | `@/common/validation` | 用 Zod 声明请求体：`.route` 放进路由选项（OpenAPI 检查据此对照文档里的请求体），权限检查之后 `.parse(request)` 校验（新建取默认值 / 编辑只含传入字段）；只收 JSON 原生类型，类型不对 → 400`<字段>的值无效` |
| `queryString(request, key)` | `@/common/http` | 读取查询参数 |
| `getUploadedFile(request)` | `@/common/http` | 读取上传文件 |
| `parsePagination(query)` | `@/common/pagination` | 分页参数，默认 20 条，上限 200 |

### 横切约定

- **时间**：`timestamp` / `date` 列以文本读取，不经过 JS `Date`；输出一律用 `toIso()`，格式为 ISO 8601 的 UTC 时间 `YYYY-MM-DDTHH:mm:ss.ffffffZ`。请求里的时间带时区的会换算成 UTC，不带时区的按 UTC 处理；前端按浏览器时区显示。导出文件、导入文件里的时间和首页统计的日期按请求头 `X-Time-Zone`（前端自动带上浏览器时区）计算：导出列用 `formatDateTime()`，导入的时间单元格先 `withZoneOffset()`。禁止使用 `Date#toISOString()`（只有毫秒精度）。
- **数值**：`numeric` 列保持字符串输出（如 `"12.50"`），`toDict()` 里不要转成数字。
- **请求体校验**：在 `schema.ts` 用 `@/common/validation` 的 `field.*` 声明请求体，路由用 `routeBody(schema, mode)` 声明，在权限检查之后 `.parse(request)`；`pnpm openapi:generate -- --strict` 会拿同一份声明核对文档里的请求体。只收 JSON 原生类型（文本是字符串并去首尾空白，整数是 number，布尔是 true / false），多余字段忽略，类型不对返回 400。`pnpm scaffold` 生成的模块同样如此，导入行经 `rowToBody` 转成请求体形状后走同一份声明。
- **操作日志**：由 logs 模块注册的全局 `onResponse` 钩子统一写入 `operation_logs`，不要在 service 里手写。
- **CSRF**：`/api/*` 下的写请求需要带 `X-CSRF-Token` 头，前端的 `request.ts` 已自动处理，登录接口豁免。

## 权限检查

权限函数统一从 `@/common/auth` 导入：

```ts
import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, parseIntParam } from '@/common/http'
import { routeBody } from '@/common/validation'
import { customerBody } from './schema'

export async function registerCustomerRoutes(app: FastifyInstance): Promise<void> {
  const service = new CustomerService(app.db)
  const opts = { preHandler: loginRequired }

  const create = routeBody(customerBody, 'create')
  app.post('/api/admin/customers', { ...opts, ...create.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_customer_add'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return reply.status(201).send(await service.createItem(create.parse(request)))
  })

  const update = routeBody(customerBody, 'patch')
  app.put(`/api/admin/customers/${intParam('item_id')}`, { ...opts, ...update.route }, async (request, reply) => {
    // Check the permission first (403), then look up the record (404): no permission, no probing of ids
    if (!(await hasMenuPermission(request, 'system_customer_edit'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    const item = await service.getOr404(parseIntParam((request.params as { item_id: string }).item_id))
    return service.updateItem(item, update.parse(request))
  })
}
```

| 函数 | 说明 |
|---|---|
| `loginRequired` | preHandler，未登录返回 401 |
| `hasMenuPermission(request, code)` | 是否拥有某个菜单或按钮权限，**异步**，必须 `await` |
| `hasAnyMenuPermission(request, ...codes)` | 满足任一编码即可 |
| `menuPermissionRequired(code)` | preHandler 形式：`{ preHandler: [loginRequired, menuPermissionRequired('system_customer')] }` |

::: danger 常见错误
- 忘记 `await hasMenuPermission(...)`：Promise 恒为真值，权限检查失效。
- 在 routes 文件里自定义 `hasPermission` 函数：`pnpm verify` 的 `no_local_has_permission` 会拦截。
:::

权限编码规则和菜单配置见 [权限 RBAC](/zh/guide/rbac)。

## 错误处理

service 层遇到业务错误时抛出 `ServiceError`：

```ts
import { ServiceError } from '@/common/errors'

throw new ServiceError('客户名称已存在', 400)
throw new ServiceError('导入失败，存在错误数据', 400, { error_rows, error_count })
```

全局错误处理器会把它转成 `{ error: message, ...payload }`，状态码取第二个参数（默认 400）。状态码 ≥ 500 时，返回给前端的文案会被替换为通用的服务器错误提示。

其他错误：

| 情况 | 响应 |
|---|---|
| Zod 请求校验失败 | 400，`error` 为第一条校验消息 |
| 请求体字段类型不对（模块用 `apps/api/src/common/validation.ts` 声明请求体） | 400，`<字段>的值无效`，如“排序的值无效” |
| 结构不对的请求值（service 抛 `invalidInput()`，见 `apps/api/src/common/errors.ts`） | 400，“请求参数格式不正确” |
| 数据库因请求里的值拒绝写入 | 400，见下文 |
| 未知异常 | 500，“服务器内部错误，请稍后重试” |
| 未匹配的 `/api/*` GET 请求 | 404 JSON |
| 未匹配的其他方法 | 405 `{ error: '请求方法不允许' }` |

报错文案写中文即可，后端会按请求头 `Accept-Language` 翻译成英文或日文。新文案要登记译文，见 [多语言](/zh/guide/i18n#后端报错翻译)。

### 数据库约束错误映射

全局错误处理器会调用 `apps/api/src/common/db-errors.ts` 的 `dbConstraintError()`，把由请求里的值引起的数据库错误转成 400；service 在事务里捕获错误时用 `writeError(err)`（业务错误原样、数据库拒绝的输入 400、其余 500），真正的服务器错误用 `internalError(err)`，不要手写 `new ServiceError(…, 500)`；scaffold 生成的 service 和 `docs/templates/backend/service.ts` 模板已经这样做，`test/conventions.test.ts` 会检查。原则是调用方的输入问题一律 4xx，只有服务器自身的问题才是 500：

| PostgreSQL 错误码 | 返回文案 |
|---|---|
| `23505` 唯一约束 | 字段「code」的值已被使用，请换一个值后再保存（从 pg 的 detail 取列名；取不到时：已有记录使用了相同的值，请换一个值后再保存） |
| `23502` 非空约束 | 必填字段「name」没有填写，请补全后再保存（取不到列名时：有必填字段没有填写，请补全后再保存） |
| `23503` 外键约束 | 关联的数据不存在，或这条数据仍被其他数据使用，请检查关联后重试 |
| `23514` 检查约束 | 有字段的值不在允许的范围内，请检查后再保存 |
| `22001` | 有字段超出了长度上限，请缩短后再保存 |
| `22003` | 有数字超出了允许的范围，请检查后再保存 |
| `22007` | 有日期时间的格式不正确，请检查后再保存 |
| `22008` | 有日期时间超出了允许的范围，请检查后再保存 |
| `22P02` | 有字段的格式不正确（例如数字字段里填了文字），请检查后再保存 |

其他数据库错误按 500 处理。这意味着在表定义上加 `.notNull()` 或 `.unique()` 后，不需要额外代码就能得到合理的 400 提示。唯一约束和非空约束的提示会带上数据库列名；需要用字段的中文名（如“客户编码已存在”）时，在 service 里先查重再写库。

## 数据库迁移

表定义在 `apps/api/src/db/schema/**`，迁移由 drizzle-kit 生成到 `apps/api/drizzle/`，执行记录保存在数据库的 `drizzle.__drizzle_migrations` 表中。

### 流程

```bash
# 1. 修改 db/schema 中的表定义后，生成迁移
pnpm db:generate --name add_customer_phone

# 2. 审查 apps/api/drizzle/ 下新生成的 SQL

# 3. 应用迁移
pnpm db:migrate

# 4. 确认表结构真实落库（库名以 apps/api/.env.development 的 DEV_DATABASE_URL 为准）
psql -d castor_kit -c '\d customers'
```

::: warning pnpm db:generate 后面不能写 --
`pnpm db:generate --name <描述>` 直接把参数传给 drizzle-kit，drizzle-kit 不认识 `--`。castor-kit 自己的脚本（scaffold、verify、seed:rbac、openapi:generate）参数前的 `--` 可写可不写。
:::

### 规则

- 不要手写迁移 SQL，否则会破坏 journal 链（`pnpm verify` 的 `migration_chain` 会检查）。
- 迁移必须真实执行并用 `psql \d` 确认，`pnpm verify` 的 `migration_applied` 会对比 journal 与数据库记录。
- scaffold 会自动生成新表的迁移。之后再改表结构，用 `pnpm db:generate --name <描述>` 生成增量迁移。
- 在其他环境部署时执行 `pnpm db:migrate && pnpm seed:rbac -- --incremental`；Docker 部署时容器启动会自动完成，见 [部署指南](/zh/deploy/)。

## 导入导出

导入导出只支持 **csv 和 xlsx**。上传 `.xls` 会返回 400，提示另存为 `.xlsx`。

### 工具函数（`@/common/tabular`）

| 函数 | 说明 |
|---|---|
| `buildTable(headers, rows, baseFilename, fileType)` | 构建表格文件载荷，csv 带 BOM |
| `sendTable(reply, table)` | 设置 `Content-Type`、`Content-Disposition` 并发送 |
| `readTableFile(file)` | 读取上传文件，返回 `{ fieldnames, rows, fileType }`，5MB 上限，rows 带行号 |
| `normalizeTableFileType(raw, fallback)` | 标准化文件类型 |
| `sanitizeFormula()` | 公式注入防护 |

### 字段映射

在模块的 `schema.ts` 中定义：

- `EXPORT_FIELD_MAP`：字段 → 中文表头。需要转换时写成 `[中文表头, 取值函数]`，例如把枚举代码显示为中文。
- `IMPORT_HEADER_MAP`：中文表头 → 字段。

导入导出文件的表头保持中文，不随界面语言变化。

### 导入事务

整批导入在一个事务中完成。存在错误行时抛出 `ServiceError('导入失败，存在错误数据', 400, { error_rows, error_count })`，整批回滚。前端的导入弹窗会展示错误行并支持下载。

### 权限

导出对应的按钮权限编码为 `<perm>_export`，下载导入模板和导入都用 `<perm>_import`，不要用查看权限或 `_edit` 代替。前端组件见 [前端开发](/zh/guide/frontend#导入导出)。

## OpenAPI

```bash
pnpm openapi:generate              # 为缺文档的路由 + 方法补骨架，并检查规范
pnpm openapi:generate -- --strict  # 逐个列出不合规的接口和原因，有则非 0 退出（加 --dry-run 不写回）
pnpm openapi:apifox                # 推送到 Apifox
```

`docs/apifox-full.openapi.json` 是接口的唯一说明书，外部调用方、Apifox 和 [AI 小助手](/zh/guide/assistant) 都只读它，所以每个已注册的 `/api` 接口都必须写完整：中文 summary、description（所需权限、数据权限、关键行为）、一个分组标签和 Apifox 目录、路径和查询参数、请求体字段（不读请求体的写 `"x-no-body": true`）、成功响应的结构和可能的错误码。完整规则见仓库里 `AGENTS.md` 的「OpenAPI 编写规范」，由 API 测试和 `pnpm verify` 强制检查，不合规就不通过。`pnpm scaffold` 生成模块时会把它的接口直接写成合规的条目；`openapi:generate` 只为缺文档的接口补骨架，骨架本身通不过检查，需要照着代码补全。推送到 Apifox 需要 `APIFOX_PROJECT_ID` 和 `APIFOX_ACCESS_TOKEN`，见 [配置项](/zh/reference/configuration)。

## 测试

后端测试使用 Vitest 并连接真实的 PostgreSQL 测试库，路由测试通过 `app.inject()` 发起请求，每个模块一个测试文件（`admin-*.test.ts`、`cc-*.test.ts`）。

```bash
pnpm --filter @castor-kit/api test
```

测试库的准备见 [快速开始](/zh/guide/getting-started) 的“运行测试”一节。
