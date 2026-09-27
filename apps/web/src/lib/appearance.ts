/**
 * Appearance options (single source of truth): accent presets, layout choices and the tags view switch.
 * Labels are the Chinese source text used as i18n keys; accent colors live in index.css under [data-accent='<id>'].
 * The choice is stored per browser in localStorage('appearance').
 */

/** One choice in an appearance menu (label is the Chinese i18n key) */
export interface AppearanceOption<Id extends string = string> {
  id: Id
  label: string
}

export const ACCENTS = [
  { id: 'ocean', label: '海洋蓝' },
  { id: 'violet', label: '紫罗兰' },
  { id: 'emerald', label: '翡翠绿' },
  { id: 'rose', label: '玫瑰红' },
  { id: 'amber', label: '琥珀橙' },
  { id: 'slate', label: '石墨灰' },
] as const satisfies readonly AppearanceOption[]

/** sidebar: full menu tree on the left; top: menus in the top bar; mixed: top-level sections on top, their menus on the left */
export const NAV_MODES = [
  { id: 'sidebar', label: '侧边栏' },
  { id: 'top', label: '顶部导航' },
  { id: 'mixed', label: '混合' },
] as const satisfies readonly AppearanceOption[]

/** Maps 1:1 to the shadcn <Sidebar variant> values */
export const SIDEBAR_VARIANTS = [
  { id: 'sidebar', label: '标准' },
  { id: 'floating', label: '浮动' },
  { id: 'inset', label: '内嵌' },
] as const satisfies readonly AppearanceOption[]

export const CONTENT_WIDTHS = [
  { id: 'boxed', label: '定宽' },
  { id: 'fluid', label: '流式' },
] as const satisfies readonly AppearanceOption[]

export type Accent = (typeof ACCENTS)[number]['id']
export type NavMode = (typeof NAV_MODES)[number]['id']
export type SidebarVariant = (typeof SIDEBAR_VARIANTS)[number]['id']
export type ContentWidth = (typeof CONTENT_WIDTHS)[number]['id']

export interface Appearance {
  accent: Accent
  navMode: NavMode
  sidebarVariant: SidebarVariant
  contentWidth: ContentWidth
  tagsView: boolean
}

/** tagsView: show the tabs bar of opened pages (and keep those pages alive) */
export const DEFAULT_APPEARANCE: Appearance = { accent: 'ocean', navMode: 'sidebar', sidebarVariant: 'sidebar', contentWidth: 'fluid', tagsView: true }

type OptionKey = Exclude<keyof Appearance, 'tagsView'>

const OPTIONS: { [K in OptionKey]: readonly AppearanceOption<Appearance[K]>[] } = {
  accent: ACCENTS,
  navMode: NAV_MODES,
  sidebarVariant: SIDEBAR_VARIANTS,
  contentWidth: CONTENT_WIDTHS,
}
const STORAGE_KEY = 'appearance'

/** The option of `key` whose id equals `candidate`, if any */
function findOption<K extends OptionKey>(key: K, candidate: unknown): AppearanceOption<Appearance[K]> | undefined {
  const options: readonly AppearanceOption<Appearance[K]>[] = OPTIONS[key]
  return options.find((o) => o.id === candidate)
}

/** Drop unknown keys / values so a stale or hand-edited entry can never break the layout */
export function normalizeAppearance(value: unknown): Appearance {
  const result = { ...DEFAULT_APPEARANCE }
  if (!value || typeof value !== 'object') return result
  const input: Partial<Record<keyof Appearance, unknown>> = value
  for (const key of Object.keys(OPTIONS) as OptionKey[]) {
    const option = findOption(key, input[key])
    if (option) Object.assign(result, { [key]: option.id })
  }
  if (typeof input.tagsView === 'boolean') result.tagsView = input.tagsView
  return result
}

export function readAppearance(): Appearance {
  try {
    return normalizeAppearance(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'))
  } catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

export function saveAppearance(value: Appearance): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* localStorage is unavailable in cases like private browsing */
  }
}

/** Content container classes shared by the page wrapper and its loading fallback */
export function contentContainerClass(contentWidth: ContentWidth): string {
  return contentWidth === 'fluid' ? 'w-full px-4 py-6 md:px-8 md:py-7' : 'mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-7'
}
