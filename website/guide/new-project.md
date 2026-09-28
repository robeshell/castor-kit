# Starting a project

Castor is a starting point, not a library you install: your product is a repository that begins as a copy of a Castor release and grows from there. This page covers creating that repository, naming the product, hiding the component gallery, going live, and taking later Castor releases.

## 1. Create the repository

Start from a release tag (the latest is listed on the [releases page](https://github.com/robeshell/castorjs/releases); `v0.4.0` below) and keep Castor as a second remote, so later releases can be merged:

```bash
git clone --branch v0.4.0 https://github.com/robeshell/castorjs.git my-app
cd my-app
git switch -c main
git remote rename origin upstream
git remote add origin git@github.com:your-org/my-app.git
git push -u origin main
```

Then follow [Quick start](/guide/getting-started) (local development) to install dependencies, create the databases and start the dev servers.

## 2. Name the product

| What | Where |
|---|---|
| Name in the web app: browser tab titles, sidebar wordmark, sign-in footer, downloaded file names | `APP_NAME` in `apps/web/src/lib/brand.ts` |
| Page title and description before the app loads | `<title>` and `<meta name="description">` in `apps/web/index.html` |
| Logo and favicon | Replace `apps/web/src/assets/castor-logo.png` (imported by `components/app/BrandMark.tsx`; the favicon link is in `index.html`) |
| Name the server shows: the issuer in authenticator apps, the default mail sender, the test mail, the AI assistant's introduction, logs | The `APP_NAME` environment variable (see [Configuration](/reference/configuration)) |
| Database names | `DEV_DATABASE_URL` / `TEST_DATABASE_URL` / `DATABASE_URL`; the defaults are `castor_kit` and `castor_kit_test` |
| Dashboard content (quick links, tech stack panel) | `apps/web/src/modules/admin/pages/dashboard/index.tsx`, an example page like any other |

Leave these as they are, even though they contain "castor":

- The internal package names `@castorjs/*`: scripts and `pnpm --filter` commands use them, and users never see them.
- The session cookie `castor_session`: renaming it signs everyone out.
- The key-derivation labels (`castor-kit-session`, `castor-kit-secret-box`, …): changing them signs everyone out and makes stored secrets (SMTP / S3 / AI keys) unreadable.
- The webhook headers `X-Castor-Event` / `X-Castor-Signature` / …: your receivers verify them.

## 3. Hide the component gallery

The component gallery (36 example pages) is the reference that AI agents copy from: AGENTS.md "Page patterns (which page to copy)" points into it. Keep its code and hide it from users: in `apps/api/scripts/seed-rbac.ts`, set the root menu to inactive:

```ts
{ id: 3, name: "组件示例中心", code: "component_center", …, is_visible: true, is_active: false },
```

Then run `pnpm seed:rbac -- --incremental` (deployments do this on every start through `setup-once`). The gallery disappears from the sidebar, the ⌘K menu and the routes (its URLs return 404), and the dashboard drops its gallery shortcuts. Its APIs stay registered but need gallery permissions, which only the super admin holds unless you grant them to a role. Its pages are loaded only when opened, so they add nothing to what users download.

Deleting the gallery outright isn't a supported step yet: the framework's own tests use its modules as fixtures.

## 4. Before going live

- `SECRET_KEY` and `ADMIN_PASSWORD` are required in production (the server refuses to start without them). `scripts/setup.sh` generates `SECRET_KEY` and asks for the admin password: enter a strong one, because an empty answer falls back to `admin123`.
- `DEMO_MODE` stays off (the default); it is only for the public demo.
- Deploy with Docker Compose or another host: see the [Deployment guide](/deploy/).

## 5. Build features

Describe a feature and let your AI agent run `/new-feature-autopilot`, or write the spec yourself and run `pnpm scaffold -- --spec`: see [AI workflow](/guide/ai-workflow). For pages other than a plain list, copy the matching page pattern from the gallery (see [Component gallery](/guide/components#from-a-pattern)).

## 6. Take a new Castor release

Replace `<tag>` with the release you are taking, for example `v0.5.0`:

```bash
git fetch upstream --tags
git merge <tag>
```

Read the release's CHANGELOG first. Conflicts are usually in files both sides extend, such as `seed-rbac.ts` (keep both sides' menus), and they resolve the usual way.

**Migrations need one extra step when you have added your own since the last merge.** Both sides then have a migration with the same number, so `apps/api/drizzle/meta/_journal.json` and a snapshot conflict. Keep your migration history and turn the release's schema changes into one new migration of your own:

```bash
# 1. The migrations the release added (keep this list for step 4)
git diff --name-only --diff-filter=A HEAD MERGE_HEAD -- 'apps/api/drizzle/*.sql'
# 2. Put apps/api/drizzle back to your version (drops the release's migration files)
git restore --source=HEAD --staged --worktree apps/api/drizzle
# 3. One migration for the release's schema changes (its schema code is already merged)
pnpm db:generate --name upstream_<tag>   # e.g. upstream_v0_5_0: letters, digits and underscores
```

4. Open each migration from step 1 (`git show MERGE_HEAD:apps/api/drizzle/<file>.sql`) and copy every statement that isn't a table / column change (`INSERT`, `UPDATE`, `DELETE` …) to the end of the new migration, each after a `--> statement-breakpoint` line.
5. Commit the merge, run `pnpm db:migrate` and `pnpm verify`.

Without migrations of your own since the last merge, the release's migrations merge cleanly and `pnpm db:migrate` applies them as they are.
