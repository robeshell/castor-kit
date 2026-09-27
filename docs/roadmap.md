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
| — | [TypeScript frontend](#typescript-frontend) (JSX → TSX, layer by layer) | High | — | Done |
| — | [Component gallery redesign](#component-gallery-redesign) (reference implementations for developers and AI, one shared demo backend, component showcase) | High | — | Done |
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

## Component gallery redesign

**Goal**: the component gallery (`modules/component_center`) becomes the reference that developers and AI agents copy from: one page per page pattern and one page per shared component, all following AGENTS.md exactly. Decided with the user on 2026-09-27: the audience is developers and AI (not marketing), the per-page backends are merged into one demo module, the 3D / creative pages go, and component showcase pages are added.

**Today**: 28 pages (~14.5k lines of frontend, ~5.9k of backend). Ten page templates each carry their own table, module, migration and menu although their columns mostly overlap (name / code / category / status / owner / priority / is_active / description + a few specific ones); the shared components (`DataTable`, FormFields, uploads, import / export, charts…) have no page of their own; the creative pages have little to do with an admin framework.

**Target structure**

| Section | Pages | Backend |
|---|---|---|
| Page patterns | standard list, card list, tree list, stats list, detail with tabs, step form, dynamic form, kanban, gantt, advanced table (inline edit, batch actions) — each marked as the reference implementation of its pattern | one shared `demo_records` module |
| Components | one page per shared component (DataTable, FormFields, Filters, TreeSelect / TreeView / CheckableTree, uploads, import / export, Chart, StatCard, …): variants, props, copyable code; also the condition builder from the old list page | none (mock data) |
| AI | chat, SQL query, prompt studio | unchanged (prompt studio keeps its table) |
| Data visualization | dashboard, realtime chart, heatmap, traffic flow | unchanged |
| Editors / tools | rich text, code, JSON, Markdown, drag layout, virtual scroll, WebSocket, perf monitor | unchanged |

**Shared demo model** — one table `demo_records`: `name`, `code` (unique), `category`, `status`, `owner`, `priority`, `is_active`, `description` for every pattern; `parent_id` + `sort_order` (tree list: sibling order); `board_order` (kanban: card order within a status column, kept apart from `sort_order` so kanban drags don't reorder the tree); `amount` + `quantity` (stats list, plus a stats endpoint); `start_date` / `end_date` / `progress` (gantt); `cover` + `tags` (card list); `extra` jsonb (dynamic form fields). One module serves list with filters, tree, stats, CRUD, batch update / delete, reorder, import / export / template. Kanban columns are the fixed `status` values (dragging a card across columns changes its status); board management and WIP limits are dropped (business features, not page patterns). The old list page's saved-query builder (conditions, versions) moves to the components section with mock data.

**Steps** (one PR each)

1. Remove the 3D / creative pages, their menus (migration `0002_remove_creative_menus`) and the three.js dependency.
2. The `demo_records` module: table + migration, schema / repository / service / routes (`routeBody`), OpenAPI docs, API tests, seed / demo fixtures. **Done**: `modules/component-center/demo-record` (scaffolded from a spec, then parent_id's foreign key, `tags` / `extra` jsonb, tree / stats / batch / reorder by hand), migrations `0003_demo_record` + `0004_demo_record_board_order` (the kanban's own `board_order`, backfilled per status from the old order), API `/api/admin/component-center/demo-records`; status `todo` / `in_progress` / `done` / `archived` (kanban columns, gantt states), category `product` / `design` / `engineering` / `marketing` / `operations`; deleting a record with children is a 400 (a batch delete may take a whole subtree); `cover` is a file-center id (scaffold `image`; renamed from the roadmap's `cover_url`), so the fixtures have no covers. Permissions belong to the new 页面模板 directory (`cc_patterns`, menu 43): its buttons 431–435 guard the writes, any page under it may read (`DEMO_RECORD_VIEW_CODES` in the module's `schema.ts` — add each new page's code there). First page: 标准列表 (4301, `component_center/patterns/demo_record_page`, the scaffold output plus filters); the old pages are untouched until step 3.
3. Rebuild the page patterns on it; delete the ten old modules, their tables (migration) and menus (migration + seed-rbac), rewrite `src/demo/fixtures.ts` and the demo writable paths. **Done**: ten pages under 页面模板 (4301–4310, `component_center/patterns/*`: standard list, card list, tree list, stats list, detail, step form, dynamic form, kanban, gantt, advanced table), all on `demo_records`; the status / category / enabled options and their badge tones come from one module (`pages/patterns/demo-record-options.ts`: todo warning, in_progress info, done success, archived neutral). The nine old modules (list-page, card-list-page, tree-list-page, stats-list-page, dynamic-form-page, kanban, gantt, advanced-table, detail-tabs) are gone with their pages, API files, tests, fixtures, messages and OpenAPI paths; migration `0005_remove_old_gallery_modules` drops their twelve tables (and the saved queries' file references) and deletes the 管理系统 directory (40) with its pages 401–409 and their buttons (IDs now free). The demo writable paths needed no change (`/api/admin/component-center/*` covers `demo-records`); the dashboard's quick link and the AI chat system prompt point to the page patterns.
4. Component showcase pages. The old list page's saved-query condition builder (conditions, versions) was dropped with it in step 3 and is rebuilt here with mock data. **Done**: the 组件 (Components) directory (`cc_components`, menu 47, right after 页面模板) with eleven pages (4701–4711, `component_center/components/*`: data table, forms, filters, pickers, trees, uploads, import / export, feedback, data display, Markdown, condition builder; no buttons, mock data only), built with the showcase kit in `modules/component_center/showcase` (each example a file under `examples/`, imported as a component and with `?raw` for its exact source; props tables in `props.ts`; `test/showcase.test.tsx` checks the wiring), plus the new shared `ConditionBuilder` (`shared/components/ConditionBuilder.tsx`); documented in AGENTS.md "Component showcase pages" and the docs site's component gallery guide.
5. AGENTS.md / skills / docs site: a "page pattern → reference implementation" table, so an agent building a card list or kanban knows which page to copy; update the docs site's component gallery guide (en / zh / ja). **Done**: AGENTS.md "Page patterns (which page to copy)" (requirement → pattern → page → the `demo-record` endpoints and service / repository functions it needs, plus how to go from a scaffolded module to another pattern), linked from "Reference implementations" and the delivery process; the shadcn skill (workflow + PATTERNS.md "0. Which page to copy") and the autopilot skill (Step 2 infers the pattern, the business preview names it, Step 4 rebuilds the page after the pattern page); the docs site's gallery guide gains "Building a feature from a pattern" (en / zh / ja), llms.txt links it.

**Upgrade note**: existing deployments lose the old demo tables' rows in step 3 (demo data only); the CHANGELOG says so.

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
| 5 | Pages, module by module (auth, admin, component center); then remove `allowJs` and the JSX rules | Done: every page, `components/app`, `App` / `main`; `allowJs` removed, `test/typescript-only.test.ts` keeps `src` TypeScript-only; the tests and Vite / Vitest configs are TypeScript too (`tsconfig.test.json`) |
| 6 | Idiomatic TypeScript cleanup (changes behavior, so its own PRs): drop defensive checks the types now guarantee (`x \|\| {}`, `typeof x === 'function'`) and dead branches; remove avoidable type assertions; one export / file-naming style (default vs named exports, `useXxx.ts` vs `use-xxx.ts`) — decided: document the existing conventions (AGENTS.md "TypeScript" → Naming and exports) instead of renaming; the duplicate `use-mobile` / `useIsMobile` hook becomes one | Done: `as` casts (excluding `as const`) down from ~49 to ~11 and non-null `!` from ~81 to ~6 outside `components/ui`, each remaining one commented; duplicated reauth guards live in `useReauth.ts`; the two mobile hooks are one |

**Acceptance per step**: `pnpm verify` green including the web typecheck; pages behave the same; no new `.jsx` in a converted layer.

**Found during the migration, left for step 6** (existing behavior, kept as-is so each step stays a pure typing change):

- ~~`ImageUpload` shows `promptText` untranslated, while `FileUpload` passes it through `tx()`~~ Fixed: it goes through `tx()` too
- ~~`RowActions`' doc comment shows a `confirm: {...}` option the component never reads (left out of the `RowAction` type)~~ Fixed: the example confirms with `render` + `ConfirmAction` (as the webhooks page does)
- ~~`DataTable` keys a column by `key || dataIndex`, so a column with neither gets `undefined`; `DataPagination` divides by `perPage` without a guard~~ Fixed: the column index is the last fallback; a non-positive `perPage` shows everything as one page
- ~~`code-highlighter` checks `name in GRAMMARS` on a plain object, so inherited keys like `constructor` count as languages (the failure is caught)~~ Fixed: the grammar and alias lookups use `Object.hasOwn`
- ~~`useFormField` (shadcn upstream) checks `if (!fieldContext)`~~ Kept: upstream shadcn code, left as it is so `components/ui` stays close to upstream (docs/shadcn-changes.md)
- ~~`AuthContext` has a `data.menus` branch that the typed `my-menus` API shows is dead~~ Fixed in step 6b
- ~~Dashboard: the system status network tiles read `net_sent_mb` / `net_recv_mb`, but `GET /api/admin/component-center/devtools/perf-stats` returns `net_sent` / `net_recv` (cumulative MB since boot, labeled MB/s), so they always show 0.00; the `data && !data.error` check is dead (the interceptor rejects non-2xx)~~ Fixed: the tiles read `net_sent` / `net_recv`, labeled as totals in MB; the dead check is gone
- ~~Login logs: the failure reason column falls back to `row.fail_reason`, which the API never returns~~ Fixed: the column reads only `message`
- `normalizeFileType` on roles / menus / logs accepted `'xls'` (the backend would send CSV under a `.xls` name); the dialogs never offer it, and the typed pages drop it
- ~~Dead code the types show: `scheduled_tasks` `openEdit` handles an object `request_headers` (the API returns a string); `value = []` defaults on the non-null `scopes` / `events` columns; the `isCancelled` / `isMfaRequired` guards are duplicated across pages (could live in `useReauth.ts`)~~ Fixed in step 6b (guards exported from `useReauth.ts` as `isReauthCancelled` / `needsMfa`)
- Component center: ~~the list page's `EditorSection` shows its Chinese title / description untranslated (the locales have them)~~ Fixed: it translates them with `tx()`; ~~tree list `<Trans components=[...]>` without a `key`~~ Fixed; card list: ~~a record with `is_active: null` shows the switch off but saves `true` if left untouched, the PUT body carries `id` / timestamps~~ Fixed: the edit form is built from the form fields only, a null `is_active` / `category` shows the API's default (`true` / `general`); ~~clearing priority saves 0 while the doc says "keeps the original value"~~ The doc already says "null → 0" since #71; the priority input's placeholder now says a blank saves 0; ~~kanban sends `board_code` on update, which the API doesn't accept~~ Fixed: sent on create only, and the field is read-only when editing
- AI / editors: ~~the AI SQL schema sheet shows "no tables" instead of an error after a failed first load (and doesn't retry)~~ Fixed: an error state with a retry button, and reopening after a failure loads again; ~~the prompt page resets the form with untrimmed values after saving~~ Fixed: it resets with the saved payload; ~~the code editor's "format" says done for languages Monaco can't format (Python, SQL, Java) and its promise has no `.catch`~~ Fixed: those languages get a "not supported" notice, and a failed format shows an error
- Charts / creative (the creative pages were removed later, see "Component gallery redesign"): ~~the heatmap labels dates in UTC but finds weekends in local time (a day off before 08:00 in UTC+8)~~ Fixed: labels use the local date (`heatmap_page/calendar.ts`); ~~`toLocaleTimeString('zh-CN' / 'zh')` in the dashboard, perf monitor and WebSocket pages ignores the UI language~~ Fixed: they use `i18n.language`; ~~the particle canvas divides by a zero distance when the pointer sits exactly on a particle~~ Fixed: a zero distance isn't pushed; ~~the two Three.js pages only resize on window `resize` (not when the sidebar collapses)~~ Fixed: a `ResizeObserver` on the container (the unused `stateRef.morphT` is gone)
- ~~The OpenAPI doc is stricter than the backend in about ten request params / bodies~~ Reconciled: request bodies declare every nullish `field.*` value as nullable, list / export filters where `''` means "all" list `''`, and the pages send typed export `fields` / `file_type`; the API files use the generated types (no `// TODO(openapi)` left)
- ~~The OpenAPI doc types `user` in the `POST /api/admin/two-factor/enable` response as a free-form object~~ Fixed: documented as the signed-in user (same shape as login), and `EnableTwoFactorResult` is the generated type. Tree `children` can't be recursive inline (the API files keep local node types)

Done early (step 5 needed it): `useAuth()` / `useTagsView()` throw outside their provider and return non-null values. Every caller destructured the result, so a missing provider already threw; now the error says why.

**Why steps 1-5 don't change behavior**: each converted file is checked by stripping its types and comparing with the old JS, so a regression can only come from the types themselves. Code that is correct but not idiomatic TypeScript is kept as it was and cleaned up in step 6, where behavior changes are reviewed on their own.

**~~Follow-up: keep the OpenAPI request bodies in sync automatically~~** Done. The reconciliation (332 differences between the doc and the Zod `field.*` declarations) was a one-off comparison; now the drift can't come back:

- ~~Each route that parses a body registers its schema~~ Routes declare their body with `routeBody(schema, 'create' | 'patch' | 'array')` (`common/validation.ts`): the schema goes into the Fastify route `config`, where `collectApiRoutes` records it; all 79 body-reading routes use it, and `test/conventions.test.ts` fails on a direct `parseBody` / `parsePatch` / `parseArrayBody` in a `routes.ts`, in the backend template or in what `pnpm scaffold` generates
- ~~Compare each documented request body with the schema~~ The `body-sync` rule of `lintOpenApi` (`scripts/lib/openapi-body-sync.ts`; runs in `pnpm openapi:generate [--strict]`, verify's `openapi_sync` and `test/openapi-doc.test.ts`) checks nullability, requiredness, types and enums per property, nested `filters`, array items and `conditions` included. Export `fields[]` / `file_type` enums are the contract by design (`isExportContractEnum`); other intentional differences are in `BODY_SYNC_ALLOWLIST` (one entry per field, each with its reason; stale entries fail)
- ~~`scripts/lib/scaffold-openapi.ts` still documents export `ids` / `fields` / `file_type` as non-null~~ Aligned: nullable (the column / file-type enums stay, as the contract), and required fields without a default are non-null and listed in `required` (a required field with a default isn't); `test/scaffold.test.ts` checks generated modules against their generated schemas

Left out on purpose:

- Moving the ~20 fields the services enforce (change-password `old_password` / `new_password`, reauth / 2FA `password` / `code`, users `password` and `status`, menus sort `direction`, scheduled task `request_url`; the gantt / kanban / advanced-table entries went with those modules in the gallery redesign) into Zod's `required(...)`: it changes which layer answers the 400 and the messages tests assert; they stay in the allowlist until then
- Query parameters: the rule only covers JSON bodies declared with `routeBody` (query strings are read with `queryString` / `parseYesNo` / …, which carry no declaration)
- Defaults: a documented `default` is not compared with the Zod fallback

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
