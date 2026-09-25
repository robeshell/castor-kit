# Backend

The backend lives in `apps/api` and is built with Fastify 5 + Zod + Drizzle ORM + PostgreSQL, written in TypeScript (strict). This page covers the layering rules, API conventions, permission checks, error handling, database migrations and import/export.

For a new feature, start by generating the scaffold with `pnpm scaffold` (see [AI-driven workflow](/en/guide/ai-workflow#pnpm-scaffold)), then fill in the business logic following the rules on this page. The reference implementation is `apps/api/src/modules/admin/users/`.

## Layers

```text
db/schema/<domain>/<name>.ts
  → modules/<domain>/<name>/{schema,repository,service,routes}.ts
  → modules/<domain>/router.ts
  → src/router.ts
```

| Layer | File | Responsibility | Not allowed |
|---|---|---|---|
| model | `db/schema/<domain>/<name>.ts` | Drizzle `pgTable(...)` table definition + `xxxToDict()` serializer | Business logic |
| schema | `modules/<domain>/<name>/schema.ts` | Request schemas, import/export field maps `EXPORT_FIELD_MAP` / `IMPORT_HEADER_MAP` | Database access |
| repository | `modules/<domain>/<name>/repository.ts` | Pure database reads and writes (Drizzle queries) | Business logic, HTTP |
| service | `modules/<domain>/<name>/service.ts` | Business logic; throws `ServiceError` on errors | Using HTTP objects such as `reply` or `session` |
| routes | `modules/<domain>/<name>/routes.ts` | Fastify routes + permission checks + service calls | Writing SQL directly |
| Domain wiring | `modules/<domain>/router.ts` | `await registerXxxRoutes(app)` | — |
| Top-level wiring | `src/router.ts` + `db/schema/index.ts` | Registers business domains, exports table definitions | — |

Path alias: on the backend, `@/*` points to `apps/api/src/*`, e.g. `@/common/auth`.

### Table definitions

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

### Registration

- When you add a module to an existing domain (`admin`, `component_center`), `pnpm scaffold` registers it in `db/schema/index.ts` and `modules/<domain>/router.ts` automatically.
- When you add a new business domain, do it by hand: call the domain's register function in `src/router.ts`, and add `export * from './<domain>/<name>'` to `db/schema/index.ts`.

## API conventions

All business APIs are mounted under `/api/admin/`. Resource names are hyphenated and plural; for example, `customer_order` maps to `/api/admin/customer-orders`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/<resource>s` | List; parameters `page`, `per_page`, `search` |
| `POST` | `/api/admin/<resource>s` | Create; returns 201 |
| `GET` | `/api/admin/<resource>s/<id>` | Detail (when needed) |
| `PUT` | `/api/admin/<resource>s/<id>` | Update |
| `DELETE` | `/api/admin/<resource>s/<id>` | Delete |
| `POST` | `/api/admin/<resource>s/export` | Export |
| `GET` | `/api/admin/<resource>s/template` | Download the import template; parameter `file_type=csv\|xlsx` |
| `POST` | `/api/admin/<resource>s/import` | Import; `multipart/form-data`, field name `file` |

### Response format

- List: `{ items, total, page, per_page }`
- Error: `{ error: string, ...payload }`
- Every 5xx returns "服务器内部错误，请稍后重试" ("Internal server error. Please try again later.") without leaking internal details; the stack trace goes to the log
- 404, 405 and 500 under `/api/*` all return JSON and never fall through to the frontend's `index.html`

### Request helpers

| Helper | Source | Purpose |
|---|---|---|
| `intParam('item_id')` | `@/common/http` | Builds a path parameter that only matches digits |
| `parseIntParam(value)` | `@/common/http` | Parses a path parameter |
| `jsonBody(request)` | `@/common/http` | Reads the request body (treated as `{}` if it isn't an object or isn't JSON) |
| `queryString(request, key)` | `@/common/http` | Reads a query parameter |
| `getUploadedFile(request)` | `@/common/http` | Reads an uploaded file |
| `parsePagination(query)` | `@/common/pagination` | Pagination parameters; default 20 per page, max 200 |

### Cross-cutting conventions

- **Time**: `timestamp` / `date` columns are read as text and never pass through a JS `Date`. Always output them with `toIso()`, formatted as `YYYY-MM-DDTHH:mm:ss[.ffffff]`, with no `Z` suffix; values are UTC. Never use `Date#toISOString()`.
- **Numbers**: `numeric` columns are output as strings (e.g. `"12.50"`); don't convert them to numbers in `toDict()`.
- **Lenient request validation**: all fields in request schemas are optional and extra fields are allowed; normalization and required-field checks happen in the service.
- **Operation logs**: a global `onResponse` hook registered by the logs module writes to `operation_logs`; don't write logs by hand in services.
- **CSRF**: write requests under `/api/*` must send an `X-CSRF-Token` header. The frontend's `request.js` handles this automatically; the login endpoint is exempt.

## Permission checks

Always import the permission functions from `@/common/auth`:

```ts
import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, jsonBody, parseIntParam } from '@/common/http'

export async function registerCustomerRoutes(app: FastifyInstance): Promise<void> {
  const service = new CustomerService(app.db)
  const opts = { preHandler: loginRequired }

  app.post('/api/admin/customers', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_customer_add'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return reply.status(201).send(await service.createItem(jsonBody(request)))
  })

  app.put(`/api/admin/customers/${intParam('item_id')}`, opts, async (request, reply) => {
    // Look up the record first (404), then check the permission (403)
    const item = await service.getOr404(parseIntParam((request.params as { item_id: string }).item_id))
    if (!(await hasMenuPermission(request, 'system_customer_edit'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return service.updateItem(item, jsonBody(request))
  })
}
```

| Function | Description |
|---|---|
| `loginRequired` | preHandler; returns 401 when not signed in |
| `hasMenuPermission(request, code)` | Whether the user has a given menu or button permission. **Async**, so you must `await` it |
| `hasAnyMenuPermission(request, ...codes)` | Passes if any of the codes match |
| `menuPermissionRequired(code)` | preHandler form: `{ preHandler: [loginRequired, menuPermissionRequired('system_customer')] }` |

::: danger Common mistakes
- Forgetting to `await hasMenuPermission(...)`: a Promise is always truthy, so the permission check does nothing.
- Defining your own `hasPermission` function in a routes file: the `no_local_has_permission` check of `pnpm verify` catches this.
:::

For permission code rules and menu setup, see [Permissions (RBAC)](/en/guide/rbac).

## Error handling

When the service layer hits a business error, it throws a `ServiceError`:

```ts
import { ServiceError } from '@/common/errors'

throw new ServiceError('客户名称已存在', 400)
throw new ServiceError('导入失败，存在错误数据', 400, { error_rows, error_count })
```

The global error handler turns it into `{ error: message, ...payload }`, using the second argument as the status code (default 400). For status codes ≥ 500, the message sent to the frontend is replaced with a generic server error message.

Other errors:

| Case | Response |
|---|---|
| Zod request validation fails | 400; `error` is the first validation message |
| Unknown exception | 500, "服务器内部错误，请稍后重试" ("Internal server error. Please try again later.") |
| Unmatched `/api/*` GET request | 404 JSON |
| Unmatched other methods | 405 `{ error: '请求方法不允许' }` ("Method not allowed") |

Write error messages in Chinese; the backend translates them into English or Japanese based on the `Accept-Language` request header. New messages need registered translations; see [Internationalization](/en/guide/i18n#translating-backend-errors).

### Database constraint error mapping

The services generated by scaffold (and the `docs/templates/backend/service.ts` template) wrap writes in a transaction. When a database error is caught, they call `dbConstraintError()` from `apps/api/src/common/db-errors.ts`, which turns constraint errors caused by user input into a 400:

| PostgreSQL error code | Message returned (English UI) |
|---|---|
| `23505` unique constraint | Duplicate data: a unique field value already exists |
| `23502` not-null constraint | Required fields cannot be empty |
| `23503` foreign key constraint | Related data does not exist or is still referenced |
| `23514` check constraint | Data violates a constraint |
| `22001` | A field exceeds its maximum length |
| `22003` | A number is out of range |
| `22007` | Invalid date/time format |
| `22008` | Date/time out of range |
| `22P02` | Invalid field format |

Other database errors are treated as 500. This means that once you add `.notNull()` or `.unique()` to a table definition, you get a sensible 400 message with no extra code. When you need a message that names the field (such as "客户编码已存在", "customer code already exists"), check for duplicates in the service before writing.

## Database migrations

Table definitions live in `apps/api/src/db/schema/**`. drizzle-kit generates migrations into `apps/api/drizzle/`, and applied migrations are recorded in the `drizzle.__drizzle_migrations` table in the database.

### Workflow

```bash
# 1. After changing a table definition in db/schema, generate a migration
pnpm db:generate --name add_customer_phone

# 2. Review the newly generated SQL under apps/api/drizzle/

# 3. Apply the migration
pnpm db:migrate

# 4. Confirm the table structure is really in the database (database name per DEV_DATABASE_URL in apps/api/.env.development)
psql -d castor_kit -c '\d customers'
```

::: warning No -- after pnpm db:generate
`pnpm db:generate --name <description>` passes its arguments straight to drizzle-kit, which doesn't understand `--`. For castor-kit's own scripts (scaffold, verify, seed:rbac, openapi:generate), the `--` before arguments is optional.
:::

### Rules

- Don't write migration SQL by hand; it breaks the journal chain (checked by the `migration_chain` check of `pnpm verify`).
- Migrations must actually be applied and confirmed with `psql \d`; the `migration_applied` check of `pnpm verify` compares the journal with the database records.
- scaffold generates the migration for a new table automatically. For later schema changes, generate an incremental migration with `pnpm db:generate --name <description>`.
- When deploying to another environment, run `pnpm db:migrate && pnpm seed:rbac -- --incremental`. With Docker, the container does this automatically on start; see the [Deployment guide](/en/deploy/).

## Import and export

Import and export support **csv and xlsx only**. Uploading an `.xls` file returns 400 with a message asking you to save it as `.xlsx`.

### Helpers (`@/common/tabular`)

| Function | Description |
|---|---|
| `buildTable(headers, rows, baseFilename, fileType)` | Builds the table file payload; csv includes a BOM |
| `sendTable(reply, table)` | Sets `Content-Type` and `Content-Disposition` and sends the file |
| `readTableFile(file)` | Reads an uploaded file and returns `{ fieldnames, rows, fileType }`; 5MB limit; rows include row numbers |
| `normalizeTableFileType(raw, fallback)` | Normalizes the file type |
| `sanitizeFormula()` | Formula-injection protection |

### Field maps

Define them in the module's `schema.ts`:

- `EXPORT_FIELD_MAP`: field → Chinese column header. When the value needs converting, use `[Chinese header, getter function]`, for example to display an enum code as Chinese.
- `IMPORT_HEADER_MAP`: Chinese column header → field.

Column headers in import/export files stay in Chinese regardless of the UI language.

### Import transactions

A whole import batch runs in a single transaction. If any row has errors, it throws `ServiceError('导入失败，存在错误数据', 400, { error_rows, error_count })` and the whole batch is rolled back. The frontend import dialog shows the error rows and lets you download them.

### Permissions

The button permission codes for export and import are `<perm>_export` and `<perm>_import`. For the frontend components, see [Frontend](/en/guide/frontend#import-and-export).

## OpenAPI

```bash
pnpm openapi:generate              # Fill in docs/apifox-full.openapi.json from the Fastify routes
pnpm openapi:generate -- --dry-run # Only report coverage; don't write back
pnpm openapi:apifox                # Push to Apifox
```

`openapi:generate` keeps the detailed definitions already in the document and only adds skeletons for missing routes; request and response schemas for new endpoints have to be filled in by hand. Pushing to Apifox requires `APIFOX_PROJECT_ID` and `APIFOX_ACCESS_TOKEN`; see [Configuration](/en/reference/configuration).

## Testing

Backend tests use Vitest against a real PostgreSQL test database. Route tests send requests through `app.inject()`, with one test file per module (`admin-*.test.ts`, `cc-*.test.ts`).

```bash
pnpm --filter @castor-kit/api test
```

To set up the test database, see the "Run tests" step in [Quick start](/en/guide/getting-started#_6-run-tests-optional).
