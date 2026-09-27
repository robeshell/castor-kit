# castor-kit — Agent Context

> **Shared context document** for every AI tool (Claude Code, Cursor, Windsurf, GitHub Copilot, Codex CLI, MCP clients, and so on).
> Read this whole file before implementing any new feature. AI should infer every technical decision from this file on its own, without asking the PM about technical details.
>
> This file is the project context shared by all AI tools (Codex, Cursor, Windsurf, GitHub Copilot and others read it directly); Claude Code also reads `CLAUDE.md`. Skills live in `.claude/skills/`, mirrored in `.agents/skills/`.
> Architecture: `docs/architecture.md` (tech stack, layers and anti-patterns, cross-cutting conventions, migrations, tooling, deployment, design decisions).
> Roadmap: `docs/roadmap.md` (planned features with their data models, APIs and acceptance criteria; read the matching section before implementing any of them, and update its status when done).
> Frontend UI: `docs/frontend-design-system.md` (design tokens and shared-component conventions for shadcn/ui + Tailwind CSS v4 + motion).

---

## Project overview

**An AI-first Node.js/TypeScript + React + RBAC scaffold.**

Goal: the PM describes business intent in natural language → the AI agent infers the technical decisions → shows a business preview for confirmation → delivers a complete, convention-compliant feature module end to end (tables, APIs, pages, permissions, migration).

castor-kit is a pnpm monorepo: the backend `apps/api` (Fastify 5 + Zod + Drizzle + PostgreSQL), the frontend `apps/web` (React 19 + **shadcn/ui + Tailwind CSS v4 + motion**, see `docs/frontend-design-system.md`), and `apps/mcp`, which exposes the scaffold / verify / seed / migration tooling to MCP clients. Overall architecture and design decisions: `docs/architecture.md`.

---

## From a one-line requirement to a spec (start here for new modules)

For requests like "build an XX management page / an XX ledger", infer a module specification (spec) from the one-line request and hand it to the scaffold, which generates the whole set of code in one go.

1. Write the requirement as a spec JSON: the format is `docs/spec.schema.json`; `docs/examples/specs/` has 4 complete examples with the reasoning behind every field
2. `pnpm scaffold -- --spec <file> --validate-only`: validates the spec and lists the APIs, permissions, tables and menus it would generate; fix any problems one by one as reported
3. Show the PM a business preview (fields, options, required fields); after confirmation, `pnpm scaffold -- --spec <file>` generates the table, APIs, API tests, page, menu and button permissions, OpenAPI docs and migration in one run
4. Add the business logic → `pnpm seed:rbac -- --incremental` → `pnpm db:migrate` → confirm with `psql \d` → `pnpm verify -- --module <name>`

With MCP the equivalent is: `get_spec_guide` → `validate_spec` → `scaffold_feature` (pass `spec`) → `run_verify` / `check_openapi`.

Inference guidelines (field types: see "Field type inference" below):

- `name`: English, singular, snake_case (`device`, `customer_order`); `title`: the module's Chinese name, required; every field needs a Chinese `label` (used by table headers, forms, import templates and the API docs). Chinese is the i18n source key for all of these
- Options that are fixed and spelled out in the requirement (status, type, level) → `enum` + `options` (`value` in English, `label` in Chinese); options that grow or shrink and are maintained by admins (category, source, industry) → `dict` + a data dictionary code
- `required`: fields the requirement calls "required / must not be empty"; status fields with a default are also required (they can't be cleared when editing); file / image fields can't be required
- `unique`: only when the requirement says "must not repeat / unique", and only for text and number fields; `default`: only when the requirement says "defaults to ...", and the value must match the type (for `enum`, use an option value)
- `dataScope: true`: when the requirement says "users only see their own / their department's ..."; `menu: {}`: every new business module needs a menu (it goes under `业务管理` (Business))
- The record's main name field is called `name` or `title` (list search and the required import column use it); don't declare `id` / `created_at` / `updated_at` (generated automatically)
- Anything beyond the scaffold (relations between tables, approval flows, computed fields, cross-field validation): generate the single-table module first, then write the rest by hand following the layering rules below

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node + TypeScript (strict) | Node 22 (`.nvmrc`), TypeScript 5 |
| Package manager | pnpm workspaces (monorepo) | pnpm 11 |
| Backend framework | Fastify + `fastify-type-provider-zod` | 5.x |
| Validation / types | Zod | 4.x |
| ORM / migrations | Drizzle ORM + drizzle-kit | 0.45 / 0.31 |
| Database | PostgreSQL (`pg` driver) | 14+ |
| Logging | pino (built into Fastify) | - |
| Sessions | `@fastify/secure-session` (cookie `castor_session`) | - |
| Other plugins | `@fastify/cors` / `compress` / `static` / `multipart` / `websocket` / `swagger` | - |
| Import / export | `csv-parse` + `exceljs` (**csv / xlsx only; `.xls` is not supported**) | - |
| Testing | Vitest + a real PostgreSQL | - |
| Frontend framework | React + Vite + React Router + Axios (TypeScript / TSX) | 19 / 5 / 7 |
| UI components | shadcn/ui (new-york style, Radix primitives, source in `apps/web/src/components/ui/`, TSX; changes from upstream in `docs/shadcn-changes.md`) | - |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) + CSS-variable themes (light / dark, `apps/web/src/index.css`) | 4.x |
| Motion | `motion` (`motion/react`) + `tw-animate-css` (overlay enter / exit) | - |
| Icons | `lucide-react` | - |
| Tables / forms / toasts | `@tanstack/react-table` (wrapped as DataTable) / `react-hook-form` / `sonner` | - |
| Dates / command palette | `react-day-picker` + `date-fns` / `cmdk` (⌘K) | - |
| Charts | ECharts 6, imported on demand: pages use `@/shared/components/Chart`; chart types / components are registered in `@/lib/echarts` (add new ones there); don't import `echarts` / `echarts-for-react` directly; theme colors come from `@/lib/chart-theme` | - |
| Code editor | @monaco-editor/react | - |
| Rich text | react-quill-new (React 19 compatible) | - |
| Drag and drop | @dnd-kit/core + @dnd-kit/sortable | - |
| MCP | `@modelcontextprotocol/sdk` | 1.x |

**Development environment:**
- Ports: api 5001, web 5173 (the Vite proxy forwards `/api` and `/ws` to 5001); tests 5002; production 5000
- Database: `postgresql://localhost/castor_kit` (set as `DEV_DATABASE_URL` in `apps/api/.env.development`; also the default when unset)
- Local config: `apps/api/.env.development` (see `apps/api/.env.example`; gitignored; `.env.<NODE_ENV>` in the repo root is read too)
- Default account: `admin` / `admin123`
- Test database: `createdb -T castor_kit castor_kit_test` (clone) or `createdb castor_kit_test` (empty; the tests run the migrations automatically); `pnpm test`

---

## Directory layout

```
castor-kit/
├── package.json                       # pnpm workspaces root (run every pnpm command from the root)
├── pnpm-workspace.yaml
├── AGENTS.md / CLAUDE.md               # project context shared by AI tools / Claude Code additions
├── apps/
│   ├── api/                           # @castor-kit/api — Fastify backend
│   │   ├── src/
│   │   │   ├── main.ts                # web process entry
│   │   │   ├── worker.ts              # standalone scheduler process entry
│   │   │   ├── app.ts                 # buildApp(): plugins / routes / error handling / static assets / SPA
│   │   │   ├── config.ts              # per-environment config (Zod-validated, fail-closed in production)
│   │   │   ├── router.ts              # top-level route assembly (register new domains here)
│   │   │   ├── common/                # cross-cutting code
│   │   │   │   ├── auth.ts            # loginRequired / hasMenuPermission / hasAnyMenuPermission / menuPermissionRequired
│   │   │   │   ├── rbac.ts            # pure functions: isSuperAdmin / menu code collection
│   │   │   │   ├── data-scope.ts      # data scope: resolveDataScope / dataScopeWhere / currentActor
│   │   │   │   ├── csrf.ts            # double-submit check
│   │   │   │   ├── errors.ts          # ServiceError + the global error handler
│   │   │   │   ├── http.ts            # intParam / parseIntParam / queryString / getUploadedFile
│   │   │   │   ├── pagination.ts      # parsePagination (MAX_PER_PAGE=200, default 20)
│   │   │   │   ├── serialize.ts       # toIso() etc., one time output format
│   │   │   │   ├── tabular.ts         # csv/xlsx read/write + formula-injection guard + 5MB cap
│   │   │   │   ├── request-meta.ts    # clientIp / userAgent / safePayload (redaction)
│   │   │   │   ├── password.ts        # scrypt password hashing (PHC format)
│   │   │   │   ├── password-policy.ts # password rules (from system settings)
│   │   │   │   ├── session.ts         # server-side sessions: isSignedIn / createSession / revokeSessions
│   │   │   │   ├── settings.ts        # system settings registry + SettingsStore (app.settings)
│   │   │   │   ├── rate-limit.ts      # per-IP rate limiting + authRateLimit for login-type endpoints
│   │   │   │   ├── totp.ts / secret-box.ts # two-factor TOTP, AES-256-GCM encryption for small secrets
│   │   │   │   ├── mailer.ts          # email (smtp / log / none)
│   │   │   │   └── scheduler/         # scheduled task runner (lease model) + cron matcher + SSRF guard
│   │   │   ├── db/
│   │   │   │   ├── client.ts          # pg Pool + drizzle instance + type parsers
│   │   │   │   ├── readonly.ts        # read-only Pool for AI SQL
│   │   │   │   ├── migrate.ts         # migration runner (drizzle-orm migrator)
│   │   │   │   ├── migrate-cli.ts     # pnpm db:migrate entry
│   │   │   │   └── schema/            # ← model layer: Drizzle table definitions + toDict
│   │   │   │       ├── columns.ts     # createdAt() / updatedAt()
│   │   │   │       ├── admin/         # rbac / audit-logs / dicts / scheduled-task / notification / announcement
│   │   │   │       ├── component-center/
│   │   │   │       └── index.ts       # combined exports (register new tables here)
│   │   │   └── modules/
│   │   │       ├── admin/             # system administration domain
│   │   │       │   ├── router.ts      # domain route assembly
│   │   │       │   └── users/         # {schema,repository,service,routes}.ts
│   │   │       │   └── auth/ roles/ menu/ logs/ dicts/ scheduled-task/ notification/ announcement/ dashboard/
│   │   │       │       sessions/ settings/ two-factor/ password-reset/ departments/ files/
│   │   │       └── component-center/  # component gallery domain
│   │   │           ├── router.ts
│   │   │           └── demo-record/ (the page patterns' shared demo API)
│   │   │               traffic-flow/ ai-chat/ ai-prompt/ ai-sql/ devtools/
│   │   ├── drizzle/                   # SQL migrations + meta/_journal.json (generated by drizzle-kit)
│   │   ├── scripts/                   # tooling: scaffold / verify-feature / seed-rbac / setup-once /
│   │   │                              #          init-ro-role / generate-openapi / import-apifox
│   │   ├── test/                      # Vitest (real PostgreSQL)
│   │   └── drizzle.config.ts
│   ├── web/                           # @castor-kit/web — React 19 + shadcn/ui + Tailwind v4 (TypeScript)
│   │   ├── components.json            # shadcn CLI config (new-york / zinc / lucide / aliases)
│   │   ├── scripts/shadcn-add.sh      # runs npx shadcn@latest add through a local relay (see "Adding shadcn/ui primitives")
│   │   └── src/
│   │       ├── App.tsx                # dynamic routing (import.meta.glob)
│   │       ├── index.css              # Tailwind v4 entry + design tokens (light / dark) + brand gradient utilities
│   │       ├── context/               # AuthContext / ThemeContext (toggles html.dark)
│   │       ├── components/
│   │       │   ├── ui/                # shadcn primitives (button / input / dialog / sheet / table / select / ...)
│   │       │   └── app/               # app shell: AppLayout / AppSidebar / TopBar / CommandMenu / ThemeToggle / ...
│   │       ├── lib/                   # utils(cn) / toast / format / motion / chart-theme / menu-icons
│   │       ├── modules/
│   │       │   ├── admin/{pages,api}/
│   │       │   └── component_center/
│   │       │       ├── pages/{patterns,dataviz,ai,editor,devtools}/   # patterns/ = one reference page per page pattern
│   │       │       └── api/
│   │       └── shared/
│   │           ├── api/request.ts     # Axios instance (baseURL='/api', withCredentials, CSRF header)
│   │           ├── api/openapi.d.ts   # API types generated from docs/apifox-full.openapi.json (helpers in api/types.ts)
│   │           ├── utils/file.ts      # downloadBlobFile
│   │           ├── hooks/             # useCrudList / useIsMobile / useDebouncedValue
│   │           └── components/        # shared business components: PageHeader / DataTable / Filters / FormDialog / FormFields /
│   │                                  #   ConfirmAction / StatusBadge / data-transfer/{ImportDialog,ExportDialog} / upload/ ...
│   └── mcp/                           # @castor-kit/mcp — MCP server (src/index.ts)
├── docs/
│   ├── architecture.md                # architecture
│   ├── frontend-design-system.md      # frontend design system (shadcn/ui)
│   ├── apifox-full.openapi.json       # OpenAPI document (see "OpenAPI writing rules")
│   ├── spec.schema.json               # JSON Schema for scaffold --spec specs (generated by pnpm scaffold -- --write-schema)
│   ├── examples/specs/                # "one-line requirement → spec" examples (README.md explains each field's reasoning)
│   └── templates/                     # code skeleton templates (for AI to copy)
│       ├── backend/                   # db-schema / schema / repository / service / routes (.ts) + README.md
│       └── frontend/                  # list_page / detail_page
├── website/                           # VitePress docs site (standalone npm project, not in the pnpm workspace)
├── scripts/                           # setup.sh (one-step Docker install), docker-entrypoint.sh (image entry point)
└── Dockerfile / docker-compose.yml / render.yaml
```

> Naming: backend directories and file names are lowercase and hyphenated (`component-center`, `scheduled-task`, `customer-order.ts`); table names, frontend directories and the menu `component` keep underscores (`component_center/patterns/card_list_page`) to match the database and the frontend routes.

---

## Backend conventions

### Layering (strict)

```
db/schema/<domain>/<name>.ts → modules/<domain>/<name>/{schema,repository,service,routes}.ts
  → modules/<domain>/router.ts → src/router.ts
```

| Layer | File | Responsibility | Forbidden |
|---|---|---|---|
| model | `db/schema/<domain>/<name>.ts` | Drizzle `pgTable(...)` table definition + `xxxToDict()` serialization | Business logic |
| schema | `modules/<domain>/<name>/schema.ts` | Zod request schemas, `EXPORT_FIELD_MAP` / `IMPORT_HEADER_MAP` | Database access |
| repository | `modules/<domain>/<name>/repository.ts` | Pure DB reads and writes (Drizzle queries) | Business logic, HTTP |
| service | `modules/<domain>/<name>/service.ts` | Business logic; throws `ServiceError(message, status, payload)` on errors | Touching HTTP objects such as `reply` / `session` |
| routes | `modules/<domain>/<name>/routes.ts` | Fastify routes + permission checks + calling the service | Writing SQL directly |
| Domain assembly | `modules/<domain>/router.ts` | `await registerXxxRoutes(app)` | — |
| Top-level assembly | `src/router.ts` + `db/schema/index.ts` | Register domains / export tables | — |

Path aliases: backend `@/*` → `apps/api/src/*` (e.g. `@/common/auth`); frontend `@` → `apps/web/src` (e.g. `@/shared/api/request`).

**Table definitions (model layer):**
```ts
import { pgTable, serial, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const customers = pgTable('customers', {
  id: serial().primaryKey().notNull(),
  name: varchar({ length: 100 }).notNull(),
  created_at: createdAt(),   // app-side default timezone('utc', now()); no DEFAULT in the database
  updated_at: updatedAt(),
})

export type Customer = typeof customers.$inferSelect

export function customerToDict(item: Customer) {
  return { id: item.id, name: item.name, created_at: toIso(item.created_at), updated_at: toIso(item.updated_at) }
}
```

**Routes (routes layer):**
```ts
export async function registerCustomerRoutes(app: FastifyInstance): Promise<void> {
  const service = new CustomerService(app.db)
  const opts = { preHandler: loginRequired }
  app.get('/api/admin/customers', opts, async (request, reply) => { ... })
}
```

### API route rules

```
Prefix for every route: /api/admin/
Standard CRUD (resource names are hyphenated plurals, e.g. customer_order → /api/admin/customer-orders):
  GET    /api/admin/<resource>s              list (page, per_page, search) → { items, total, page, per_page }
  POST   /api/admin/<resource>s              create (201)
  GET    /api/admin/<resource>s/<id>         detail (when needed)
  PUT    /api/admin/<resource>s/<id>         update
  DELETE /api/admin/<resource>s/<id>         delete
  POST   /api/admin/<resource>s/export       export (responseType: blob)
  GET    /api/admin/<resource>s/template     download the import template (file_type=csv|xlsx)
  POST   /api/admin/<resource>s/import       import (multipart/form-data, field name file)
Error response: { error: string, ...payload }; every 5xx returns "服务器内部错误，请稍后重试" (internal server error, try again later)
Every input problem is a 400: declare the request body with Zod (field.* from @/common/validation; in the route, routeBody(schema, mode) and .parse(request) after the permission check); a wrong type → "<label>的值无效" (<label> has an invalid value);
  uniqueness / business rules are checked in the service, with a Chinese message; a wrong shape (e.g. an array where an object belongs) throws invalidInput() (@/common/errors);
  in a transaction's catch, throw writeError(err) (@/common/db-errors: business errors pass through, input the database rejects becomes 400, everything else 500);
  real server errors use internalError(err) (@/common/errors); never write new ServiceError(..., 500) by hand (checked by test/conventions.test.ts)
```

- Routes with an id: build the path with `intParam('item_id')` (matches digits only). **Check permissions first (403), then `service.getOr404(id)` (404)**: someone without permission must not be able to probe whether an id exists through the 404 / 403 difference; records the user has permission for but that fall outside their data scope also return 404. `test/conventions.test.ts` checks every route, the backend templates and scaffold-generated routes
- Request bodies: declare them in `schema.ts` with `z.object({ name: field.requiredText('名称', '名称不能为空'), sort_order: field.int('排序', 0), … })` (the arguments are the field's Chinese label and message: "name", "name must not be empty", "sort order"). The route declares the body once with `routeBody(schema, mode)` from `@/common/validation` — `'create'` (missing fields take their defaults), `'patch'` (update; only the fields present in the request) or `'array'` (a JSON array of `schema` objects, e.g. a reorder list) — spreads its `.route` into the route options and calls `.parse(request)` after the permission check, so the service receives validated, typed values:

  ```ts
  const create = routeBody(itemBody, 'create')
  app.post(BASE, { ...opts, ...create.route }, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_xxx_add'))) return reply.status(403).send({ error: '无权限新增' })
    return reply.status(201).send(await service.createItem(create.parse(request)))
  })
  ```

  `.route` is Fastify route `config` (not `schema`), so nothing runs before the login and permission checks; `pnpm openapi:generate` reads it to compare the schema with the documented `requestBody` (see "OpenAPI writing rules"). Routes never call `parseBody` / `parsePatch` / `parseArrayBody` directly (checked by `test/conventions.test.ts`); a handler shared with a GET route that builds the body from the query passes it as `item.parse({ body })` and puts `.route` on the POST route only. Modules generated by `pnpm scaffold` use the same pattern (import rows are turned into request-body shape by `rowToBody` and go through the same declaration). Only native JSON types are accepted: text is a string (trimmed), integers are numbers, booleans are true / false; no implicit conversions like `'1'` → 1. Don't use `schema: { body }` on routes that require login or permissions: it runs before the login and permission checks and turns 401 / 403 into 400 (fine for endpoints that don't need login, such as login itself)
- Use the standard JavaScript / Node way: `JSON.stringify` / `JSON.parse`, `new URL()`, request bodies declared with Zod (`common/validation.ts`); don't imitate the behavior of other languages or frameworks (truthiness, string formatting, date parsing, etc.)
- Read query parameters with `queryString(request, key)` and pagination with `parsePagination(request.query)`; query parameters and import cells are always text, so parse them with `parseYesNo` / `parseIntText` / `parseNumberText` from `@/common/validation`

### OpenAPI writing rules

`docs/apifox-full.openapi.json` is the single reference for the API: external callers, Apifox and the **AI assistant** (which uses this document to find endpoints and decide which fields to send) read only this file. Every registered `/api` route + method must have a complete entry. `test/openapi-doc.test.ts` and the `openapi_sync` step of `pnpm verify` check the rules below (implementation: `apps/api/scripts/lib/openapi-lint.ts`) and fail on any violation.

| Item | Requirement |
|---|---|
| Path key | The OpenAPI form of the route path: `intParam('user_id')` → `/api/admin/users/{user_id}`; one entry per path; path parameters are written `{x}` without a type prefix |
| Method | Lowercase (`get` / `post` / `put` / `patch` / `delete`) |
| `summary` | A short action in Chinese: `新增部门` (create department), `部门列表` (department list), `导出公告` (export announcements), `下载导入模板` (download import template); no method or path, no English identifiers mixed in (auto-generated ones like `创建users` don't pass) |
| `description` | In Chinese: the required permission (`需要 system_users_add` / `需要以下之一：…` / `登录即可` / `公开，无需登录`, i.e. "requires system_users_add" / "requires one of: ..." / "any signed-in user" / "public, no login"), whether results are filtered by data scope, and behavior worth knowing (side effects, events, key validations, what a 404 means) |
| `tags` + `x-apifox-folder` | Exactly one tag, declared in the document's top-level `tags`; system administration uses `后台-<module>` + `后台/系统管理/<module>`, the component gallery uses `示例-<menu name>` + `后台/组件示例中心/<menu name>` |
| `security` | Login required: `[{ "cookieAuth": [] }, { "bearerAuth": [] }]`; endpoints that refuse API tokens (`API_TOKEN_DENIED`: account security, system settings, etc.) only `[{ "cookieAuth": [] }]`; public endpoints: `[]` |
| `parameters` | Every path parameter (`in: path`, `required: true`, `schema`; `integer` for `intParam`); every query parameter the route reads (`schema` + a Chinese description; `enum` when the values are restricted) |
| `requestBody` | Required for `post` / `put` / `patch` that read a body: each field's type, Chinese description, `enum` / `maxLength` / `minimum`; `required` lists only the fields the code actually rejects; nullable is `["string", "null"]`; uploads use `multipart/form-data` with the file field `file` (`format: binary`). Operations that don't read a body set `"x-no-body": true`. JSON bodies declared with `routeBody` must match the Zod declaration (next list) |
| `responses` | The real success status (200 / 201 / 204); anything but 204 needs `content.schema`: lists are `{ items, total, page, per_page }`, single records use the fields of `xxxToDict()`; file downloads use the actual media type + `format: binary`; list the possible error codes (401 is mandatory for endpoints that require login; add 400 / 403 / 404 / 413 / 429 as they actually occur) |

- Document only fields and rules that really exist in the code, never invent them; when unsure, read `routes.ts` / `service.ts` / `schema.ts`
- Request bodies are checked against the code (rule `body-sync`, `apps/api/scripts/lib/openapi-body-sync.ts`): for every route declared with `routeBody`, each property's nullability (`null` in the type ⇔ the Zod field accepts null), requiredness (`required` ⇔ a `'create'` body rejects it missing; a `'patch'` body lists nothing), type and `enum` must match, nested `filters` objects, array items and arrays of objects included, with no property on one side only. On export requests (paths ending in `/export`) the `fields[]` column enum and the `file_type` enum are the contract by design, although the backend reads free text (`isExportContractEnum`); document them. Any other difference kept on purpose (e.g. the service rejects what the Zod field lets through, like change-password passwords) goes into `BODY_SYNC_ALLOWLIST` in that file: one entry per field (`method`, `path`, `field`, `kind`, `reason`). An entry that no longer matches a difference fails too, so remove it when the doc or the code is aligned
- Reference entries: those under `/api/admin/departments`, `/api/admin/sessions` and `/api/admin/files`
- `pnpm scaffold` already writes the module's 8 endpoints to this standard (`scripts/lib/scaffold-openapi.ts`), so they pass right after generation; when you hand-edit the generated routes, fields or validation, update the docs to match
- After adding or changing any other route: `pnpm openapi:generate` (adds skeletons for undocumented route + method pairs) → complete them per the table above → `pnpm openapi:generate -- --strict` (lists every non-compliant endpoint with the reason; exits 0 only when all comply)

### Permission checks

```ts
// ✅ Correct
import { hasMenuPermission, loginRequired } from '@/common/auth'

app.get('/api/admin/customers', { preHandler: loginRequired }, async (request, reply) => {
  if (!(await hasMenuPermission(request, 'system_customer'))) {
    return reply.status(403).send({ error: '无权限' })
  }
  ...
})

// The preHandler form also works: { preHandler: [loginRequired, menuPermissionRequired('system_customer')] }
// Any one of several codes: await hasAnyMenuPermission(request, 'a', 'b')

// ❌ Forbidden: a custom permission function inside routes.ts
function hasPermission(code: string) { ... }   // never do this (blocked by verify's no_local_has_permission)
```

`hasMenuPermission` is async and takes `request` as its first argument (the current user is cached per request). Forgetting `await` makes the check always true.

`'无权限'` above is the standard 403 message ("no permission").

### Permission codes

```
Menu permission:    <domain>_<resource>              system_users (admin domain prefix system_, component_center domain prefix cc_)
Button permissions: <domain>_<resource>_add          system_users_add
                    <domain>_<resource>_edit
                    <domain>_<resource>_delete
                    <domain>_<resource>_export        (required on standard list pages)
                    <domain>_<resource>_import        (required on standard list pages)
```

> Component gallery pages always use `cc_<group>_<page>` (e.g. `cc_patterns_kanban`), system administration always uses `system_<page>`; modules generated by scaffold use the Perm prefix it prints (`<domain prefix>_<name>`).

**One API behind several pages (directory-level permissions).** When pages share one backend module — the gallery's page patterns all use `demo_records` — its permissions belong to the directory that holds the pages, not to one page: the buttons `<dir>_add` / `_edit` / `_delete` / `_export` / `_import` hang under the directory menu, and reads accept the directory code or any page code under it (`hasAnyMenuPermission(request, ...VIEW_CODES)`). A role granted a single page stores only that page's code (the role editor keeps half-checked parents out of `role_menus`), which is why reads list every page code instead of checking the directory alone. Reference: `DEMO_RECORD_VIEW_CODES` / `DEMO_RECORD_PERMS` in `apps/api/src/modules/component-center/demo-record/schema.ts` (directory `cc_patterns`, buttons `cc_patterns_add` …); add a new page's code to the view list when you add a page under the directory.

### Registering a new domain

A new business domain must update both of:
1. `src/router.ts` — `await registerXxxRoutes(app)` (and create `modules/<domain>/router.ts` inside the domain)
2. `db/schema/index.ts` — `export * from './<domain>/<name>'`

When adding a module to an existing domain (admin / component_center), `pnpm scaffold` does both registrations automatically (`db/schema/index.ts` + `modules/<domain>/router.ts`); when writing by hand, follow `docs/templates/backend/README.md`.

### Cross-cutting conventions

Details: docs/architecture.md "Cross-cutting conventions".

- **Times**: columns are `timestamp` (without time zone) storing UTC; pg `timestamp`/`date` values stay as text and never go through JS `Date`; output always uses `toIso()` (ISO 8601 UTC: `YYYY-MM-DDTHH:mm:ss.ffffffZ`, 6 fractional digits + `Z`). Times in requests use `field.dateTime`: values with a zone (`Z` / `±HH:MM`) are converted to UTC, values without one are taken as UTC. The frontend displays times in the browser's time zone via `@/lib/format`. Times meant for people follow the caller's time zone: the frontend sends `X-Time-Zone` (the browser's IANA zone) with every request; time columns in exports use `formatDateTime()` (`common/serialize.ts`, which outputs wall-clock time in the current request's zone); times in import files go through `withZoneOffset()` (`common/time-zone.ts`) before `field.dateTime`; "today" in the home page statistics is also computed in this zone. **Never** use `Date#toISOString()` (milliseconds only)
- **Numbers**: `numeric` columns stay strings (e.g. `"12.50"`); don't `parseFloat` them in `toDict()`
- **Request validation**: request schemas are always lenient (`.passthrough()` / `z.record(...)` + everything optional); normalization happens in the service; tightening validation is a separate task
- **Errors**: services throw `ServiceError`; the global error handler turns it into `{ error, ...payload }`; 404/405/500 under `/api/*` all return JSON
- **Operation log**: written centrally to `operation_logs` by a global `onResponse` hook registered by the logs module; don't write log entries from services
- **Files**: uploads and storage all go through the file center (`modules/admin/files` + `common/storage/`, drivers `local` / `s3`, see the `STORAGE_*` env vars). The frontend uses `uploadFile` from `@/shared/api/files` and the `upload/*` components (in forms, `FormFileUpload` / `FormImageUpload` / `FormAvatarUpload`). Business tables store the file ID (or, for things like avatars, the `/api/admin/files/<id>` URL). When writing, call `syncFileRefs(tx, tableName, rowId, { field: value })` from `common/file-refs.ts` in the same transaction, and `clearFileRefs` when deleting; otherwise the file is treated as an orphan and cleaned up 24 hours after upload. The scaffold's `file` / `image` types handle this automatically
- **Data scope**: a role's `data_scope` (`all` / `dept_and_children` / `dept` / `self` / `custom`) decides which rows it can see. In routes, `await resolveDataScope(request)` gets the scope; in the repository, filter with `and(..., dataScopeWhere(scope, { deptColumn, ownerColumn }))` (the repository never touches `request`); detail / update / delete outside the scope always return 404. Scoped modules export `DATA_SCOPE` from `schema.ts`, and verify's `data_scope_filter` checks that the repository uses `dataScopeWhere`. New modules that need it are generated with `pnpm scaffold ... --data-scope` (adds `dept_id` / `created_by`, filled from `currentActor` on create). User management already uses it (department column `dept_id`, owner column `id`)
- **CSRF**: write requests under `/api/*` must send `X-CSRF-Token` (the frontend's request.ts handles this); the login endpoint is exempt
- **API tokens**: requests with `Authorization: Bearer ck_…` are authenticated by `common/api-token.ts` (no cookie read, no CSRF check), and `request.apiToken` is set; `hasMenuPermission` checks the token's scopes before the super admin rule, so business code just uses it as usual. Account and security endpoints are refused centrally through `API_TOKEN_DENIED`; when you add such an endpoint (password change, secrets, sessions, etc.), add its path there
- **Webhook events**: **after** a write's transaction commits, the service calls `this.events?.emit('<module>.created' | '.updated' | '.deleted', data)` (`created` / `updated` send the `xxxToDict` result, `deleted` sends `{ id }`); routes register event names with Chinese descriptions via `declareEvents({ ... })`, and pass `app.events` when constructing the service. `emit` never throws; don't `await` it to decide a business outcome. Scaffold-generated modules handle this automatically
- **Public demo (`DEMO_MODE`)**: write requests outside the allowlist in `common/demo.ts` all get 403. Currently allowed: login / logout, `/api/admin/component-center/*`, file uploads (`POST /api/admin/files`, needed by the gallery's images / attachments), and marking notifications read. New business domains are read-only in the demo by default; to make one writable there, add its path to `DEMO_WRITABLE` and add sample data in `src/demo/fixtures.ts` (reset logic: `src/demo/reset.ts`). Gallery APIs must live under `/api/admin/component-center/` to stay writable in the demo (scaffold's `/api/admin/<name>s` is not; move the paths by hand). `pnpm demo:reset` loads the fixtures into the current database too, but it empties every fixture table and the logs first, so on a dev database insert just the rows you need instead

---

## Frontend conventions

The frontend consists of dynamic routing (`App.tsx`), the API layer (`shared/api/request.ts`), `AuthContext`, `useCrudList` and the pages. The UI system is described in `docs/frontend-design-system.md`: **shadcn/ui + Tailwind CSS v4 + motion + lucide-react**, written in TypeScript (see "TypeScript"), with UI copy in Chinese (the i18n source key).

### Dynamic routing

`apps/web/src/App.tsx` resolves pages through `lib/page-modules.ts`, which scans them with `import.meta.glob('../modules/**/pages/**/index.{jsx,tsx}')`.

**Menu `component` field format:** `<module>/<subdir>/<page_name>`

```
admin/users                              → modules/admin/pages/users/index.tsx
component_center/patterns/kanban_page     → modules/component_center/pages/patterns/kanban_page/index.tsx
component_center/dataviz/dashboard_page  → modules/component_center/pages/dataviz/dashboard_page/index.tsx
```

### File locations

```
apps/web/src/modules/<module>/pages/<subdir>/<page_name>/index.tsx   ← page component
apps/web/src/modules/<module>/api/<page_name>.ts                      ← API call layer
```

Where scaffold puts pages: admin domain → `pages/<name>/index.tsx`; component_center domain → `pages/admin/<name>_page/index.tsx`; the API file is `api/<name>.ts`.

### TypeScript

`apps/web/src` is TypeScript only (`.ts` / `.tsx`; `apps/web/test/typescript-only.test.ts` fails on a `.js` / `.jsx` file there). `apps/web/tsconfig.json` uses the same strict options as the API (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), and `pnpm typecheck` / the `verify` gate type-check the whole app. The tests (`apps/web/test/*.test.ts(x)`, `test/setup.ts`) and `vite.config.ts` / `vitest.config.ts` are TypeScript too, checked by `apps/web/tsconfig.test.json` (same options plus the vitest / node types; `pnpm typecheck` and `verify` run both configs); jest-dom's matchers are typed in `test/setup.ts`. Only `eslint.config.js` and the two node scripts `scripts/api-types.mjs` / `scripts/i18n-scan.mjs` stay JavaScript; the tests import the scripts through the declarations next to them (`*.d.mts`), so keep those in step when a script's exports change. `test/fixtures/i18n-sample.jsx` stays JSX on purpose (it exercises the i18n scanner's JSX parsing).

- API files `modules/<module>/api/<page>.ts` take their types from the OpenAPI doc (see "Calling the API"); shared shapes live in `@/shared/api/types`.
- Components export `interface XxxProps`; type-only imports use `import type` / `import { type X }`. No `any`; a cast (`as`, `!`) needs a one-line comment saying why it holds.
- Shared components are typed for pages: `DataTable<Row>` with `DataTableColumn<Row>[]` (render values typed from `dataIndex`), FormFields generic over the react-hook-form values (`name` must be a real field), `FormDialog` / `FormSheet` over `UseFormReturn`, `TreeView` / `CheckableTree` over a `TreeNode` subtype, `MultiSelect<V>`, `SegmentedTabs<V>`, `Chart` over echarts' `EChartsOption`. Row types come from the API files (`export type User = ApiItem<'/api/admin/users'>`).
- `useAuth()` / `useTagsView()` return non-null values (they throw outside their provider).
- **Naming and exports** (follow what's there; don't rename existing files):
  - Pages: `modules/<module>/pages/<subdir>/<page>/index.tsx` with a **default export** (the lazy page loader needs it); page-local helpers next to it (`form.ts`, `demo-content.ts`, sub-components in PascalCase `.tsx`).
  - Shared components (`shared/components`) and the app shell (`components/app`): one PascalCase file per component, the component as the **default export**, its props / related types and small companion components as **named exports** (`import DataTable, { type DataTableColumn } from ...`). Multi-part modules (`Filters`, `FormFields`, `FormDialog`) export everything by name.
  - shadcn primitives (`components/ui`) and AI Elements: kebab-case files with **named exports only**, as the CLI writes them.
  - Hooks: one `useXxx.ts` file per hook in `shared/hooks`, with a named export. `use-mobile.ts` keeps shadcn's name because `components/ui/sidebar.tsx` imports it; it re-exports `useIsMobile`.
  - Everything else (`lib/`, `shared/api`, `shared/utils`, API files): kebab-case or snake_case file names as they are, named exports only.
- **Typed pages** (what scaffold generates, `docs/templates/frontend/list_page/`): the API file exports the row type (`export type Customer = ApiItem<'/api/admin/customers'>`, the path exactly as documented) and types every function with `ApiQuery` / `ApiBody` / `ApiResponse` (export / template return `Blob`). The page imports the row type (`type Customer as Row`) and declares `interface FormValues` field by field (str / text / date / datetime → `string`, int → `number | null`, float → `number | string | null` because decimals come back as strings, bool → `boolean`, enum → its option values `| null`, dict / file / image → `string | null`); then `useForm<FormValues>`, `const columns: DataTableColumn<Row>[]`, `useState<Row | null>` / `useState<number[]>`, and `useCrudList` infers Row from the API function. Submitting `FormValues` to `createItem` / `updateItem` is checked against the documented body, so a form that doesn't match the API fails `tsc`. No `any` and no casts at call sites: fix the OpenAPI doc (then `pnpm openapi:generate`) or the page instead. Scaffold writes the module's OpenAPI entries and regenerates `openapi.d.ts` itself, so the generated files type-check straight away.

### Calling the API

```typescript
// modules/<module>/api/<page>.ts
// ✅ Always use the shared request instance (vite has the @ → src/ alias configured)
import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

const BASE = '/admin/<resource>s'

/** Row and body types come from the OpenAPI doc (paths as documented: /api prefix, {param} placeholders) */
export type Item = ApiItem<'/api/admin/<resource>s'>
type ItemBody = ApiBody<'/api/admin/<resource>s', 'post'>

export const getItems = (params?: ApiQuery<'/api/admin/<resource>s'>) =>
  request.get<unknown, ApiResponse<'/api/admin/<resource>s'>>(BASE, { params })
export const createItem = (data: ItemBody) => request.post<unknown, Item>(BASE, data)
export const updateItem = (id: number, data: Partial<ItemBody>) => request.put<unknown, Item>(`${BASE}/${id}`, data)
export const deleteItem = (id: number) => request.delete<unknown, void>(`${BASE}/${id}`)

// Export (responseType: 'blob')
export const exportItems = (data: unknown) => request.post<unknown, Blob>(`${BASE}/export`, data, { responseType: 'blob' })
// Download the import template
export const downloadTemplate = (fileType = 'xlsx') =>
  request.get<unknown, Blob>(`${BASE}/template`, { params: { file_type: fileType }, responseType: 'blob' })
// Import (multipart/form-data)
export const importItems = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`${BASE}/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}
```

- The response interceptor already unwraps: use `res.items` / `res.total` directly, **not** `res.data.items` (that's why the second type argument of `request.get<unknown, T>` is the body type)
- API types: `src/shared/api/openapi.d.ts` is generated from `docs/apifox-full.openapi.json` by `apps/web/scripts/api-types.mjs`; `pnpm openapi:generate` regenerates it (so a doc fix reaches the frontend types), and `apps/web/test/api-types.test.ts` fails when it is stale. Never edit it by hand; if a type is wrong, fix the OpenAPI doc
- 401 redirects to the login page automatically; write requests carry the CSRF header automatically

### UI components

- **Component system**: shadcn/ui primitives (`@/components/ui/*`; the source lives in the repo and can be changed as needed) + shared business components (`@/shared/components/*`); icons come only from `lucide-react`
- **Use only** `@/components/ui/*`, `@/shared/components/*`, lucide-react and Tailwind semantic color classes; don't add other UI libraries (antd, MUI, etc.)
- **Forbidden**: hard-coded hex colors in pages (exceptions: shading inside canvas / WebGL and chart data colors; for charts, try `useChartColors` first), large inline styles for layout, emoji as icons
- **Reference implementations**: `apps/web/src/modules/admin/pages/users/index.tsx` (standard CRUD list page), `apps/web/src/modules/admin/pages/dashboard/index.tsx` (cards / charts / motion), `apps/web/src/modules/admin/pages/profile/index.tsx` (form page); templates in `docs/templates/frontend/`
- **Docs first**: before implementing a shadcn component, check the official shadcn/ui docs (https://ui.shadcn.com/docs/components; prefer the shadcn MCP when available); the skill is at `.claude/skills/shadcn-ui-skills/SKILL.md`. When the docs conflict with the existing implementation in the repo, the repo wins (components in `components/ui` may have been adjusted to this project's tokens)

**Page structure (list pages follow the users page):**

```
PageHeader (title + actions on the right: import / export as outline, create as variant="brand"; at most one brand button per page; no feature description under the title)
→ FilterBar (SearchInput / FilterSelect, search + reset)
→ DataTable (pagination page/perPage/total, selectable rows, row actions as ghost buttons + ConfirmAction for delete)
→ FormDialog / FormSheet (react-hook-form + FormFields; on submit failure call toast.apiError, then throw to keep the dialog open)
→ ImportDialog / ExportDialog (csv / xlsx)
Sections use Panel; status uses StatusBadge; empty states use EmptyState; all feedback goes through toast (@/lib/toast)
```

**Shared components at a glance (`apps/web/src/shared/components/`):**

| Component | Purpose |
|---|---|
| `PageHeader` / `Panel` | Page header (title / actions; description only for data facts, such as `4 列 · 8 张卡片` ("4 columns · 8 cards")) / card section (`padded={false}` for edge-to-edge) |
| `DataTable` + `DataPagination` | Column definition `{ key, title, dataIndex, width, align, className, ellipsis, render(value, row, index) }`; `pagination={{ page, perPage, total, onChange }}`; `selectable` / `selectedKeys` / `onSelectionChange`; `loading` skeleton and empty state built in |
| `Filters`: `FilterBar` / `SearchInput` / `FilterSelect` | Filter bar; `''` in `FilterSelect` means all; debounce with `@/shared/hooks/useDebouncedValue` |
| `FormDialog` / `FormSheet` / `DetailSheet` / `DescriptionList` | Create / edit dialog / side sheet / read-only detail sheet / key-value list |
| `FormFields`: `FormInput` / `FormTextarea` / `FormNumber` / `FormSelect` / `FormMultiSelect` / `FormSwitch` / `FormRadioGroup` / `FormCheckboxGroup` / `FormDate` / `FormDateTime` / `FormTags` / `FormCustom` / `FormGrid` | react-hook-form fields: `<FormInput control={form.control} name="x" label="…" rules={{ required: '请输入…' }} />` (`请输入…` = "please enter ...") |
| `ConfirmAction` / `RowActions` | Confirmation for dangerous actions (replaces Popconfirm) / row actions |
| `StatusBadge` | `tone`: neutral / brand / info / success / warning / danger, `dot`, `variant="plain"` |
| `EmptyState` / `SegmentedTabs` / `TreeView` / `StatCard` | Empty state / segmented tabs with a sliding indicator / tree / metric card |
| `DatePicker` / `DateTimePicker` / `MultiSelect` / `TagInput` | Value format `'YYYY-MM-DD'` / `'YYYY-MM-DD HH:mm:ss'` |
| `data-transfer/ImportDialog` / `data-transfer/ExportDialog` | Import / export dialogs (`open` / `onOpenChange`) |
| `upload/FileUpload` / `upload/ImageUpload` | Upload (fileList entries `{ uid, name, url, status, response }`) |

lib: `@/lib/utils` (`cn`), `@/lib/toast` (`toast.success / error / warning`, `toast.apiError(err, fallback)`), `@/lib/format` (`formatDate / formatDateTime / formatNumber / formatRelative`), `@/lib/motion` (`fadeUp / stagger / pageTransition / layoutSpring`), `@/lib/chart-theme` (`useChartColors` etc.; ECharts must take theme colors from it), `@/lib/menu-icons`.

**Field type → form component / table column (scaffold generates these):**

| scaffold type | Form component | Table column rendering | Default |
|---|---|---|---|
| `str` / `str20` / `str50` / `str500` | `FormInput` | As is | `''` |
| `text` | `FormTextarea` | `ellipsis: true` | `''` |
| `int` / `float` | `FormNumber` (`step={1}` / `step={0.01}`) | Right-aligned + `tabular-nums` | `null` |
| `bool` | `FormSwitch` | `StatusBadge` (是 / 否, yes / no) | `false` |
| `date` | `FormDate` | `formatDate` | `''` (edit form fills `formatDate(v, '')`) |
| `datetime` | `FormDateTime` | `formatDateTime` | `''` (edit form fills the API value as is, `v ?? ''`; the picker shows local time and submits an ISO time with a zone offset) |
| `file` / `image` | `FormFileUpload` / `FormImageUpload` | "View" link / thumbnail (`fileUrl(id)`) | `null` |
| Enum / status (hand-written) | `FormSelect` / `FormRadioGroup` | `StatusBadge` + tone mapping | - |

**Design tokens and motion** (details: `docs/frontend-design-system.md` §2):

- Colors always use semantic classes: `bg-background` / `bg-card` / `text-foreground` / `text-muted-foreground` / `border` / `bg-muted` / `text-primary` / `bg-brand-soft` / `text-success` / `bg-success-soft` / `text-warning` / `text-danger` / `bg-danger-soft` / `text-info`; with semantic classes only, dark mode (`<html class="dark">`) is correct for free
- Users can switch the accent color under Appearance settings in the top bar (presets in `src/lib/appearance.ts`, default Ocean; the `[data-accent]` presets in `index.css` only define `--brand-from/via/to`, and `--primary`, `--ring`, chart colors and `brand-soft/glow/shadow` are all derived from those three). Pages always use the `primary` / `brand-*` semantic classes; never hard-code a particular accent color, or it won't follow the switch. Navigation mode (sidebar / top / mixed), sidebar style and content width live in the same panel and are handled by `AppLayout`; pages don't need to care
- Tab bar (on by default, can be turned off in Appearance settings): opened pages stay as tabs, with state in `src/context/TagsViewContext.tsx`. When it's on, each tab page is kept alive with React `<Activity>`: switching away keeps the page state (filters, pagination, form input), but effects are cleaned up and run again on return (requests in `useEffect` fetch again; timers / polling / WebSockets stop while hidden). So page side effects must live in effects with proper cleanup; never start timers at module level or during render
- Neutral gray is the base; the accent (default Ocean gradient blue → sky → cyan) is only an accent: `bg-brand-gradient` (decoration) / `bg-brand-gradient-strong` (carries white text) / `text-brand-gradient` / `border-brand-gradient` / `shadow-brand` / `bg-brand-glow` (only for small decorations, never as a large background behind content; in light mode it looks like a stain); no purple
- Spacing with Tailwind (`space-y-4` / `gap-4`), numbers with `tabular-nums`; on mobile (<768px) nothing may overflow horizontally (table containers scroll horizontally)
- Restrained motion: interactions 150-250ms ease-out; staggered list entrances, layoutId indicators, number rolls and overlay enter / exit are already provided by the shared components; `prefers-reduced-motion` is handled globally

**Menu icons**: `menus.icon` stores a lucide icon name (e.g. `Users`, `Settings`), which `apps/web/src/lib/menu-icons.ts` resolves to a lucide component; new menus reuse names already in the mapping, and a new icon needs a new entry in the mapping.

### Internationalization (i18n) and code comments

The UI supports Simplified Chinese / English / Japanese, and **the Chinese source text is the translation key** (design in `apps/web/src/i18n/index.ts` and `apps/api/src/common/i18n.ts`).

- **Frontend**: `const { t } = useTranslation()`, then `t('保存')` ("Save") or `t('共 {{count}} 条', { count })` ("{{count}} items in total"). English / Japanese go in the **page's own directory**, `locales/en-US.json` and `locales/ja-JP.json` ("Chinese → translation"; both files have the same keys); shared copy lives in `src/locales/`, and menu names, keyed by menu code, in `src/locales/menus/`.
  - String props passed to shared components (PageHeader / Panel titles, DataTable column titles, FormFields label / placeholder / options / rules messages, FilterSelect / SegmentedTabs / StatusBadge / StatCard / RowActions / ConfirmAction / FormDialog, etc.) are translated by the component: write the Chinese and add the translations. `toast.success('固定中文')` (a fixed Chinese string) is translated automatically too.
  - Must be wrapped in `t()`: Chinese written directly in JSX, aria-label / title / placeholder on native elements, copy with variables (don't use Chinese template strings), and other display channels such as chart axes / legends.
  - Demo content (sample data, sample documents) isn't translated; mark it with `// i18n-ignore-next-line` or the file-level `i18n-ignore-file`.
  - Check: `node apps/web/scripts/i18n-scan.mjs <dir>` must report 0 problems (the frontend test `test/i18n.test.ts` runs it on every page).
- **Backend**: keep throwing Chinese errors (`new ServiceError('用户名已存在')`, "username already exists"); a response hook translates `error` / `message` / the `reason` of import error rows according to the `Accept-Language` request header (no supported language → English; API tests send `zh-CN` by default via `chineseByDefault` in `test/helpers.ts`). Register English and Japanese translations for new messages in `apps/api/src/i18n/messages.ts` (messages with variables go in `PATTERNS`); `test/i18n-messages.test.ts` catches missing ones. Headers in import / export files stay in Chinese.
- **Code comments are always in English** (frontend, backend, scripts, tests, scaffold-generated code). UI copy is still written in Chinese as the key.

### Adding shadcn/ui primitives

Component source goes straight into the repo (`apps/web/src/components/ui/`, config `apps/web/components.json`). On this machine the shadcn CLI (node) can't reach ui.shadcn.com directly, so always use the relay script:

```bash
apps/web/scripts/shadcn-add.sh hover-card           # start a local relay → REGISTRY_URL=http://127.0.0.1:<port>/r npx shadcn@latest add ... → stop the relay
apps/web/scripts/shadcn-add.sh --view badge         # only view the registry content, write no files
apps/web/scripts/shadcn-add.sh badge -o -y          # overwrite existing files (loses local changes; confirm first)
```

The script clears `HTTP(S)_PROXY` before running the CLI (npm package downloads still use the original proxy via `npm_config_proxy`), rewrites `import { cn } from "cn"` in the registry source back to `@/lib/utils`, and removes the `cn` package if it was installed by mistake. After adding, check `git diff apps/web/package.json` and make sure the component only uses semantic color classes; change focus styles to the project's `ring-2` + `ring-ring/20` (shadcn's default `ring-[3px]` / `ring-ring/50` is too heavy; `apps/web/test/focus-ring.test.ts` catches it). Every project change to an upstream component is listed in `docs/shadcn-changes.md`: re-apply it after overwriting a component with `-o`, and add a line there when you change one.

### Adding AI Elements components

AI interfaces use Vercel's AI Elements (`apps/web/src/components/ai-elements/`; list and usage in `.claude/skills/shadcn-ui-skills/COMPONENTS.md`). The relay script only forwards ui.shadcn.com, so first download the component's registry JSON with curl, then pass the local file to the script (the shadcn primitives it depends on are still resolved through the relay; `yes n` answers "don't overwrite existing files", which protects the project's modified `components/ui/*`):

```bash
curl -sSo /tmp/el-reasoning.json https://elements.ai-sdk.dev/api/registry/reasoning.json
yes n | apps/web/scripts/shadcn-add.sh /tmp/el-reasoning.json -y
```

The CLI writes TSX according to `components.json` (`tsx: true`). After installing, check the size of new dependencies (compare `npx vite build` before and after); change English copy in the components to `t('中文')` or have the caller pass it in; dependencies in the registry that point to other AI Elements components by full URL must also be downloaded locally before installing.

### Frontend-only pages (no backend API)

```
component_center/devtools/websocket_page      (WebSocket /ws/devtools is served by the backend)
component_center/devtools/perf_monitor_page   (metrics come from /ws/devtools)
component_center/dataviz/heatmap_page
component_center/dataviz/realtime_chart_page
```

---

## Import and export rules

**Backend** (`apps/api/src/common/tabular.ts`)
- Supported formats: `SUPPORTED_TABLE_FILE_TYPES = ['csv', 'xlsx']`. **`.xls` is not supported**: uploading `.xls` returns `400 {error:'不支持 .xls 格式，请另存为 .xlsx 后重新上传'}` (".xls isn't supported, save as .xlsx and upload again"); `file_type=xls` for export / template falls back to the default
- Helpers:
  - `buildTable(headers, rows, baseFilename, fileType)` → table payload (csv with BOM); `sendTable(reply, table)` → sets `Content-Type` / `Content-Disposition` and sends it
  - `readTableFile(file)` → `{ fieldnames, rows, fileType }` (rows carry line numbers, 5MB cap, csv BOM stripped automatically)
  - `normalizeTableFileType(raw, fallback)` → normalizes the file type; `sanitizeFormula()` guards against formula injection
  - Read uploaded files with `getUploadedFile(request)` (`@/common/http`)
- In `modules/<domain>/<name>/schema.ts`, define `EXPORT_FIELD_MAP` (field → Chinese header; the value comes from the same-named field of toDict; when it needs converting, write `[Chinese header, getter function]`, e.g. to show an enum's Chinese label) and `IMPORT_HEADER_MAP` (Chinese header → field)
- An import is one transaction for the whole batch: if any row has errors, throw `ServiceError('导入失败，存在错误数据', 400, { error_rows, error_count })` ("import failed, some rows have errors") and roll everything back
- Routes: `POST /export`, `GET /template`, `POST /import` (under the resource path); permission codes: export is `<perm>_export`, template download and import are both `<perm>_import`. Don't substitute the view permission or `_edit` (someone who can view can't necessarily export, and someone who can edit can't necessarily write in bulk)
- Logs (login log / operation log) can only be exported, never imported: audit records must not be written from files
- Reference implementation: `apps/api/src/modules/admin/users/`

**Frontend**
- Export dialog: `@/shared/components/data-transfer/ExportDialog` (`open` / `onOpenChange` / `fieldOptions` / `ruleHint` / `onConfirm({ fields, fileType })`)
- Import dialog: `@/shared/components/data-transfer/ImportDialog` (`onDownloadTemplate(fileType)` / `onImport(file)` / `onImported(res)`; CSV / XLSX only; error rows can be downloaded)
- Download: `import { downloadBlobFile } from '@/shared/utils/file'`
- Reference implementation: `apps/web/src/modules/admin/pages/users/index.tsx` (exports the selected rows first + template download + import result message)

---

## RBAC conventions

### Data model

```
menus table:
  menu_type = 'menu'    → page menu (shown in the sidebar)
  menu_type = 'button'  → button permission (not shown in the sidebar)

role_menus: role-menu many-to-many (composite primary key)
user_roles: user-role many-to-many (composite primary key)
```

### Super admin

The role with `code = 'super_admin'` has every permission: `hasMenuPermission` lets it through directly, and `seed-rbac` grants it all menus on every run. Note that `GET /api/admin/my-menus` has no super_admin shortcut; it returns the menus actually granted to the roles.

Protections (enforced in the roles / users services, with the UI disabled to match): the super admin role can't be deleted, its code can't change, its data scope is fixed at `all` and its menus are fixed at all; only super admins can grant / remove this role and edit / disable / delete super admin accounts; you can't remove this role from yourself; the last enabled super admin can't be disabled / deleted / lose the role. Recovery after a lockout: `pnpm seed:rbac -- --incremental` rebuilds the role and attaches it to `admin` again.

### Changing menus

1. Add / change the menu entries and button permissions in `MENUS_DATA` (the single source of truth) in `apps/api/scripts/seed-rbac.ts`
2. Run `pnpm seed:rbac -- --incremental`
3. `--incremental` upserts by `code`: it only inserts / updates, **never deletes** existing records, and refreshes the super admin's permissions; after inserting it syncs the `menus` sequence
4. Deleting a menu takes manual SQL: `DELETE FROM menus WHERE id = xxx`
5. **Without `--incremental` it's a full rebuild** (clears user_roles / role_menus / admin_users / roles / menus); use it only to initialize an empty database

### Menu ID allocation

```
System groups (parent_id=2):                  ID 201-209 (组织权限 [Organization] 201 / 安全审计 [Security & Audit] 202 / 系统配置 [Configuration] 203 / 内容消息 [Content & Messages] 204)
System pages (parent_id=its group):           ID 21-39; new pages start at 2001 (pages hang under a group, never directly under 2)
Component gallery (parent_id=3):              ID 40-499
  数据可视化 [Data Visualization] (parent_id=41): ID 411-419
  (free: ID 40 and 401-409 with their buttons 4011-4099, the removed 管理系统 [Admin Pages] group — replaced by 页面模板;
   ID 42 and 421-429, the removed 3D / Creative group)
  页面模板 [Page Patterns] (ID 43, parent_id=3):  the directory's buttons (the shared demo API) ID 431-435;
                                                pages (parent_id=43) ID 4301-4399 (43 × 100 + n: a directory with
                                                its own buttons can't also use 431-439 for pages)
  AI 应用 [AI Apps] (parent_id=44):               ID 441-449
  编辑器 [Editors] (parent_id=45):                ID 451-459
  工具类 [Engineering Tools] (parent_id=46):      ID 461-469
New business domain menus:                    from 1000 (ID 1000 = the 业务管理 [Business] directory, code `biz`, created the first time scaffold --spec registers a menu; generated modules 1001-1999, buttons = ID × 10 + 1...5)
```

> **Check which IDs are actually taken before picking one**; don't assume "the next number in the range":
> ```bash
> grep -oE "id: [0-9]+" apps/api/scripts/seed-rbac.ts | awk '{print $2}' | sort -n | uniq
> ```

> New menus stay strictly within the ranges above. Button permission IDs are hard-coded in `MENUS_DATA` as "menu ID × 10 + sequence number" (e.g. 用户管理 (Users) 21 → 211 add / 212 edit / 213 delete / 214 export / 215 import / 216 enable-disable; AI 提示词工坊 (AI Prompt Studio) 442 → 4421 add / 4422 edit / 4423 delete).

---

## Field type inference

AI infers types from the business description; **the PM never specifies technical types**. The scaffold type keys are for `pnpm scaffold -- --fields "name:str,phone:str20"`; the Drizzle column is what goes in `db/schema/<domain>/<name>.ts` (mapping: `FIELD_TYPE_MAP` in `apps/api/scripts/scaffold.ts`).

| Keywords in the business description | scaffold type | Drizzle column | Notes |
|---|---|---|---|
| name, title, person's name (名称, 标题, 姓名, 名字) | `str` | `varchar({ length: 100 })` | - |
| code, number/ID (编码, 代码, code, 编号) | `str50` | `varchar({ length: 50 })` | - |
| description, remarks, summary, notes (描述, 备注, 简介, 说明) | `text` | `text()` | - |
| mobile, phone (手机, 电话, phone) | `str20` | `varchar({ length: 20 })` | - |
| email (邮箱, email) | `str` | `varchar({ length: 100 })` | - |
| status, type, level with fixed options (状态, 类型, 等级) | `enum` (`options` in the spec) | `varchar({ length: 50 })` | Stores the English value, shows the Chinese label; falls back to `str20` with `--fields` only |
| category, source, industry with changing options (分类, 来源, 行业) | `dict` (`dict` dictionary code in the spec) | `varchar({ length: 100 })` | Options are maintained in 数据字典 (Dictionaries) |
| amount, price, fee, cost (金额, 价格, 费用, 成本) | `float` | `numeric({ precision: 10, scale: 2 })` | Output as a string |
| quantity, count, number of (数量, 次数, 个数) | `int` | `integer()` | - |
| progress, percentage, completion (进度, 百分比, 完成度) | `int` | `integer()` | 0-100 |
| date without time (日期) | `date` | `date({ mode: 'string' })` | `YYYY-MM-DD` text |
| time (时间) | `datetime` | `timestamp({ mode: 'string' })` | Output via `toIso()` |
| created at, updated at (创建时间, 更新时间) | (automatic) | `createdAt()` / `updatedAt()` | Added by scaffold automatically |
| whether, enabled, disabled, switch (是否, 启用, 禁用, 开关) | `bool` | `boolean()` | Add `.$default(() => true)` when writing by hand |
| sort order, weight, numeric priority (排序, 权重, 优先级数字) | `int` | `integer()` | Add `.$default(() => 0)` when writing by hand |
| color (颜色, color) | `str20` | `varchar({ length: 20 })` | - |
| URL, link, external address (URL, 链接, 地址) | `str500` | `varchar({ length: 500 })` | - |
| image, avatar, cover, photo (图片, 头像, 封面, 照片) | `image` | `varchar({ length: 36 })` | Stores the file center's file ID; the reference is registered automatically on save |
| attachment, file, contract, scan (附件, 文件, 合同, 扫描件) | `file` | `varchar({ length: 36 })` | Same as above |
| content, body, details (内容, 正文, 详情) | `text` | `text()` | Rich text |
| tags (标签, tags) | `text` | `text()` | JSON string |

**Prefer `--spec` for scaffold** (see step 4a of the `new-feature-autopilot` skill): write the inferred spec as a JSON file, and `pnpm scaffold -- --spec <file>` generates in one run the Chinese title / labels, required, unique, defaults, fixed options (`enum`, stores the English value and shows the Chinese label), data dictionaries (`dict`) and the menu (`menu`: written automatically into the 业务管理 (Business) directory in `seed-rbac.ts`, with menu translations); the generated API test gets an extra field-rules case. The spec is first checked by `validateSpec` (the Chinese `title` and each field's `label` are required; misspelled property names are errors; it checks field names, types, options, dictionaries, and whether defaults match their types; titles / labels can't contain quotes, braces, angle brackets and the like). `--validate-only` validates without generating. The format is `docs/spec.schema.json` (generated from the scaffold code by `pnpm scaffold -- --write-schema`); examples are in `docs/examples/specs/`. With `--fields` alone you get none of this, and labels are English placeholders. The table name is always the resource name plus `s`. Scaffold also generates the basic API test `apps/api/test/<admin|cc>-<name>.test.ts`; keep it up to date when you add business rules.

---

## Anti-patterns (❌ forbidden)

```
❌ A custom hasPermission() inside routes.ts (always import from @/common/auth)
❌ Calling db.select()/sql`` directly inside routes.ts (always go through the repository)
❌ Business logic in db/schema (only pgTable + toDict)
❌ Outputting times with Date#toISOString() directly (always use toIso from @/common/serialize)
❌ Converting numeric to a number in toDict() (keep it a string)
❌ Adding other UI libraries to the frontend (antd, MUI, etc.): use only @/components/ui/*, @/shared/components/*, lucide-react and Tailwind semantic color classes
❌ Hard-coded hex colors or large inline-style layouts in the frontend (use Tailwind semantic classes)
❌ Each page writing its own table / dialog / confirmation (always reuse DataTable / FormDialog / ConfirmAction / ImportDialog / ExportDialog)
❌ Frontend requests via fetch/XMLHttpRequest (always use @/shared/api/request)
❌ Hard-coded menu IDs (check the menu tree for the next free ID first)
❌ A new domain not registered in src/router.ts + db/schema/index.ts
❌ Hand-written migration SQL instead of drizzle-kit generate (breaks the journal chain)
❌ A migration generated but not applied, or declared done without confirming with psql \d
❌ Declaring done without passing the verify-feature gate
❌ New endpoints left with only the openapi:generate skeleton, or with an invented summary / fields (write them from the code per "OpenAPI writing rules")
❌ Frontend pages not placed at modules/<module>/pages/<subdir>/<page>/index.tsx (dynamic routing won't find them elsewhere)
❌ New frontend code in .jsx / .js, or `any` / type casts at call sites in a new page (type it from the API file; fix the OpenAPI doc when a type is wrong)
❌ Re-adding .xls support to import / export (decided: csv / xlsx only)
❌ Asking the PM about technical details such as route paths, permission codes or field types (AI infers them)
```

---

## Delivery process (every new feature)

```
Step 1  Read the context
        → Read this file (AGENTS.md)
        → Read the code skeleton templates in docs/templates/ (backend/README.md has the substitution rules)
        → Look at similar existing modules for naming (backend: modules/admin/users/, frontend: apps/web/src/modules/admin/pages/users/index.tsx)
        → Check the current menu tree (MENUS_DATA in apps/api/scripts/seed-rbac.ts) to pick the parent_id and the next free ID

Step 2  Write the internal spec (an AI-internal document; the PM doesn't read it)
        → Infer: API paths, field types and lengths, permission codes, file paths, menu IDs, migration name

Step 3  Show the business preview (for the PM to confirm)
        Show business-level information only:
        · Feature name and location (which menu it lives under)
        · Field list (Chinese names, required fields marked)
        · Available actions (create / read / update / delete, import / export, etc.)
        · Wait for confirmation or changes; on changes, go back to Step 2

Step 4  Implement
        → pnpm scaffold -- --name <name> --domain <admin|component_center> --fields "..."
          (generates db/schema + the four module files + the frontend api/<name>.ts and pages/.../index.tsx, registers router.ts and
            db/schema/index.ts automatically, writes the module's OpenAPI entries and regenerates the frontend API types,
            and runs drizzle-kit generate --name <name> to create the migration)
        → Fill in the business logic and Chinese headers in the order db/schema → schema → repository → service → routes
        → If you change the table structure afterwards: pnpm db:generate --name <description> (note: no -- here)
        → Add the menu + button permissions (_add/_edit/_delete/_export/_import) to seed-rbac.ts and run pnpm seed:rbac -- --incremental
        → Review the newly generated SQL under apps/api/drizzle/ and run pnpm db:migrate
        → Add the new menu to "Current menu tree" in this file
        → API docs: scaffold has already written the module's 8 endpoints; if you hand-edited the generated routes / fields / validation or added routes, update the docs from the code (for new routes, run pnpm openapi:generate first to add skeletons),
          until pnpm openapi:generate -- --strict passes (mandatory: verify's openapi_sync and the API tests both block on it)

Step 5  Verification gate (mandatory, never skip)
        → pnpm verify -- --module <name> (includes the frontend build and frontend + backend unit tests; while debugging you can use --skip-build / --skip-api-tests)
        → If anything fails, fix it and verify again
        → Once everything passes, output the delivery report
```

> **Migrations must be applied to the database (mandatory)**: after generating / changing a migration, static checks alone (verify's `migration_chain`) **don't count as done**. You must actually run it and confirm:
> 0. The database name comes from `DEV_DATABASE_URL` in `apps/api/.env.development` (the local default is `castor_kit`; substitute the real name in the commands below)
> 1. Before writing, record the current version: `psql -d castor_kit -c 'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id'`
> 2. `pnpm db:migrate` to apply the changes
> 3. For new tables / indexes / columns, confirm the objects really exist with `psql -d castor_kit -c '\d <table>'`
> 4. The `migration_applied` step of `pnpm verify -- --module <name>` passes (it compares the journal with `drizzle.__drizzle_migrations` and confirms the module's table exists with `to_regclass`); its detail reads like `migrated to 0001_customer (castor_kit)`
> 5. The delivery report states "migrated to <tag>" (the tag is the migration name under `apps/api/drizzle/`, e.g. `0001_customer`)

**Delivery report format:**
```
✅ Feature delivered: <feature name>

Changed files:
  Backend:  apps/api/src/db/schema/<domain>/<name>.ts
            apps/api/src/modules/<domain>/<name>/{schema,repository,service,routes}.ts
            apps/api/src/db/schema/index.ts, apps/api/src/modules/<domain>/router.ts (registration)
            apps/api/test/<admin|cc>-<name>.test.ts (API tests, updated for the business rules)
  Frontend: apps/web/src/modules/<module>/pages/<subdir>/<page>/index.tsx
            apps/web/src/modules/<module>/api/<name>.ts
  RBAC:     apps/api/scripts/seed-rbac.ts (--incremental has been run)
  Migration: apps/api/drizzle/<tag>.sql — migrated to <tag> (confirmed with psql \d <table>)
  Gate:     pnpm verify -- --module <name> all passed (including frontend + backend unit tests)

Next steps for the user:
  1. Refresh the page and find <feature name> under <location>
  2. (When deploying to another environment) pnpm db:migrate && pnpm seed:rbac -- --incremental
```

---

## Docs site and community files

- The docs site and project website are in `website/` (VitePress, a standalone npm project, not in the pnpm workspace): English is the root language (`website/guide/…`), Chinese is at `website/zh/` and Japanese at `website/ja/`, and the pages of the three languages correspond one to one; the landing page is `.vitepress/theme/components/Landing.vue`, with its copy in `landing-content.js`
- The UI images on the landing page and in the READMEs are real screenshots (`website/public/screenshots/`, `.github/assets/screenshot-*.webp`), captured automatically by `npm --prefix website run screenshots` while `pnpm dev` is running (it prompts for the admin password); take new screenshots when the UI's look changes noticeably
- When feature behavior, commands or environment variables change, update the docs in all three languages in the same PR; preview locally with `npm --prefix website run dev`, and run `npm --prefix website run build` before committing (it checks for dead links)
- The docs site is published to GitHub Pages (https://robeshell.github.io/castor-kit/) by `.github/workflows/docs.yml`: changes to `website/` deploy automatically once merged into main; PRs only run the build check
- `README.md` (English) / `README.zh-CN.md` / `README.ja.md`, `CONTRIBUTING.md`, `SECURITY.md` and `CHANGELOG.md` in the repo root are for outside contributors; record user-visible changes under `[Unreleased]` in `CHANGELOG.md`

## Command reference

Run every command from the repo root. For castor-kit's own scripts (scaffold / verify / seed:rbac / openapi:*), the `--` before the arguments is optional; **`pnpm db:generate` must not be followed by `--`** (drizzle-kit doesn't understand it).

```bash
# Install / start
pnpm install
pnpm dev                     # api(5001) + web(5173)
pnpm dev:api                 # backend only (tsx watch)
pnpm dev:web                 # frontend only (vite)
pnpm --filter @castor-kit/api worker   # standalone scheduler process (when RUN_SCHEDULER_IN_WEB=false)

# Quality
pnpm typecheck               # tsc --noEmit (api / mcp / web, web's tests and Vite configs included)
pnpm test                    # vitest (needs the castor_kit_test database) + web unit tests
pnpm lint
pnpm build                   # web(vite) + api(tsup) + mcp

# Database migrations (Drizzle)
pnpm db:generate --name <description>   # drizzle-kit generate, creates apps/api/drizzle/<nnnn>_<description>.sql
pnpm db:migrate                         # apply migrations (recorded in drizzle.__drizzle_migrations)
psql -d castor_kit -c '\d <table>'       # confirm it's in the database (database name from DEV_DATABASE_URL in apps/api/.env.development)

# RBAC (run after every menu change)
pnpm seed:rbac -- --incremental         # incremental upsert, no deletes
pnpm seed:rbac                          # full rebuild (empty-database initialization only)
pnpm seed:demo                          # sample departments / roles (department head, regular staff) / users to try data scopes; needs --force in production

# One-time initialization (migrations + incremental RBAC + AI SQL read-only account; an advisory lock makes it safe to run concurrently)
pnpm setup-once
pnpm --filter @castor-kit/api init-ro-role   # create only the read-only account castor_kit_ro (needs POSTGRES_RO_PASSWORD)

# Verification gate
pnpm verify -- --module <name>                 # every check (including vite build)
pnpm verify -- --module <name> --skip-build    # skip the frontend build
pnpm verify -- --module <name> --json          # structured JSON (stdout is JSON only, for AI/MCP)
#   other flags: --skip-frontend-tests --skip-api-tests --skip-db --strict-docs --run-rbac-sync --database-url <url>

# Code skeleton generation
pnpm scaffold -- --name <name> --domain admin --fields "name:str,status:str20"
pnpm scaffold -- --name <name> --domain component_center --fields "..." --dry-run   # print only, write no files
pnpm scaffold -- --name <name> --domain admin --fields "..." --data-scope         # add data scope (dept_id / created_by)
#   --domain must be admin or component_center; --skip-migration skips drizzle-kit

# OpenAPI
pnpm openapi:generate                    # add skeletons for undocumented route + method pairs (written back to docs/apifox-full.openapi.json), check the rules, regenerate the frontend API types
pnpm openapi:generate -- --strict        # list every endpoint that breaks "OpenAPI writing rules"; non-zero exit if any (--dry-run: don't write back)
pnpm openapi:apifox                      # push to Apifox (APIFOX_PROJECT_ID / APIFOX_ACCESS_TOKEN, or --project-id / --access-token)

# MCP server
pnpm mcp
```

**Ask the user before running** (this also applies when AI tools run commands on their own):

- `pnpm seed:rbac` (without `--incremental` it's a full rebuild that wipes accounts / roles / menus)
- Deleting or hand-editing already-applied migration files under `apps/api/drizzle/` (breaks the journal chain)
- `DELETE FROM ...` / `DROP ...` (deletes data or objects directly)
- `git push` / `git reset --hard`

---

## MCP server

`apps/mcp/src/index.ts` exposes the tooling over the MCP protocol. Tools: `get_project_context` / `get_menu_tree` / `get_spec_guide` (the spec's JSON Schema and requirement → spec examples) / `validate_spec` / `scaffold_feature` (pass `spec`, or the short form `name` + `fields`) / `check_openapi` / `run_verify` / `init_rbac` / `run_migration` / `list_templates`.

Claude Desktop config (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "castor-kit": { "command": "pnpm", "args": ["--dir", "/path/to/castor-kit", "-s", "mcp"] }
  }
}
```
You can also run `pnpm --filter @castor-kit/mcp build` and then use `node apps/mcp/dist/index.js`; the repo root can be overridden with the `CASTOR_KIT_ROOT` environment variable.

---

## Current menu tree (ID reference)

> Single source of truth: `apps/api/scripts/seed-rbac.ts` (menus + button permissions). Add new feature menus below as you create them; if the two disagree, seed-rbac.ts wins. Menu names are the Chinese data stored in `menus` (the English names in brackets come from `apps/web/src/locales/menus/en-US.json`).

```
ID=1   首页 [Home] (dashboard) → /dashboard → admin/dashboard
ID=2   系统管理 [System] (system)
  ID=201 组织权限 [Organization] (system_group_org)
    ID=21  用户管理 [Users] → /system/users → admin/users
    ID=22  角色权限 [Roles] → /system/roles → admin/roles
    ID=26  部门管理 [Departments] → /system/departments → admin/departments
  ID=202 安全审计 [Security & Audit] (system_group_security)
    ID=28  在线用户 [Online Users] → /system/sessions → admin/sessions (button 281 force sign-out: system_sessions_revoke)
    ID=24  日志管理 [Logs] → /system/logs → admin/logs
    ID=38  API Token → /system/api-tokens → admin/api_tokens (button 381 revoke: system_api_tokens_revoke)
  ID=203 系统配置 [Configuration] (system_group_config)
    ID=29  系统设置 [System Settings] → /system/settings → admin/settings (button 291 edit: system_settings_edit)
    ID=23  菜单管理 [Menus] → /system/menus → admin/menus
    ID=25  数据字典 [Dictionaries] → /system/dicts → admin/dicts
    ID=32  定时任务 [Scheduled Tasks] → /system/scheduled-tasks → admin/scheduled_tasks
    ID=39  Webhook → /system/webhooks → admin/webhooks (buttons 391 add / 392 edit / 393 delete: system_webhooks_*)
  ID=204 内容消息 [Content & Messages] (system_group_content)
    ID=27  文件管理 [Files] → /system/files → admin/files
    ID=30  消息通知 [Notifications] → /system/notifications → admin/notifications
    ID=31  公告管理 [Announcements] → /system/announcements → admin/announcement_page
ID=3   组件示例中心 [Component Gallery] (component_center)
  ID=43  页面模板 [Page Patterns] (cc_patterns; buttons 431-435: cc_patterns_add / _edit / _delete / _export / _import, the shared demo API /api/admin/component-center/demo-records)
    ID=4301 标准列表 [Standard List] (cc_patterns_standard_list) → /component-center/patterns/standard-list → component_center/patterns/demo_record_page
    ID=4302 卡片列表 [Card List] (cc_patterns_card_list) → /component-center/patterns/card-list → component_center/patterns/card_list_page
    ID=4303 树形列表 [Tree List] (cc_patterns_tree_list) → /component-center/patterns/tree-list → component_center/patterns/tree_list_page
    ID=4304 统计列表 [Stats List] (cc_patterns_stats_list) → /component-center/patterns/stats-list → component_center/patterns/stats_list_page
    ID=4305 详情页 [Detail Page] (cc_patterns_detail) → /component-center/patterns/detail → component_center/patterns/detail_page
    ID=4306 分步表单 [Step Form] (cc_patterns_step_form) → /component-center/patterns/step-form → component_center/patterns/step_form_page
    ID=4307 动态表单 [Dynamic Form] (cc_patterns_dynamic_form) → /component-center/patterns/dynamic-form → component_center/patterns/dynamic_form_page
    ID=4308 看板 [Kanban] (cc_patterns_kanban) → /component-center/patterns/kanban → component_center/patterns/kanban_page
    ID=4309 甘特图 [Gantt Chart] (cc_patterns_gantt) → /component-center/patterns/gantt → component_center/patterns/gantt_page
    ID=4310 高级表格 [Advanced Table] (cc_patterns_advanced_table) → /component-center/patterns/advanced-table → component_center/patterns/advanced_table_page
  ID=41  数据可视化 [Data Visualization] (cc_dataviz)
    ID=411 实时折线图 [Real-time Line Chart] → /component-center/dataviz/realtime-chart → component_center/dataviz/realtime_chart_page
    ID=412 热力日历图 [Calendar Heatmap] → /component-center/dataviz/heatmap → component_center/dataviz/heatmap_page
    ID=413 流量转化分析 [Traffic Flow] (cc_dataviz_traffic_flow) → /component-center/dataviz/traffic-flow → component_center/dataviz/traffic_flow_page
    ID=414 数据大屏 [Data Dashboard] (cc_dataviz_dashboard) → /component-center/dashboard-page → component_center/dataviz/dashboard_page
  ID=44  AI 应用 [AI Apps] (cc_ai)
    ID=441 AI 对话 [AI Chat] → /component-center/ai/chat → component_center/ai/ai_chat_page
    ID=442 AI 提示词工坊 [AI Prompt Studio] → /component-center/ai/prompt → component_center/ai/ai_prompt_page
    ID=443 AI 数据查询 [AI Data Query] → /component-center/ai/sql → component_center/ai/ai_sql_page
  ID=45  编辑器 / 低代码 [Editors / Low-code] (cc_editor)
    ID=451 富文本编辑器 [Rich Text Editor] → /component-center/editor/rich-text → component_center/editor/rich_text_page
    ID=452 代码编辑器 [Code Editor] → /component-center/editor/code → component_center/editor/code_editor_page
    ID=453 JSON 编辑器 [JSON Editor] → /component-center/editor/json → component_center/editor/json_editor_page
    ID=454 Markdown 预览 [Markdown Preview] → /component-center/editor/markdown → component_center/editor/markdown_page
  ID=46  工程 / 工具类 [Engineering Tools] (cc_devtools)
    ID=461 拖拽布局 [Drag Layout] → /component-center/devtools/drag-layout → component_center/devtools/drag_layout_page
    ID=462 虚拟滚动列表 [Virtual Scroll List] → /component-center/devtools/virtual-scroll → component_center/devtools/virtual_scroll_page
    ID=463 WebSocket 通信 [WebSocket] → /component-center/devtools/websocket → component_center/devtools/websocket_page
    ID=464 性能监控面板 [Performance Monitor] → /component-center/devtools/perf-monitor → component_center/devtools/perf_monitor_page
```

---

## Settled decisions (don't reopen)

- The project name is `castor-kit`; names are always lowercase and hyphenated, no camelCase, no Stack suffix
- Backend: Node 22 + TypeScript + Fastify 5 + Zod + Drizzle + pg + pino; no NestJS
- Frontend: React 19 + Vite + shadcn/ui + Tailwind CSS v4 + motion + lucide-react (TypeScript; UI copy in Chinese as the i18n key); UI system in `docs/frontend-design-system.md`
- `.xls` is not supported; csv / xlsx only
- Passwords are hashed with scrypt and stored as a PHC string `$scrypt$ln=15,r=8,p=3$<salt>$<hash>` (`common/password.ts`, async; the parameters are in the string, so old hashes still verify after the parameters are raised)
- Sessions: the server-side `sessions` table is the single source of truth (can be listed and force-revoked; a password change / account disable / password reset invalidates them); the `@fastify/secure-session` cookie `castor_session` only holds `{ sid, csrf_token }`, with its key derived from `SECRET_KEY` via HKDF. Always check sign-in with `isSignedIn(request)` from `common/session.ts`; never read cookie fields
- Configuration has two tiers: whatever is needed before the server starts (database URL, `SECRET_KEY`, ports, scheduler switch, etc.) goes in environment variables; everything else goes in system settings (the `common/settings.ts` registry + the `system_settings` table): feature switches, security parameters, email, file storage, upload limits, AI models, site URL. Secrets (`type: 'secret'`) are stored encrypted with `secret-box` and never echoed back; a registry entry can declare `env`, and when that environment variable is non-empty it locks the value (read-only in the UI); the variable names are also registered in `common/settings-env.ts`. When a new feature needs configuration, add a registry entry; don't add more env-only settings. Read settings with `app.settings.get()` (`peek()` on hot paths); clients such as email / storage are rebuilt from the current settings through `MailerProvider` / `StorageProvider`. Endpoints that change settings (save and test) must first pass `requireRecentAuth(request)` (signed in, or verified via `/api/admin/reauth`, within the last 10 minutes), and saving notifies every super admin; address-type settings that make the server connect out must pass the `common/outbound.ts` check on save and test (reserved addresses are always refused; private networks depend on `SETTINGS_ALLOW_PRIVATE_NETWORK`)
- Time fields never go through JS `Date`: pg types 1114/1082 stay as text; `toIso()` replaces the space with `T`, right-pads fractional seconds with 0 to 6 digits (pg's text output drops trailing zeros) and appends `Z`; database writes use `utcNow()` (`timezone('utc', now())`), and the current time generated in the app uses `utcNowIso()` (API) / `utcNowText()` (database writes)
- The cron matcher is our own, with standard 5-field semantics: when both day-of-month and day-of-week are restricted, they are ORed (as in Vixie cron)
- Request schemas are `.passthrough()` + all optional; normalization happens in the service
- The operation log is written centrally by the global `onResponse` hook, not scattered across services
- The AI assistant's tools (`modules/admin/assistant`) always call our own API via `app.inject` with the current user's cookie / CSRF, so permissions, data scope, demo-mode restrictions and the operation log are all handled by the original endpoints; don't give it tools that access the database directly or bypass the routes. Write operations must use `needsApproval` (approval requests are signed with a key derived from `SECRET_KEY`); endpoints it can't use, such as account security, system settings and import / export, are listed in `ASSISTANT_DENIED` in `catalog.ts`
- The runtime environment is set by `NODE_ENV`; in production, a missing `SECRET_KEY` / `ADMIN_PASSWORD` / `AI_SQL_DATABASE_URL` refuses to start
