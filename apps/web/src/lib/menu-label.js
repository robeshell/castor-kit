import i18n from '@/i18n'

/** 菜单显示名：按 code 查当前语言的译文（src/locales/menus/<语言>.json），没有时用数据库里的名字 */
export function menuLabel(menu) {
  if (!menu) return ''
  return i18n.t(menu.code || '', { ns: 'menu', defaultValue: menu.name || '' })
}
