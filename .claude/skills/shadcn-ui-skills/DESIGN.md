# Design tokens and motion rules

Visual direction: clean, with smooth motion, in the style of English-language SaaS products (Linear / Vercel / Stripe). A neutral gray base, with the **Ocean gradient (blue → sky → cyan) as the only accent color**; the gradient is only an accent, and purple is not used.
Tokens are defined in `apps/web/src/index.css` (`:root` for light, `.dark` for dark, exposed to Tailwind via `@theme inline`); the full description is in section 2 of `docs/frontend-design-system.md`.

## Color: semantic classes only

| Use | Classes |
|---|---|
| Page / card / overlay background | `bg-background` / `bg-card` / `bg-popover` |
| Body / secondary text | `text-foreground` / `text-muted-foreground` |
| Border / input border / focus ring | `border` (default color is `--border`) / `border-input` / `ring-ring` |
| Focus style (shared) | `focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20` (use `focus-within:` on outer containers). shadcn's default `ring-[3px]` + `ring-ring/50` is too thick with the brand color; change it to this after installing a new component |
| Subtle backgrounds (hover, placeholders) | `bg-muted` / `bg-accent` / `hover:bg-muted/60` |
| Brand color | `text-primary` / `bg-primary` / `bg-brand-soft` (light background for selected state) |
| Status | `text-success` `bg-success-soft` / `text-warning` `bg-warning-soft` / `text-danger` `bg-danger-soft` / `text-info` `bg-info-soft` |
| Dangerous action text | `text-danger hover:text-danger` (ghost buttons); solid dangerous buttons use `variant="destructive"` |

With semantic classes only, dark mode (`<html class="dark">`, toggled by ThemeContext) is correct automatically; **don't** write `text-gray-500`, `#2563eb` or `dark:` branches to set colors by hand.

## Brand gradient utilities (accents only)

| Class | Where to use it |
|---|---|
| `bg-brand-gradient` | Decoration: logo, progress bars, indicators, chart areas |
| `bg-brand-gradient-strong` | Elements that carry white text: primary button (built into `Button variant="brand"`), avatar blocks |
| `text-brand-gradient` | A little emphasized text (large numbers, title keywords) |
| `border-brand-gradient` | Gradient outlines, e.g. AI entry cards |
| `shadow-brand` | Soft glow on the primary button |
| `bg-brand-glow` | Small decorative glows (e.g. image placeholders); don't spread it over the main content background, it looks dirty in light mode |
| `surface-card` | Card surface (white background + 1px hairline border + radius; used by `Panel`) |

A page has only a handful of gradient elements: 1 primary button + a few indicators / decorations. Large background areas don't use gradients.

## Sizing and typography

- Radius 10–14px (`rounded-lg` / `rounded-xl`; cards get it from `surface-card`); no heavy shadows, layers are separated by 1px borders
- Body text 13–14px (`text-[13px]` / `text-sm`), secondary 12px (`text-xs`), page titles are handled by PageHeader (24–26px / 600)
- Numbers always use `tabular-nums`; ID and time columns add `text-muted-foreground`
- Spacing uses Tailwind: page sections `space-y-4` / `space-y-5`, side by side `gap-4`; form field spacing is handled by FormDialog
- Fonts: Geist / Geist Mono (bundled locally) + Chinese fallbacks PingFang SC / Microsoft YaHei; don't add CDN fonts
- Responsive: nothing may overflow horizontally below 768px (the DataTable container scrolls horizontally on its own; two-column layouts use `md:grid-cols-[...]` and stack on mobile); use `useIsMobile()` for the breakpoint
- Icons: `lucide-react`; don't set a size inside buttons, elsewhere usually `size-4`; no emoji as icons

## Motion rules (`motion/react` + `@/lib/motion`)

| Case | How |
|---|---|
| Interactions (hover / press / expand) | 150–250ms, ease-out (CSS `transition-colors` etc. is enough) |
| Overlay enter / exit | Already provided by shadcn components + `tw-animate-css` (curve `--ease-spring: cubic-bezier(.32,.72,0,1)`); don't wrap them in motion |
| Page transitions | Handled centrally by the app shell (`pageTransition`); pages don't add their own |
| Staggered list entrance | `<motion.ul variants={stagger.container} initial="hidden" animate="show">` + children with `variants={stagger.item}` |
| Single block fade-in | `<motion.div {...fadeUp}>` |
| Sliding indicator / selected background | `layoutId` + `layoutSpring` (built into `SegmentedTabs`) |
| Number counters | `CountUp` / `StatCard` |
| Conditionally shown notice bars | `AnimatePresence` + `height: 0 → 'auto'` (see the selection notice bar on the users page) |

Principle: motion serves state changes; no pointless loops / bounces; `prefers-reduced-motion` is handled globally for CSS animations, and motion animations stay short.

## Charts (ECharts)

Colors always come from `@/lib/chart-theme` and switch automatically between light and dark:

```jsx
const c = useChartColors()
const option = {
  ...chartBase(c),                                        // neutral styles for axes / grid / tooltip
  series: [{ type: 'line', smooth: true, lineStyle: { color: brandLine(c) }, areaStyle: brandArea(c) }],
}
```

`c` contains `brand-from / brand-via / brand-to`, `chart-1`...`chart-5`, `foreground`, `muted-foreground`, `border`, `card`, `popover`, `success / warning / danger`; for multiple series use token values such as `c['chart-1']`..., never hard-coded hex.
