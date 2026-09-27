# castor-kit — Claude Code additions

> **Main docs**: `AGENTS.md` (tool-agnostic project context: architecture, layering, naming, field type inference, anti-patterns, delivery process, menu tree) + `docs/architecture.md` (architecture: tech stack, cross-cutting conventions, migrations, deployment, design decisions). For features on the roadmap, first read the matching section of `docs/roadmap.md`.
> Read these two files before starting any implementation; for frontend UI work, also read `docs/frontend-design-system.md` (the shadcn/ui system). This file holds only what is specific to Claude Code.

## Rules

- Names are always lowercase and hyphenated (`castor-kit`, `@castor-kit/api`), never camelCase
- Before implementing a shadcn/ui component, check the official shadcn docs / registry first (use the shadcn MCP if available); add new primitives with `npx shadcn@latest add` (on this machine it has to go through a REGISTRY_URL relay, so run `apps/web/scripts/shadcn-add.sh <component>` directly; see AGENTS.md "Adding shadcn/ui primitives")
- Migrations must actually be applied to the database and checked with `psql \d`; static checks don't count as done
- **Code comments are always in English**; the UI supports Chinese / English / Japanese: in the frontend write `t('中文原文')` (the Chinese source text is the i18n key) and put translations in the page directory's `locales/en-US.json` and `ja-JP.json`; register translations for new backend errors in `apps/api/src/i18n/messages.ts` (see AGENTS.md "Internationalization (i18n) and code comments")

---

## Claude Code specifics

### Skills

- `/new-feature-autopilot` (`.claude/skills/new-feature-autopilot/SKILL.md`): use when a PM says "build feature XX / add an XX page". Flow:
  1. Read AGENTS.md + docs/templates/
  2. Infer the technical spec automatically (don't ask the user about technical details)
  3. Show a **business preview** for confirmation
  4. `pnpm scaffold` → fill in the business logic → incremental `seed-rbac` → `pnpm db:migrate` → prove it with `psql \d`
  5. Once the `pnpm verify -- --module <name>` gate is all green (including frontend and backend unit tests), output the delivery report (stating "migrated to <tag>")
- `shadcn-ui-skills` (`.claude/skills/shadcn-ui-skills/SKILL.md`): shadcn/ui component list, how to use castor-kit's shared components, design tokens, motion rules, common patterns and things not to do

### Docs first

- Before implementing a shadcn/ui component, check the official docs (https://ui.shadcn.com/docs/components ) or the registry (`apps/web/scripts/shadcn-add.sh --view <component>`); prefer the shadcn MCP when available
- If the docs conflict with the existing implementation, the repo wins (`apps/web/src/components/ui/` has been adjusted to this project's tokens)

### Local preview

`.claude/launch.json` defines two dev servers, `api` (`pnpm --filter @castor-kit/api dev`, 5001) and `web` (`pnpm --filter @castor-kit/web dev`, 5173); start them from there when checking pages in the browser.

---

## Key conventions at a glance (details in AGENTS.md)

### Backend (apps/api)
- **Layering**: `db/schema/<domain>/<name>.ts` → `modules/<domain>/<name>/{schema,repository,service,routes}.ts` → `modules/<domain>/router.ts` → `src/router.ts`
- **API route prefix**: `/api/admin/...`; list responses are `{ items, total, page, per_page }`, error responses are `{ error, ...payload }`
- **Permission checks**: `import { hasMenuPermission, loginRequired } from '@/common/auth'`, `await hasMenuPermission(request, 'system_xxx')`; `hasAnyMenuPermission` / `menuPermissionRequired(code)` also exist
  - Defining your own `hasPermission` inside a routes file is not allowed
- **Model layer**: Drizzle `pgTable` + `xxxToDict()`; time columns use `createdAt()/updatedAt()` and are output with `toIso()` (ISO 8601 UTC, with `Z`); numeric stays a string
- **New domain**: register it in `src/router.ts` + `db/schema/index.ts` (new modules inside an existing domain are registered by scaffold automatically)
- **Import / export**: `common/tabular.ts` (`buildTable` / `sendTable` / `readTableFile`), csv / xlsx only

### Frontend (apps/web, shadcn/ui + Tailwind CSS v4 + motion + lucide-react; moving from JSX to TSX, see AGENTS.md "TypeScript (migration in progress)")
- **Dynamic routing**: `App.jsx` resolves pages via `lib/page-modules.ts` (`import.meta.glob('../modules/**/pages/**/index.{jsx,tsx}')`); `menu.component` values have the form `<module>/<subdir>/<page>` (e.g. `component_center/admin/kanban_page`)
- **API client**: `apps/web/src/shared/api/request.ts` (intercepts 401 and redirects to the login page, adds the CSRF header automatically, responses are already unwrapped)
- **Page structure**: follow `apps/web/src/modules/admin/pages/users/index.tsx`: PageHeader → FilterBar → DataTable → FormDialog (react-hook-form + FormFields) → ImportDialog / ExportDialog; deletes use ConfirmAction, feedback uses `@/lib/toast`
- **Import / export**: reuse `@/shared/components/data-transfer/ImportDialog` + `@/shared/components/data-transfer/ExportDialog`
- **Styling**: only Tailwind semantic color classes (`bg-card` / `text-muted-foreground` / `bg-brand-soft` ...); the Ocean gradient is only an accent; no hard-coded hex colors; only `@/components/ui/*`, `@/shared/components/*`, lucide-react and Tailwind semantic color classes, no other UI component libraries (antd, MUI, etc.)
- **Frontend-only pages** (no backend CRUD API): creative/, devtools/websocket_page, devtools/perf_monitor_page, dataviz/heatmap_page, dataviz/realtime_chart_page

### RBAC
- Menu structure: `menus` table, `menu_type = 'menu'|'button'`; `role_menus` / `user_roles` are many-to-many
- **Super admin**: code=`super_admin`, permission checks always pass (except `my-menus`)
- Single source of truth: `apps/api/scripts/seed-rbac.ts`; after every menu / permission change you must run `pnpm seed:rbac -- --incremental`

---

## Common commands

```bash
pnpm dev                                   # api(5001) + web(5173)
pnpm db:generate --name <description>      # generate a migration (note: no -- here)
pnpm db:migrate                            # apply migrations
psql -d castor_kit -c '\d <table>'          # prove it hit the DB (DB name from DEV_DATABASE_URL in apps/api/.env.development)
pnpm seed:rbac -- --incremental            # incremental RBAC sync
pnpm scaffold -- --name <name> --domain admin --fields "name:str,status:str20"
pnpm verify -- --module <name>             # feature verification gate (--skip-build skips the frontend build, --json for structured output)
pnpm typecheck && pnpm test
pnpm openapi:generate && pnpm openapi:apifox
```

---

## New feature checklist

1. [ ] Read the related existing modules (see `apps/api/src/modules/admin/users/`, `apps/web/src/modules/admin/pages/users/index.tsx`)
2. [ ] `pnpm scaffold -- --name <name> --domain <admin|component_center> --fields "..."`
3. [ ] Backend: fill in the business logic in `db/schema` → `schema.ts` → `repository.ts` → `service.ts` → `routes.ts`
4. [ ] Frontend: `pages/<subdir>/<page>/index.tsx` + `api/<page>.ts` (what scaffold generates; frontend-only pages need no api file): row type from the API file, `interface FormValues` + `useForm<FormValues>`, `DataTableColumn<Row>[]`, no `any` / casts (see AGENTS.md "TypeScript (migration in progress)")
5. [ ] RBAC: add the menu + button permission entries in `seed-rbac.ts`, run `pnpm seed:rbac -- --incremental`
6. [ ] Migration: review the new SQL in `apps/api/drizzle/` → `pnpm db:migrate` → confirm with `psql \d`
7. [ ] OpenAPI: scaffold has already written the module's endpoints; if you changed the generated routes / fields or added routes, update the doc following AGENTS.md "OpenAPI writing rules" until `pnpm openapi:generate -- --strict` passes
8. [ ] Gate: `pnpm verify -- --module <name>` passes completely (including frontend and backend unit tests)
