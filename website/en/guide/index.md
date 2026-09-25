# Introduction

castor-kit is an AI-first, full-stack admin scaffold. You describe a business feature in plain language; your AI coding tool follows the conventions written into the repository to generate the table, API, page, permissions and database migration; and a verification gate confirms the result is fit to ship.

*Castor* is the Latin genus of the beaver, known as "nature's engineer". *Kit* stands for the scaffold and its toolkit.

## Tech stack

castor-kit is a pnpm monorepo with three apps:

| App | Package | Tech |
|---|---|---|
| Backend `apps/api` | `@castor-kit/api` | Node 22, TypeScript (strict), Fastify 5, Zod, Drizzle ORM, PostgreSQL 14+, pino |
| Frontend `apps/web` | `@castor-kit/web` | React 19, Vite, React Router, shadcn/ui (Radix), Tailwind CSS v4, motion, lucide-react, i18next (JavaScript / JSX) |
| MCP Server `apps/mcp` | `@castor-kit/mcp` | `@modelcontextprotocol/sdk`; exposes scaffolding, verification, RBAC sync, migrations and other tools to MCP clients |

Other notable dependencies: `@tanstack/react-table` for tables, `react-hook-form` for forms, ECharts for charts, Three.js for 3D, Monaco for code editing, react-quill-new for rich text, and dnd-kit for drag and drop.

## Who it's for

- **Teams that want AI to actually ship features**: a product manager or developer describes the requirement in one sentence, and the AI works out the technical details: routes, field types, permission codes, menu IDs.
- **Developers who need a well-structured admin starting point**: login, users, roles, menus, logs, data dictionaries, scheduled tasks, notifications and announcements work out of the box, together with a full RBAC permission system.
- **Frontend developers looking for reference implementations of common admin pages**: the Component Gallery ships 28 example pages covering lists, Kanban boards, Gantt charts, data dashboards, 3D, AI chat, editors and more.

## Core features

- **AI-driven development**: `AGENTS.md` is the shared project context for every AI tool. Claude Code, Codex CLI, Cursor, GitHub Copilot, Windsurf and MCP clients are all pre-configured. See [AI-driven workflow](/en/guide/ai-workflow).
- **Scaffold generation**: `pnpm scaffold` generates the table definition, the four backend layers, the frontend page and API client, and API tests in one go, then registers everything and generates the migration.
- **Verification gate**: `pnpm verify` checks types, layering rules, the migration chain and whether migrations are applied, files and registrations, the RBAC seed, the frontend build, and backend and frontend tests. A feature is done only when every check passes.
- **Complete RBAC**: four levels of permissions (users, roles, menus, buttons), with the menu tree maintained in one place, `seed-rbac.ts`. See [Permissions (RBAC)](/en/guide/rbac).
- **Internationalization**: the UI supports 简体中文, English and 日本語. The Chinese source text is the translation key, backed by a scanner and test guards. See [Internationalization](/en/guide/i18n).
- **Theme and layout**: light / dark mode, 6 accent colors, 3 navigation modes, and a tabs bar with page keep-alive. See [Theme & layout](/en/guide/appearance).
- **Import and export**: list pages come with CSV / XLSX import and export as standard, with formula-injection protection and all-or-nothing transactional imports.
- **Scheduled tasks**: a scheduler built on database leases that is safe to run with multiple replicas, plus a management page.
- **Docker deployment**: `bash setup.sh` generates the config and starts PostgreSQL and the app; migrations and RBAC sync run automatically on container start. See the [Deployment guide](/en/deploy/).

## How it differs from other scaffolds

Most admin scaffolds give you "a codebase to copy and modify". castor-kit does two more things on top of that:

1. **The conventions are written for AI.** Layering rules, naming, the field-type inference table, permission code rules, menu ID allocation and a list of anti-patterns all live in `AGENTS.md`. Once an AI has read it, it can make technical decisions on its own instead of repeatedly asking you about routes or field types.
2. **A gate decides when work is delivered.** AI-generated code must pass `pnpm verify`. The gate goes beyond static checks: it confirms that migrations have actually been applied to the database, that pages don't pull in retired UI libraries, and it runs the frontend build and the backend and frontend tests.

The result is an automated check between "the AI says it's done" and "the feature actually works".

## Next steps

- [Quick start](/en/guide/getting-started): get it running with Docker or locally
- [Project structure](/en/guide/project-structure): learn the layout and what each part does
- [AI-driven workflow](/en/guide/ai-workflow): ship your first feature with AI
