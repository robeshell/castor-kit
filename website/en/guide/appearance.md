# Theme & layout

Users can switch between light and dark mode from the top bar, and use the Appearance panel to choose the accent color, navigation mode, sidebar style and content width, and to turn the tabs bar on or off. Every choice takes effect immediately and is saved in the current browser.

This page explains how these options are implemented and what they require of your page code.

## Light / dark

- Toggled via `<html class="dark">`, following the shadcn / Tailwind convention.
- The choice is saved under the `theme` key in `localStorage`; if the user has never chosen, it follows the system setting.
- While switching, a global color transition is briefly enabled and then removed, so it doesn't affect normal hover animations.

The implementation is in `apps/web/src/context/ThemeContext.jsx`. As long as a page uses semantic color classes (see [Frontend](/en/guide/frontend#styling-rules)), dark mode just works.

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

The accent color is applied as `<html data-accent="<id>">`. In `apps/web/src/index.css`, each preset defines only three gradient stops, one set for light and one for dark:

```css
[data-accent='ocean'] { --brand-from: #2563eb; --brand-via: #0284c7; --brand-to: #22d3ee; }
.dark[data-accent='ocean'], .dark [data-accent='ocean'] { --brand-from: #3b82f6; --brand-via: #0ea5e9; --brand-to: #22d3ee; }
```

Every other token that follows the accent color is derived from these three variables:

| Token | Source |
|---|---|
| `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring` | `--brand-from` |
| `--chart-1` / `--chart-2` / `--chart-3` | `--brand-from` / `--brand-via` / `--brand-to` |
| `--brand-gradient`, `--brand-gradient-strong` | A linear gradient of the three stops |
| `--brand-soft`, `--brand-glow`, `--brand-shadow` | Mixed with transparent via `color-mix()` |

`--chart-4` and `--chart-5` are fixed colors that don't change with the accent.

So as long as a page uses semantic classes such as `primary` and `brand-*`, it follows accent changes automatically. **Don't hard-code any accent color value in a page.**

ECharts charts read the actual values of the current CSS variables through `useChartColors()` from `@/lib/chart-theme`, and recompute when the theme or accent changes. Canvas / WebGL scenes (such as the particle animation and the Three.js globe) also take their colors from `--brand-from/via/to`.

### Adding an accent color

1. Add `{ id, label }` to `ACCENTS` in `apps/web/src/lib/appearance.js`. `label` is the Chinese source text and also serves as the translation key.
2. Add the matching `[data-accent='<id>']` light and dark stop sets to `apps/web/src/index.css`. Keep the stops in hex; `chart-theme.js` converts `--brand-from` to rgba.
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

State management is in `apps/web/src/context/TagsViewContext.jsx`; the page area is rendered in `apps/web/src/components/app/AppLayout.jsx`.

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

```jsx
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
| `localStorage` | `lang` | UI language; see [Internationalization](/en/guide/i18n) |
| `sessionStorage` | `tags-view` | Open tabs |

Unknown keys or invalid values in `appearance` are ignored and fall back to the defaults. The Appearance panel has a Reset button. The options are defined in one place: `apps/web/src/lib/appearance.js`.
