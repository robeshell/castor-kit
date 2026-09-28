/**
 * Adding a generated module's menu to scripts/seed-rbac.ts (MENUS_DATA) — used by `pnpm scaffold -- --spec`.
 *
 * - admin modules go under the business group (code `biz`, id 1000), created on first use, and take the first free id
 *   in 1001–1999; component_center modules go under the gallery's Page patterns directory (code `cc_patterns`, id 43), which
 *   must exist, and take the first free id in 4301–4399 (AGENTS.md "Menu ID allocation"). The spec can name another
 *   parent; the id range stays the domain's. Button ids (id × 10 + 1…5) must be free as well
 * - Entries are written in the same one-line, double-quoted shape as the rest of MENUS_DATA
 * - Menu names in other languages go to apps/web/src/locales/menus/<lang>.json
 */

export const BIZ_GROUP = { id: 1000, code: 'biz', name: '业务管理', icon: 'Box', names: { 'en-US': 'Business', 'ja-JP': '業務管理' } }

/** Where a domain's generated menus go: the default parent (by code) and the menu id range */
export interface MenuPlacement {
  /** Code of the default parent; the business group is created when missing, any other must exist */
  parentCode: string
  /** First and last menu id the domain's generated menus may take */
  ids: readonly [number, number]
}

export const ADMIN_PLACEMENT: MenuPlacement = { parentCode: BIZ_GROUP.code, ids: [1001, 1999] }
/** The gallery's Page patterns directory, whose pages are 43 × 100 + n */
export const GALLERY_PLACEMENT: MenuPlacement = { parentCode: 'cc_patterns', ids: [4301, 4399] }

export interface MenuRequest {
  /** Menu / page title (Chinese) */
  title: string
  /** Title translations for the menu locales */
  titles: { 'en-US': string; 'ja-JP': string }
  /** Permission prefix of the module, e.g. system_device */
  permPrefix: string
  /** Frontend component, e.g. admin/device */
  component: string
  /** Route path, e.g. /biz/devices */
  path: string
  icon?: string
  /** Parent menu id; default: the placement's parent */
  parentId?: number
  /** Default parent and id range (default: the business group, 1001–1999) */
  placement?: MenuPlacement
}

export interface MenuEntry {
  id: number
  name: string
  code: string
  icon: string | null
  path: string | null
  component: string | null
  parent_id: number | null
  sort_order: number
  menu_type: 'menu' | 'button'
}

const BUTTONS = [
  { suffix: '_add', zh: '新建', en: 'Add', ja: '追加' },
  { suffix: '_edit', zh: '编辑', en: 'Edit', ja: '編集' },
  { suffix: '_delete', zh: '删除', en: 'Delete', ja: '削除' },
  { suffix: '_export', zh: '导出', en: 'Export', ja: 'エクスポート' },
  { suffix: '_import', zh: '导入', en: 'Import', ja: 'インポート' },
] as const

/** The part of seed-rbac.ts holding MENUS_DATA: [start of the array body, index of its closing bracket] */
function menusBlock(content: string): [number, number] {
  const start = content.indexOf('export const MENUS_DATA')
  if (start < 0) throw new Error('MENUS_DATA not found in seed-rbac.ts')
  const open = content.indexOf('[', content.indexOf('=', start))
  const close = content.indexOf('\n]', open)
  if (open < 0 || close < 0) throw new Error('Unrecognized MENUS_DATA format in seed-rbac.ts')
  return [open + 1, close]
}

/** Menus already in MENUS_DATA: id, code, parent and sort order */
export function existingMenus(content: string): Array<Pick<MenuEntry, 'id' | 'code' | 'parent_id' | 'sort_order'>> {
  const [from, to] = menusBlock(content)
  const out: Array<Pick<MenuEntry, 'id' | 'code' | 'parent_id' | 'sort_order'>> = []
  for (const line of content.slice(from, to).split('\n')) {
    const id = /\bid:\s*(\d+)/.exec(line)
    const code = /\bcode:\s*"([^"]+)"/.exec(line)
    if (!id || !code) continue
    const parent = /\bparent_id:\s*(\d+|null)/.exec(line)?.[1]
    const sort = /\bsort_order:\s*(\d+)/.exec(line)?.[1]
    out.push({ id: Number(id[1]), code: code[1]!, parent_id: parent && parent !== 'null' ? Number(parent) : null, sort_order: Number(sort ?? 0) })
  }
  return out
}

function line(entry: MenuEntry): string {
  const str = (v: string | null) => (v === null ? 'null' : JSON.stringify(v))
  return (
    `  { id: ${entry.id}, name: ${str(entry.name)}, code: ${str(entry.code)}, icon: ${str(entry.icon)}, path: ${str(entry.path)}, ` +
    `component: ${str(entry.component)}, parent_id: ${entry.parent_id ?? 'null'}, sort_order: ${entry.sort_order}, ` +
    `menu_type: "${entry.menu_type}", is_visible: ${entry.menu_type === 'menu'}, is_active: true },`
  )
}

/**
 * The entries for a module (the business group first when it doesn't exist yet), or null when the module's menu is
 * already there (its code is taken)
 */
export function planMenus(content: string, request: MenuRequest): MenuEntry[] | null {
  const menus = existingMenus(content)
  const codes = new Set(menus.map((m) => m.code))
  if (codes.has(request.permPrefix)) return null
  const ids = new Set(menus.map((m) => m.id))
  const entries: MenuEntry[] = []

  const placement = request.placement ?? ADMIN_PLACEMENT
  let parentId = request.parentId
  if (parentId === undefined) {
    const group = menus.find((m) => m.code === placement.parentCode)
    if (group) {
      parentId = group.id
    } else if (placement.parentCode !== BIZ_GROUP.code) {
      throw new Error(`The parent directory ${placement.parentCode} isn't in MENUS_DATA; add it first or set menu.parentId`)
    } else {
      if (ids.has(BIZ_GROUP.id)) throw new Error(`Menu ID ${BIZ_GROUP.id} is already taken, so the 业务管理 (Business) directory can't be created`)
      const topSort = Math.max(0, ...menus.filter((m) => m.parent_id === null && m.code !== 'system').map((m) => m.sort_order))
      entries.push({ id: BIZ_GROUP.id, name: BIZ_GROUP.name, code: BIZ_GROUP.code, icon: BIZ_GROUP.icon, path: null, component: null, parent_id: null, sort_order: topSort + 1, menu_type: 'menu' })
      ids.add(BIZ_GROUP.id)
      parentId = BIZ_GROUP.id
    }
  } else if (!ids.has(parentId)) {
    throw new Error(`Parent menu ${parentId} doesn't exist`)
  }

  const [first, last] = placement.ids
  let id = first
  while (id <= last && (ids.has(id) || BUTTONS.some((_, i) => ids.has(id * 10 + i + 1)))) id++
  if (id > last) throw new Error(`No generated module menu IDs left (${first}–${last})`)
  const sort = Math.max(0, ...menus.filter((m) => m.parent_id === parentId).map((m) => m.sort_order)) + 1
  entries.push({
    id,
    name: request.title,
    code: request.permPrefix,
    icon: request.icon ?? 'List',
    path: request.path,
    component: request.component,
    parent_id: parentId,
    sort_order: sort,
    menu_type: 'menu',
  })
  BUTTONS.forEach((b, i) => {
    entries.push({
      id: id * 10 + i + 1,
      name: `${b.zh}${request.title}`,
      code: `${request.permPrefix}${b.suffix}`,
      icon: null,
      path: null,
      component: null,
      parent_id: id,
      sort_order: i + 1,
      menu_type: 'button',
    })
  })
  return entries
}

/** seed-rbac.ts with the entries appended to MENUS_DATA */
export function insertMenus(content: string, entries: MenuEntry[], comment: string): string {
  const [, close] = menusBlock(content)
  const block = [`  // ${comment}`, ...entries.map(line)].join('\n')
  return `${content.slice(0, close)}\n${block}${content.slice(close)}`
}

/** Menu names for apps/web/src/locales/menus/<lang>.json */
export function menuNames(entries: MenuEntry[], request: MenuRequest, lang: 'en-US' | 'ja-JP'): Record<string, string> {
  const title = request.titles[lang]
  const out: Record<string, string> = {}
  for (const entry of entries) {
    if (entry.code === BIZ_GROUP.code) out[entry.code] = BIZ_GROUP.names[lang]
    else if (entry.code === request.permPrefix) out[entry.code] = title
    else {
      const button = BUTTONS.find((b) => entry.code === `${request.permPrefix}${b.suffix}`)!
      out[entry.code] = lang === 'en-US' ? `${button.en} ${title}` : `${title}を${button.ja}`
    }
  }
  return out
}
