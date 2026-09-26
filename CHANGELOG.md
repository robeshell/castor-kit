# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project will follow [Semantic Versioning](https://semver.org/) once versioned releases start.

## [Unreleased]

### Added

- Account security: server-side sessions (Online users page with force sign-out; signed-in devices on the profile), two-step verification with an authenticator app and recovery codes (optionally required per role; admins can reset it), password reset by email (`SMTP_*`, `APP_BASE_URL`; `MAIL_DRIVER=log` for development), configurable password rules and per-IP rate limits with a stricter sign-in bucket.
- System settings page: feature switches and security parameters stored in the database and applied without a restart; two-step verification and password reset are off by default, everything else keeps the previous behavior.
- File center follow-ups: the component gallery list page uploads through the file center (older files stay readable); upload limits reach the browser through `/api/admin/app-info`, so size and type are checked before sending; oversized multipart uploads get the same "file too large" message; avatars can still be set from an image URL; uploads are allowed in demo mode; the profile page shows the department; role import / template / export carry the data scope and custom departments; an opt-in live S3 test (`S3_TEST_ENDPOINT`) verified the s3 driver against MinIO.
- File center: uploads stored locally or in any S3-compatible service (`STORAGE_*`), checked for size, allowed type and a file signature matching the extension, deduplicated by content, served inline only for images; a Files page under System; drag-and-drop uploads with progress; avatars are uploaded instead of typed as URLs; scaffold `file` / `image` field types; files nothing references are cleaned up 24 hours after upload.
- Super admin safeguards: the super admin role can't be deleted, renamed or narrowed (data scope and menus are fixed); only super admins can grant or remove it or change super admin accounts; nobody can remove it from themselves, and the last active super admin always keeps it. `pnpm seed:rbac -- --incremental` restores the role and the `admin` account if something still goes wrong.
- `pnpm seed:demo`: sample departments, a "department manager" and a "staff" role and six users for trying data scope (refuses `NODE_ENV=production` without `--force`).
- Departments and data scope: a department tree under System (add child, edit, move up / down; users belong to a department) and a data scope per role — all data, own department and below, own department, own data only, or custom departments. User management follows it (list, export, edit, disable, delete, import; out-of-scope rows are a 404), roles can pick custom departments, `pnpm scaffold --data-scope` generates modules that follow it, and `pnpm verify` checks that declared modules filter with `dataScopeWhere`.
- User profiles: nickname, email, phone, avatar URL, status, last sign-in time and IP on accounts. Admins edit them on the Users page (with search and a status filter, and the new columns in import / export); everyone edits their own on the Profile page. Accounts can be disabled (new `system_users_status` permission): a disabled account can't sign in and its open sessions end on the next request.
- Demo AI quota: in demo mode the AI endpoints are limited per IP per hour and per day for the whole site, with a max request size and reply length (`DEMO_AI_*`); `render.yaml` points AI at Gemini's OpenAI-compatible endpoint. The AI chat now answers in the user's language.
- Public demo mode (`DEMO_MODE`): read-only system management, one-click demo sign-in, a "Demo" badge in the top bar and sample data restored every `DEMO_RESET_HOURS`; `render.yaml` deploys it to Render with a free Neon database.
- Documentation and landing site rebuilt on VitePress with a custom theme, real product screenshots (captured by `npm --prefix website run screenshots`) and docs in Chinese, English and Japanese.
- Community files: MIT `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue forms and a pull request template; README in English, Chinese and Japanese.
- `castorkit` wordmark next to the beaver logo, in the app and as SVG assets.
- Tabs bar: opened pages stay as tabs and keep their state (React `<Activity>`), with refresh / close / close others / close to the right / close all and per-page scroll memory ([#9]).
- Appearance menu: six accent colors, three navigation modes (sidebar, top, mixed), three sidebar styles and two content widths ([#8]).
- Frosted-glass login card over an animated aurora and grid backdrop ([#7], [#8]).
- Internationalization of the UI and API errors in zh-CN, en-US and ja-JP, with a scanner and tests that guard against untranslated text ([#6]).
- AI module generation hardening: new-feature autopilot skill, scaffold-generated API tests and database-constraint error mapping, and API tests inside the `pnpm verify` gate ([#5]).
- Frontend rebuilt on shadcn/ui, Tailwind CSS v4 and Motion ([#2]).
- Node.js + TypeScript stack: Fastify 5, Zod, Drizzle ORM, React 19, MCP server, scaffold and verification tooling ([#1]).

### Changed

- Sessions live on the server: the cookie now only carries a session ID, so everyone signs in once more after upgrading. Changing your password signs out your other devices; disabling a user or resetting their password ends their sessions immediately.
- A session whose account was deleted now gets 401 (back to sign-in) on its next request instead of 403 / 404 responses.
- The user menu no longer has a light / dark toggle; the top bar button and the ⌘K command menu cover it.
- The default content width is now fluid (full width); fixed width stays available in the appearance menu.
- The 3D globe and particle demos follow the accent color.
- Light-mode sidebar uses a cool off-white with a raised selection chip; pagination follows the accent color.
- Loading skeletons fade in late and shimmer instead of flashing ([#4]).

### Fixed

- After signing in, the "no accessible pages" screen flashed before the dashboard (menus are now loaded before the redirect); list pages and dashboard panels show skeletons instead of "no data" / zero values until their first response.
- AI Data Query sample questions asked about system tables (users, roles, menus, logs, scheduled tasks) that AI SQL never exposes, so they came back empty; they now ask about the component gallery data, and the demo data has members who joined across the last six months.
- AI Data Query timed out in the browser after 10 s with thinking models; the generate request now allows 60 s. A startup warning flags Neon pooler URLs, which break the AI SQL read-only connection.
- Docker image crashed at startup: `sodium-native` has no prebuilt binaries for Alpine (musl); the image now uses `node:22-bookworm-slim`, and the npm registry is a build argument.
- Scheduled-task URL errors, cycle checks when moving tree nodes, menu tree search and legacy sequences ([#3]).

### Removed

- Continuous deployment workflows for the server and the docs site ([#7]).

[Unreleased]: https://github.com/robeshell/castor-kit/commits/main
[#1]: https://github.com/robeshell/castor-kit/pull/1
[#2]: https://github.com/robeshell/castor-kit/pull/2
[#3]: https://github.com/robeshell/castor-kit/pull/3
[#4]: https://github.com/robeshell/castor-kit/pull/4
[#5]: https://github.com/robeshell/castor-kit/pull/5
[#6]: https://github.com/robeshell/castor-kit/pull/6
[#7]: https://github.com/robeshell/castor-kit/pull/7
[#8]: https://github.com/robeshell/castor-kit/pull/8
[#9]: https://github.com/robeshell/castor-kit/pull/9
