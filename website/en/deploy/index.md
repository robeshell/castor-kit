# Deployment guide

The recommended way to deploy is Docker Compose. One compose stack contains two services: PostgreSQL (`db`) and the Node app (`app`). The app process serves both the backend API and the built frontend.

::: info No automatic deployment
The project has no CI-driven deployment. `.github/workflows/ci.yml` only runs lint, type checks, tests, the gate and the frontend build on pushes and pull requests. Deployment is done by hand on the server; see the update process below.
:::

## Architecture overview

| Component | Description |
|---|---|
| `db` | Image `postgres:alpine`; the database name and user are both `castor_kit`; data lives in the `postgres_data` volume |
| `app` | Built from the `Dockerfile` in the repo root; listens on port 5000 inside the container; uploaded files live in the `app_instance` volume (mounted at `/app/instance`) |

The image is built in two stages. The first stage, based on `node:22-alpine`, installs dependencies, builds the frontend (Vite) and backend (tsup), then prunes down to production dependencies. The second stage is the runtime image: it runs as a non-root user (uid 10001) and has a health check on `/health`.

On container start, `docker-entrypoint.sh` runs, in order:

1. `node dist/setup-once.js`: under a PostgreSQL advisory lock, runs database migrations, the incremental RBAC sync, and creates or updates the AI SQL read-only account `castor_kit_ro`. Even when several replicas start at once, they run one after another and the result is idempotent.
2. `node dist/main.js`: starts the server.

::: warning Registry used during the build
The `Dockerfile` sets the npm registry to `https://registry.npmmirror.com`. If that registry is slow from your server, change it in the `Dockerfile`.
:::

## Option 1: setup wizard

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh
```

The wizard asks for the admin password, the port (default 5000) and optional AI settings; generates a random `SECRET_KEY`, `POSTGRES_PASSWORD` and `POSTGRES_RO_PASSWORD`; writes them to `.env.production`; then builds and starts the services and waits for `/health` to be ready.

::: warning setup.sh modifies your Docker configuration
If Docker's `daemon.json` (`~/.docker/daemon.json` on macOS, `/etc/docker/daemon.json` on Linux) has no `registry-mirrors`, the script adds a registry mirror and restarts Docker (via `sudo systemctl restart docker` on Linux). On a server that is already running other containers, Option 2 is recommended.
:::

## Option 2: manual setup

### 1. Create .env.production

Create `.env.production` in the repo root with at least the following variables (compose refuses to start if any of them is missing):

```bash
SECRET_KEY=<a long random string>
ADMIN_PASSWORD=<initial password for the admin account>
POSTGRES_PASSWORD=<database password>
POSTGRES_RO_PASSWORD=<AI SQL read-only account password>
```

Optional variables:

```bash
APP_PORT=5000          # Host port; 8080 if not set
AI_API_BASE=
AI_API_KEY=
AI_MODEL=
```

For every available variable, see [Configuration](/en/reference/configuration#docker). You can generate random strings with `openssl rand -base64 48`.

### 2. Build and start

```bash
docker compose --env-file .env.production up -d --build
```

The first build takes a few minutes. Then open `http://<server-address>:<APP_PORT>` and sign in with `admin` and your `ADMIN_PASSWORD`.

::: tip Every compose command needs --env-file
By default compose only reads `.env`, not `.env.production`. Without `--env-file .env.production`, the required variables are missing and the command fails immediately.
:::

::: warning ADMIN_PASSWORD only applies the first time
The `admin` account is only created if it doesn't exist. Changing `ADMIN_PASSWORD` after the first start won't change the existing account's password; sign in and change it in the UI.
:::

## Common operations

```bash
docker compose --env-file .env.production ps               # Show service status
docker compose --env-file .env.production logs -f app      # Follow the app logs
docker compose --env-file .env.production restart app      # Restart the app
docker compose --env-file .env.production down             # Stop the services; volumes are kept
curl -f http://localhost:<APP_PORT>/health                 # Health check
```

`/health` returns `{ status: 'healthy', ... }` when the database is reachable, and 500 otherwise.

::: danger Don't use down -v casually
`docker compose down -v` deletes the volumes, and with them the database and all uploaded files.
:::

## Updating

```bash
git pull
docker compose --env-file .env.production up -d --build
```

compose rebuilds the image from the latest code and recreates the `app` container. On start, the container automatically runs any new database migrations and the incremental RBAC sync: new menus appear and are granted to the super admin, while existing users, roles and custom data are left intact.

We recommend backing up the database before updating; see below.

## Data persistence and backups

| Volume | Default name | Contents |
|---|---|---|
| `postgres_data` | `castor-kit_postgres_data` | PostgreSQL data |
| `app_instance` | `castor-kit_app_instance` | Uploaded files |

To reuse existing volumes, set `COMPOSE_DB_VOLUME` / `COMPOSE_INSTANCE_VOLUME` in `.env.production` to the existing volume names.

Example database backup:

```bash
docker compose --env-file .env.production exec db pg_dump -U castor_kit castor_kit > castor_kit_backup.sql
```

::: tip Pin the PostgreSQL version
In `docker-compose.yml`, the `db` service uses the image tag `postgres:alpine`, which pulls the latest major version on a new machine. PostgreSQL data directories can't be used directly across major versions, so in production, pin the tag to a specific major version.
:::

## Reverse proxy and HTTPS

In production, put a reverse proxy (such as Nginx) in front of the app to handle TLS. Keep in mind:

- **Forward `Host` and the protocol headers**: the app trusts one proxy hop and reads the client IP and protocol from `X-Forwarded-For` / `X-Forwarded-Proto`. When `SESSION_COOKIE_SECURE` is empty, whether the cookie gets the `Secure` flag depends on the request protocol, so `X-Forwarded-Proto` must be passed through correctly.
- **WebSocket**: the `/ws` path needs the `Upgrade` header forwarded. The WebSocket handshake checks that `Origin` matches `Host` (or is in the `CORS_ORIGINS` allowlist), so the proxy must preserve the original `Host`.
- **Request body size**: the app allows request bodies up to 16MB by default (`MAX_CONTENT_LENGTH`), and import files up to 5MB. Nginx's `client_max_body_size` defaults to only 1MB, so raise it accordingly.
- **Streaming responses**: AI Chat uses SSE, and the app already sets `X-Accel-Buffering: no` in the response headers to turn off Nginx buffering.

Example Nginx config (assuming `APP_PORT=5000`):

```nginx
server {
    listen 80;
    server_name example.com;

    client_max_body_size 16m;

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

You can get an HTTPS certificate from Let's Encrypt (for example with Certbot's Nginx plugin). Once HTTPS is enabled, you can also set `SESSION_COOKIE_SECURE=true` explicitly in `.env.production`.

::: tip Allow access only through the proxy
When using a reverse proxy, you can change the port mapping in `docker-compose.yml` to bind only to localhost (e.g. `"127.0.0.1:${APP_PORT:-8080}:5000"`), so nobody can bypass the proxy and reach the app directly.
:::

## Multiple replicas and scheduled tasks

By default there is a single `app` container, and the task scheduler runs inside the web process (`RUN_SCHEDULER_IN_WEB` defaults to `true` in compose).

To run multiple app replicas:

1. Set `RUN_SCHEDULER_IN_WEB=false` on the web replicas.
2. Run a separate scheduler process: use the same image and **override the entrypoint** (not `command`) with `node dist/worker.js`.

The image's `ENTRYPOINT` is `docker-entrypoint.sh`, which always runs `setup-once` and then starts `main.js`; it never reads `command`. So add the scheduler service to `docker-compose.yml` like this:

```yaml
  worker:
    build: .
    restart: unless-stopped
    entrypoint: ["node", "dist/worker.js"]
    environment:
      # Same variables as the app service (DATABASE_URL, SECRET_KEY, ADMIN_PASSWORD, AI_SQL_DATABASE_URL, ...)
    depends_on:
      db:
        condition: service_healthy
```

The scheduler service doesn't run `setup-once`; database initialization is still done by the `app` container.

The scheduler is built on database leases: a given task is claimed by only one process at a time, so it never runs twice even when several processes run the scheduler at once. `setup-once` uses an advisory lock, so starting several replicas at the same time is also safe.

## Deploying without Docker

You need Node 22+, pnpm and PostgreSQL 14+.

```bash
# 1. Install dependencies and build
corepack enable
pnpm install --frozen-lockfile
pnpm build

# 2. Create .env.production in the repo root or in apps/api/, containing at least:
#    DATABASE_URL, SECRET_KEY, ADMIN_PASSWORD, AI_SQL_DATABASE_URL, POSTGRES_RO_PASSWORD

# 3. Initialize the database (migrations + incremental RBAC sync + read-only account)
NODE_ENV=production node apps/api/dist/setup-once.js

# 4. Start the server (listens on 0.0.0.0:5000 by default; change it with PORT)
NODE_ENV=production node apps/api/dist/main.js
```

- `NODE_ENV` must be set on the command line (or in your process manager); the backend uses it to decide to load `.env.production`.
- `AI_SQL_DATABASE_URL` should point at the read-only account, e.g. `postgresql://castor_kit_ro:<POSTGRES_RO_PASSWORD>@<host>/<database>`. Step 3 creates the read-only account using `POSTGRES_RO_PASSWORD`.
- The frontend build is in `apps/web/dist/`, and the backend serves pages from there by default.
- Run `main.js` under a process manager such as systemd or pm2; the standalone scheduler process is `apps/api/dist/worker.js`.
- To update: `git pull` → `pnpm install --frozen-lockfile` → `pnpm build` → run step 3 again → restart the server.
