# castor-kit frontend design system

> The UI system of `apps/web`: shadcn/ui + Tailwind CSS v4 + motion + lucide-react (moving from JSX to TSX, see AGENTS.md "TypeScript (migration in progress)"). Visual direction: clean, with smooth motion, in the style of English-language SaaS products (Linear / Vercel / Stripe),
> on a neutral gray base, with the **Ocean gradient (blue → sky → cyan)** as the default accent color; the gradient is only an accent. The accent can be switched to other presets in the Appearance menu (`src/lib/appearance.ts`), and every accent token is derived from `--brand-from/via/to`.
> Component usage, common page patterns and things not to do are in `.claude/skills/shadcn-ui-skills/`; project conventions are in `AGENTS.md` "Frontend conventions".

## 1. Tech stack

| Concern | Choice |
|---|---|
| React | React 19 (TypeScript / TSX; converted layer by layer from JSX) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) + CSS variable themes (light / dark) |
| Components | shadcn/ui (new-york, Radix), source in `src/components/ui/` (TSX); changes from upstream in `docs/shadcn-changes.md` |
| Motion | `motion` (page transitions, staggered list entrances, layoutId indicators, number counters) + `tw-animate-css` (overlay enter / exit) |
| Icons | `lucide-react`; the menu table stores lucide icon names (e.g. `Users`, `Settings`), resolved by `lib/menu-icons.ts` |
| Tables | shared `DataTable` component (pagination, selection, empty state, skeleton) |
| Forms | `react-hook-form` (shadcn Form pattern) + `FormFields` |
| Notifications | `sonner` (the shared `toast`) |
| Command palette | `cmdk` (⌘K: jump to a menu, switch theme, sign out) |
| Dates | `react-day-picker` + `date-fns` (Calendar + Popover) |
| Fonts | Geist / Geist Mono (`@fontsource-variable`, bundled locally, no CDN) + Chinese fallbacks PingFang SC / Microsoft YaHei |
| Other | echarts, three, monaco, dnd-kit, react-grid-layout, react-window, react-markdown, react-quill-new (rich text) |

## 2. Design tokens

Tokens are defined in `apps/web/src/index.css` (`:root` for light, `.dark` for dark, exposed to Tailwind via `@theme inline`). Pages use only semantic color classes (`bg-card`, `text-muted-foreground`, `bg-brand-soft` ...) and never hard-code hex colors.

- Neutrals: pure neutral grays (no blue / purple tint, which looks dirty next to a blue accent); the content area is pure white `#ffffff`, the sidebar a cool light gray `#f7f8fa`; cards have a 1px hairline border (`--border #ebebeb`) + a very light shadow, no heavy shadows; corner radius 10–14px.
- Accent (Ocean): `--primary` takes `--brand-from` (default `#2563eb`); the gradient is `--brand-gradient: linear-gradient(135deg, brand-from, brand-via 55%, brand-to)` (default #2563eb → #0284c7 → #22d3ee);
  elements that carry text use the two-stop darker gradient `--brand-gradient-strong` (brand-from → brand-via) to keep white text readable.
- Gradients are used only for: the logo, the primary button (with a soft glow), tab indicators, progress bars, chart lines and areas, and the online avatar ring. Don't lay large soft glows / gradient backgrounds over the content area (in light mode they look like stains); apart from the primary button, avoid a second gradient on the same screen.
- Data visualization: use bar charts for daily counts; don't draw trend lines for sparse data (Sparkline renders nothing with fewer than 2 valid points); show failure states with a small red status code instead of coloring the whole block red.
- Status: success green, warning amber, danger red (`--success` / `--warning` / `--danger` and the matching `-soft` light backgrounds); badges use dark text on a light background.
- Copy: don't write useless descriptions. No intro text under the page title; write a description only when it carries information (data, the current object, constraints and consequences, shortcuts, the next step in an empty state); never restate the title, introduce the feature or tech stack, or write marketing lines.
- Loading states: always use `<Skeleton>` (it has a built-in 200ms delayed fade-in + shimmer, so it doesn't appear for instant responses); don't hand-write `animate-pulse`; match the skeleton's shape to the real content (tables use DataTable's built-in row skeletons, stat cards take `loading`); don't fake loading with 0 or `共 0 条` ("0 items"); page code loading is handled centrally by AppLayout's Suspense, so don't wrap pages in another Suspense.
- Languages: Simplified Chinese / English / Japanese, with the Chinese source text as the key; switch from the top bar or the top-right corner of the login page; the choice is stored in localStorage and requests send `Accept-Language`. Conventions are in AGENTS.md "Internationalization (i18n) and code comments".
- Font sizes: body 13–14px, titles 24–26px / 600, numbers use `tabular-nums`.
- Motion: interactions 150–250ms ease-out; overlays use the spring curve `cubic-bezier(.32,.72,0,1)`; respect `prefers-reduced-motion`.
- Dark mode: a dark version of the same tokens, toggled with `<html class="dark">`.

## 3. Directory layout

```
apps/web/src/
├── components/
│   ├── ui/                 # shadcn primitives (button, input, dialog, sheet, table, select, ...)
│   └── app/                # app shell: AppLayout, AppSidebar, TopBar, TopNav, TagsView, CommandMenu, ThemeToggle,
│                           #            AppearanceMenu, LanguageSwitcher, NotificationBell, UserMenu, StatusPages, PrivateRoute
├── shared/
│   ├── components/         # shared business components: PageHeader, Filters, DataTable, RowActions, ConfirmAction, FormDialog, FormFields,
│   │                       #            data-transfer/ (ImportDialog, ExportDialog), upload/, StatusBadge, EmptyState,
│   │                       #            TreeView, CheckableTree, TreeSelect, StatCard, Panel, SegmentedTabs ...
│   ├── hooks/              # useCrudList, useIsMobile, useDebouncedValue, useDictOptions ...
│   └── api/request.js      # axios wrapper (CSRF, 401 redirect, response unwrap)
├── lib/                    # utils(cn), toast, menu-icons, motion presets, format (dates / numbers), appearance, chart-theme
├── context/                # AuthContext, ThemeContext (html.dark), TagsViewContext
├── i18n/                   # i18next setup and date locales
└── modules/**/pages/**/index.jsx   # pages (dynamically routed by import.meta.glob in App.jsx)
```

## 4. Shared component conventions (pages must reuse them, not build their own)

### Component layers

| Layer | May import | Must not import |
|---|---|---|
| `src/components/ui/` (shadcn primitives) | other primitives, `@/lib/utils`, `@/shared/hooks/use-mobile` | everything else |
| `src/shared/components/` (shared business components) | primitives, `@/lib/*`, `@/i18n`, generic hooks, other shared components | `@/shared/api`, `@/context`, `@/modules`, `@/components/app`, `@/shared/hooks/useAppInfo` |
| `src/components/app/` (app shell), pages | anything | - |

Shared components get their data through props and callbacks, never by calling the API or reading app context themselves, so they stay reusable outside this app (a possible shadcn registry later). `apps/web/test/component-boundaries.test.js` enforces this; its allowlist holds the files that predate the rule (the file / avatar upload components, and two project changes to shadcn originals: `form` translates messages, `sonner` follows the app theme). Don't add to it: move the dependency into a prop instead. Changes to shadcn originals should stay small and are listed in `docs/shadcn-changes.md`.

The components live in `apps/web/src/shared/components/`; full usage is in `.claude/skills/shadcn-ui-skills/COMPONENTS.md`.

- `PageHeader`: title + action area on the right (description only for data-type information).
- `Filters` (`FilterBar` / `SearchInput` / `FilterSelect`): search box + filters + search / reset.
- `DataTable`: column definitions `{ key, title, dataIndex, render, ... }`; `loading` skeleton, empty state, pagination (total/page/perPage), row selection.
- `FormDialog` / `FormSheet` + `FormFields`: create / edit form containers (react-hook-form), with submit loading state and error messages.
- `ConfirmAction`: confirmation popover for dangerous actions such as delete; `RowActions`: row actions.
- `data-transfer/ImportDialog` / `ExportDialog`: import and export, csv/xlsx only.
- `useAuth().hasPermission(code)`: button permissions (`@/context/AuthContext`).
- `toast.success / toast.error / toast.apiError` (`@/lib/toast`): shared feedback; the backend's `{error}` message is shown as is.

Use only `@/components/ui/*`, `@/shared/components/*`, lucide-react and Tailwind semantic color classes; don't add other UI component libraries (antd, MUI, etc.).
