import i18n from '@/i18n'

/** Menu display name: look up the current language's translation by code (src/locales/menus/<lang>.json), falling back to the name in the database */
export function menuLabel(menu) {
  if (!menu) return ''
  return i18n.t(menu.code || '', { ns: 'menu', defaultValue: menu.name || '' })
}
