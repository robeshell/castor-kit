# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Repository root tidied:
  - The Docker setup wizard is `bash scripts/setup.sh`; the image entry point moved to `scripts/docker-entrypoint.sh`.
  - The Chinese README is `README.zh-CN.md`.
  - The root env reference is `.env.production.example`; local development still uses `apps/api/.env.example`.
  - `llms.txt` is served by the docs site at `/llms.txt`.
  - AI tools read one shared `AGENTS.md`, plus `CLAUDE.md` for Claude Code. The per-tool copies (`CODEX.md`, `.windsurfrules`, `.cursor/rules/`, `.github/copilot-instructions.md`) are gone.
- The component gallery's map heatmap is replaced by **Traffic flow** (`/component-center/dataviz/traffic-flow`, permission `cc_dataviz_traffic_flow`):
  - a Sankey diagram of visits from source to landing page to outcome, and a conversion funnel;
  - mock data from `GET /api/admin/component-center/dataviz/traffic-flow/data`.
  - Migration `0001_traffic_flow_menu` renames the existing menu in place, so role grants carry over. The map endpoint and the bundled China GeoJSON are gone.
- Pages open faster the first time:
  - ECharts is registered on demand. `@/shared/components/Chart` is bound to `@/lib/echarts`, which registers only the charts, components and renderers the pages use. Chart pages load about 40% less code.
  - The sign-in, reset-password and profile pages load on demand. The first download is about a fifth smaller.
  - A page's code is prefetched when the pointer or keyboard focus reaches its menu item. While the browser is idle, the system pages and the gallery's admin pages are prefetched one at a time; this is skipped in data-saver mode.

## [0.1.0] - 2026-09-27

First public release: an AI-first admin framework on Node.js + TypeScript (Fastify 5, Zod, Drizzle ORM, PostgreSQL) and React 19 (shadcn/ui, Tailwind CSS v4, Motion).

### AI-driven development

- `pnpm scaffold` generates a complete module from a field list or a JSON spec (`--spec`): table, migration, request-body declaration, repository / service / routes, OpenAPI entries, API tests (including field rules), the list page with form, import and export, menu and button permissions, and translations. Specs are checked against `docs/spec.schema.json` (`--validate-only`); `docs/examples/specs/` shows how requirements become specs.
- `pnpm verify -- --module <name>` gates a feature: files, registration, migrations applied, OpenAPI in sync, permission checks, data scope, frontend conventions, and the API and web tests.
- An MCP server (`apps/mcp`) exposes scaffolding, spec validation, RBAC sync and OpenAPI checks to AI agents; `AGENTS.md`, `CLAUDE.md` and skills describe the conventions they follow.
- The OpenAPI document (`docs/apifox-full.openapi.json`) is written alongside the code and linted in CI (`pnpm openapi:generate -- --strict`); it can be pushed to Apifox.

### Platform

- RBAC with menus and button permissions (`seed-rbac.ts` as the single source of truth), a protected super admin role, departments and per-role data scope (all, own department and below, own department, own data, custom departments).
- Users with profiles, status, avatars and import / export; roles, menus, data dictionary, announcements, notifications, login and operation logs, scheduled HTTP tasks (cron, with SSRF checks), and a file center (local or S3-compatible storage, type and signature checks, reference tracking).
- Account security: server-side sessions with an online-users page, two-step verification (authenticator app, recovery codes, required per role), password reset by email, password rules, rate limits and sign-in lockout. Passwords are hashed with scrypt.
- System settings as the configuration center: security, mail, file storage and AI, applied without a restart; secrets stored encrypted; changes need a recent identity check and notify super admins.
- Open API: personal API tokens limited to chosen permissions, and signed webhooks with retries and a delivery log.
- Request bodies are declared with Zod (`common/validation.ts`) and take JSON types only; input problems are 4xx with readable messages. Times in the API are ISO 8601 in UTC; the web app shows them, and exported files and the dashboard use, the caller's time zone (`X-Time-Zone`).
- Interface and API messages in Chinese, English and Japanese.

### AI features

- AI chat, AI data query (read-only SQL on a restricted role) and a prompt workshop, on the Vercel AI SDK with OpenAI-compatible, OpenAI, Anthropic and Google providers.
- A global AI assistant (⌘/Ctrl + J) that answers questions and, after the user approves each call, acts through the API as the signed-in user.

### Frontend

- Pages built from shared components: page header, filters, data table, form dialogs, import / export dialogs, confirmations and toasts.
- Tabs that keep page state, three navigation modes, accent colors, light and dark themes, and a component gallery of list, card, tree, kanban, Gantt, dashboard, editor, 3D and data-visualization examples.

### Deployment and docs

- Docker image with migrations and RBAC sync on start; a public demo mode (read-only system management, one-click sign-in, data reset on a schedule) and a Render + Neon blueprint.
- Documentation site (VitePress) in Chinese, English and Japanese; MIT license and community files.

[Unreleased]: https://github.com/robeshell/castor-kit/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/robeshell/castor-kit/releases/tag/v0.1.0
