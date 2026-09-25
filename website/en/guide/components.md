# Component gallery

After signing in, the Component Gallery menu holds 28 example pages in six groups. They all follow the project's frontend conventions, so you can use any of them as a reference or starting point for a new page.

Page source lives in `apps/web/src/modules/component_center/pages/<group-dir>/<page>/index.jsx`. Examples with a backend API have a matching module under `apps/api/src/modules/component-center/`.

## Admin Pages

Group directory `admin/`; every page has a backend API and a database table.

| Page | Route | Description |
|---|---|---|
| List Page | `/component-center/list-page` | The most complete CRUD list: filters, pagination, create/edit/delete, import/export, image and file upload |
| Stats List Page | `/component-center/stats-list-page` | Stat cards plus category distribution and publish status charts above the list; creation uses a multi-step form |
| Card List Page | `/component-center/card-list-page` | Records shown as a card grid, with create/edit/delete |
| Tree List Page | `/component-center/tree-list-page` | Tree on the left, details on the right; supports changing the parent node, with cycle detection |
| Dynamic Form Page | `/component-center/dynamic-form-page` | Basic info plus a sub-table of dynamic fields you can add and remove |
| Kanban Board | `/component-center/admin/kanban` | Drag-and-drop ordering of Kanban columns and cards, with WIP limits |
| Detail Tabs | `/component-center/admin/detail-tabs` | Member list on the left, details split into tabs on the right |
| Gantt Chart | `/component-center/admin/gantt` | Gantt-chart scheduling of project tasks |
| Advanced Table | `/component-center/admin/advanced-table` | Inline editing, column settings, drag-to-reorder, bulk actions, pinned action column |

## Data Visualization

Group directory `dataviz/`. Built on ECharts; chart colors follow the theme and accent color through `useChartColors()`.

| Page | Route | Description |
|---|---|---|
| Data Dashboard | `/component-center/dashboard-page` | A full dashboard made of multiple charts and an event stream |
| Real-time Line Chart | `/component-center/dataviz/realtime-chart` | Continuously scrolling sensor curves (frontend only) |
| Calendar Heatmap | `/component-center/dataviz/heatmap` | Yearly calendar heatmap and an hour × weekday heatmap (frontend only) |
| Map Heatmap | `/component-center/dataviz/map-heatmap` | Province heatmap on a map of China plus a Top 10 ranking; the map data ships with the repo |

## 3D / Creative

Group directory `creative/`; frontend-only pages.

| Page | Route | Description |
|---|---|---|
| Particle Network | `/component-center/creative/particle` | Canvas particles connected by lines; the default colors come from the current accent color |
| CSS 3D Cards | `/component-center/creative/css-3d` | Pure-CSS 3D effects such as flip on hover, a spinning cube and parallax tracking |
| Three.js Globe | `/component-center/creative/globe` | A 3D globe rendered with Three.js; scene colors follow the accent color |
| Particle Morphing | `/component-center/creative/morphing` | WebGL particles morphing between several shapes |

## AI Apps

Group directory `ai/`. Requires an OpenAI-compatible API (`AI_API_BASE`, `AI_API_KEY`, `AI_MODEL`); see [Configuration](/en/reference/configuration).

| Page | Route | Description |
|---|---|---|
| AI Chat | `/component-center/ai/chat` | Streaming (SSE) chat interface |
| AI Prompt Studio | `/component-center/ai/prompt` | Prompt template library that extracts template variables and previews in real time |
| AI Data Query | `/component-center/ai/sql` | Generates SQL from natural language, runs it on a read-only connection, and shows the results and a chart |

::: tip Security boundaries of AI Data Query
Queries run on a separate read-only connection, the number of result rows is capped, and sensitive tables such as permissions and logs are filtered out. In production you must set `AI_SQL_DATABASE_URL` to point at a read-only account; see the [Deployment guide](/en/deploy/).
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
The WebSocket and Performance Monitor pages depend on `/ws/devtools`. Behind a reverse proxy, you need to configure WebSocket forwarding for `/ws`; see the [Deployment guide](/en/deploy/#reverse-proxy-and-https).
:::

## System

Besides the component examples, the System menu holds the business features that ship with the scaffold:

| Page | Route | Description |
|---|---|---|
| Users | `/system/users` | Create, edit and delete users, assign roles, import/export (the reference implementation of a standard list page) |
| Roles | `/system/roles` | Role management and menu / button authorization |
| Menus | `/system/menus` | Menu tree management |
| Logs | `/system/logs` | Operation logs and login logs |
| Dictionaries | `/system/dicts` | Maintains dictionary data and serves as a data source for dropdown options |
| Scheduled Tasks | `/system/scheduled-tasks` | Calls HTTP URLs on a cron schedule and shows execution history |
| Notifications | `/system/notifications` | In-app notifications |
| Announcements | `/system/announcements` | Publishing and managing announcements |

There is also the Home page (`/dashboard`) and the Profile page (`/profile`).
