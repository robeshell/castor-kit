# Development Guide

## Project Structure

castor-kit is a pnpm monorepo; the backend, frontend and MCP server are separate workspace packages:

```
castor-kit/
├── package.json                    # workspace root scripts (pnpm dev / verify / scaffold ...)
├── pnpm-workspace.yaml
├── AGENTS.md                       # AI context (read by all AI tools)
├── apps/
│   ├── api/                        # @castor-kit/api — Fastify + TypeScript backend
│   │   ├── src/
│   │   │   ├── main.ts             # web process entry
│   │   │   ├── worker.ts           # standalone scheduler process entry
│   │   │   ├── app.ts              # plugins / routes / error handling / static assets
│   │   │   ├── config.ts           # multi-environment config (Zod-validated)
│   │   │   ├── router.ts           # top-level route assembly
│   │   │   ├── common/             # auth / csrf / tabular / pagination / serialize / scheduler ...
│   │   │   ├── db/schema/          # Drizzle table definitions (admin/, component-center/, index.ts)
│   │   │   └── modules/
│   │   │       ├── admin/          # system domain: users, roles, menu, logs, dicts, scheduled-task ...
│   │   │       │   └── users/      # schema.ts / repository.ts / service.ts / routes.ts
│   │   │       └── component-center/   # examples domain: list-page, kanban, gantt, ai-chat ...
│   │   ├── drizzle/                # Drizzle SQL migrations + meta/_journal.json
│   │   ├── scripts/
│   │   │   ├── scaffold.ts         # code skeleton generator
│   │   │   ├── verify-feature.ts   # feature verification gate
│   │   │   ├── seed-rbac.ts        # RBAC seed data (single source of truth for the menu tree)
│   │   │   ├── setup-once.ts       # migrations + RBAC + read-only role (runs on container start)
│   │   │   └── generate-openapi.ts / import-apifox.ts
│   │   └── test/                   # Vitest (against a real PostgreSQL)
│   ├── web/                        # @castor-kit/web — React 19 + Vite + shadcn/ui frontend (JSX)
│   │   ├── scripts/shadcn-add.sh   # runs npx shadcn@latest add through a local relay
│   │   └── src/
│   │       ├── App.jsx             # dynamic routing (import.meta.glob)
│   │       ├── index.css           # Tailwind v4 + design tokens (light / dark)
│   │       ├── context/            # AuthContext / ThemeContext
│   │       ├── components/ui/      # shadcn/ui primitives
│   │       ├── components/app/     # app shell: sidebar, top bar, ⌘K, theme toggle
│   │       ├── lib/                # cn / toast / format / motion / chart-theme
│   │       ├── modules/
│   │       │   ├── admin/          # system management pages
│   │       │   └── component_center/   # component example pages
│   │       └── shared/
│   │           ├── api/request.js  # Axios instance (baseURL='/api')
│   │           └── components/     # shared business components: PageHeader / DataTable / FormDialog / ImportDialog …
│   └── mcp/                        # @castor-kit/mcp — MCP server
└── docs/
    └── templates/                  # AI code skeleton templates (backend/*.ts, frontend/*)
```

Backend layering: `db/schema → schema (Zod) → repository → service → routes`. Each feature module is four files under `modules/<domain>/<module>/`, with its table definition in `db/schema/<domain>/<module>.ts`.

---

## Generating Features with AI

castor-kit is designed for AI-driven development. The fastest path is Claude Code's `/new-feature-autopilot` skill.

**Example prompt:**

```
Create a customer management page with fields: name, phone, company, status
```

The AI will automatically:
1. Read `AGENTS.md` and `docs/templates/` to understand project conventions
2. Infer all technical details — no clarifying questions needed
3. Show you a **business preview** to confirm
4. Generate the complete module: table definition → Zod schema → repository → service → routes → frontend page → RBAC entries → DB migration
5. Run the `pnpm verify` quality gate

---

## Manual Code Generation

If you prefer to scaffold manually:

```bash
# Preview which files will be generated
pnpm scaffold -- --name customer --domain admin \
  --fields "name:str,phone:str20,company:str,status:str20" --dry-run

# Generate for real
pnpm scaffold -- --name customer --domain admin \
  --fields "name:str,phone:str20,company:str,status:str20"
```

The scaffolder:

- writes the table definition `db/schema/admin/customer.ts` and the module `modules/admin/customer/{schema,repository,service,routes}.ts`
- writes the frontend API file and a shadcn/ui list page shaped like the Users page (search, create/edit/delete, import/export; field types map to form components)
- registers them in `db/schema/index.ts` and the domain router `modules/admin/router.ts`
- runs `drizzle-kit generate` to produce the migration SQL

`--domain` is `admin` or `component_center`. Field types: `str` (100), `str20`, `str50`, `str500`, `text`, `int`, `float` (numeric 10,2), `bool`, `date`, `datetime`.

---

## Frontend Conventions

The frontend (`apps/web`) uses **shadcn/ui + Tailwind CSS v4 + motion + lucide-react** (JavaScript / JSX, Chinese UI copy); the UI was migrated from Semi Design — see the [frontend redesign plan](https://github.com/robeshell/castor-kit/blob/main/docs/frontend-redesign-plan.md).

- **Page structure**: list pages follow `modules/admin/pages/users/index.jsx` — `PageHeader` → `FilterBar` → `DataTable` → `FormDialog` (react-hook-form + `FormFields`) → `ImportDialog` / `ExportDialog`; deletes go through `ConfirmAction`, feedback through `@/lib/toast`
- **Field → form component**: `str` → `FormInput`, `text` → `FormTextarea`, `int` / `float` → `FormNumber`, `bool` → `FormSwitch`, `date` → `FormDate`, `datetime` → `FormDateTime`; in tables `bool` renders as `StatusBadge` and times via `formatDate` / `formatDateTime`
- **Styling**: Tailwind semantic color classes only (`bg-card`, `text-muted-foreground`, `bg-brand-soft` …), so dark mode just works; the Ocean gradient (blue → sky → cyan) is an accent only, with at most one `variant="brand"` primary button per page
- **Forbidden**: `@douyinfe/*` imports, `var(--semi-*)`, hard-coded hex colors, large inline-style layouts
- **Adding shadcn primitives**: the shadcn CLI cannot reach ui.shadcn.com directly on this machine, so use the relay script (starts a local registry relay, runs `npx shadcn@latest add` with `REGISTRY_URL`, then shuts it down):

```bash
apps/web/scripts/shadcn-add.sh hover-card
```

---

## RBAC & Menu Management

All menu items and button permissions are defined in `MENUS_DATA` in `apps/api/scripts/seed-rbac.ts` (the single source of truth). After adding a menu, run:

```bash
pnpm seed:rbac -- --incremental
```

`--incremental` upserts by `code`, never deletes existing data, and grants new menus to the super-admin role.

**Menu entry format (in `seed-rbac.ts`):**

```ts
{ id: 26, name: "Customers", code: "system_customer", icon: "IconUser", path: "/system/customer",
  component: "admin/customer", parent_id: 2, sort_order: 10, menu_type: "menu", is_visible: true, is_active: true },
// Button permissions: ID = menu ID × 10 + n
{ id: 261, name: "Create", code: "system_customer_add",    icon: null, path: null, component: null, parent_id: 26, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
{ id: 262, name: "Edit",   code: "system_customer_edit",   icon: null, path: null, component: null, parent_id: 26, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
{ id: 263, name: "Delete", code: "system_customer_delete", icon: null, path: null, component: null, parent_id: 26, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
{ id: 264, name: "Export", code: "system_customer_export", icon: null, path: null, component: null, parent_id: 26, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
{ id: 265, name: "Import", code: "system_customer_import", icon: null, path: null, component: null, parent_id: 26, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
```

::: tip component field format
The `component` field maps to `apps/web/src/modules/<module>/pages/<subdir>/<page>/index.jsx` (`admin/customer` → `modules/admin/pages/customer/index.jsx`).
Component-center pages use sub-directory paths, e.g. `component_center/admin/kanban_page`.
:::

Menu ID ranges are listed in `AGENTS.md` (system 21–39, component center 40–499, new business domains from 1000).

---

## Database Migrations

castor-kit uses Drizzle for migrations; migration files are plain, reviewable SQL (`apps/api/drizzle/`). After changing a table definition, generate and apply a migration:

```bash
# Generate the migration file (note: no -- after db:generate)
pnpm db:generate --name add_customer_table

# Apply it
pnpm db:migrate

# Confirm the table really exists
psql -d aurastack -c '\d customers'
```

::: warning Migrations must actually be applied
Generating a migration file is not enough. Run `pnpm db:migrate` and confirm the table/columns exist with `psql \d`; the `migration_applied` check in `pnpm verify` also compares against the migration records in the database.
:::

::: info Taking over an AuraStack database
When `pnpm db:migrate` runs against an existing AuraStack database, the baseline migration is only marked as applied (recorded in `drizzle.__drizzle_migrations`) and no DDL is executed; the existing `alembic_version` table is left untouched.
:::

---

## Feature Verification

After implementing a feature, run the verification gate:

```bash
pnpm verify -- --module customer --skip-build
```

It checks TypeScript types, layering rules (no local permission helpers), migration chain integrity and that migrations are applied, OpenAPI sync, paths referenced by the AI docs, backend/frontend files and registration, and the RBAC seed. Frontend pages are also checked for leftovers of the old UI stack (`@douyinfe/*`, `var(--semi-*)`). Drop `--skip-build` in CI to also validate the production frontend build; add `--json` for structured output an AI can read.

---

## Common Commands

```bash
pnpm dev                       # api (5001) + web (5173)
pnpm typecheck                 # TypeScript type check
pnpm test                      # Vitest (needs the aurastack_test database)
pnpm build                     # build web + api + mcp
pnpm db:generate --name <desc> # generate a migration
pnpm db:migrate                # apply migrations
pnpm seed:rbac -- --incremental
pnpm verify -- --module <name>
pnpm openapi:generate          # fill docs/apifox-full.openapi.json from the routes
pnpm openapi:apifox            # push to Apifox (needs APIFOX_PROJECT_ID / APIFOX_ACCESS_TOKEN)
pnpm mcp                       # start the MCP server
```

Test database: `createdb -T aurastack aurastack_test` (clone the dev database) or `createdb aurastack_test` (empty; tests run the migrations automatically).

---

## AI Tools Integration

castor-kit ships pre-configured context files for all major AI coding tools:

| Tool | Config File | Capability |
|---|---|---|
| Claude Code | `CLAUDE.md` + `.claude/skills/` | `/new-feature-autopilot` end-to-end skill + `shadcn-ui-skills` frontend guide |
| Cursor | `.cursor/rules/` | Auto-triggers the Autopilot workflow |
| GitHub Copilot | `.github/copilot-instructions.md` | Injects project conventions globally |
| Windsurf | `.windsurfrules` | Injects project conventions globally |
| Codex CLI | `CODEX.md` | Reads `AGENTS.md` natively |
| MCP clients | `apps/mcp` | scaffold / verify / RBAC / migration tools |

All tools share the core context in `AGENTS.md`, which covers the full project architecture, naming conventions, anti-patterns, and the delivery workflow.

---

## Environment Variables

### Development (`apps/api/.env.development`)

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment: `development` / `production` / `test` |
| `DEV_DATABASE_URL` | `postgresql://localhost/aurastack_dev` | Local PostgreSQL connection string |
| `TEST_DATABASE_URL` | `postgresql://localhost/aurastack_test` | Test database used by `pnpm test` |
| `SECRET_KEY` | built-in dev key | Session encryption key (optional in development) |
| `ADMIN_PASSWORD` | `admin123` | Password `pnpm seed:rbac` uses for the admin account |
| `PORT` | `5001` | Backend port (the Vite proxy targets 5001) |
| `AI_API_KEY` | — | API key for AI features (optional in development) |
| `AI_API_BASE` | — | OpenAI-compatible endpoint (e.g. `https://api.openai.com/v1`) |
| `AI_MODEL` | — | Model name |
| `RUN_SCHEDULER_IN_WEB` | `false` | Run the scheduled-task scheduler inside the web process |

### Production (`.env.production`)

See the production variables in the [Deployment guide](/en/deployment/#environment-variable-reference).

::: warning Production secret key
Always set a strong, random `SECRET_KEY` in production. The session key is derived from it — rotating it invalidates all active user sessions.
:::
