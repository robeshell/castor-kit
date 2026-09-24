# Getting Started

::: info castor-kit and AuraStack
castor-kit is the Node.js/TypeScript rewrite of AuraStack (the Flask version): the backend is now Fastify + Drizzle, the React frontend is reused unchanged, and it connects to the same PostgreSQL schema with a compatible API contract.
:::

## Prerequisites

Choose the setup path that fits your situation:

| Path | Requirements |
|---|---|
| **Docker (recommended)** | [Docker Desktop](https://www.docker.com/products/docker-desktop/) — no other tooling needed |
| **Local development** | Node 22+, pnpm (`corepack enable` is enough), PostgreSQL 14+ |

---

## Quick Start — Docker (Recommended)

Docker is the fastest way to run castor-kit. The setup wizard handles everything automatically.

### 1. Install Docker Desktop

Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/). Wait until the bottom-left status icon turns green ("Running") before continuing.

### 2. Clone and run the setup wizard

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh
```

The interactive wizard asks for your admin password, the port, and optional AI settings, then generates `SECRET_KEY`, the database password and the AI SQL read-only password into `.env.production`. The entire process takes about 3–5 minutes on first run.

### 3. Access the application

Open **http://localhost:5000** (the port you chose in the wizard, 5000 by default) and log in with:

- **Username:** `admin`
- **Password:** the password you set during setup (default: `admin123`)

::: tip Manual Docker start (no wizard)
If you prefer to configure things manually:

```bash
cp .env.example .env.production
# Edit .env.production — set at least:
#   SECRET_KEY / ADMIN_PASSWORD / POSTGRES_PASSWORD / POSTGRES_RO_PASSWORD
docker compose --env-file .env.production up -d --build
```

Without `APP_PORT` the app is exposed on port **8080**.
:::

---

## Local Development Setup

Use this path when you want to modify the source code and see changes live. castor-kit is a pnpm monorepo — run every command from the repository root.

### 1. Clone and install dependencies

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
corepack enable        # activates the pnpm version pinned in package.json
pnpm install
```

### 2. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env.development
```

Open `apps/api/.env.development` and set at least the database connection:

```env
DEV_DATABASE_URL=postgresql://youruser@localhost/aurastack
```

In development `NODE_ENV` defaults to `development`; `SECRET_KEY` and `ADMIN_PASSWORD` may be left empty (a built-in dev key and `admin123` are used).

### 3. Initialize the database

```bash
# Create the database
createdb aurastack

# Run the Drizzle migrations (an empty database gets every table)
pnpm db:migrate

# Seed RBAC data (menus, super-admin role, admin account)
pnpm seed:rbac
```

::: warning seed:rbac without flags is a full rebuild
Plain `pnpm seed:rbac` wipes and recreates accounts, roles and menus — use it only for the first initialization. For later menu changes use `pnpm seed:rbac -- --incremental`.
:::

### 4. Start the dev servers

```bash
pnpm dev
```

This starts the Fastify backend (port 5001, hot reload via `tsx watch`) and the Vite frontend (port 5173, `/api` and `/ws` are proxied to the backend). You can also start them separately in two terminals with `pnpm dev:api` and `pnpm dev:web`.

Open **http://localhost:5173** and log in with `admin` / `admin123`.

::: tip macOS double-click launcher
Once the database is initialized you can simply double-click **`启动castor-kit.command`** in the project root; it runs `pnpm install`, `pnpm setup-once` and `pnpm dev`.
:::

---

## AI Tools Setup

castor-kit ships with pre-configured context for all major AI coding tools. Clone the repo and start working immediately — no extra setup required.

### Claude Code (Recommended)

```bash
# Install
npm install -g @anthropic-ai/claude-code

# Start in the project directory
cd castor-kit
claude
```

Claude Code automatically reads `CLAUDE.md` and `AGENTS.md` on startup. Use the built-in skill:

```
/new-feature-autopilot
```

### Cursor

1. Download and install [Cursor](https://cursor.sh)
2. Open the project folder in Cursor
3. Rules in `.cursor/rules/` load automatically — describe your feature in the chat panel

### GitHub Copilot

1. Install the **GitHub Copilot** extension in VS Code
2. Open the project folder in VS Code
3. `.github/copilot-instructions.md` is injected as project context automatically
4. Use Copilot Chat (`Ctrl+Shift+I`) to describe your feature

### Windsurf

1. Download and install [Windsurf](https://codeium.com/windsurf)
2. Open the project folder in Windsurf
3. `.windsurfrules` loads automatically — use Cascade to describe your feature

### Codex CLI

```bash
# Install
npm install -g @openai/codex

# Run in the project directory
cd castor-kit
codex "Create a customer management page with fields: name, phone, company, status"
```

Codex CLI reads `AGENTS.md` natively; `CODEX.md` adds command and permission notes.

### MCP clients (Claude Desktop, etc.)

castor-kit includes an MCP server (`apps/mcp`) that exposes scaffolding, the verification gate, RBAC sync and migrations as MCP tools. Add it to `claude_desktop_config.json`:

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

---

## AI Development Workflow

Using Claude Code as an example, here's the full end-to-end flow:

### 1. Describe your feature

```
/new-feature-autopilot

Create a customer management page with fields: name, phone, company, status (active/inactive)
```

### 2. AI infers the technical spec

The AI reads `AGENTS.md` and `docs/templates/` to infer:

- Table column types (Drizzle syntax)
- API route naming
- Frontend page path
- RBAC permission codes and menu ID

**You don't need to answer any technical questions.**

### 3. Confirm the business preview

The AI shows you a plain-language preview before touching any code:

```
📋 Customer Management

Location: System → Customer Management
Actions: list, create, edit, delete, import, export
Fields:
  · Name (required)
  · Phone
  · Company
  · Status

Proceed, or anything to adjust?
```

### 4. Full module is generated

After confirmation, the AI runs `pnpm scaffold` and fills in the business logic:

| File | Contents |
|---|---|
| `apps/api/src/db/schema/admin/customer.ts` | Drizzle table definition + `toDict` |
| `apps/api/src/modules/admin/customer/schema.ts` | Zod validation, import/export field maps |
| `apps/api/src/modules/admin/customer/repository.ts` | Database access |
| `apps/api/src/modules/admin/customer/service.ts` | Business logic |
| `apps/api/src/modules/admin/customer/routes.ts` | Fastify routes + permission checks |
| `apps/web/src/modules/admin/pages/customer/index.jsx` | React list page (with import/export) |
| `apps/api/drizzle/` | Drizzle SQL migration |
| `apps/api/scripts/seed-rbac.ts` | Menu + button permission entries |

It then runs `pnpm seed:rbac -- --incremental`, applies the migration with `pnpm setup-once`, and confirms the table exists with `psql \d`.

### 5. Verify

```bash
pnpm verify -- --module customer
```

All checks pass — your feature is ready to ship.
