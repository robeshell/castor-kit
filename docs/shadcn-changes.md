# Changes to upstream components

`apps/web/src/components/ui/` comes from shadcn/ui (new-york-v4) and `apps/web/src/components/ai-elements/` from Vercel's AI Elements. Both were added with their CLIs and are kept close to upstream. This is the full list of castor-kit's changes. When you re-add or update a component (`apps/web/scripts/shadcn-add.sh <name> -o` overwrites it), apply its entries again, and keep this list in sync when you change a component.

Compared on 2026-09-27 against `https://ui.shadcn.com/r/styles/new-york-v4/<name>.json` and `https://elements.ai-sdk.dev/api/registry/<name>.json`, ignoring formatting, quote style, import paths (`@/components/ui/*`, `@/lib/utils`) and `"use client"`.

## shadcn/ui

**Focus indicator.** Upstream removes the outline (`outline-none`) and draws a `ring-[3px] ring-ring/50` box-shadow halo: a translucent halo misses 3:1 against the surface, and box-shadows disappear in forced-colors mode. Every focusable primitive instead draws a solid outline in the full `ring` color and drops `outline-none` (`apps/web/test/focus-ring.test.ts` rejects bare `outline-none`, translucent focus rings and `ring-[3px]`):
- controls, `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`: accordion (trigger), badge, button (destructive: `outline-destructive`), checkbox and radio-group (plus `border-ring`), slider (thumb; the hover halo stays as `hover:ring-4 hover:ring-ring/20`), switch, tabs (trigger, and the content panel, which Radix makes tabbable), toggle (and so toggle-group items), calendar days (through button);
- bordered text fields, `focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring` (one 2px perimeter): input, textarea, select (trigger), input-group (on the group, `focus-visible:outline-none` on its control), input-otp (active slot), calendar (`dropdown_root`, with `has-focus:`);
- inset (`-outline-offset-2`), where an outer edge would be clipped: scroll-area (viewport), sidebar (group label, group action, menu button, menu action, sub button: `outline-sidebar-ring`, replacing `ring-sidebar-ring outline-hidden focus-visible:ring-2`).
`aria-invalid` sets `outline-destructive` instead of `ring-destructive/20` (`/40` in dark).

| Component | Change |
|---|---|
| button | `duration-150` and `active:scale-[0.98]` press feedback on every variant; an extra `brand` variant (`bg-brand-gradient-strong text-white shadow-brand hover:brightness-110`) for the page's one primary action |
| checkbox | Indeterminate state: `data-[state=indeterminate]` styles like checked, and the indicator shows `MinusIcon` when `checked === "indeterminate"` |
| command | `CommandDialog` takes `closeLabel` and passes it to `DialogContent`; its sr-only `DialogHeader` sits inside `DialogContent` (upstream renders it outside, so the title stays on the page, outside any landmark, while the dialog is closed) |
| dialog | `DialogContent` takes `closeLabel` (default `"Close"`): the close button's screen-reader text, translated by the caller |
| form | `FormMessage` translates the error with `i18n.t(...)`: validation messages are Chinese source text used as i18n keys |
| sheet | `SheetContent` takes `closeLabel` (default `"Close"`), like `DialogContent` |
| skeleton | Base `bg-foreground/[0.06] dark:bg-foreground/[0.08]` instead of `bg-accent`; a shimmer sweep (`after:animate-shimmer`) instead of `animate-pulse`; fades in after a short delay (`animate-skeleton-in`) so fast loads don't flash |
| sidebar | `useIsMobile` from `@/shared/hooks/use-mobile` (a `useSyncExternalStore` implementation); `SidebarMenuSkeleton` picks its random width with a lazy `useState` instead of `useMemo` (react-hooks purity rule); `Sidebar` takes `mobileTitle` / `mobileDescription`, `SidebarTrigger` and `SidebarRail` take `label` (the English defaults stay, callers pass translations); `SidebarInset` renders a `<div>` instead of `<main>` (it also holds the top bar; `AppLayout` puts `<main id="main">` around the page area) |
| sonner | Theme from `@/context/ThemeContext` (`light` / `dark`) instead of `next-themes` |
| slider | `aria-label` / `aria-labelledby` given to `Slider` go to each thumb (the focusable `role="slider"`) instead of the root |
| spinner | Decorative (`aria-hidden`) unless a `label` prop is given, then `role="status"` + `aria-label={label}` (upstream: always `role="status" aria-label="Loading"`, which repeats inside labelled buttons and is English only) |

Added during the TSX conversion: exported props types `ButtonProps`, `BadgeProps`, `AlertProps`, `ButtonGroupProps` and `CalendarProps`.

Unchanged from upstream: alert, alert-dialog, avatar, breadcrumb, button-group, card, collapsible, context-menu, drawer, dropdown-menu, empty, field, hover-card, kbd, label, pagination, popover, progress, separator, table, tooltip.

## AI Elements

| File | Change |
|---|---|
| message | Code blocks use castor-kit's `code-highlighter` instead of `@streamdown/code` (common languages only, grammars loaded on demand; `@streamdown/code` bundles 200+ Shiki grammars, about 10 MB of build output); the `@streamdown/math` and `@streamdown/mermaid` plugins are left out for bundle size |
| code-highlighter.ts | castor-kit only: implements Streamdown's `CodeHighlighterPlugin` |
| streamdown-translations.ts | castor-kit only: i18n labels for Streamdown's built-in buttons |
| conversation | `Conversation` passes `initial` / `resize` as `"instant"` instead of `"smooth"` under `prefers-reduced-motion` (`useReducedMotion` from `motion/react`) |

Unchanged from upstream: confirmation, prompt-input, suggestion. Their English default copy ("No messages yet", "What would you like to know?", "Submit", ...) is still upstream's; the callers (`AssistantWidget`, the AI chat page) pass translated `t()` copy for the parts they use.
