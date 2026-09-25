/**
 * Appearance options (single source of truth): accent presets, layout choices and the tags view switch.
 * Labels are the Chinese source text used as i18n keys; accent colors live in index.css under [data-accent='<id>'].
 * The choice is stored per browser in localStorage('appearance').
 */

export const ACCENTS = [
  { id: 'ocean', label: '海洋蓝' },
  { id: 'violet', label: '紫罗兰' },
  { id: 'emerald', label: '翡翠绿' },
  { id: 'rose', label: '玫瑰红' },
  { id: 'amber', label: '琥珀橙' },
  { id: 'slate', label: '石墨灰' },
]

/** sidebar: full menu tree on the left; top: menus in the top bar; mixed: top-level sections on top, their menus on the left */
export const NAV_MODES = [
  { id: 'sidebar', label: '侧边栏' },
  { id: 'top', label: '顶部导航' },
  { id: 'mixed', label: '混合' },
]

/** Maps 1:1 to the shadcn <Sidebar variant> values */
export const SIDEBAR_VARIANTS = [
  { id: 'sidebar', label: '标准' },
  { id: 'floating', label: '浮动' },
  { id: 'inset', label: '内嵌' },
]

export const CONTENT_WIDTHS = [
  { id: 'boxed', label: '定宽' },
  { id: 'fluid', label: '流式' },
]

/** tagsView: show the tabs bar of opened pages (and keep those pages alive) */
export const DEFAULT_APPEARANCE = { accent: 'ocean', navMode: 'sidebar', sidebarVariant: 'sidebar', contentWidth: 'fluid', tagsView: true }

const OPTIONS = { accent: ACCENTS, navMode: NAV_MODES, sidebarVariant: SIDEBAR_VARIANTS, contentWidth: CONTENT_WIDTHS }
const STORAGE_KEY = 'appearance'

/** Drop unknown keys / values so a stale or hand-edited entry can never break the layout */
export function normalizeAppearance(value) {
  const result = { ...DEFAULT_APPEARANCE }
  if (!value || typeof value !== 'object') return result
  for (const [key, options] of Object.entries(OPTIONS)) {
    if (options.some((o) => o.id === value[key])) result[key] = value[key]
  }
  if (typeof value.tagsView === 'boolean') result.tagsView = value.tagsView
  return result
}

export function readAppearance() {
  try {
    return normalizeAppearance(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'))
  } catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

export function saveAppearance(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* localStorage is unavailable in cases like private browsing */
  }
}

/** Content container classes shared by the page wrapper and its loading fallback */
export function contentContainerClass(contentWidth) {
  return contentWidth === 'fluid' ? 'w-full px-4 py-6 md:px-8 md:py-7' : 'mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-7'
}
