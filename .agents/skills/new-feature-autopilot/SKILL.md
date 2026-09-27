---
name: new-feature-autopilot
description: PM gives feature intent in natural language; execute end-to-end implementation for castor-kit (Fastify + Drizzle + React/shadcn-ui) without requiring structured requirement docs.
---

# New Feature Autopilot

When to use: triggered when the user expresses an intent such as "build feature XX", "add an XX page" or "add an XX module".

## Core principles

**The AI makes every technical decision; the PM only confirms the business intent.**

- Route paths, permission codes, field types, file locations, menu IDs: the AI infers all of them from the AGENTS.md conventions
- Never ask the PM about technical details
- Show a business preview for confirmation first, then implement
- Run every command from the repo root (Node 22 + pnpm)
- Dev environment config is in `apps/api/.env.development` (there is no `.env` at the repo root); the database connection comes from its `DEV_DATABASE_URL`, and the default local database name is `castor_kit`. A fresh checkout or git worktree has no such file and silently uses `castor_kit`, the same database as the main checkout: check with `cat apps/api/.env.development` first, and when another checkout is in use, give this one its own databases and ports (AGENTS.md "Development environment")

---

## Steps

### Step 1 — Read the context

```
Read these, in order:
1. AGENTS.md (project conventions, naming, field type inference, anti-patterns)
2. docs/templates/backend/ (including the replacement rules in README.md) and docs/templates/frontend/ (code skeleton templates)
3. Existing similar modules (backend: apps/api/src/modules/admin/users/, frontend: apps/web/src/modules/admin/pages/users/index.tsx)
   + frontend conventions: AGENTS.md "Frontend conventions", docs/frontend-design-system.md, .claude/skills/shadcn-ui-skills/
4. apps/api/scripts/seed-rbac.ts (MENUS_DATA: look up the current menu tree to determine parent_id and the next free ID)
5. Scan the existing modules first: if the requirement can be met by extending an existing module, extend it rather than creating a duplicate module
```

Menu IDs are allocated from the range table in AGENTS.md; before picking one, check what `MENUS_DATA` actually uses:

```bash
grep -oE "id: [0-9]+" apps/api/scripts/seed-rbac.ts | awk '{print $2}' | sort -n | uniq
```

### Step 2 — Produce the internal spec (not shown to the PM)

From the PM's business description, infer the technical spec and write it as a spec JSON file (format `docs/spec.schema.json`, inference rules in AGENTS.md "From a one-line requirement to a spec", 4 worked examples in `docs/examples/specs/`; read one first). Put the file anywhere outside the repo (a scratch directory) or next to your notes; it isn't committed. Then check it:

```bash
pnpm scaffold -- --spec <dir>/<name>.spec.json --validate-only
# ✅ Spec is valid: device (设备台账), 8 fields
#    API: /api/admin/devices (list / create / detail / update / delete / export / import template / import)
#    Permissions: system_device / _add / _edit / _delete / _export / _import
#    Table: devices; search field: name
#    Menu: 设备台账 (ID 1001, /biz/devices, buttons 10011–10015), in the new 业务管理 directory (ID 1000); written to scripts/seed-rbac.ts
```

With `"menu": {}` in the spec, scaffold allocates the menu ID, path (`/biz/<name-kebab>s`) and buttons itself under 业务管理 (Business); the manual menu rules below (ID ranges, `/system/...` paths) only apply when you generate with `--fields` and register the menu by hand.

What to infer (the spec and `--validate-only` settle all of it):

```
- Resource name (snake_case, e.g. customer_order) and domain (admin | component_center)
- API path (/api/admin/<resource>s, hyphens for multiple words, e.g. /api/admin/customer-orders)
- Field names + scaffold types (str/str20/str50/str500/text/int/float/bool/date/datetime/file/image, following AGENTS.md "Field type inference"; images and attachments use image / file, which store a file ID from the file center)
- Permission codes (admin domain system_<name>, component_center domain cc_<name>, matching the Perm prefix scaffold prints; buttons _add/_edit/_delete/_export/_import)
- Frontend file path (admin domain modules/admin/pages/<name>/index.tsx;
                     component_center domain modules/component_center/pages/admin/<name>_page/index.tsx; API file api/<name>.ts)
- (--fields only) Menu ID (an ID not used in `MENUS_DATA`, from the ID allocation ranges in AGENTS.md; button ID = menu ID × 10 + sequence number)
- (--fields only) Menu path: admin domain `/system/<name-kebab>s` (e.g. `/system/suppliers`); component_center domain `/component-center/<group>/<name-kebab>` (like the sibling pages of the gallery group it goes under, e.g. `/component-center/patterns/kanban`)
- Menu order: last among its siblings; icon: reuse a name already in the mapping table in `apps/web/src/lib/menu-icons.ts`
- Resource name: scaffold always appends `s` to the table name / API path, so think about the plural when choosing the name (`equipment` becomes `equipments`; use a countable noun such as `device` instead)
- Enum fields: the database stores English codes (e.g. `raw_material`), the UI / exports show Chinese, imports accept either Chinese or English; the list gets a filter per enum field and shows each option as a badge, so give status-like options a `tone` (`success` / `warning` / `danger`, default `neutral`)
- parent_id: the 业务管理 (Business) directory by default; spec `menu.parentId` when the PM names another place
- Migration name (scaffold uses <name> by default)
```

### Step 3 — Show the business preview and wait for confirmation

Show the PM business-level information only, in this format:

```
📋 <feature name>

Location: <parent menu> → <feature name>   (as --validate-only reports it)
Features: list, create, edit, delete (adjust as needed)
Fields:
  · <field label> (required)
  · <field label>
  · ...

Shall I go ahead with this, or is there anything to adjust?
```

- If the PM confirms → go to Step 4
- If the PM adjusts → update the internal spec and show the preview again

### Step 4 — Implement

**4a. Generate the skeleton from the spec**

```bash
pnpm scaffold -- --spec <dir>/<name>.spec.json --dry-run   # lists every file it would write or update; writes nothing
pnpm scaffold -- --spec <dir>/<name>.spec.json             # generate
```

(Without a spec: `pnpm scaffold -- --name <name> --domain <admin|component_center> --fields "<field>:<type>,..."`; see the `--fields` notes below.)

scaffold will:
- Generate `apps/api/src/db/schema/<domain-dir>/<name-kebab>.ts` (Drizzle table definition + toDict)
- Generate `apps/api/src/modules/<domain-dir>/<name-kebab>/{schema,repository,service,routes}.ts`
- Generate the frontend `apps/web/src/modules/<module>/api/<name>.ts` + page `index.tsx` (shadcn/ui system, same structure as the users page: PageHeader → FilterBar → DataTable → FormDialog → ImportDialog / ExportDialog), typed from the module's OpenAPI entries: the API file exports the row type `ApiItem<'/api/admin/<name-kebab>s'>`, the page has `interface FormValues` + `useForm<FormValues>` and `DataTableColumn<Row>[]` (AGENTS.md "TypeScript")
- Write the module's endpoints into `docs/apifox-full.openapi.json` and regenerate `apps/web/src/shared/api/openapi.d.ts` from it, so the generated frontend files type-check straight away
- Generate basic API tests `apps/api/test/<admin|cc>-<name-kebab>.test.ts` (CRUD, list search, 404, export, import template, successful import / rollback when a required column is empty)
- Register in `apps/api/src/db/schema/index.ts` and `apps/api/src/modules/<domain-dir>/router.ts` automatically
- Run `drizzle-kit generate --name <name>` automatically to generate the migration SQL

(`<domain-dir>` is `admin` or `component-center`; `<name-kebab>` is the name with underscores replaced by hyphens.)

The spec gets the Chinese title / labels, required, unique, defaults, fixed options (with badge tones), data dictionaries, the menu (and its translations) and the OpenAPI docs right in one go:

- `title` and every field's `label` are required (in Chinese); a misspelled property name (e.g. `requried`) is an error

- `required` → `NOT NULL` + the service reports `<label>不能为空` ("<label> must not be empty") + the form field is required; `unique` → `UNIQUE` (text / numbers only); `default` → column default, used when the field is left empty on create
- Fixed values such as status, type or level use `enum` + `options` (English snake_case values, Chinese names); values that come from a data dictionary use `dict` + the dictionary code
- `i18n` holds English / Japanese for the title, labels and option names; missing ones fall back to the field name. All locales files are one namespace, so a text already translated elsewhere in the app (备注, 状态 …) keeps that translation; scaffold prints a `[note]` for each spec translation that isn't used
- The generated API tests get one extra "field rules" case; when you add business rules later, keep the tests up to date
- With `--fields` only, none of the above is available: labels are English placeholders and must be edited by hand (table columns, form, `EXPORT_FIELD_MAP`, `IMPORT_HEADER_MAP`); constraint violations are turned into 400 by the service (`apps/api/src/common/db-errors.ts`)
- The permission prefix is singular, `system_<name>` / `cc_<name>`; it only has to match the routes and verify, so don't change it to plural

If scaffold is not available, copy `docs/templates/` by hand (the placeholder replacement rules are in `docs/templates/backend/README.md`), and do the registration above and `pnpm db:generate --name <description>` by hand.

**4b. Add the business logic**

Fill in the actual fields, the Chinese column headers (`EXPORT_FIELD_MAP` / `IMPORT_HEADER_MAP`) and the business rules in the order db/schema → schema → repository → service → routes.

- Permissions: `import { hasMenuPermission, loginRequired } from '@/common/auth'`, `await hasMenuPermission(request, code)`
- Output times with `toIso()`, keep numeric as strings, throw `ServiceError` for business errors
- If you change the table structure after scaffolding: generate an incremental migration with `pnpm db:generate --name <description>` (**don't write `--`**, drizzle-kit doesn't understand it)

**4b'. Frontend page**

The page scaffold generates already works; polish it for the business:

- With a spec, the title, labels, required rules, enum `FormSelect`s and `StatusBadge` columns are already generated (**no description** under the page title; see the "Copy" item in the design doc); with `--fields` only, change the title and labels to Chinese and add `rules` (messages matching the backend) by hand
- **Types**: keep the page typed as generated (`docs/templates/frontend/list_page/` shows the pattern): a new or changed field goes into `FormValues`, `EMPTY_VALUES` / `toFormValues` and the columns; the row and body types come from the OpenAPI doc, so when you change the backend's fields update the doc and run `pnpm openapi:generate`, and `tsc` points at the page code to follow. No `any`, no casts at call sites
- **Languages**: write UI text as Chinese source text and wire up translation per AGENTS.md "Internationalization (i18n) and code comments": strings passed to shared components are translated automatically; Chinese written directly in JSX, native element attributes and text with variables use `t()`; create `locales/en-US.json` and `locales/ja-JP.json` in the page directory for the translations; `node apps/web/scripts/i18n-scan.mjs <page directory>` must report 0 issues
- Register English and Japanese translations for new backend error / notice messages in `apps/api/src/i18n/messages.ts` (messages with variables go in `PATTERNS`)
- Code comments are always in English
- Use only `@/components/ui/*`, `@/shared/components/*`, `lucide-react` and Tailwind semantic color classes; don't add other UI component libraries (antd, MUI, etc.), don't hard-code hex colors
- Look up component usage in `.claude/skills/shadcn-ui-skills/SKILL.md`; look up the shadcn component API in the official docs (prefer the shadcn MCP when available); when a primitive is missing, run `apps/web/scripts/shadcn-add.sh <component>`
- Self-check: `cd apps/web && npx eslint <page file> && npx tsc --noEmit` with zero errors

**4c. RBAC**

When using `--spec` with `menu`, the menu and button permissions are already written (skip the editing in this step and just run the sync below); otherwise add the menu entry (`component` is the Menu component scaffold prints) and the button permissions to `MENUS_DATA` in `apps/api/scripts/seed-rbac.ts`, then run:
```bash
pnpm seed:rbac -- --incremental
```

Also add a row for the new menu to AGENTS.md "Current menu tree (ID reference)".

**4d. Database migration (must actually be applied)**

```bash
# Run after reviewing the newly generated SQL in apps/api/drizzle/
pnpm db:migrate
# Proof: the table / columns really exist (the DB name comes from DEV_DATABASE_URL in apps/api/.env.development)
psql -d castor_kit -c '\d <name>s'
```

**4e. API docs (required; verify's openapi_sync and the API tests both block on it)**

`pnpm scaffold` has already written the module's 8 endpoints into `docs/apifox-full.openapi.json` (field types, required, unique, defaults, options, dictionaries, permissions and data scope all follow the spec), so after generating it already satisfies the "OpenAPI writing rules". Only when you change the generated routes, fields or validation, or add routes, do you need to update the doc to match the code:

```bash
pnpm openapi:generate            # add skeletons for new routes (complete the skeletons per the rules)
pnpm openapi:generate -- --strict  # re-check; lists the specific problems of each non-conforming endpoint
```

The AI assistant and external callers rely only on this doc, so fields must not be made up.

A new route that reads a JSON body declares it with `routeBody(schema, 'create' | 'patch' | 'array')` like the generated ones (`{ ...opts, ...item.route }` in the route options, `item.parse(request)` after the permission check; never `parseBody` directly). `--strict` then also compares each documented request body with that Zod declaration (rule `body-sync`: nullability, `required`, types, enums), so a field you add or change in `schema.ts` must be updated in the doc too.

### Step 5 — Verification gate (mandatory, never skip)

```bash
pnpm verify -- --module <name>
# Includes the frontend build and frontend + backend unit tests (backend takes about 45s); add --json for structured results
# While debugging you can add --skip-build / --skip-api-tests to speed things up, but run the full version once before delivery
```

- If anything fails → fix it automatically → run verification again
- The `migration applied` line shows the detail `migrated to 0001_<name> (castor_kit)`; put it in the delivery report
- Only a run without `--skip-*` flags counts: with them verify ends "The checks that ran passed, but N were skipped …" instead of "ready to deliver"
- Once everything passes, output the delivery report

---

## Delivery report format

```
✅ <feature name> delivered

Changed files:
  Backend:  apps/api/src/db/schema/<domain-dir>/<name-kebab>.ts
            apps/api/src/modules/<domain-dir>/<name-kebab>/{schema,repository,service,routes}.ts
            apps/api/src/db/schema/index.ts, apps/api/src/modules/<domain-dir>/router.ts (registration)
            apps/api/test/<admin|cc>-<name-kebab>.test.ts (API tests)
  Frontend: apps/web/src/modules/<module>/pages/<subdir>/<page>/index.tsx
            apps/web/src/modules/<module>/api/<name>.ts
  RBAC:     apps/api/scripts/seed-rbac.ts (--incremental has been run)
  Migration: migrated to <tag> (confirmed with psql \d <name>s)
  Gate:     pnpm verify -- --module <name> all passed (including frontend and backend unit tests)

Next steps for the user:
  1. Refresh the page and find the new feature under "<parent menu> → <feature name>"
  2. (When deploying to other environments) pnpm db:migrate && pnpm seed:rbac -- --incremental
```

---

## Default behavior (when the PM doesn't specify)

- Standard list page features: search + create + edit + delete + **import + export** (csv / xlsx, .xls not supported)
- RBAC button permissions: `_add` / `_edit` / `_delete` / `_export` / `_import`
- New route prefix: `/api/admin/<resource>s`
- Export / import routes: `POST /api/admin/<resource>s/export`, `GET /template`, `POST /import`
- Pagination: 20 per page (max 200)
- Sorting: by id descending

---

## Ask questions only in these cases (at most 1-2)

- The data model has an ambiguity that can't be undone later (e.g. complex relations that affect the table structure)
- An external system integration needs configuration
- A permission boundary has security implications and needs product confirmation

For every other technical decision, the AI makes a reasonable choice itself and states its assumptions in the delivery report.
