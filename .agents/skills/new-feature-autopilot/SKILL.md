---
name: new-feature-autopilot
description: PM gives feature intent in natural language; execute end-to-end implementation for castor-kit (Fastify + Drizzle + React/Semi) without requiring structured requirement docs.
---

# New Feature Autopilot

Use this skill when user asks to "做XX功能", "新增模块", "加一个页面/接口", etc.

## Goal

Deliver a usable feature from intent only:

- backend table definition + API module
- frontend page
- RBAC/menu wiring
- Drizzle migration, really applied to the database
- OpenAPI update
- verification gate green

## Execution Steps

1. Identify stack + read references first
   - This project is castor-kit: pnpm monorepo, Node 22 + TypeScript + Fastify 5 + Zod + Drizzle (`apps/api`), React 18 + Vite + Semi Design (`apps/web`), PostgreSQL.
   - Read `AGENTS.md` and `docs/templates/backend/README.md` before writing code.
   - If related MCP docs/skills exist, read them first (UI tasks should prefer `semi-mcp` + `semi-ui-skills`).
2. Understand intent from conversation
   - Extract actor, main workflow, key entities, and expected admin actions.
   - Make reasonable defaults for non-critical fields (field type table in `AGENTS.md`).
3. Scan existing modules
   - Prefer extending existing modules over creating duplicates.
   - Reference implementation: `apps/api/src/modules/admin/users/`.
4. Scaffold
   - `pnpm scaffold -- --name <name> --domain <admin|component_center> --fields "name:str,status:str20" --dry-run`, then run again without `--dry-run`.
   - Scaffold writes `db/schema/<domain-dir>/<name>.ts` + `modules/<domain-dir>/<name>/{schema,repository,service,routes}.ts` + frontend api/page, registers them in `apps/api/src/db/schema/index.ts` and `apps/api/src/modules/<domain-dir>/router.ts`, and runs `drizzle-kit generate`.
5. Implement backend
   - Follow the layered module structure: `db/schema → schema.ts → repository.ts → service.ts → routes.ts`.
   - If introducing a new first-level domain, wire it in `apps/api/src/router.ts` and `apps/api/src/db/schema/index.ts`.
   - Use unified permission helpers: `import { hasMenuPermission, loginRequired } from '@/common/auth'` and `await hasMenuPermission(request, code)`; do not create a local `hasPermission` in routes files.
   - Output times with `toIso()` (never `Date#toISOString()`), keep numeric columns as strings, throw `ServiceError` from services.
   - If the table shape changes after scaffolding: `pnpm db:generate --name <desc>` (no `--` for this command).
6. Implement frontend
   - Page under `apps/web/src/modules/**/pages/**/index.jsx`, API file under `apps/web/src/modules/**/api/`.
   - Reuse `apps/web/src/shared/api/request.js` and `apps/web/src/shared/utils/file.js`.
   - Ensure menu `path` + `component` are compatible with dynamic routing (`component` like `admin/users`, `component_center/admin/list_page`).
   - Prefer reusing `apps/web/src/shared/components/import-export/` for import/export UX (csv / xlsx only).
7. Integrate permissions
   - Add menu/button permission codes to `MENUS_DATA` in `apps/api/scripts/seed-rbac.ts` (button ID = menu ID × 10 + n).
   - Always run `pnpm seed:rbac -- --incremental` after permission/menu changes (it refreshes super-admin permissions so new pages are immediately visible).
8. Apply the migration
   - Review the new SQL in `apps/api/drizzle/`, run `pnpm db:migrate`, then prove it with `psql -d aurastack -c '\d <table>'`. Static checks alone do not count.
9. Update API docs
   - `pnpm openapi:generate`, then fill in request/response schema in `docs/apifox-full.openapi.json`.
10. Verify
    - `pnpm verify -- --module <name> --skip-build` (add `--json` for structured output); fix failures and re-run until all green.
11. Deliver handoff
    - Report "已迁移至 <tag>" (from the `migration_applied` check) when schema changed.
    - Always provide a short "next steps" command list for the user (e.g. `pnpm db:migrate && pnpm seed:rbac -- --incremental` for other environments).

## Defaults (when user does not specify)

- List page supports: search + create + edit + delete + import + export.
- RBAC includes: `<perm>`, `<perm>_add`, `<perm>_edit`, `<perm>_delete`, `<perm>_export`, `<perm>_import` (`<perm>` = `system_<name>` for admin, `cc_<name>` for component_center).
- New admin routes under `/api/admin/<resource>s`.
- Use consistent Toast success/error UX with existing pages.
- Pagination 20 per page, ordered by id desc.

## Blocking Questions Only

Ask at most 1-2 concise questions only for:

- data model ambiguity with irreversible impact
- security-sensitive permission boundaries
- external integration credentials
