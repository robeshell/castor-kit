# castor-kit

> **AI-First Full-Stack Management Scaffold**
> Node.js + TypeScript (Fastify 5 · Zod · Drizzle) + React 18 + PostgreSQL + Semi Design — built for AI-driven, end-to-end feature development.

![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![Node 22+](https://img.shields.io/badge/node-22%2B-green)
![pnpm](https://img.shields.io/badge/pnpm-workspaces-orange)

**[📖 Documentation](https://robeshell.github.io/castor-kit/)** · **[中文文档](README_CN.md)**

> *Castor* is the Latin genus name of the beaver — nature's engineer, building and extending a whole dam without blueprints.
>
> castor-kit is the Node.js/TypeScript rewrite of [AuraStack](https://github.com/robeshell/AuraStack) (Flask + React). It connects to the same PostgreSQL schema, keeps the API contract compatible, and ships the same React frontend unchanged.

---

## Features

- **AI-First workflow** — pre-configured for Claude Code, Cursor, Copilot, Windsurf, Codex CLI and MCP clients; PM describes a feature in plain English, AI generates the complete module
- **Typed toolchain** — `pnpm scaffold` generates table + API + page, `pnpm verify` gates delivery (typecheck, layering, migration really applied, RBAC seed, docs paths)
- **Full RBAC** — user / role / menu permission system with button-level access control
- **30+ component examples** — admin lists, Kanban, Gantt, data dashboards, AI chat, 3D creative, editors, WebSocket, and more
- **Import / export built-in** — every list page ships with CSV and XLSX import/export
- **Scheduled tasks** — database-backed, lease-based scheduler with a management UI
- **Production-ready Docker** — one command spins up the full stack with automatic Drizzle migration and RBAC seeding

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node 22 · TypeScript · Fastify 5 · Zod · pino |
| Database | PostgreSQL 14+ · Drizzle ORM + drizzle-kit (SQL migrations) |
| Frontend | React 18 · Vite 5 · React Router 7 · Axios |
| UI | Semi Design 2.93 |
| Charts | ECharts 6 · echarts-for-react |
| 3D | Three.js 0.176 |
| Editors | Monaco Editor · react-quill |
| Monorepo | pnpm workspaces: `apps/api` · `apps/web` · `apps/mcp` |

---

## Quick Start (Docker)

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh          # interactive wizard — sets passwords and port, optionally configures AI
```

Open **http://localhost:5000** (or the port you chose in the wizard) and log in as `admin` with the password you set.

## Local Development

Requires Node 22+, pnpm and a local PostgreSQL.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env.development   # set DEV_DATABASE_URL
createdb aurastack
pnpm db:migrate        # create tables (Drizzle baseline)
pnpm seed:rbac         # menus, super-admin role, admin / admin123
pnpm dev               # api :5001 + web :5173
```

AI tools read [AGENTS.md](AGENTS.md) (all tools), [CLAUDE.md](CLAUDE.md), [CODEX.md](CODEX.md), `.cursor/rules/`, `.windsurfrules` and `.github/copilot-instructions.md`. The full rewrite design is in [docs/rewrite-plan.md](docs/rewrite-plan.md).

> For deployment options, environment variables, AI tools integration and more — see the **[full documentation](https://robeshell.github.io/castor-kit/)**.

---

## License

MIT
