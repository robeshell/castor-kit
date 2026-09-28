# Commands

Run all `pnpm` commands from the repo root.

::: tip About the -- before arguments
For Castor's own scripts (`scaffold`, `verify`, `seed:rbac`, `seed:demo`, `openapi:*`), the `--` before arguments is optional. **Don't put `--` after `pnpm db:generate`**: its arguments go straight to drizzle-kit, which doesn't understand `--`.
:::

## Development

| Command | Description |
|---|---|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start the backend (5001) and frontend (5173) together |
| `pnpm dev:api` | Start the backend only (hot reload via `tsx watch`) |
| `pnpm dev:web` | Start the frontend only (Vite) |
| `pnpm --filter @castorjs/api worker` | Start the standalone scheduler process |
| `pnpm build` | Build all apps: frontend (Vite), backend (tsup), MCP Server |
| `pnpm --filter @castorjs/web preview` | Preview the frontend build |

## Quality checks

| Command | Description |
|---|---|
| `pnpm typecheck` | TypeScript type check (`apps/api`, `apps/mcp`, `apps/web` including its tests) |
| `pnpm test` | Run all tests (the backend needs the test database `castor_kit_test`) |
| `pnpm --filter @castorjs/api test` | Run backend tests only |
| `pnpm --filter @castorjs/web test` | Run frontend tests only |
| `pnpm --filter @castorjs/web test:watch` | Frontend tests in watch mode |
| `pnpm --filter @castorjs/mcp test` | Run the MCP Server tests only |
| `pnpm lint` | ESLint for the backend and the frontend |
| `pnpm --filter @castorjs/web lint` | Frontend ESLint only |
| `node apps/web/scripts/i18n-scan.mjs [dir]` | Scan for untranslated text; `dir` is relative to `apps/web`; scans all of `src` if omitted |

## Database

| Command | Description |
|---|---|
| `pnpm db:generate --name <description>` | Generate migration SQL from the table definitions into `apps/api/drizzle/` |
| `pnpm db:migrate` | Apply migrations |
| `psql -d <database> -c '\d <table>'` | Confirm the table structure is really in the database |
| `pnpm setup-once` | Migrations + incremental RBAC sync + AI SQL read-only account (plus a demo data reset when `DEMO_MODE` is on and one is due); guarded by an advisory lock and safe to re-run. The Docker image runs it on every start |
| `pnpm --filter @castorjs/api init-ro-role` | Create only the AI SQL read-only account `castor_kit_ro` (needs `POSTGRES_RO_PASSWORD`) |
| `pnpm demo:reset` | Restore the public demo data now. It empties every demo fixture table and the logs first, so don't run it on a database whose data you want to keep |

## RBAC

| Command | Description |
|---|---|
| `pnpm seed:rbac -- --incremental` | Incremental sync of menus and permissions: upserts by `code`, never deletes |
| `pnpm seed:rbac -- --incremental --reset-admin-password` | Also sets the `admin` account's password to `ADMIN_PASSWORD` |
| `pnpm seed:rbac` | Full rebuild: wipes users, roles, menus and their links, then rewrites them. **Only for initializing an empty database** |
| `pnpm seed:demo` | Adds sample departments, roles (department manager / staff) and users for trying data scope; safe to re-run, needs `--force` in production. `--password <pwd>` sets the sample users' password (default `demo123456` or `DEMO_USER_PASSWORD`); `--reset-passwords` also applies it to existing sample users |

## Code generation and the gate

| Command | Description |
|---|---|
| `pnpm scaffold -- --spec <file>` | Generate a module from a JSON spec (format: `docs/spec.schema.json`, examples: `docs/examples/specs/`): backend module, frontend page and API client, API tests, OpenAPI entries and migration; with a `menu` in the spec, also the menu and button permissions in `seed-rbac.ts` |
| `pnpm scaffold -- --spec <file> --validate-only` | Check the spec and print what would be generated; writes nothing, exits 1 on problems |
| `pnpm scaffold -- --name <name> --domain <admin\|component_center> --fields "<field:type,...>"` | Generate a module without a spec (same output, but no Chinese labels, constraints or menu) |
| `pnpm scaffold -- ... --dry-run` | Only print what would be generated; don't write files |
| `pnpm scaffold -- ... --skip-migration` | Generate code but no migration |
| `pnpm scaffold -- ... --data-scope` | Generated module filters by data scope (adds `dept_id` / `created_by`) |
| `pnpm verify -- --module <name>` | Run all gate checks |
| `pnpm verify -- --module <name> --skip-build` | Skip the frontend build |
| `pnpm verify -- --module <name> --json` | Output structured JSON |
| `pnpm verify -- --module <name> --skip-frontend-tests --skip-api-tests` | Skip frontend and backend tests |
| `pnpm verify -- --module <name> --skip-db` | Don't connect to the database (skips `migration_applied`) |
| `pnpm verify -- --module <name> --run-rbac-sync` | Also run an incremental RBAC sync |
| `pnpm verify -- --module <name> --strict-docs` | Make docs path check failures blocking |
| `pnpm verify -- --module <name> --database-url <url>` | Database used to check migration status |

The `--skip-*` flags are for debugging: a run that skipped checks with them lists them as skipped and doesn't report the feature as ready to deliver (`complete: false` in `--json`); run the gate without them before delivering.

Both `scaffold` and `verify` print their usage with `-h` / `--help`. For the options, see [AI-driven workflow](/guide/ai-workflow).

## OpenAPI

| Command | Description |
|---|---|
| `pnpm openapi:generate` | Add skeletons for undocumented routes + methods (written to `docs/apifox-full.openapi.json`), check the OpenAPI rules, and regenerate the frontend's API types `apps/web/src/shared/api/openapi.d.ts` |
| `pnpm openapi:generate -- --dry-run` | Check only; don't write back (the API types aren't regenerated either) |
| `pnpm openapi:generate -- --strict` | List every operation that breaks the rules and why; exit non-zero if any |
| `pnpm openapi:apifox` | Push to Apifox (needs `APIFOX_PROJECT_ID`, `APIFOX_ACCESS_TOKEN`) |
| `pnpm --filter @castorjs/web api:types` | Only regenerate `openapi.d.ts` from the OpenAPI document (`--check` exits 1 if it is out of date) |

## MCP Server

| Command | Description |
|---|---|
| `pnpm mcp` | Start the MCP Server (stdio) |
| `pnpm --filter @castorjs/mcp build` | Build into `apps/mcp/dist/` |

## Frontend components

| Command | Description |
|---|---|
| `apps/web/scripts/shadcn-add.sh <component>` | Run `npx shadcn@latest add` through the local registry relay |
| `apps/web/scripts/shadcn-add.sh --view <component>` | Only view the registry content; don't write files |

## Docker

Run from the repo root. Compose commands need `--env-file .env.production`.

| Command | Description |
|---|---|
| `bash scripts/setup.sh` | Interactive wizard: generates `.env.production`, then builds and starts |
| `docker compose --env-file .env.production up -d --build` | Build the image and start (also used after code updates) |
| `docker compose --env-file .env.production logs -f app` | Follow the app logs |
| `docker compose --env-file .env.production ps` | Show service status |
| `docker compose --env-file .env.production down` | Stop the services; volumes are kept |

## Docs site

The docs site in `website/` is a standalone npm project and is not part of the pnpm workspace:

| Command | Description |
|---|---|
| `npm --prefix website install` | Install the docs site dependencies |
| `npm --prefix website run dev` | Preview the docs site locally |
| `npm --prefix website run build` | Build the docs site (fails on dead links) |
| `npm --prefix website run screenshots` | Recapture the landing page and README screenshots from the running app (run `pnpm dev` first; prompts for the admin password) |
| `npm --prefix website run og` | Render the social preview image (`website/public/og.png` and `.github/assets/social-preview.png`) from the dashboard screenshot |

Once merged to main, the site is published to GitHub Pages by `.github/workflows/docs.yml`.
