import { enUS, ja, zhCN } from 'date-fns/locale'

const LOCALES = { 'zh-CN': zhCN, 'en-US': enUS, 'ja-JP': ja }

/** date-fns locale for the current UI language (calendar month / weekday names) */
export function dateLocale(lang) {
  return LOCALES[lang] || zhCN
}
