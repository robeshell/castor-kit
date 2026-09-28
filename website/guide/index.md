# Introduction

Castor is an AI-first, full-stack admin scaffold. You describe a business feature in plain language; your AI coding tool follows the conventions written into the repository to generate the table, API, page, permissions and database migration; and a verification gate confirms the result is fit to ship.

*Castor* is the Latin genus of the beaver, known as "nature's engineer".

## Tech stack

Castor is a pnpm monorepo with three apps:

| App | Package | Tech |
|---|---|---|
| Backend `apps/api` | `@castorjs/api` | Node 22, TypeScript (strict), Fastify 5, Zod, Drizzle ORM, PostgreSQL 14+, pino |
| Frontend `apps/web` | `@castorjs/web` | React 19, Vite, React Router, shadcn/ui (Radix), Tailwind CSS v4, motion, lucide-react, i18next (TypeScript / TSX) |
| MCP Server `apps/mcp` | `@castorjs/mcp` | `@modelcontextprotocol/sdk`; exposes scaffolding, verification, RBAC sync, migrations and other tools to MCP clients |

Other notable dependencies: `@tanstack/react-table` for tables, `react-hook-form` for forms, ECharts for charts, Monaco for code editing, react-quill-new for rich text, and dnd-kit for drag and drop.

## Who it's for

- **Teams that want AI to actually ship features**: a product manager or developer describes the requirement in one sentence, and the AI works out the technical details: routes, field types, permission codes, menu IDs.
- **Developers who need a well-structured admin starting point**: login, users, roles, departments, menus, logs, data dictionaries, file management, online sessions, system settings, scheduled tasks, notifications, announcements, API tokens and webhooks work out of the box, together with a full RBAC permission system and row-level data scope.
- **Frontend developers looking for reference implementations of common admin pages**: the Component Gallery ships 36 example pages, including one reference implementation per page pattern (standard, card, tree and stats lists, detail page, step and dynamic forms, Kanban, Gantt chart, advanced table), one usage page per group of shared components (live examples with their exact source and key props: data table, forms, filters, pickers, trees, uploads, import / export, feedback, data display, Markdown, condition builder), plus data dashboards, AI chat, editors and more. See [Component gallery](/guide/components).

## Core features

- **AI-driven development**: `AGENTS.md` is the shared project context for every AI tool. Claude Code and Codex CLI also get the project's skills; Cursor, GitHub Copilot and Windsurf read `AGENTS.md` directly; MCP clients connect through the bundled MCP Server. See [AI-driven workflow](/guide/ai-workflow).
- **Scaffold generation**: `pnpm scaffold` generates the table definition, the four backend layers, the frontend page and API client, API tests and the module's OpenAPI entries in one go, then registers everything and generates the migration.
- **Verification gate**: `pnpm verify` checks types, layering rules, the migration chain and whether migrations are applied, the OpenAPI document, files and registrations, the RBAC seed, the frontend build, and backend and frontend tests. A feature is done only when every check passes.
- **Complete RBAC**: four levels of permissions (users, roles, menus, buttons), with the menu tree maintained in one place, `seed-rbac.ts`. See [Permissions (RBAC)](/guide/rbac).
- **Internationalization**: the UI supports 简体中文, English and 日本語. The Chinese source text is the translation key, backed by a scanner and test guards. See [Internationalization](/guide/i18n).
- **Theme and layout**: light / dark mode, 6 accent colors, 3 navigation modes, and a tabs bar with page keep-alive. See [Theme & layout](/guide/appearance).
- **Import and export**: list pages come with CSV / XLSX import and export as standard, with formula-injection protection and all-or-nothing transactional imports.
- **Scheduled tasks**: a scheduler built on database leases that is safe to run with multiple replicas, plus a management page.
- **AI assistant**: an in-app assistant that answers questions through the documented API and runs changes only after you allow them, always with your own permissions. See [AI assistant](/guide/assistant).
- **Security and integration**: server-side sessions, two-step verification, password reset by email and system settings that change at runtime (see [Account security & settings](/guide/security)); API tokens and webhooks for other systems (see [Open API](/guide/open-api)).
- **Docker deployment**: `bash scripts/setup.sh` generates the config and starts PostgreSQL and the app; migrations and RBAC sync run automatically on container start. See the [Deployment guide](/deploy/).

## How it differs from other scaffolds

Most admin scaffolds give you "a codebase to copy and modify". Castor does two more things on top of that:

1. **The conventions are written for AI.** Layering rules, naming, the field-type inference table, permission code rules, menu ID allocation and a list of anti-patterns all live in `AGENTS.md`. Once an AI has read it, it can make technical decisions on its own instead of repeatedly asking you about routes or field types.
2. **A gate decides when work is delivered.** AI-generated code must pass `pnpm verify`. The gate goes beyond static checks: it confirms that migrations have actually been applied to the database and that routes and menu permissions are registered, and it runs the frontend build and the backend and frontend tests.

The result is an automated check between "the AI says it's done" and "the feature actually works".

## Next steps

- [Quick start](/guide/getting-started): get it running with Docker or locally
- [Project structure](/guide/project-structure): learn the layout and what each part does
- [AI-driven workflow](/guide/ai-workflow): ship your first feature with AI
