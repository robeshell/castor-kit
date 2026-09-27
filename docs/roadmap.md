# castor-kit feature roadmap

> This document is the development plan for upcoming features: each item states its goal, scope, data model, API, UI, permissions and acceptance criteria, and development follows it.
> Status is updated as work progresses; when a plan changes, update this document first, then write code. Architecture and conventions are defined by `AGENTS.md` and `docs/architecture.md`.

## Overview

| Phase | Feature | Priority | Depends on | Status |
|---|---|---|---|---|
| 0 | User profile (nickname, email, phone, avatar, enable / disable, last login) | — | — | Done |
| 1 | Departments and data scopes (`all` / `dept_and_children` / `dept` / `self` / `custom`) | — | 0 | Done |
| 1 | File center (`local` / S3-compatible storage, deduplication, references, orphan cleanup) | — | 0 | Done |
| 2 | Account security and system settings (server-side sessions, online users, two-factor authentication, password recovery, rate limiting, password policy) | — | 0 | Done |
| 2 | Open API: API tokens and webhooks | — | — | Done |
| — | Public demo mode and Render + Neon deployment | — | — | Done |
| — | Global AI assistant (see [AI assistant](../website/guide/assistant.md)) | — | — | Done |
| — | [TypeScript frontend](#typescript-frontend) (JSX → TSX, layer by layer) | High | — | Done (step 6 cleanup open) |
| 3 | [Approval workflow](#approval-workflow) | Low | 1 | Not started |
| 3 | [Multi-tenancy](#multi-tenancy) | Low | 1, 2 | Not started |

The design and conventions of finished features are in `docs/architecture.md` (section 4 "Cross-cutting conventions") and on the docs site (`website/guide/`). Multi-tenancy touches the most code, so it comes last.

Online visual modeling (a low-code platform) is not planned: castor-kit's direction is to have AI agents generate feature code, and the entry point is `pnpm scaffold -- --spec` (the agent writes the inferred spec as JSON and then generates from it, getting Chinese labels, required / unique / default values, fixed options, data dictionaries and the menu right in one go). Ongoing investment goes into making generated features more accurate across different AI agents (the spec's JSON Schema and examples, OpenAPI rule checks, MCP tools).

## General delivery requirements

Each item ships as its own PR and meets these requirements:

- The backend follows the layering rules (`db/schema` → `schema` → `repository` → `service` → `routes`); migrations are actually applied and checked with `psql \d`
- New menus and button permissions go into `apps/api/scripts/seed-rbac.ts` (pick IDs that are actually free, following `AGENTS.md` "Menu ID allocation"), synced with `pnpm seed:rbac -- --incremental`
- UI copy is written as `t('中文原文')` (the Chinese source text is the i18n key), with complete en-US / ja-JP translations; new backend errors are registered in `apps/api/src/i18n/messages.ts`; code comments are in English
- New endpoints have API tests and shared frontend components have unit tests; `pnpm verify` is all green
- The same PR updates the docs in all three languages (`website/`) and the `[Unreleased]` section of `CHANGELOG.md`; if new environment variables are involved, update `apps/api/.env.example` and the configuration docs too
- Existing deployments upgrade smoothly: new columns get a default value or are nullable, and existing data is not broken

---

## TypeScript frontend

**Goal**: `apps/web` in TypeScript / TSX like the API and MCP server, so the `verify` gate catches wrong props and field names in AI-written frontend code, and the frontend matches what React / shadcn users expect.

**Why bottom-up**: with `allowJs`, a `.tsx` file that imports a `.jsx` component gets that component's props inferred as required `any`, so a layer can only move once the layers it imports have moved.

| Step | Scope | Status |
|---|---|---|
| 1 | Toolchain: `tsconfig.json` (strict, `allowJs`), web typecheck in `pnpm typecheck` / `verify`, web lint in `pnpm lint`, typescript-eslint; page routing, i18n scanner, import check and `shadcn-add.sh` accept `.ts` / `.tsx`; component layer boundaries test; first files (`lib/utils`, `PageHeader`, `StatusBadge`, `shared/api/types`, the sessions API) | Done |
| 2 | `components/ui` and AI Elements as TSX (`components.json` `tsx: true`), keeping the project's changes; `lib`, `i18n`, hooks, context | Done: typed in place against the upstream TSX (type-stripped output identical to the old JSX); changes from upstream listed in `docs/shadcn-changes.md` |
| 3 | `shared/components` and the module API files; API types generated from `docs/apifox-full.openapi.json` (`src/shared/api/openapi.d.ts`, helpers `ApiItem` / `ApiResponse` / `ApiQuery` / `ApiBody`); fixed the doc where the types showed it disagreed with the backend | Done |
| 4 | Scaffold: generated pages and API files, `docs/templates/frontend`, skills and AGENTS.md describe TSX | Done: `pnpm scaffold` writes `api/<name>.ts` (row / body types from the module's OpenAPI entries) and `index.tsx` (`FormValues` per field, `DataTableColumn<Row>[]`, no `any` or casts) and regenerates `openapi.d.ts` after writing the doc; the scaffold tests type-check the generated files with apps/web's tsc |
| 5 | Pages, module by module (auth, admin, component center); then remove `allowJs` and the JSX rules | Done: every page, `components/app`, `App` / `main`; `allowJs` removed, `test/typescript-only.test.js` keeps `src` TypeScript-only |
| 6 | Idiomatic TypeScript cleanup (changes behavior, so its own PRs): drop defensive checks the types now guarantee (`x \|\| {}`, `typeof x === 'function'`) and dead branches; remove avoidable type assertions; one export / file-naming style (default vs named exports, `useXxx.ts` vs `use-xxx.ts`) | Not started |

**Acceptance per step**: `pnpm verify` green including the web typecheck; pages behave the same; no new `.jsx` in a converted layer.

**Found during the migration, left for step 6** (existing behavior, kept as-is so each step stays a pure typing change):

- `ImageUpload` shows `promptText` untranslated, while `FileUpload` passes it through `tx()`
- `RowActions`' doc comment shows a `confirm: {...}` option the component never reads (left out of the `RowAction` type)
- `DataTable` keys a column by `key || dataIndex`, so a column with neither gets `undefined`; `DataPagination` divides by `perPage` without a guard
- `code-highlighter` checks `name in GRAMMARS` on a plain object, so inherited keys like `constructor` count as languages (the failure is caught)
- `useFormField` (shadcn upstream) checks `if (!fieldContext)`, which never fires because the context default is `{}`
- `AuthContext` has a `data.menus` branch that the typed `my-menus` API shows is dead
- Dashboard: the system status network tiles read `net_sent_mb` / `net_recv_mb`, but `GET /api/admin/component-center/devtools/perf-stats` returns `net_sent` / `net_recv` (cumulative MB since boot, labeled MB/s), so they always show 0.00; the `data && !data.error` check is dead (the interceptor rejects non-2xx)
- Login logs: the failure reason column falls back to `row.fail_reason`, which the API never returns
- `normalizeFileType` on roles / menus / logs accepted `'xls'` (the backend would send CSV under a `.xls` name); the dialogs never offer it, and the typed pages drop it
- Dead code the types show: `scheduled_tasks` `openEdit` handles an object `request_headers` (the API returns a string); `value = []` defaults on the non-null `scopes` / `events` columns; the `isCancelled` / `isMfaRequired` guards are duplicated across pages (could live in `useReauth.ts`)
- Component center: the list page's `EditorSection` shows its Chinese title / description untranslated (the locales have them); tree list `<Trans components=[...]>` without a `key`; card list: a record with `is_active: null` shows the switch off but saves `true` if left untouched, the PUT body carries `id` / timestamps, clearing priority saves 0 while the doc says "keeps the original value"; kanban sends `board_code` on update, which the API doesn't accept
- AI / editors: the AI SQL schema sheet shows "no tables" instead of an error after a failed first load (and doesn't retry); the prompt page resets the form with untrimmed values after saving; the code editor's "format" says done for languages Monaco can't format (Python, SQL, Java) and its promise has no `.catch`
- Charts / creative: the heatmap labels dates in UTC but finds weekends in local time (a day off before 08:00 in UTC+8); `toLocaleTimeString('zh-CN' / 'zh')` in the dashboard, perf monitor and WebSocket pages ignores the UI language; the particle canvas divides by a zero distance when the pointer sits exactly on a particle; the two Three.js pages only resize on window `resize` (not when the sidebar collapses)
- ~~The OpenAPI doc is stricter than the backend in about ten request params / bodies~~ Reconciled: request bodies declare every nullish `field.*` value as nullable, list / export filters where `''` means "all" list `''`, and the pages send typed export `fields` / `file_type`; the API files use the generated types (no `// TODO(openapi)` left)
- The OpenAPI doc types `user` in the `POST /api/admin/two-factor/enable` response as a free-form object, and tree `children` can't be recursive inline (the API files keep local node types)

Done early (step 5 needed it): `useAuth()` / `useTagsView()` throw outside their provider and return non-null values. Every caller destructured the result, so a missing provider already threw; now the error says why.

**Why steps 1-5 don't change behavior**: each converted file is checked by stripping its types and comparing with the old JS, so a regression can only come from the types themselves. Code that is correct but not idiomatic TypeScript is kept as it was and cleaned up in step 6, where behavior changes are reviewed on their own.

**Follow-up: keep the OpenAPI request bodies in sync automatically.** The reconciliation (332 differences between the doc and the Zod `field.*` declarations) was a one-off comparison. To stop the drift coming back:

1. Each route that parses a body registers its schema (a `BODY_SCHEMAS` list per module, or a `parseBody` wrapper that records the schema while `collectApiRoutes` builds the app); fail when a body-reading route has no entry.
2. `test/openapi-doc.test.ts` and verify's `openapi_sync` compare each documented request body with `z.toJSONSchema(schema, { io: 'input' })` plus real `safeParse` probes for null / missing / `''` (preprocess wrappers make the JSON Schema alone misleading), against an allowlist of intentional differences, each with its reason.
3. Move the 18 fields the services enforce (e.g. change-password `old_password`, scheduled task `request_url`, gantt dates) into `required(...)` in Zod, so the allowlist shrinks to the export `fields[]` / `file_type` enums.
4. `scripts/lib/scaffold-openapi.ts` still documents export `ids` / `fields` / `file_type` as non-null; align it.

---

## Approval workflow

**Scope (first version)**

- Workflow definition: nodes are start, approval (a named user / role / department head / head of the initiator's parent department), conditional branch (on form fields), and end; parallel countersigning is not in the first version
- `workflow_definitions` (versioned), `workflow_instances`, `workflow_tasks`, `workflow_histories`
- Designer: canvas-based node editing (a component like React Flow could be used; evaluate its bundle size before adding it)
- "My to-dos / My completed / Started by me" pages; approve, reject, reassign, withdraw
- Integrating business modules: a module declares that it can start an approval, stores `workflow_instance_id`, and the approval result is written back to the business status
- Notifications: reuse the notification module and notify the approver when a to-do arrives

**Acceptance**: one sample business process (e.g. a leave or purchase request) goes all the way through start → conditional branch → approval → result written back; the history is traceable.

---

## Multi-tenancy

**Goal**: make castor-kit usable as a SaaS foundation, with one deployment serving multiple tenants whose data is isolated from each other.

**Key points of the design**

- A `tenants` table; all business tables plus users, roles, departments, files, etc. get a `tenant_id`
- Tenant resolution: subdomain or request header, determined at login and stored in the session
- Isolation: PostgreSQL row-level security (RLS) as the safety net, while the application layer also adds a `tenant_id` condition; the super admin splits into a platform admin and tenant admins
- Menus and features are switched per tenant plan; file storage uses a directory / prefix per tenant
- Scaffold and `verify`: new tables get `tenant_id` by default, and the gate checks that queries include the tenant condition

**Risk**: it touches almost every table and query, and has the highest data migration cost; it needs its own data migration and rollback plan, and should start only after features such as the approval workflow are stable.

**Acceptance**: the data, users and files of two tenants are completely isolated; any cross-tenant access returns 404; single-tenant deployments are unaffected (default tenant).
