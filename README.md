<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/wordmark-dark.svg">
    <img src=".github/assets/wordmark-light.svg" alt="castor-kit" height="96">
  </picture>
</p>

<p align="center">
  <strong>The AI-first full-stack admin scaffold.</strong><br>
  Describe a feature in plain language and get a complete, verified module:<br>
  table, API, page, permissions and migration.
</p>

<p align="center">
  <a href="https://github.com/robeshell/castor-kit/actions/workflows/ci.yml"><img src="https://github.com/robeshell/castor-kit/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2563eb" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A5%2022-0284c7" alt="Node ≥ 22">
  <img src="https://img.shields.io/badge/pnpm-workspace-22d3ee" alt="pnpm workspace">
  <img src="https://img.shields.io/badge/i18n-zh%20%C2%B7%20en%20%C2%B7%20ja-0284c7" alt="i18n: zh · en · ja">
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-2563eb" alt="PRs welcome"></a>
</p>

<p align="center">
  <a href="website/guide/index.md">Documentation</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <b>English</b> ·
  <a href="README_CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/screenshot-dark.png">
    <img src=".github/assets/screenshot-light.png" alt="castor-kit admin UI" width="880">
  </picture>
</p>

---

## Why castor-kit

Most scaffolds give you a starting point and leave the rest to discipline. castor-kit writes the discipline down. [`AGENTS.md`](AGENTS.md) encodes the architecture, naming, field-type inference, permission and i18n rules in a form every AI coding tool can follow, and a scaffold + verification gate turns those rules into something enforceable. The result: feature one thousand is as clean as feature one, whether a person or an agent wrote it.

> *Castor* is the Latin genus of the beaver — nature's engineer, extending a whole dam one well-placed log at a time.

## Highlights

- **AI-first workflow** — pre-configured for Claude Code, Cursor, GitHub Copilot, Windsurf, Codex CLI and MCP clients. A plain-language request becomes table, API, page, RBAC entries and a migration.
- **Delivery gate** — `pnpm verify` runs 15 checks: type checking, layering rules, the migration chain, route registration, RBAC seed and sync, OpenAPI sync, API and web tests, and the production build.
- **Complete RBAC** — users, roles, menus and button-level permissions; new features join the permission model automatically.
- **A designed admin UI** — shadcn/ui + Tailwind CSS v4, six accent colors, light and dark, three navigation modes, and a tabs bar that keeps pages alive.
- **Three languages** — UI and API errors in Chinese, English and Japanese, guarded by a scanner and tests.
- **25+ example pages** — tables, dashboards, charts, a Three.js globe, AI chat, editors, Kanban, WebSocket tools and more.
- **Import / export** — CSV and XLSX on both ends, with row-level validation.
- **One-line deploy** — `bash setup.sh` brings up PostgreSQL, the API and the web app with Docker Compose, then migrates and seeds.

## How it works

```text
you   ▸ Build an "Equipment" registry: name, code, status, purchase date, owner

AI    ▸ infers the spec (types, table, menu, button permissions) and shows a business preview
      $ pnpm scaffold -- --name equipment --domain admin --fields "name:str,code:str50,status:str20,purchase_date:date,owner:str"
      $ pnpm db:migrate
      $ pnpm seed:rbac -- --incremental
      $ pnpm verify -- --module equipment
      ✓ typescript_compile ✓ migration_chain ✓ router_registration ✓ rbac_sync ✓ api_tests ✓ frontend_tests ✓ frontend_build
```

See [AI-driven workflow](website/en/guide/ai-workflow.md) for the full flow.

## Quick start

**Docker (recommended)** — only Docker is required:

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh
```

The wizard sets the admin password and port (default `5000`) and can configure the AI features. Then open `http://localhost:5000` and sign in as `admin`.

**Local development** — Node 22+, pnpm and PostgreSQL 14+:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env.development   # set DEV_DATABASE_URL
createdb castor_kit
pnpm db:migrate
pnpm seed:rbac
pnpm dev                                              # API :5001 · web :5173
```

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js 22 · TypeScript · Fastify 5 · Zod 4 |
| Database | PostgreSQL · Drizzle ORM with reviewable SQL migrations |
| Frontend | React 19 · Vite · React Router 7 · i18next |
| UI | shadcn/ui (Radix) · Tailwind CSS v4 · Motion · lucide-react |
| Data & charts | TanStack Table · react-hook-form · ECharts 6 · Three.js |
| Tooling | pnpm workspaces · Vitest · ESLint · MCP server · Docker Compose |

## Project structure

```text
apps/
  api/        Fastify API: db/schema → modules/<domain>/<name>/{schema,repository,service,routes}.ts
  web/        React app: modules/<module>/pages/**, shared components, locales
  mcp/        MCP server exposing scaffold / verify / seed / migration tools
docs/         architecture notes, templates used by the scaffold
website/      documentation and landing site (VitePress)
AGENTS.md     the single source of conventions for humans and AI tools
```

## Documentation

The documentation lives in [`website/`](website) and covers the [introduction](website/en/guide/index.md), [quick start](website/en/guide/getting-started.md), [backend](website/en/guide/backend.md), [frontend](website/en/guide/frontend.md), [RBAC](website/en/guide/rbac.md), [i18n](website/en/guide/i18n.md), [theme & layout](website/en/guide/appearance.md) and [deployment](website/en/deploy/index.md). To browse it locally:

```bash
npm --prefix website install
npm --prefix website run dev
```

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md) first. For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

[MIT](LICENSE) © castor-kit contributors
