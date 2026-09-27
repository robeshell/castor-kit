# Using the backend templates

> Prefer generating with the scaffold (it does the replacements, registration and migration generation below for you):
>
> ```bash
> pnpm scaffold -- --name <resource> --domain <admin|component_center> --fields "name:str,phone:str"
> ```
>
> Copy the templates in this directory only when the scaffold isn't available or you need to write the code by hand.

## Files

| File | Target location | Layer | Description |
|---|---|---|---|
| `db-schema.ts` | `apps/api/src/db/schema/<domain>/<resource>.ts` | model layer | Drizzle `pgTable` + `toDict`; table structure and serialization only |
| `schema.ts` | `apps/api/src/modules/<domain>/<resource>/schema.ts` | schema layer | Request body declarations (`field.*` from `@/common/validation`), import / export field mappings |
| `repository.ts` | `apps/api/src/modules/<domain>/<resource>/repository.ts` | crud layer | Pure database reads and writes (Drizzle queries) |
| `service.ts` | `apps/api/src/modules/<domain>/<resource>/service.ts` | service layer | Business logic + `ServiceError` |
| `routes.ts` | `apps/api/src/modules/<domain>/<resource>/routes.ts` | api layer | Fastify routes + permission checks |

Backend directory and file names are always lowercase and hyphenated (customer_order → customer-order directory, component_center domain → component-center directory);
table names and frontend paths keep underscores.

## Usage

1. Copy the files to the locations in the table above
2. Replace the placeholders everywhere:
   - `<Resource>` → type / class name (PascalCase, e.g. `Customer`)
   - `<resource>` → resource name (underscores, e.g. `customer`; the table name is `<resource>s`; URLs use the hyphenated plural, e.g. `/api/admin/customer-orders`; for multi-word resources write `<resource>ToDict` in camelCase)
   - `<domain>` → domain directory (`admin` or `component-center`)
   - `<domain_resource>` → permission code prefix (e.g. `system_customer`; the component_center domain uses the `cc_` prefix)
3. Add the actual business fields (search for the `TODO` comments)
4. Register:
   - `apps/api/src/db/schema/index.ts`: `export * from './<domain>/<resource>'`
   - `apps/api/src/modules/<domain>/router.ts`:
     ```ts
     import { register<Resource>Routes } from './<resource>/routes'
     await register<Resource>Routes(app)
     ```
5. Migration: `pnpm db:generate --name add_<resource>_table` → review the SQL → `pnpm db:migrate` → confirm it hit the database with `psql -d <db> -c '\d <resource>s'`
6. RBAC: add the menu + button permissions in `apps/api/scripts/seed-rbac.ts`, run `pnpm seed:rbac -- --incremental`
7. Frontend: copy `docs/templates/frontend/` (`list_page` list page `index.tsx` + `api.ts`, shadcn/ui system, conventions in `docs/frontend-design-system.md`);
   pages go in `apps/web/src/modules/<module>/pages/<subdir>/<page>/index.tsx`, the API file in `api/<page>.ts` (its types need the endpoints
   documented in `docs/apifox-full.openapi.json`, then `pnpm openapi:generate`); scaffold generates a page with the same structure directly
8. Gate: `pnpm verify -- --module <resource>` passes completely

## Conventions

- Permission checks always use `import { hasMenuPermission, loginRequired } from '@/common/auth'`; defining your own `hasPermission` in routes is forbidden
- Routes don't write SQL directly; services don't touch `reply` / `session`
- Routes that take an id check permissions first (403) and then call `getOr404` (404), so a caller without permission can't probe whether an id exists
- Times are always output with `toIso()`, `Date#toISOString()` is forbidden; numeric stays a string
- An import runs as one transaction for the whole batch; if any row has errors, throw `ServiceError(400, { error_rows, error_count })` and roll back everything

## Reference implementation

- `apps/api/src/modules/admin/users/` (standard CRUD + import / export)
- `apps/api/test/admin-users.test.ts` (how the matching vitest cases are written)
