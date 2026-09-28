# Component gallery

After signing in, the Component Gallery menu holds 36 example pages in six groups: Page Patterns, Components, Data Visualization, AI Apps, Editors / Low-code and Engineering Tools. The gallery is the reference that developers and AI agents copy from: every page follows the project's frontend conventions exactly. Each page pattern has one page that is its reference implementation, and each group of shared components has one page that shows how to use them. To build a card list or a kanban board, start from the matching pattern page; to use `DataTable` or an upload field, look it up under [Components](#components).

Page source lives in `apps/web/src/modules/component_center/pages/<group-dir>/<page>/index.tsx`; the doc comment at the top of each page says when to use the pattern and what to copy. Examples with a backend API have a matching module under `apps/api/src/modules/component-center/`.

## Page Patterns

Group directory `patterns/`. All ten pages work on the same demo data through one shared API (see [below](#shared-demo-api)).

| Pattern | Route | What it shows | Reference directory |
|---|---|---|---|
| Standard List | `/component-center/patterns/standard-list` | A plain CRUD resource: category / status / enabled filters, table with pagination and row selection, create / edit dialog, delete, import / export (selected rows or everything). It is `pnpm scaffold` output plus the filters, the same structure as the Users page | `patterns/demo_record_page` |
| Card List | `/component-center/patterns/card-list` | The standard list with the table swapped for a responsive card grid: cover image (uploaded to the file center, with a placeholder), category / status badges, tags, owner; skeleton cards while loading, an empty state | `patterns/card_list_page` |
| Tree List | `/component-center/patterns/tree-list` | Records nested by `parent_id`: the whole tree on the left (searched on the server, keeping the ancestors of each match), the selected record's children in a table on the right with a breadcrumb; move up / down among siblings, a parent picker that excludes the record's own descendants | `patterns/tree_list_page` |
| Stats List | `/component-center/patterns/stats-list` | Stat cards (count, amount, quantity, completion rate), a category donut chart and a stacked status bar above the table; the stats and the table read the same filters, and every write reloads both | `patterns/stats_list_page` |
| Detail Page | `/component-center/patterns/detail` | One record's detail: a record picker on the left, a header with key facts and edit / delete, then tabs (overview, children, tags and extra fields); the record is in the URL (`?id=`) | `patterns/detail_page` |
| Step Form | `/component-center/patterns/step-form` | A create wizard as a full page: one form across the steps, each step validated on "Next", a review step with links back to each step, then a success state | `patterns/step_form_page` |
| Dynamic Form | `/component-center/patterns/dynamic-form` | Fixed fields plus user-defined extra fields (text / number / boolean / date) you can add and remove, stored as the record's jsonb `extra` | `patterns/dynamic_form_page` |
| Kanban | `/component-center/patterns/kanban` | Columns are the status values (to do / in progress / completed / archived); drag cards within and across columns (dnd-kit), saved optimistically with one reorder request and rolled back on failure; the archived column collapses to a narrow rail | `patterns/kanban_page` |
| Gantt Chart | `/component-center/patterns/gantt` | Records on a timeline in work-breakdown order (by `parent_id`, collapsible): day / week scale, weekend shading, a today line, summary bars for parents and progress bars for leaves; click a bar to edit | `patterns/gantt_page` |
| Advanced Table | `/component-center/patterns/advanced-table` | A table worked in place: server-side sorting, inline row editing with undo, row selection with batch update (status / owner / enabled) and batch delete, column visibility | `patterns/advanced_table_page` |

The shared option lists (category and status labels and badge tones) are in `patterns/demo-record-options.ts`. How to use each shared component on its own is in [Components](#components).

### Building a feature from a pattern {#from-a-pattern}

`pnpm scaffold` always generates a standard list page. When a feature is better shown another way, generate the module as usual (backend, menu, migration, typed API file), then rebuild its page after the matching pattern page and add the backend pieces that pattern relies on:

| The feature needs | Copy | Backend to add (see the [shared demo API](#shared-demo-api)) |
|---|---|---|
| Cards instead of rows | Card List | nothing beyond the scaffold endpoints |
| Records nested by a parent | Tree List | a tree endpoint, a `parent_id` filter, reorder by `sort_order`, delete / move checks |
| Totals above the list | Stats List | a stats endpoint that reads the list's filters |
| A page per record with tabs | Detail Page | nothing beyond the scaffold endpoints |
| A long create form in steps | Step Form | nothing beyond the scaffold endpoints |
| User-defined extra fields | Dynamic Form | a jsonb column |
| Cards moved between states | Kanban | a reorder endpoint with its own order column |
| Date ranges on a timeline | Gantt Chart | date range and progress columns |
| Sorting, inline edit, batch actions | Advanced Table | sortable fields, batch update / delete endpoints |

[AGENTS.md](https://github.com/robeshell/castorjs/blob/main/AGENTS.md) has the same table under "Page patterns (which page to copy)", with the service and repository functions to copy, so an AI agent picks the right page by itself: describe the feature ("a kanban of support tickets") and it starts from the kanban page.

### Shared demo API {#shared-demo-api}

The ten pattern pages don't each have a backend. They share one module, `apps/api/src/modules/component-center/demo-record`, with one table, `demo_records`, under `/api/admin/component-center/demo-records`:

| Endpoint | Used by |
|---|---|
| `GET /demo-records` (filters, pagination, sorting), `GET /demo-records/{id}` | Every page |
| `POST` / `PUT /{id}` / `DELETE /{id}` | Create, edit, delete (a record that still has children can't be deleted) |
| `GET /demo-records/tree` | Tree list, parent pickers |
| `GET /demo-records/stats` | Stats list: totals, counts by status and by category, under the same filters as the list |
| `POST /demo-records/batch-update`, `POST /demo-records/batch-delete` | Advanced table |
| `PUT /demo-records/reorder` | Tree list (`sort_order`), kanban (`board_order` and `status`) |
| `POST /demo-records/export`, `GET /demo-records/template`, `POST /demo-records/import` | Standard list |

Besides the common fields (`name`, `code`, `category`, `status`, `owner`, `priority`, `is_active`, `description`), each pattern uses a few of its own: `parent_id` + `sort_order` (tree), `board_order` (kanban card order, kept apart from the tree's order), `amount` + `quantity` (stats), `start_date` / `end_date` / `progress` (gantt), `cover` + `tags` (cards), `extra` (dynamic form). `status` is `todo` / `in_progress` / `done` / `archived`; `category` is `product` / `design` / `engineering` / `marketing` / `operations`.

Permissions belong to the Page Patterns directory (menu code `cc_patterns`), not to one page: its buttons `cc_patterns_add` / `_edit` / `_delete` / `_export` / `_import` guard the writes, and reading is allowed with the directory or any page under it (`DEMO_RECORD_VIEW_CODES` in the module's `schema.ts`). See [Permissions (RBAC)](/guide/rbac#permission-codes). In [demo mode](/reference/configuration#public-demo) the gallery stays writable, and the demo records are restored periodically from `apps/api/src/demo/fixtures.ts`.

## Components {#components}

Group directory `components/`. Where the page patterns show whole pages, these pages show how to use each shared component from `apps/web/src/shared/components/`: every example is live code rendered on the page, with its exact source one click away (syntax-highlighted, with a copy button) and a table of the component's key props. Look here first before using a shared component. All data is mock data, and there are no buttons to grant: the pages have no backend of their own (the uploads page stores files in the real file center).

| Page | Route | Components covered |
|---|---|---|
| Data Table | `/component-center/components/data-table` | `DataTable` (columns, custom cells, row selection with a batch toolbar, pagination, loading and empty states), `RowActions`, `ConfirmAction` |
| Forms | `/component-center/components/forms` | The react-hook-form fields in `FormFields` (`FormInput`, `FormSelect`, `FormDate`, `FormTreeSelect`, `FormFileUpload`, `FormCustom`, …) and `FormGrid`; `FormDialog`, `FormSheet`, and the read-only `DetailSheet` / `DescriptionList` |
| Filters | `/component-center/components/filters` | `FilterBar` with `SearchInput` / `FilterSelect`, `SegmentedTabs` |
| Pickers | `/component-center/components/pickers` | `MultiSelect`, `TagInput`, `DatePicker` / `DateTimePicker`, `TreeSelect`, used on their own (controlled `value` + `onChange`) |
| Trees | `/component-center/components/trees` | `TreeView` (selection, expansion, custom rows, filtering), `CheckableTree` (cascading checks, inside a form) |
| Uploads | `/component-center/components/uploads` | `FileUpload`, `ImageUpload`, `AvatarUpload`, `FileIdUpload`, uploading to the file center |
| Import / Export | `/component-center/components/import-export` | `ImportDialog` (success and failed rows) and `ExportDialog`, wired to mock handlers |
| Feedback | `/component-center/components/feedback` | `StatusBadge`, `EmptyState`, `ConfirmAction`, `toast` (`@/lib/toast`), the `Skeleton` loading pattern |
| Data Display | `/component-center/components/data-display` | `StatCard` (with `CountUp` / `Sparkline`), `Chart` (ECharts with theme colors), `Panel`, `PageHeader`, `UserAvatar` |
| Markdown | `/component-center/components/markdown` | `MarkdownView` |
| Condition Builder | `/component-center/components/condition-builder` | `ConditionBuilder`: field / operator / value conditions combined with AND / OR, plus condition groups; its value is plain JSON to save or send to an API (examples: filtering table rows, saving a query in a form, single-level and read-only) |

Each page lives in `components/<group>_page/`: every example is its own file under `examples/`, imported by the page twice, once as a component for the live preview and once with Vite's `?raw` for the source shown under it, so the preview and the code can't drift; the props tables are in the page's `props.ts`. The layout pieces (`ShowcasePage`, `ShowcaseSection`, `Example`, `PropsTable`, `CodeBlock`) are in `apps/web/src/modules/component_center/showcase/`. To add a page or an example, follow "Component showcase pages" in [AGENTS.md](https://github.com/robeshell/castorjs/blob/main/AGENTS.md); a test fails when an example file isn't wired both ways.

## Data Visualization

Group directory `dataviz/`. Built on ECharts; chart colors follow the theme and accent color through `useChartColors()`.

| Page | Route | Description |
|---|---|---|
| Data Dashboard | `/component-center/dashboard-page` | A full dashboard made of multiple charts and an event stream |
| Real-time Line Chart | `/component-center/dataviz/realtime-chart` | Continuously scrolling sensor curves (frontend only) |
| Calendar Heatmap | `/component-center/dataviz/heatmap` | Yearly calendar heatmap and an hour × weekday heatmap (frontend only) |
| Traffic Flow | `/component-center/dataviz/traffic-flow` | A Sankey diagram of visits from source to landing page to outcome, next to a funnel from visit to payment |

## AI Apps

Group directory `ai/`. Requires a model service, configured on the AI tab of System settings; see [Configuration](/reference/configuration#ai-model).

| Page | Route | Description |
|---|---|---|
| AI Chat | `/component-center/ai/chat` | Streaming chat (Vercel AI SDK `useChat` + AI Elements) |
| AI Prompt Studio | `/component-center/ai/prompt` | Prompt template library that extracts template variables and previews in real time |
| AI Data Query | `/component-center/ai/sql` | Generates SQL from natural language, runs it on a read-only connection, and shows the results and a chart |

::: tip Security boundaries of AI Data Query
Queries run on a separate read-only connection, the number of result rows is capped, and sensitive tables such as permissions and logs are filtered out. In production you must set `AI_SQL_DATABASE_URL` to point at a read-only account; see the [Deployment guide](/deploy/).
:::

## Editors / Low-code

Group directory `editor/`.

| Page | Route | Description |
|---|---|---|
| Rich Text Editor | `/component-center/editor/rich-text` | Built on react-quill-new |
| Code Editor | `/component-center/editor/code` | Built on Monaco, with switchable languages; the theme follows the app by default |
| JSON Editor | `/component-center/editor/json` | JSON editing with a tree preview |
| Markdown Preview | `/component-center/editor/markdown` | Editor on the left, live preview on the right |

## Engineering Tools

Group directory `devtools/`.

| Page | Route | Description |
|---|---|---|
| Drag Layout | `/component-center/devtools/drag-layout` | Draggable, resizable grid layout, saved locally in the browser |
| Virtual Scroll List | `/component-center/devtools/virtual-scroll` | Renders a large number of rows with react-window |
| WebSocket | `/component-center/devtools/websocket` | Connects to the backend's `/ws/devtools` and demonstrates sending, receiving and echoing messages |
| Performance Monitor | `/component-center/devtools/perf-monitor` | Receives server CPU, memory, disk and network metrics every second via `/ws/devtools` |

::: info WebSocket and reverse proxies
The WebSocket and Performance Monitor pages depend on `/ws/devtools`. Behind a reverse proxy, you need to configure WebSocket forwarding for `/ws`; see the [Deployment guide](/deploy/#reverse-proxy-and-https).
:::

## System

Besides the component examples, the System menu holds the business features that ship with the scaffold, in four groups: Organization (users, roles, departments), Security & Audit (online users, logs), Configuration (system settings, menus, dictionaries, scheduled tasks) and Content & Messages (files, notifications, announcements):

| Page | Route | Description |
|---|---|---|
| Users | `/system/users` | Create, edit and delete users, assign roles, enable / disable, import/export (the reference implementation of a standard list page) |
| Roles | `/system/roles` | Role management, menu / button authorization and data scope |
| Departments | `/system/departments` | Department tree: add children, edit, move up / down; the basis for user membership and data scope |
| Files | `/system/files` | Everything in the file center: preview, download, see whether a file is in use, delete unused files |
| Online users | `/system/sessions` | Signed-in sessions, with force sign-out (see [Account security & settings](/guide/security)) |
| System settings | `/system/settings` | Switches for two-step verification and password reset; password rules, session lifetime and rate limits |
| Menus | `/system/menus` | Menu tree management |
| Logs | `/system/logs` | Operation logs and login logs |
| Dictionaries | `/system/dicts` | Maintains dictionary data and serves as a data source for dropdown options |
| Scheduled Tasks | `/system/scheduled-tasks` | Calls HTTP URLs on a cron schedule and shows execution history |
| Notifications | `/system/notifications` | In-app notifications |
| Announcements | `/system/announcements` | Publishing and managing announcements |

There is also the Home page (`/dashboard`) and the Profile page (`/profile`: account details and last sign-in, plus editing nickname / email / phone / avatar and the password).
