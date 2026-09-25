# Contributing to castor-kit

Thanks for taking the time to contribute! This guide covers how to set up the project, the conventions we follow, and what a good pull request looks like.

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug** — open an issue with the *Bug report* template, including steps to reproduce.
- **Suggest a feature** — open an issue with the *Feature request* template and describe the problem before the solution.
- **Improve the docs** — the docs site lives in [`website/`](website); Chinese is the source language, with English and Japanese translations.
- **Send a pull request** — for anything beyond a small fix, please open an issue first so we can agree on the approach.

Security issues should **not** be reported publicly; see [SECURITY.md](SECURITY.md).

## Development setup

Requirements: Node.js 22+, pnpm (`corepack enable`), PostgreSQL 14+.

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
pnpm install
cp apps/api/.env.example apps/api/.env.development   # set DEV_DATABASE_URL
createdb castor_kit
pnpm db:migrate
pnpm seed:rbac
pnpm dev                                              # API :5001 · web :5173
```

Docs site: `npm --prefix website install && npm --prefix website run dev`.

## Conventions

[`AGENTS.md`](AGENTS.md) is the single source of truth for architecture and conventions — for humans and AI tools alike. The essentials:

- **Backend layering**: `db/schema/<domain>/<name>.ts` → `modules/<domain>/<name>/{schema,repository,service,routes}.ts`. Permission checks use `hasMenuPermission` from `@/common/auth`; never define a local permission helper.
- **Migrations** are generated with `pnpm db:generate --name <description>`, reviewed as SQL, applied with `pnpm db:migrate`, and checked in the database (`psql -c '\d <table>'`).
- **RBAC**: `apps/api/scripts/seed-rbac.ts` is the only source of menus and permissions; run `pnpm seed:rbac -- --incremental` after changing it.
- **Frontend**: follow the standard page structure (PageHeader → FilterBar → DataTable → FormDialog); use semantic Tailwind color classes only, never hard-coded colors.
- **i18n**: UI text is written as `t('中文原文')`, with translations in the page's `locales/en-US.json` and `locales/ja-JP.json`; new API error messages are registered in `apps/api/src/i18n/messages.ts`.
- **Code comments are in English.** Chinese is only allowed inside quoted strings.
- **Naming**: lowercase, hyphen-separated for packages and files (`castor-kit`, `@castor-kit/api`).

New feature modules should start from the scaffold rather than by hand:

```bash
pnpm scaffold -- --name <name> --domain <admin|component_center> --fields "name:str,status:str20"
```

## Before you open a pull request

Run the same checks as CI:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm verify -- --skip-build        # repository-wide delivery gate
pnpm --filter @castor-kit/web build
```

If your change adds or modifies a feature module, run the gate for that module as well:

```bash
pnpm verify -- --module <name>
```

If you changed the docs, make sure the site builds: `npm --prefix website run build`.

## Commits and pull requests

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(web): …`, `fix(api): …`, `docs: …`, `chore: …`. Keep the subject in the imperative and under ~72 characters.
- Keep pull requests focused: one feature or fix per PR. Update docs and translations in the same PR when behavior changes.
- Fill in the pull request template, including how you tested the change. UI changes should include a screenshot.
- CI must be green before merge. Pull requests are squash-merged.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
