# Commands

Run all `pnpm` commands from the repo root.

::: tip About the -- before arguments
For castor-kit's own scripts (`scaffold`, `verify`, `seed:rbac`, `openapi:*`), the `--` before arguments is optional. **Don't put `--` after `pnpm db:generate`**: its arguments go straight to drizzle-kit, which doesn't understand `--`.
:::

## Development

| Command | Description |
|---|---|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start the backend (5001) and frontend (5173) together |
| `pnpm dev:api` | Start the backend only (hot reload via `tsx watch`) |
| `pnpm dev:web` | Start the frontend only (Vite) |
| `pnpm --filter @castor-kit/api worker` | Start the standalone scheduler process |
| `pnpm build` | Build all apps: frontend (Vite), backend (tsup), MCP Server |
| `pnpm --filter @castor-kit/web preview` | Preview the frontend build |

## Quality checks

| Command | Description |
|---|---|
| `pnpm typecheck` | TypeScript type check (`apps/api`, `apps/mcp`) |
| `pnpm test` | Run all tests (the backend needs the test database `castor_kit_test`) |
| `pnpm --filter @castor-kit/api test` | Run backend tests only |
| `pnpm --filter @castor-kit/web test` | Run frontend tests only |
| `pnpm --filter @castor-kit/web test:watch` | Frontend tests in watch mode |
| `pnpm lint` | Backend ESLint |
| `pnpm --filter @castor-kit/web lint` | Frontend ESLint |
| `node apps/web/scripts/i18n-scan.mjs [dir]` | Scan for untranslated text; `dir` is relative to `apps/web`; scans all of `src` if omitted |

## Database

| Command | Description |
|---|---|
| `pnpm db:generate --name <description>` | Generate migration SQL from the table definitions into `apps/api/drizzle/` |
| `pnpm db:migrate` | Apply migrations |
| `psql -d <database> -c '\d <table>'` | Confirm the table structure is really in the database |
| `pnpm setup-once` | Migrations + incremental RBAC sync + AI SQL read-only account; guarded by an advisory lock and safe to re-run |
| `pnpm --filter @castor-kit/api init-ro-role` | Create only the AI SQL read-only account `castor_kit_ro` (needs `POSTGRES_RO_PASSWORD`) |

## RBAC

| Command | Description |
|---|---|
| `pnpm seed:rbac -- --incremental` | Incremental sync of menus and permissions: upserts by `code`, never deletes |
| `pnpm seed:rbac` | Full rebuild: wipes users, roles and menus, then rewrites them. **Only for initializing an empty database** |
| `pnpm seed:demo` | Adds sample departments, roles (department manager / staff) and users for trying data scope; safe to re-run, needs `--force` in production |

## Code generation and the gate

| Command | Description |
|---|---|
| `pnpm scaffold -- --name <name> --domain <admin\|component_center> --fields "<field:type,...>"` | Generate the backend module, frontend page, API tests and migration |
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

Both `scaffold` and `verify` print their usage with `-h` / `--help`. For the options, see [AI-driven workflow](/en/guide/ai-workflow).

## OpenAPI

| Command | Description |
|---|---|
| `pnpm openapi:generate` | Add skeletons for undocumented routes + methods (written to `docs/apifox-full.openapi.json`) and check the OpenAPI rules |
| `pnpm openapi:generate -- --dry-run` | Check only; don't write back |
| `pnpm openapi:generate -- --strict` | List every operation that breaks the rules and why; exit non-zero if any |
| `pnpm openapi:apifox` | Push to Apifox (needs `APIFOX_PROJECT_ID`, `APIFOX_ACCESS_TOKEN`) |

## MCP Server

| Command | Description |
|---|---|
| `pnpm mcp` | Start the MCP Server (stdio) |
| `pnpm --filter @castor-kit/mcp build` | Build into `apps/mcp/dist/` |

## Frontend components

| Command | Description |
|---|---|
| `apps/web/scripts/shadcn-add.sh <component>` | Run `npx shadcn@latest add` through the local registry relay |
| `apps/web/scripts/shadcn-add.sh --view <component>` | Only view the registry content; don't write files |

## Docker

Run from the repo root. Compose commands need `--env-file .env.production`.

| Command | Description |
|---|---|
| `bash setup.sh` | Interactive wizard: generates `.env.production`, then builds and starts |
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

Once merged to main, the site is published to GitHub Pages by `.github/workflows/docs.yml`.
