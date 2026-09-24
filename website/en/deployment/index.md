# Deployment

## Docker Deployment (Recommended)

Docker is the officially recommended deployment method. A single command starts PostgreSQL plus the Node server (the Fastify backend also serves the built React frontend), and the container runs Drizzle migrations, RBAC sync and the AI SQL read-only role setup on startup.

### 1. Use the setup wizard (easiest)

```bash
bash setup.sh
```

The wizard writes `.env.production` (random `SECRET_KEY`, database password and read-only password), then builds and starts the stack. The default port is 5000.

### 2. Or configure environment variables manually

```bash
cp .env.example .env.production
```

Edit `.env.production` and set at least these four values (`docker-compose.yml` refuses to start if any is missing):

```env
SECRET_KEY=a-random-string-of-64-or-more-characters   # Required — session encryption key
ADMIN_PASSWORD=your-admin-password                   # Required — initial admin password
POSTGRES_PASSWORD=your-db-password                   # Required — PostgreSQL password
POSTGRES_RO_PASSWORD=your-readonly-password          # Required — password of the AI SQL read-only role aurastack_ro
```

Then build and start:

```bash
docker compose --env-file .env.production up -d --build
```

The first run takes 2–5 minutes (pulling images + installing dependencies + building frontend and backend). Subsequent starts are fast.

### 3. Access the application

Open **http://localhost:8080** (or whichever port you set in `APP_PORT`; the wizard defaults to 5000) and log in with `admin` / `<ADMIN_PASSWORD>`.

### What happens when the container starts

The image is based on `node:22-alpine` and runs as a non-root user. The entrypoint `docker-entrypoint.sh` runs:

1. `node dist/setup-once.js` — under a PostgreSQL advisory lock: migrations → incremental RBAC sync → create/update the AI SQL read-only role (only one replica does the work even if several start at once)
2. `node dist/main.js` — starts the server on port 5000 inside the container; `/health` is used for health checks

---

## Environment Variable Reference

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | _(required)_ | Session encryption key (castor-kit derives the cookie key from it with HKDF). |
| `ADMIN_PASSWORD` | _(required)_ | Initial password for the `admin` account. |
| `POSTGRES_PASSWORD` | _(required)_ | PostgreSQL service password. |
| `POSTGRES_RO_PASSWORD` | _(required)_ | AI SQL read-only role password; compose builds `AI_SQL_DATABASE_URL` from it. |
| `APP_PORT` | `8080` | Host port mapped to the app container (the wizard writes 5000). |
| `AI_API_KEY` | _(empty)_ | API key for AI features. Leave blank to disable AI pages. |
| `AI_API_BASE` | _(empty)_ | OpenAI-compatible endpoint (e.g. `https://api.openai.com/v1`, Azure OpenAI, a local proxy). |
| `AI_MODEL` | _(empty)_ | Model name, e.g. `gpt-4o`. |
| `ENABLE_TASK_SCHEDULER` | `true` | Enable the scheduled-task scheduler. |
| `RUN_SCHEDULER_IN_WEB` | `true` | Run the scheduler inside the web process (for multiple replicas set `false` and run a separate worker). |
| `SESSION_TTL_HOURS` | `8` | Session lifetime in hours. |
| `SESSION_COOKIE_SECURE` | _(empty = auto)_ | When empty, the cookie gets the `Secure` flag only on HTTPS requests. |
| `CORS_ORIGINS` | _(empty)_ | Comma-separated list of allowed cross-origin sources. |
| `COMPOSE_DB_VOLUME` / `COMPOSE_INSTANCE_VOLUME` | `castor-kit_postgres_data` / `castor-kit_app_instance` | Volume names for the database and uploaded files. |

::: warning
In production (`NODE_ENV=production`) the server refuses to start without `SECRET_KEY`, `ADMIN_PASSWORD` or `AI_SQL_DATABASE_URL`. If `AI_API_KEY` is not set, the AI Chat and AI Prompt Workshop pages will return errors. All other features work normally.
:::

---

## Common Commands

```bash
# Tail application logs
docker compose logs -f app

# Stop all containers (database data is preserved)
docker compose down

# Stop all containers and delete the database volume
docker compose down -v

# Rebuild after a code update
docker compose --env-file .env.production up -d --build
```

---

## Switching Over from AuraStack

castor-kit is the Node.js rewrite of AuraStack and uses the same database schema. On a server that already runs AuraStack with Docker, castor-kit can reuse the existing volumes:

```bash
COMPOSE_DB_VOLUME=aurastack_postgres_data \
COMPOSE_INSTANCE_VOLUME=aurastack_app_instance \
docker compose --env-file .env.production up -d --build
```

- On first start the baseline migration is only marked as applied; no existing table is changed and the `alembic_version` table is left alone
- Password hashes are compatible, so accounts keep working, but session cookies are not — every user has to log in once more after the switch
- The old `FLASK_ENV` entry in `.env.production` is no longer used; compose sets `NODE_ENV=production`

---

## Manual Server Deployment

For VPS or bare-metal servers without Docker. Requires Node 22+, pnpm and PostgreSQL 14+.

### 1. Install dependencies and build

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

The frontend is built into `apps/web/dist/` and the backend into `apps/api/dist/`; in production the Node server serves the frontend static files itself.

### 2. Configure environment variables

```bash
cp .env.example .env.production
```

Edit `.env.production` (either the repository root or `apps/api/` works):

```env
SECRET_KEY=your-strong-random-secret
DATABASE_URL=postgresql://user:password@localhost/aurastack
ADMIN_PASSWORD=your-admin-password
POSTGRES_RO_PASSWORD=your-readonly-password
AI_SQL_DATABASE_URL=postgresql://aurastack_ro:your-readonly-password@localhost/aurastack
```

### 3. Initialize the database

```bash
NODE_ENV=production node apps/api/dist/setup-once.js
```

This runs the migrations, syncs RBAC data and creates the read-only role `aurastack_ro` from `POSTGRES_RO_PASSWORD`.

### 4. Start the server

```bash
NODE_ENV=production node apps/api/dist/main.js
```

It binds to `0.0.0.0:5000` by default; change it with the `PORT` environment variable. Use systemd or pm2 to keep the process running.

::: tip Standalone scheduler process
For multi-instance deployments, set `RUN_SCHEDULER_IN_WEB=false` for the web processes and run one scheduler process:
```bash
NODE_ENV=production node apps/api/dist/worker.js
```
:::

---

## Nginx Reverse Proxy

Put Nginx in front of the Node server for TLS termination, compression, and static file caching.

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # WebSocket support (component-center WebSocket / performance monitor pages)
    location /ws {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
    }
}
```

::: tip TLS / HTTPS
Use [Certbot](https://certbot.eff.org/) with the Nginx plugin to obtain and auto-renew a free Let's Encrypt certificate:
```bash
certbot --nginx -d your-domain.com
```
:::

---

## Updating

### Docker

```bash
git pull
docker compose --env-file .env.production up -d --build
```

Compose rebuilds the image with the latest code; migrations and the RBAC sync run automatically on container start. No manual steps needed.

### Manual

```bash
git pull
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production node apps/api/dist/setup-once.js
# Restart the Node server (e.g. via systemd)
sudo systemctl restart castor-kit
```
