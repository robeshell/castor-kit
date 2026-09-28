# Theme & layout

Users can switch between light and dark mode from the top bar, and use the Appearance panel to choose the accent color, navigation mode, sidebar style and content width, and to turn the tabs bar on or off. Every choice takes effect immediately and is saved in the current browser.

This page explains how these options are implemented and what they require of your page code.

## Light / dark

- Toggled via `<html class="dark">`, following the shadcn / Tailwind convention.
- The current mode is saved under the `theme` key in `localStorage`. On the first visit, when nothing is saved yet, it starts from the system setting.
- While switching, all CSS transitions are turned off for one frame (the `theme-switching` class on `<html>`), so the page changes color at once instead of hover and color transitions animating through mixed colors.

The implementation is in `apps/web/src/context/ThemeContext.tsx`. As long as a page uses semantic color classes (see [Frontend](/guide/frontend#styling-rules)), dark mode just works.

## Accent color

Appearance offers 6 accent colors; the default is Ocean:

| ID | Name |
|---|---|
| `ocean` | Ocean (default) |
| `violet` | Violet |
| `emerald` | Emerald |
| `rose` | Rose |
| `amber` | Amber |
| `slate` | Slate |

### How tokens are derived

The accent color is applied as `<html data-accent="<id>">`. In `apps/web/src/index.css`, each preset sets six variables, once for light and once for dark:

```css
[data-accent='ocean'] { --brand-from: #2563eb; --brand-via: #0284c7; --brand-to: #22d3ee; --brand-primary: #2563eb; --brand-strong-from: #2563eb; --brand-strong-to: #077bba; }
.dark[data-accent='ocean'], .dark [data-accent='ocean'] { --brand-from: #3b82f6; --brand-via: #0ea5e9; --brand-to: #22d3ee; --brand-primary: #3d85f9; --brand-strong-from: #2970e3; --brand-strong-to: #017cb2; }
```

- `--brand-from` / `--brand-via` / `--brand-to`: the three decorative gradient stops.
- `--brand-primary`: the step that carries text (links, the focus ring, fills under `--primary-foreground`), chosen for at least 4.6:1 contrast on every surface and on `brand-soft`.
- `--brand-strong-from` / `--brand-strong-to`: the gradient that sits under white text, at least 4.6:1 against white.

Every other token that follows the accent color is derived from these:

| Token | Source |
|---|---|
| `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring` | `--brand-primary` |
| `--brand-gradient` | A linear gradient of the three stops |
| `--brand-gradient-strong` | A linear gradient of `--brand-strong-from` / `--brand-strong-to` |
| `--brand-soft`, `--brand-glow`, `--brand-shadow` | Stops mixed with transparent via `color-mix()` |

So as long as a page uses semantic classes such as `primary` and `brand-*`, it follows accent changes automatically. **Don't hard-code any accent color value in a page.**

Chart series colors `--chart-1` … `--chart-5` are a fixed categorical palette (separate light and dark steps) that does not follow the accent. ECharts charts read the current CSS variable values through `useChartColors()` from `@/lib/chart-theme` and recompute when the theme or accent changes; `chartBase()` applies the categorical palette, and single-series charts use `brandLine()` / `brandArea()`, which are built from the accent stops.

### Adding an accent color

1. Add `{ id, label }` to `ACCENTS` in `apps/web/src/lib/appearance.ts`. `label` is the Chinese source text and also serves as the translation key.
2. Add the matching `[data-accent='<id>']` light and dark rules to `apps/web/src/index.css`, each setting all six variables and meeting the contrast targets above. Keep the values in hex; `chart-theme.ts` converts `--brand-from` to rgba.
3. Add English and Japanese translations for `label`.

## Navigation mode

| ID | Name | Description |
|---|---|---|
| `sidebar` | Sidebar (default) | Full menu tree on the left |
| `top` | Top | Menus in the top bar, no sidebar |
| `mixed` | Mixed | Top-level sections in the top bar, the current section's menus on the left |

## Sidebar style

Maps one-to-one to shadcn `<Sidebar variant>`:

| ID | Name |
|---|---|
| `sidebar` | Standard (default) |
| `floating` | Floating |
| `inset` | Inset |

When the navigation mode is Top, there is no sidebar, so this option is disabled.

## Content width

| ID | Name | Description |
|---|---|---|
| `boxed` | Fixed | Content area centered, max width 1600px |
| `fluid` | Fluid (default) | Content area fills the available width |

## Mobile

When the viewport is narrower than 768px:

- Every navigation mode falls back to a drawer sidebar showing the full menu
- The tabs bar is hidden and pages are not kept alive

## Tabs bar and page keep-alive

The tabs bar is on by default and can be turned off in Appearance. When it's on, every page you open appears as a tab below the top bar:

- Top-level pages (such as Home) are pinned first and can't be closed
- Tabs support Close, Close others, Close to the right, Close all and Refresh
- The tab list is saved under the `tags-view` key in `sessionStorage`, so it only applies to the current browser tab
- Switching back to a tab restores its last query parameters and scroll position

State management is in `apps/web/src/context/TagsViewContext.tsx`; the page area is rendered in `apps/web/src/components/app/AppLayout.tsx`.

### How keep-alive works

When the tabs bar is on, each open tab is wrapped in React `<Activity>` and stays mounted:

| State | When switched away (hidden) | When switched back (shown) |
|---|---|---|
| Component state (filters, pagination, form input) | Kept | Restored as it was |
| `useEffect` side effects | Cleanup functions run | Effects run again |

In other words, requests in `useEffect` refetch data once when you switch back to a page, and timers, polling and WebSockets stop automatically through their cleanup functions while the page is hidden.

Closing a tab unmounts its page; refreshing a tab remounts the page and shows it from the top.

### What this means for page code

::: warning Side effects must live in effects and be cleaned up
- Start timers, polling, subscriptions and WebSocket connections inside `useEffect`, and stop them in the cleanup function.
- Don't start timers at module top level or during render, or they will keep running after the page is hidden.
:::

```tsx
useEffect(() => {
  const timer = setInterval(refresh, 5000)
  return () => clearInterval(timer)
}, [refresh])
```

## Where preferences are stored

| Storage | Key | Contents |
|---|---|---|
| `localStorage` | `theme` | `light` / `dark` |
| `localStorage` | `appearance` | `{ accent, navMode, sidebarVariant, contentWidth, tagsView }` |
| `localStorage` | `lang` | UI language; see [Internationalization](/guide/i18n) |
| `sessionStorage` | `tags-view` | Open tabs |

Unknown keys or invalid values in `appearance` are ignored and fall back to the defaults. The Appearance panel has a Reset button. The options are defined in one place: `apps/web/src/lib/appearance.ts`.
