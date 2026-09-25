# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project will follow [Semantic Versioning](https://semver.org/) once versioned releases start.

## [Unreleased]

### Added

- Documentation and landing site rebuilt on VitePress with a custom theme, an interactive product showcase and docs in Chinese, English and Japanese.
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

- The 3D globe and particle demos follow the accent color.
- Light-mode sidebar uses a cool off-white with a raised selection chip; pagination follows the accent color.
- Loading skeletons fade in late and shimmer instead of flashing ([#4]).

### Fixed

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
