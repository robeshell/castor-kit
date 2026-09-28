# Quick start

There are two ways to run Castor:

| Option | Use it for | Requirements |
|---|---|---|
| One-command Docker setup | Trying it out, demos, deployment | Docker (with the `docker compose` plugin) |
| Local development | Changing the source, building new features with AI | Node 22+, pnpm, PostgreSQL 14+ |

## One-command Docker setup

### 1. Clone the repo and run the setup wizard

```bash
git clone https://github.com/robeshell/castorjs.git
cd castorjs
bash scripts/setup.sh
```

`setup.sh` does the following, in order:

1. Checks that Docker is installed and running and that the `docker compose` plugin is available.
2. If `.env.production` already exists in the repo root, asks whether to reconfigure; if you answer no, it keeps the file and skips to step 4.
3. Asks for the admin password (press Enter for `admin123`), the port (press Enter for `5000`), and whether to configure the AI features now (API key, base URL and model name of an OpenAI-compatible API). It then generates a random `SECRET_KEY`, database password and AI SQL read-only account password, and writes everything to `.env.production`. AI values entered here pin those settings, so the System settings page shows them read-only.
4. Adds a Docker registry mirror if none is configured (see the warning below).
5. Runs `docker compose --env-file .env.production up -d --build` to build and start the services.
6. Polls `http://localhost:<port>/health` until the service is ready (for about 90 seconds; if it's still not up, it prints the command for viewing the logs).

The first run downloads dependencies and builds the image, which usually takes a few minutes.

::: warning setup.sh modifies your Docker configuration
If Docker's `daemon.json` has no `registry-mirrors` entry, the script adds the registry mirror `https://docker.xuanyuan.me` and restarts Docker. If you don't need a mirror, skip the wizard and follow the [Deployment guide](/deploy/) to configure and start everything manually.
:::

### 2. Sign in

Open `http://localhost:5000` (or the port you chose in the wizard) and sign in with:

- Username: `admin`
- Password: the password you set in the wizard (default `admin123`)

### 3. Common commands

Every `docker compose` command needs `--env-file .env.production`; without it, compose can't find the required variables and fails immediately:

```bash
docker compose --env-file .env.production logs -f app   # Follow the app logs
docker compose --env-file .env.production down          # Stop the services (volumes are kept)
docker compose --env-file .env.production up -d         # Start again
```

For more (manual configuration, updates, reverse proxy), see the [Deployment guide](/deploy/).

## Local development

Run all commands from the repo root.

### 1. Prerequisites

- Node 22 or later (the repo's `.nvmrc` is `22`)
- pnpm (the version is in the `packageManager` field of the root `package.json`; enable it with `corepack enable`; Node 25 and later no longer bundle corepack, so use `npm i -g pnpm@11` there)
- A local PostgreSQL 14 or later that you can reach with `createdb` / `psql`

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure the database connection

```bash
cp apps/api/.env.example apps/api/.env.development
```

`apps/api/.env.development` is gitignored. In the example file, `DEV_DATABASE_URL` is `postgresql://localhost/castor_kit`; adjust the user, password and database name to match your machine. For other optional settings, see [Configuration](/reference/configuration).

::: tip Config file load order
The backend loads `.env.<NODE_ENV>` based on `NODE_ENV` (default `development`): first from `apps/api/`, then from the repo root. Environment variables that are already set are never overridden.
:::

### 4. Create and initialize the database

```bash
createdb castor_kit
pnpm db:migrate      # Run the Drizzle migrations to create all tables
pnpm seed:rbac       # Write the menus, the super admin role and the admin account
```

Or run migrations and RBAC sync with a single command:

```bash
pnpm setup-once      # Migrations + incremental RBAC sync + AI SQL read-only account (skipped if POSTGRES_RO_PASSWORD is not set)
```

::: warning pnpm seed:rbac is a full rebuild
`pnpm seed:rbac` without arguments wipes users, roles, menus and their relations, then rewrites them. Use it only to initialize an empty database. For a database that already has data, use `pnpm seed:rbac -- --incremental`. See [Permissions (RBAC)](/guide/rbac).
:::

### 5. Start the dev servers

```bash
pnpm dev
```

This starts both:

| Service | URL | Notes |
|---|---|---|
| Backend | `http://localhost:5001` | Hot reload via `tsx watch` |
| Frontend | `http://localhost:5173` | Vite dev server; `/api` and `/ws` are proxied to 5001 |

Open `http://localhost:5173` and sign in with `admin` / `admin123`.

You can also start them separately: `pnpm dev:api`, `pnpm dev:web`.

::: tip Default account
In development, if `ADMIN_PASSWORD` is not set, the initial password is `admin123`. The `admin` account is only created when it doesn't exist, so changing `ADMIN_PASSWORD` later won't change the existing account's password. Change it in the UI, or run `pnpm seed:rbac -- --incremental --reset-admin-password` to set it to the current `ADMIN_PASSWORD`.
:::

### 6. Run tests (optional)

`pnpm test` runs the backend and frontend tests. The backend tests run against a real PostgreSQL test database (default `postgresql://localhost/castor_kit_test`; override with `TEST_DATABASE_URL` in the shell or in `apps/api/.env.test`, not in `.env.development`). Before the tests start, migrations and an incremental RBAC sync are applied to it automatically:

```bash
createdb castor_kit_test      # Or clone the dev database: createdb -T castor_kit castor_kit_test
pnpm test
```

## Optional: AI features

AI Chat, AI Prompt Studio and AI Data Query in the Component Gallery need a model service: an OpenAI-compatible API (DeepSeek, Qwen, Ollama …) or OpenAI / Anthropic / Google directly. After signing in, pick the service type and fill in the API URL, API key and model on the AI tab of System → Configuration → System settings, check them with "Test call", and save; they apply right away.

You can also put them in `apps/api/.env.development` (the page then shows them read-only):

```bash
AI_PROVIDER=openai-compatible   # or openai / anthropic / google
AI_API_BASE=https://api.openai.com/v1
AI_API_KEY=<your API key>
AI_MODEL=<model name>
```

Without this configuration, those pages show a "not configured" notice; everything else works as usual.

## Optional: run scheduled tasks locally

In development, the web process does not start the task scheduler by default. To have tasks run on their cron schedule, pick one:

- Set `RUN_SCHEDULER_IN_WEB=true` in `apps/api/.env.development`
- Run the standalone scheduler process in another terminal: `pnpm --filter @castorjs/api worker`

## Next steps

- [Project structure](/guide/project-structure)
- [AI-driven workflow](/guide/ai-workflow): ship your first feature with AI
- [Commands](/reference/commands)
