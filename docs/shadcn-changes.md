# Changes to upstream components

`apps/web/src/components/ui/` comes from shadcn/ui (new-york-v4) and `apps/web/src/components/ai-elements/` from Vercel's AI Elements. Both were added with their CLIs and are kept close to upstream. This is the full list of castor-kit's changes. When you re-add or update a component (`apps/web/scripts/shadcn-add.sh <name> -o` overwrites it), apply its entries again, and keep this list in sync when you change a component.

Compared on 2026-09-27 against `https://ui.shadcn.com/r/styles/new-york-v4/<name>.json` and `https://elements.ai-sdk.dev/api/registry/<name>.json`, ignoring formatting, quote style, import paths (`@/components/ui/*`, `@/lib/utils`) and `"use client"`.

## shadcn/ui

**Focus ring.** Upstream's `ring-[3px] ring-ring/50` looks heavy next to the brand color, so every focusable primitive uses `ring-2 ring-ring/20` instead (`apps/web/test/focus-ring.test.js` rejects the upstream values):
accordion (trigger), badge, button, calendar (`dropdown_root` and the focused day), checkbox, input, input-group, input-otp (active slot), radio-group, scroll-area (viewport), select (trigger), switch, tabs (trigger), textarea, toggle (and so toggle-group items). slider keeps its `ring-4` on the thumb but with `ring-ring/20`.

| Component | Change |
|---|---|
| button | `duration-150` and `active:scale-[0.98]` press feedback on every variant; an extra `brand` variant (`bg-brand-gradient-strong text-white shadow-brand hover:brightness-110`) for the page's one primary action |
| checkbox | Indeterminate state: `data-[state=indeterminate]` styles like checked, and the indicator shows `MinusIcon` when `checked === "indeterminate"` |
| form | `FormMessage` translates the error with `i18n.t(...)`: validation messages are Chinese source text used as i18n keys |
| skeleton | Base `bg-foreground/[0.06] dark:bg-foreground/[0.08]` instead of `bg-accent`; a shimmer sweep (`after:animate-shimmer`) instead of `animate-pulse`; fades in after a short delay (`animate-skeleton-in`) so fast loads don't flash |
| sidebar | `useIsMobile` from `@/shared/hooks/use-mobile` (a `useSyncExternalStore` implementation); `SidebarMenuSkeleton` picks its random width with a lazy `useState` instead of `useMemo` (react-hooks purity rule) |
| sonner | Theme from `@/context/ThemeContext` (`light` / `dark`) instead of `next-themes` |

Added during the TSX conversion: exported props types `ButtonProps`, `BadgeProps`, `AlertProps`, `ButtonGroupProps` and `CalendarProps`.

Unchanged from upstream: alert, alert-dialog, avatar, breadcrumb, button-group, card, collapsible, command, context-menu, dialog, drawer, dropdown-menu, empty, field, hover-card, kbd, label, pagination, popover, progress, separator, sheet, spinner, table, tooltip.

## AI Elements

| File | Change |
|---|---|
| message | Code blocks use castor-kit's `code-highlighter` instead of `@streamdown/code` (common languages only, grammars loaded on demand; `@streamdown/code` bundles 200+ Shiki grammars, about 10 MB of build output); the `@streamdown/math` and `@streamdown/mermaid` plugins are left out for bundle size |
| code-highlighter.ts | castor-kit only: implements Streamdown's `CodeHighlighterPlugin` |
| streamdown-translations.ts | castor-kit only: i18n labels for Streamdown's built-in buttons |

Unchanged from upstream: confirmation, conversation, prompt-input, suggestion. Their English default copy ("No messages yet", "What would you like to know?", "Submit", ...) is still upstream's; the callers (`AssistantWidget`, the AI chat page) pass translated `t()` copy for the parts they use.
