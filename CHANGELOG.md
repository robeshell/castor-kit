# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The docs site moves to https://castor.wenworks.dev (links to `robeshell.github.io/castorjs/…` redirect there) and the public demo to https://castor.wenworks.app (the old `castor-kit-demo.onrender.com` address keeps working).
- The wordmark is written "Castor", the way the name is written in text, in the app, the docs site and the README (it was a lowercase "castor" in 0.4.0).

## [0.4.0] - 2026-09-28

castor-kit is now **Castor**: a professional name that keeps the beaver. The repository is `robeshell/castorjs`, the packages are `@castorjs/*` and the docs live at https://robeshell.github.io/castorjs/. Nothing changes for running installs: databases, cookies, stored secrets and the webhook contract are untouched.

### Changed

- **castor-kit is now Castor.** The product name is Castor (the beaver keeps its place in the logo); the repository is `robeshell/castorjs`, the packages are `@castorjs/api` / `@castorjs/web` / `@castorjs/mcp` (so `pnpm --filter @castorjs/…`), the docs site moves to `https://robeshell.github.io/castorjs/`, the MCP server is named `castor` and its binary `castor-mcp`, and `APP_NAME` defaults to `Castor` (authenticator apps list new enrollments under Castor). The wordmark is "castor" in the app, the docs site and the README.
- Kept on purpose, so existing installs keep working: database, user and volume names (`castor_kit`, `castor_kit_test`, `castor_kit_ro`, `castor-kit_postgres_data` / `castor-kit_app_data`), the session cookie and the key-derivation labels (`castor-kit-session`, `castor-kit-secret-box`, `castor-kit-assistant-approval`), the webhook headers `X-Castor-*` and User-Agents (`castor-kit-webhook`, `castor-kit-scheduler`, `castor-kit-assistant`), the browser storage keys and the public demo's address.
- Upgrading: `git fetch` / `git merge` from the old URL keeps working (GitHub redirects renamed repositories), but point `upstream` at `https://github.com/robeshell/castorjs.git`; replace `@castor-kit/` with `@castorjs/` in your own scripts, CI and MCP client configs.

## [0.3.0] - 2026-09-28

Reference implementations and a checked interface: the component gallery is rebuilt as the pages developers and AI agents copy from, a whole-app interface audit is fixed (accessibility, color, layout, copy), and a project can now start from a release with its own name and the gallery hidden.

### Highlights

- **A gallery to copy from.** Ten page patterns (standard / card / tree / stats list, detail, step form, dynamic form, kanban, gantt, advanced table) on one shared demo backend, eleven component showcase pages (live examples with their exact source and key props) and the new `ConditionBuilder`; AGENTS.md, the skills and the docs site say which page to copy for a requirement.
- **Interface audit fixed.** Visible focus everywhere (including Windows high contrast), names and keyboard paths for every control, reduced motion honored, route titles and landmarks, text alternatives for all charts, measured color tokens (234 text / focus pairs across 6 accents × light / dark, none below threshold), pinned row actions, full text for truncated values, errors that say how to recover; axe reports no serious or critical issue on any page.
- **Ready for your own project.** A [Starting a project](https://robeshell.github.io/castor-kit/guide/new-project) guide (repository from a release tag, naming, going live, taking later releases including migrations), `APP_NAME` to name the product, and a gallery that nothing else depends on and one line hides.
- **The AI workflow, dogfooded.** Building a module end to end with `/new-feature-autopilot` fixed two dozen rough edges in `pnpm scaffold`, `pnpm verify`, `pnpm db:migrate`, `seed:rbac` and the docs.

### Upgrading from 0.2.0

- `pnpm db:migrate` (Docker: on start). `0003` / `0004` add `demo_records`; `0005` drops the twelve tables of the old gallery pages (demo data only) and deletes their menus (40, 401–409).
- `pnpm seed:rbac -- --incremental` (Docker: on start) adds the 页面模板 (43, 4301–4310) and 组件 (47, 4701–4711) menus and renames the `_add` buttons 新增… → 新建….
- Color tokens (`apps/web/src/index.css`): the light status text steps, `--muted-foreground` and `--destructive` (now the danger red) changed, and each accent preset gained `--brand-primary` (text, links, focus; `--primary` / `--ring` use it), `--brand-strong-from/to` (gradients under white text) and `--primary-hover`. A project with its own presets defines those too.
- Focus: controls use `focus-visible:outline-*` with `--ring`, and `test/focus-ring.test.ts` now rejects a bare `outline-none` and translucent focus rings in your own components as well.
- `Chart` requires a `summary` (its accessible name); `DataTable` gained `pin: 'end'` for actions columns, `primary`, `isRowActive`, `filtered` / `onClearFilters` and new empty states; `FilterSelect` / `SearchInput` take a `label`.
- The dashboard's system status reads `GET /api/admin/dashboard/system`; `pnpm scaffold --domain component_center` modules use `/api/admin/component-center/<name>s` and register under 页面模板.

### Added

- **Shared demo data for the component gallery's page patterns** (`docs/roadmap.md` "Component gallery redesign", step 2): table `demo_records` (migrations `0003_demo_record`, `0004_demo_record_board_order`) and the API `/api/admin/component-center/demo-records` — list with filters (search, category, status, owner, enabled, parent / `root`, start-date range) and sorting (`sort_field` + `sort_dir`), `tree`, `stats` (count, amount / quantity sums, counts per status and category, same filters), CRUD, `batch-update`, `batch-delete`, `reorder` (each entry changes only what it carries: `board_order` + status for kanban moves, `sort_order` + parent for tree drags, so the two orders never disturb each other; cycle-checked), import / export / template. A record with children can't be deleted (400); a batch delete may take a parent together with all of its children. Demo fixtures: a three-level project tree of 24 rows.
- **组件示例中心 → 页面模板 (Page patterns)** directory (menu 43, `cc_patterns`) with its first page, **标准列表 (Standard list)** (menu 4301, `/component-center/patterns/standard-list`): the scaffold-generated list page on the shared API, the reference implementation of the standard list pattern. The API's buttons (`cc_patterns_add` / `_edit` / `_delete` / `_export` / `_import`, menus 431–435) belong to the directory, and any page under it may read. Run `pnpm db:migrate && pnpm seed:rbac -- --incremental` after upgrading.
- **The other nine page patterns** under 页面模板 (menus 4302–4310, `component_center/patterns/*`), each the reference implementation of its pattern on the shared demo API: 卡片列表 (card list: card grid, cover upload, tags), 树形列表 (tree list: drag to reorder / reparent), 统计列表 (stats list: stat cards and status bar from `stats`), 详情页 (detail with tabs, the record id in the URL), 分步表单 (step form), 动态表单 (dynamic form: extra fields in `extra`), 看板 (kanban: status columns, drag across columns), 甘特图 (gantt: start / end dates and progress), 高级表格 (advanced table: inline edit, batch update / delete). Their status / category / enabled options and badge tones come from one module (`pages/patterns/demo-record-options.ts`; status tones: 待办 warning, 进行中 info, 已完成 success, 已归档 neutral).
- **组件示例中心 → 组件 (Components)** directory (menu 47, `cc_components`, right after 页面模板) with **11 pages** (4701–4711, `/component-center/components/<slug>`, `component_center/components/*`): one page per group of shared components (`apps/web/src/shared/components`), the usage reference for developers and AI agents — live examples, each example's exact source (syntax-highlighted, copyable) and the key props. 数据表格 (DataTable, RowActions, ConfirmAction), 表单 (FormFields, FormGrid, FormDialog, FormSheet, DetailSheet / DescriptionList), 筛选 (FilterBar, SearchInput, FilterSelect, SegmentedTabs), 选择器 (MultiSelect, TagInput, DatePicker / DateTimePicker, TreeSelect), 树 (TreeView, CheckableTree), 上传 (FileUpload, ImageUpload, AvatarUpload, FileIdUpload, to the real file center), 导入导出 (ImportDialog, ExportDialog on mock handlers), 反馈 (StatusBadge, EmptyState, ConfirmAction, toast, Skeleton), 数据展示 (StatCard with CountUp / Sparkline, Chart, Panel, PageHeader, UserAvatar), Markdown (MarkdownView), 条件构建器 (ConditionBuilder); no buttons, mock data only. The pages share a small showcase kit (`modules/component_center/showcase`: `ShowcasePage`, `ShowcaseSection`, `Example`, `PropsTable`, `CodeBlock`); each example is its own file imported twice, as a component and with Vite `?raw` for the source shown, so the two can't drift (`test/showcase.test.tsx` checks every example file is wired both ways); props tables are hand-written per page in `props.ts`. The code highlighting reuses the AI Elements Shiki setup (`tokensFor`, now exported) and loads on demand. How to add one: AGENTS.md "Component showcase pages"; overview on the docs site's component gallery guide. Run `pnpm seed:rbac -- --incremental` after upgrading.
- **`ConditionBuilder`** shared component (`apps/web/src/shared/components/ConditionBuilder.tsx`), replacing the old list page's saved-query condition builder: conditions (field / operator / value, operators and value editor by field type — text, number, date, select, boolean) combined with AND / OR, plus one level of condition groups (`allowGroups`); controlled (`value` / `onChange`), typed over the field keys (`ConditionBuilder<K>`), and its value `ConditionTree` is plain JSON to save or send to an API — saving, API parameters or client-side filtering stay with the page.
- **Which page to copy**: AGENTS.md "Page patterns (which page to copy)" maps a requirement (cards, tree, stats, detail, steps, dynamic fields, kanban, gantt, batch editing) to its gallery page and the backend pieces it needs; the shadcn and autopilot skills and the docs site's gallery guide ("Building a feature from a pattern", en / zh / ja) point to it.
- **Starting a project** guide (docs site, en / zh / ja): create a repository from a release tag with castor-kit as `upstream`, name the product, hide the component gallery (one line in `seed-rbac.ts`; the code stays as the AI reference), go live, and take later releases, including how to merge when both sides added migrations (tried end to end on a scratch copy).
- **`APP_NAME`** (server) and `APP_NAME` in `apps/web/src/lib/brand.ts` (web) name the product in one place each: authenticator apps, the default mail sender and test mail, the AI assistant's introduction, logs; tab titles, the sidebar wordmark, the sign-in footer, the recovery-code file name.

### Removed

- **The old gallery pages** (组件示例中心 → 管理系统 / Admin pages: list page with saved queries and the condition builder, stats list, card list, tree list, dynamic form, kanban board, detail tabs, gantt, advanced table), replaced by the page patterns: their backend modules (`/api/admin/component-center/{list-page,stats-list-page,card-list-page,tree-list-page,dynamic-form-page,kanban,detail-tabs,gantt,advanced-table}`), pages, API files, tests, demo fixtures, messages and OpenAPI paths. Migration `0005_remove_old_gallery_modules` drops their tables (`saved_queries`, `saved_query_versions`, `stats_items`, `card_items`, `tree_nodes`, `dynamic_form_records`, `dynamic_form_fields`, `kanban_boards`, `kanban_cards`, `detail_members`, `gantt_tasks`, `advanced_table_rows`) and deletes the 管理系统 menu directory (40) with its pages (401–409), their buttons and role grants. The saved-query condition builder comes back as a component showcase page (roadmap step 4). The dashboard's gallery quick link now opens the page patterns. **Upgrading**: `pnpm db:migrate` deletes the rows of those tables — demo data only; nothing else reads them.

- The component gallery's 3D / creative pages (particle network, CSS 3D cards, Three.js globe, particle morphing) and the `three` dependency: the gallery is being reshaped into reference implementations for developers and AI (`docs/roadmap.md` "Component gallery redesign"). Migration `0002_remove_creative_menus` deletes their menus and role grants on existing databases.
- `pnpm verify` no longer accepts a `.jsx` page or `.js` API file (the frontend is TypeScript only); AGENTS.md / CLAUDE.md name the page glob as `index.tsx`.

### Fixed

- **Interface audit** (2026-09-28, all 52 pages; #84–#89): visible focus outlines on every control (a 1.3:1 translucent ring before) that survive Windows high contrast; reduced motion for `motion/react` (`MotionConfig reducedMotion="user"`); per-route document titles, `<main>` focus on navigation, `nav` landmarks and a skip link; accessible names for filters, pickers, tree / table rows and settings fields; keyboard paths for trees (APG tree), table row clicks, tag close, clear buttons, the drag layout and kanban cards (localized dnd-kit announcements); chart text alternatives (`summary` + ECharts aria / decals); focus return after dialogs; sign-in errors linked to their fields; error toasts that stay until dismissed; translated names for close / sidebar / loading / toasts / date picker; measured color tokens (status text, muted text, one red, accent split, hue separation, fixed chart palette); pinned actions columns and full text for truncated values; actionable network and validation errors; no clipping at 320px; 16px inputs on iOS; one create verb (新建) and clearer empty states.
- `pnpm scaffold --domain component_center` writes the page to `pages/patterns/<name>_page/` (menu component `component_center/patterns/<name>_page`), next to the gallery's page patterns, instead of the removed `pages/admin/` group.
- Pages that update on their own can be paused: the perf monitor (every second) and the dashboard's system status (every 3 s); the step form moves focus to each step's heading and to the first invalid field; the advanced table's inline edit focuses the name input, saves on Enter, cancels on Escape and returns focus to the row's Edit button.
- `pnpm scaffold --domain component_center`: the API lives under the gallery prefix (`/api/admin/component-center/<name>s`, writable in demo mode like the other gallery APIs), and a spec `menu` registers the page under 组件示例中心 → 页面模板 (IDs 4301–4399, path `/component-center/patterns/<name>`) instead of 业务管理.
- The dashboard's system status only worked for users holding the gallery's performance-monitor permission (it polled `/api/admin/component-center/devtools/perf-stats`); it now reads `GET /api/admin/dashboard/system` (login only). The gallery is no longer needed by the rest of the app: the chat helpers the AI assistant shares moved to `common/ai-chat.ts`, the system metrics to `common/system-stats.ts`, the business-table rule of the read-only role (used by `setup-once` / `init-ro-role`) to `common/sql-visibility.ts`, and the dashboard shows its gallery shortcuts, "Ask AI" and "Audit logs" only when those pages are in the user's menus. Page prefetching matches the page patterns again (it still named the removed `component_center/admin` group), and the AI chat's system prompt lists the current 36 gallery pages.
- The public demo's notification fixtures no longer include two leftover test rows ("test", "csrf ok").

Found by building a module end to end with `/new-feature-autopilot` (friction log in #79):

- `pnpm scaffold`: each enum field gets a list filter (`FilterSelect` on the page, an exact-match query parameter on the list route, documented with the option values, checked in the generated API test); the backend templates show where the list page template's `status` filter is read. Enum columns are `StatusBadge`s, coloured by an optional `tone` per spec option; list columns keep short values on one line and give free text a minimum width, so narrow screens scroll the table instead of squeezing a column to one character (and ellipsis columns no longer collapse); webhook events are described with the module title ("设备台账已新增") and translated in the module's page locales; downloads are saved under the names the server gives them. `--validate-only` and `--dry-run` name the menu ID and path, `--dry-run` reports the same writes as a real run and ends with "nothing was written", the field list is printed in the `--fields` syntax, and a spec translation that loses to an existing one gets a `[note]`.
- `pnpm scaffold`: a spec with a required number / option field and no default (e.g. `docs/examples/specs/expense.json`) generated a page that failed `tsc` (the empty form value is `null`, the create body isn't nullable); the page now narrows those fields in a generated `toBody()` before submitting. Its `--fields` next steps and AGENTS.md "Changing menus" mention the menu names in `apps/web/src/locales/menus/`, which the web i18n test requires.
- `pnpm verify` prints each check's detail (the `migrated to <tag>` line for the delivery report), counts skipped checks as skipped, and no longer says "ready to deliver" when `--skip-*` flags skipped checks (`complete` in `--json`).
- `pnpm db:migrate` prints in English how many migrations it applied and which one the database is at; `pnpm seed:rbac -- --incremental` lists only menus that changed.
- The tests read `TEST_DATABASE_URL` from `apps/api/.env.test` as well as the shell, and the Vite dev proxy takes `API_PORT`, so a second checkout can run beside the first with its own databases and ports.
- AGENTS.md, CLAUDE.md and the autopilot skill lead with the spec flow (`--spec` → `--validate-only` → generate), no longer describe request schemas as `.passthrough()`, and explain a checkout without `apps/api/.env.development`.

## [0.2.0] - 2026-09-27

English first and TypeScript throughout: the specs, docs and tools speak English, the admin frontend is TypeScript end to end, and the OpenAPI doc is kept in sync with the backend by a check instead of by hand.

### Highlights

- **English first.** `AGENTS.md`, `CLAUDE.md`, `docs/`, the skills, the MCP tool descriptions and every developer tool (`pnpm verify`, `pnpm scaffold`, `pnpm openapi:generate`, the setup wizard) are in English; the docs site defaults to English (Chinese at `/zh/`, Japanese at `/ja/`); English is the fallback UI / API language.
- **TypeScript frontend.** `apps/web` (source, tests and configs) is TypeScript with the same strict settings as the API, checked by `pnpm typecheck` and the `verify` gate; `pnpm scaffold` generates typed TSX pages and TS API files.
- **API types from the OpenAPI doc.** The frontend's API types are generated from `docs/apifox-full.openapi.json`, and a new `body-sync` rule keeps every documented request body in line with the backend's Zod declarations.

### Added

- `routeBody(schema, 'create' | 'patch' | 'array')` (`@/common/validation`): a route declares its JSON body once — `.route` goes into the route options (Fastify route `config`, so nothing runs before the login and permission checks), `.parse(request)` validates after the permission check. All 79 body-reading routes, the backend template and `pnpm scaffold` use it; `test/conventions.test.ts` rejects a direct `parseBody` / `parsePatch` / `parseArrayBody` in a `routes.ts`.
- `body-sync` OpenAPI rule (`apps/api/scripts/lib/openapi-body-sync.ts`): compares each documented JSON request body with the route's declaration — nullability, requiredness, types and enums per property, nested objects and array items included — wherever the doc rules run (`pnpm openapi:generate --strict`, verify's `openapi_sync`, `test/openapi-doc.test.ts`). Export `fields[]` / `file_type` enums are the contract by design; other intentional differences live in `BODY_SYNC_ALLOWLIST` with a reason each, and a stale entry fails.
- Generated frontend API types: `apps/web/src/shared/api/openapi.d.ts` (by `apps/web/scripts/api-types.mjs`) with `ApiItem` / `ApiResponse` / `ApiQuery` / `ApiBody` helpers in `@/shared/api/types`; `pnpm openapi:generate` regenerates it and `test/api-types.test.ts` fails when it is stale.
- **Traffic flow** in the component gallery (`/component-center/dataviz/traffic-flow`, permission `cc_dataviz_traffic_flow`): a Sankey diagram of visits (source → landing page → outcome) and a conversion funnel, replacing the map heatmap. Migration `0001_traffic_flow_menu` renames the existing menu in place, so role grants carry over.
- `docs/shadcn-changes.md`: every project change to an upstream shadcn / AI Elements component, to re-apply after re-adding one.
- Component layer boundaries enforced by a test: shadcn primitives import only primitives; shared components get data through props instead of calling the API or reading app context.

### Changed

- **Frontend in TypeScript** (plan and details in `docs/roadmap.md` "TypeScript frontend"):
  - `apps/web/tsconfig.json` is strict (same options as the API: `noUncheckedIndexedAccess`, `verbatimModuleSyntax`); `src` is TypeScript only (`test/typescript-only.test.ts`), and tests and the Vite / Vitest configs are checked by `tsconfig.test.json`. `pnpm lint` lints the web app too.
  - Everything is typed: shadcn primitives (`components.json` `tsx: true`), shared components (`DataTable<Row>` with typed columns, FormFields / FormDialog over react-hook-form, generic trees and selects, `Chart` over echarts' `EChartsOption`), contexts (`useAuth()` / `useTagsView()` return non-null values), hooks (`useCrudList<Row>`), every module API file and every page.
  - `pnpm scaffold` writes `api/<name>.ts` typed from the module's OpenAPI entries and a list page `index.tsx` with `FormValues` and `DataTableColumn<Row>[]`, so a form that doesn't match the documented body fails `tsc`; it regenerates `openapi.d.ts` itself. `docs/templates/frontend/` is TSX.
  - Idiomatic cleanup: casts and non-null assertions replaced by narrowing, type guards and precise generics (the few left are commented); naming and export conventions documented in AGENTS.md "TypeScript".
- **English first:**
  - Developer specs, skills and MCP tool descriptions in English; UI copy is still Chinese source text as the i18n key (`t('中文原文')`) with English and Japanese translations.
  - English is the fallback: the UI uses it when neither a saved choice nor the browser language matches; the API answers in English when a request has no supported `Accept-Language` (curl, API-token clients). Page title and `<html lang>` are English.
  - Tool output in English (`pnpm verify`, `pnpm scaffold` incl. spec validation and `docs/spec.schema.json` hints, `pnpm openapi:generate`, `pnpm seed:rbac`, setup / seed scripts, `scripts/setup.sh`). Generated code keeps Chinese UI copy as the i18n key, and generated OpenAPI text stays Chinese.
  - Docs site: English at the root (`/guide/…`), Chinese at `/zh/`, Japanese at `/ja/`; old `/en/…` links redirect.
- **Repository root tidied:** the Docker setup wizard is `bash scripts/setup.sh` (entry point `scripts/docker-entrypoint.sh`); `README.zh-CN.md`; `.env.production.example`; `llms.txt` served at `/llms.txt`; one shared `AGENTS.md` (+ `CLAUDE.md`) instead of per-tool rule copies.
- **Faster first page opens:** ECharts registered on demand (chart pages load about 40% less code); sign-in, reset-password and profile pages lazy-loaded (first download about a fifth smaller); page code prefetched on menu hover / focus and, for light pages, while the browser is idle (skipped in data-saver mode).
- Scaffolded modules document export `ids` / `fields` / `file_type` as nullable, and only required fields without a default are non-null and listed in `required`.

### Fixed

- OpenAPI request side matches the backend: 332 differences between documented request bodies and the Zod `field.*` declarations fixed (nullable fields with their defaults, `''` = "all" filters, `export_mode: all`, validated enums on announcements / menus, required webhook fields, descriptions that promised lenient parsing where the API returns 400).
- Dashboard network tiles always showed 0.00 (they read fields the API doesn't return); they now show cumulative traffic since boot with a readable unit.
- Card list: a card with no `is_active` value showed the switch off but was saved as enabled; edits sent `id` / timestamps along with the form.
- Heatmap dates were a day off before 08:00 in UTC+8; times on the dashboard, perf monitor and WebSocket pages ignored the UI language; the code editor reported success for languages it can't format; the AI SQL schema sheet showed "no tables" after a failed load; the prompt studio kept untrimmed values after saving; kanban sent `board_code` on update; untranslated list-page section titles and image-upload hint; Three.js pages didn't resize with their container; smaller fixes in `DataTable` keys, zero page size, the particle canvas and the code highlighter.
- Tags view: even spacing between tabs (the close button on inactive tabs no longer leaves an invisible gap).

### Upgrading from 0.1.0

- Run `pnpm db:migrate` (migration `0001_traffic_flow_menu`) and `pnpm seed:rbac -- --incremental`.
- Frontend pages must be `index.tsx`: page routing no longer finds `index.jsx`, and `apps/web/src` accepts no `.js` / `.jsx` files. Convert custom pages and components to TypeScript (see AGENTS.md "TypeScript" and `docs/templates/frontend/`).
- Backend routes read JSON bodies through `routeBody(...)` instead of calling `parseBody` / `parsePatch` / `parseArrayBody` directly (enforced by `test/conventions.test.ts`), and `pnpm openapi:generate -- --strict` now also checks request bodies against the Zod declarations.
- API clients that send no `Accept-Language` now get English messages; send `Accept-Language: zh-CN` for Chinese.
- Docs site links: English pages moved from `/en/…` to the root (old links redirect), Chinese pages from the root to `/zh/…`.
- Moved at the repo root: `setup.sh` → `scripts/setup.sh`, `docker-entrypoint.sh` → `scripts/docker-entrypoint.sh`, `README_CN.md` → `README.zh-CN.md`, the production env reference `.env.example` → `.env.production.example` (local development still uses `apps/api/.env.example`).

## [0.1.0] - 2026-09-27

First public release: an AI-first admin framework on Node.js + TypeScript (Fastify 5, Zod, Drizzle ORM, PostgreSQL) and React 19 (shadcn/ui, Tailwind CSS v4, Motion).

### AI-driven development

- `pnpm scaffold` generates a complete module from a field list or a JSON spec (`--spec`): table, migration, request-body declaration, repository / service / routes, OpenAPI entries, API tests (including field rules), the list page with form, import and export, menu and button permissions, and translations. Specs are checked against `docs/spec.schema.json` (`--validate-only`); `docs/examples/specs/` shows how requirements become specs.
- `pnpm verify -- --module <name>` gates a feature: files, registration, migrations applied, OpenAPI in sync, permission checks, data scope, frontend conventions, and the API and web tests.
- An MCP server (`apps/mcp`) exposes scaffolding, spec validation, RBAC sync and OpenAPI checks to AI agents; `AGENTS.md`, `CLAUDE.md` and skills describe the conventions they follow.
- The OpenAPI document (`docs/apifox-full.openapi.json`) is written alongside the code and linted in CI (`pnpm openapi:generate -- --strict`); it can be pushed to Apifox.

### Platform

- RBAC with menus and button permissions (`seed-rbac.ts` as the single source of truth), a protected super admin role, departments and per-role data scope (all, own department and below, own department, own data, custom departments).
- Users with profiles, status, avatars and import / export; roles, menus, data dictionary, announcements, notifications, login and operation logs, scheduled HTTP tasks (cron, with SSRF checks), and a file center (local or S3-compatible storage, type and signature checks, reference tracking).
- Account security: server-side sessions with an online-users page, two-step verification (authenticator app, recovery codes, required per role), password reset by email, password rules, rate limits and sign-in lockout. Passwords are hashed with scrypt.
- System settings as the configuration center: security, mail, file storage and AI, applied without a restart; secrets stored encrypted; changes need a recent identity check and notify super admins.
- Open API: personal API tokens limited to chosen permissions, and signed webhooks with retries and a delivery log.
- Request bodies are declared with Zod (`common/validation.ts`) and take JSON types only; input problems are 4xx with readable messages. Times in the API are ISO 8601 in UTC; the web app shows them, and exported files and the dashboard use, the caller's time zone (`X-Time-Zone`).
- Interface and API messages in Chinese, English and Japanese.

### AI features

- AI chat, AI data query (read-only SQL on a restricted role) and a prompt workshop, on the Vercel AI SDK with OpenAI-compatible, OpenAI, Anthropic and Google providers.
- A global AI assistant (⌘/Ctrl + J) that answers questions and, after the user approves each call, acts through the API as the signed-in user.

### Frontend

- Pages built from shared components: page header, filters, data table, form dialogs, import / export dialogs, confirmations and toasts.
- Tabs that keep page state, three navigation modes, accent colors, light and dark themes, and a component gallery of list, card, tree, kanban, Gantt, dashboard, editor, 3D and data-visualization examples.

### Deployment and docs

- Docker image with migrations and RBAC sync on start; a public demo mode (read-only system management, one-click sign-in, data reset on a schedule) and a Render + Neon blueprint.
- Documentation site (VitePress) in Chinese, English and Japanese; MIT license and community files.

[Unreleased]: https://github.com/robeshell/castorjs/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/robeshell/castorjs/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/robeshell/castorjs/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/robeshell/castorjs/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/robeshell/castorjs/releases/tag/v0.1.0
