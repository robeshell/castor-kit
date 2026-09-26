# AI-driven workflow

The goal of castor-kit: you describe a business requirement in plain language, and your AI coding tool works out the technical details on its own, delivering a feature module end to end (table, API, page, permissions, migration) that follows the project's conventions and passes the verification gate.

This page covers the four pieces the workflow relies on: the project context in `AGENTS.md`, the per-tool AI configuration, the scaffold generator `pnpm scaffold`, and the verification gate `pnpm verify`.

## AGENTS.md: the single project context

`AGENTS.md` in the repo root is the complete project guide written for AI, and every AI tool treats it as the source of truth. It covers:

- Tech stack, directory layout and naming rules
- Backend layering rules, routing conventions, how to write permission checks, and cross-cutting conventions (time, numbers, errors, CSRF)
- Frontend dynamic routing, page structure, shared components, design tokens and i18n rules
- Import/export conventions, RBAC conventions, menu ID allocation rules and the current menu tree
- The field-type inference table (business description → field type)
- A list of anti-patterns and the standard delivery process

Each tool's own config file only adds to it and points back to `AGENTS.md`. When you change a project convention, change `AGENTS.md` first.

Deeper architecture notes are in `docs/architecture.md`; the frontend UI approach is in `docs/frontend-redesign-plan.md`.

## Supported AI tools

| Tool | Files it reads |
|---|---|
| Claude Code | `CLAUDE.md`; skills in `.claude/skills/` (`new-feature-autopilot`, `shadcn-ui-skills`) |
| Codex CLI | `AGENTS.md` (read automatically) + `CODEX.md`; skills in `.agents/skills/` |
| Cursor | `.cursor/rules/castor-kit-always.mdc` (always applied), `.cursor/rules/new-feature-autopilot.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Windsurf | `.windsurfrules` |
| Other tools | `llms.txt` (entry index) |
| MCP clients | `apps/mcp`; see [MCP Server](#mcp-server) below |

`.claude/skills/` and `.agents/skills/` have the same content; the backend test `skills-sync.test.ts` checks that they stay in sync.

## Feature delivery process

The `new-feature-autopilot` skill (type `/new-feature-autopilot` in Claude Code, or just say "build an XX feature") runs the five steps below. Other tools follow the same process through their own rule files.

### 1. Read the context

The AI reads `AGENTS.md`, the code scaffold templates under `docs/templates/`, the existing reference modules (backend `apps/api/src/modules/admin/users/`, frontend `apps/web/src/modules/admin/pages/users/index.jsx`), and the menu tree in `apps/api/scripts/seed-rbac.ts`. If the requirement can be met by extending an existing module, it prefers that.

### 2. Infer the technical spec

The AI infers the following internally, without asking you:

- The resource name and its domain (`admin` or `component_center`)
- The API path, e.g. `/api/admin/customer-orders`
- Field names and field types (based on the field-type inference table below)
- Permission codes: `system_<name>` for the `admin` domain, `cc_<name>` for the `component_center` domain, with `_add` / `_edit` / `_delete` / `_export` / `_import` appended for button permissions
- Frontend file paths, menu ID, parent menu, migration name

### 3. Show a business preview

The AI shows only business-level information and waits for you to confirm or adjust:

```text
Customers

Location: System → Customers
Features: list, create, edit, delete, import, export
Fields:
  · Customer name (required)
  · Phone
  · Status

Shall I go ahead, or would you like to change anything?
```

The AI asks additional questions only when the data model has an ambiguity that would be irreversible, when external system configuration is needed, or when a permission boundary has security implications.

### 4. Implement

1. Generate the scaffold with `pnpm scaffold` (preview with `--dry-run` first).
2. Fill in business logic, Chinese column headers and validation in the order `db/schema → schema → repository → service → routes`.
3. Polish the frontend page: Chinese labels, form validation, enum fields, translations.
4. Add the menu and button permissions to `seed-rbac.ts` and run `pnpm seed:rbac -- --incremental`.
5. Review the newly generated migration SQL, run `pnpm db:migrate`, and confirm the table really exists with `psql -d <database> -c '\d <table>'`.
6. Run `pnpm openapi:generate` to add skeletons for the new endpoints, then write them up from the code per `AGENTS.md` ("OpenAPI 编写规范") — required; `pnpm verify` checks it.

### 5. Verification gate

Run `pnpm verify -- --module <name>`. The AI fixes any failing checks and re-runs verification. Once everything passes, it outputs a delivery report that states the migration version (e.g. "已迁移至 0001_customer", i.e. "migrated to 0001_customer").

::: warning Migrations must actually be applied
Generating the migration file or passing static checks is not enough. You must run `pnpm db:migrate`, confirm with `psql \d`, and the `migration_applied` check of `pnpm verify` must pass.
:::

## pnpm scaffold

`pnpm scaffold` generates the backend module, frontend page, API tests and migration from a field definition in one go.

```bash
# Preview the files to be generated without writing anything
pnpm scaffold -- --name customer --domain admin --fields "name:str,phone:str20,status:str20" --dry-run

# Generate for real
pnpm scaffold -- --name customer --domain admin --fields "name:str,phone:str20,status:str20"
```

### Options

| Option | Description | Default |
|---|---|---|
| `--name` | Resource name in snake_case, e.g. `customer_order` | Required |
| `--domain` | Domain: `admin` or `component_center` | `admin` |
| `--fields` | Field list in the form `field:type,field:type` | `name:str` |
| `--dry-run` | Only print what would be generated; no files written, nothing registered, no migration | Off |
| `--skip-migration` | Don't call drizzle-kit to generate a migration | Off |
| `--data-scope` | Adds [data scope](/en/guide/rbac#data-scope): `dept_id` / `created_by` columns, list / detail / edit / delete / export filtered by the caller's scope, creator and department stamped on create, plus matching API tests | Off |
| `-h` / `--help` | Print usage | — |

### What gets generated

Existing files are skipped, never overwritten.

| Generated file | Description |
|---|---|
| `apps/api/src/db/schema/<domain-dir>/<name-kebab>.ts` | Table definition + `toDict` |
| `apps/api/src/modules/<domain-dir>/<name-kebab>/{schema,repository,service,routes}.ts` | The four backend layers |
| `apps/api/test/<admin\|cc>-<name-kebab>.test.ts` | Basic API tests (CRUD, search, 404, export, import template, import) |
| `apps/web/src/modules/<module>/api/<name>.js` | Frontend API client |
| Frontend list page `index.jsx` | In `pages/<name>/` for the `admin` domain, `pages/admin/<name>_page/` for the `component_center` domain |
| Page `locales/{en-US,ja-JP}.json` | Only generated when the page has Chinese text not covered by the shared translations |

`<domain-dir>` is `admin` or `component-center`; `<name-kebab>` is the resource name with underscores replaced by hyphens.

It also automatically:

- Registers the module in `apps/api/src/db/schema/index.ts` and `apps/api/src/modules/<domain-dir>/router.ts`
- Runs `drizzle-kit generate --name <name>` to generate the migration

scaffold prints the permission code prefix (Perm prefix), the menu `component` value and the API path in its output; use them directly when adding the menu.

### Field types

| Type | Drizzle column | Form component | Notes |
|---|---|---|---|
| `str` | `varchar(100)` | `FormInput` | |
| `str20` | `varchar(20)` | `FormInput` | |
| `str50` | `varchar(50)` | `FormInput` | |
| `str500` | `varchar(500)` | `FormInput` | |
| `text` | `text` | `FormTextarea` | |
| `int` | `integer` | `FormNumber` | |
| `float` | `numeric(10, 2)` | `FormNumber` | Returned by the API as a string, e.g. `"12.50"` |
| `bool` | `boolean` | `FormSwitch` | |
| `date` | `date` (string mode) | `FormDate` | `YYYY-MM-DD` |
| `datetime` | `timestamp` (string mode) | `FormDateTime` | |
| `file` | `varchar(36)` holding a file-center id | `FormFileUpload` | "View" link in the list; the reference is registered on save |
| `image` | `varchar(36)` holding a file-center id | `FormImageUpload` | Thumbnail in the list; the reference is registered on save |

Unknown types are treated as `str`. `id`, `created_at` and `updated_at` are added automatically.

### Field-type inference

The AI infers types from the business description, so you don't have to specify them:

| Keywords in the business description | Type |
|---|---|
| name, title, person's name, email | `str` |
| code, identifier, number (as in an ID or serial number) | `str50` |
| mobile, phone, status, type, color | `str20` |
| URL, link, address (external) | `str500` |
| image, avatar, cover, photo | `image` |
| attachment, file, contract, scan | `file` |
| description, remarks, summary, content, body, tags (JSON string) | `text` |
| amount, price, fee, cost | `float` |
| quantity, count, progress, percentage, sort order, weight | `int` |
| date (without time) | `date` |
| time | `datetime` |
| is/whether, enabled, disabled, toggle | `bool` |

### Known limitations

- `--fields` can't express required, unique or default values. Recommended flow: generate with `--skip-migration` first, then edit the table definition in `db/schema` (`.notNull()`, `.unique()`, `.$default(...)`), and finally run `pnpm db:generate --name <name>`. That way a new table produces only one migration.
- Generated titles and field labels are English placeholders; change them to Chinese.
- Enum fields are generated as `str20` and store English codes; showing Chinese in the UI needs a hand-written mapping.
- The table name is always the resource name plus `s`, and so is the API path. Keep the plural form in mind when choosing a resource name.
- `bool` columns are nullable; if you need a default, set it in the service.
- Once you add business rules, keep the generated API tests up to date.

If the scaffold isn't available, you can write the files by hand from `docs/templates/`; the substitution rules are in `docs/templates/backend/README.md`.

## pnpm verify

`pnpm verify` is the delivery gate: work is done only when every check passes.

```bash
pnpm verify -- --module customer                 # All checks
pnpm verify -- --module customer --skip-build    # Skip the frontend build (faster while debugging)
pnpm verify -- --module customer --json          # Structured JSON output (stdout contains only JSON)
```

### Checks

Global checks (always run):

| Check | What it checks |
|---|---|
| `typescript_compile` | `tsc --noEmit` over `apps/api` (including scripts and test) and `apps/mcp` |
| `no_local_has_permission` | Routes files must not define their own `hasPermission` |
| `migration_chain` | The drizzle migration journal is linear, the snapshot chain is complete, every entry has SQL, and there is no stray SQL |
| `migration_applied` | Compares the journal with `drizzle.__drizzle_migrations` in the database and confirms the module's table exists |
| `openapi_sync` | Whether the OpenAPI document is in sync with the routes (warning only) |
| `docs_paths` | Whether paths referenced in the AI context docs exist (warning only by default; blocking with `--strict-docs`) |

Module checks (run when `--module` is passed):

| Check | What it checks |
|---|---|
| `backend_file` | Backend routes / repository / service files exist |
| `data_scope_filter` | A module whose `schema.ts` declares `DATA_SCOPE` must filter with `dataScopeWhere` in its repository; skipped otherwise |
| `frontend_page` | The frontend page file exists |
| `frontend_no_legacy_ui` | The page directory doesn't use retired UI systems such as `@douyinfe/*` or `var(--semi-*)` |
| `frontend_api` | The frontend API file exists |
| `router_registration` | Routes are registered in `src/router.ts` or the domain `router.ts` |
| `schema_registration` | The table definition is registered in `db/schema/index.ts` |
| `rbac_seed` | `seed-rbac.ts` contains the module's menu or permission codes |

Build and tests (can be skipped):

| Check | What it checks | Skip flag |
|---|---|---|
| `frontend_build` | Frontend Vite build | `--skip-build` |
| `frontend_tests` | Frontend Vitest | `--skip-frontend-tests` |
| `api_tests` | Backend Vitest (needs the test database) | `--skip-api-tests` |

### Other options

| Option | Description |
|---|---|
| `--skip-db` | Skip `migration_applied` (no database connection) |
| `--run-rbac-sync` | Also run `seed:rbac --incremental` once (check `rbac_sync`) |
| `--database-url <url>` | Database connection used by `migration_applied` |
| `--strict-docs` | Make `docs_paths` failures blocking |

Use the skip flags to speed things up while debugging, but run the full gate once before delivering.

## MCP Server

`apps/mcp` exposes the toolchain as MCP tools, so MCP clients (such as Claude Desktop) can run the full development flow without a command line.

| Tool | Purpose |
|---|---|
| `get_project_context` | Returns the full text of `AGENTS.md` and the current module structure; call it before implementing a new feature |
| `get_menu_tree` | Returns the menu tree from the database, for picking `parent_id` and a free ID |
| `scaffold_feature` | Calls `pnpm scaffold` (parameters `name`, `domain`, `fields`, `dry_run`) |
| `run_verify` | Calls `pnpm verify --json` and returns the result (parameters `module`, `skip_build`) |
| `init_rbac` | Calls `pnpm seed:rbac -- --incremental` |
| `run_migration` | Runs `db:generate` + `db:migrate` (parameter `message` is used as the migration description) |
| `list_templates` | Lists the templates under `docs/templates/` |

Example Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "castor-kit": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/castor-kit", "-s", "mcp"]
    }
  }
}
```

Or build it first and run it directly with node:

```bash
pnpm --filter @castor-kit/mcp build
node /path/to/castor-kit/apps/mcp/dist/index.js
```

By default the MCP Server derives the repo root from its own location; override it with the `CASTOR_KIT_ROOT` environment variable.

## Related pages

- [Backend](/en/guide/backend): layering and API conventions
- [Frontend](/en/guide/frontend): page structure and shared components
- [Permissions (RBAC)](/en/guide/rbac): menu and button permissions
- [Commands](/en/reference/commands)
