import type { Locale } from 'date-fns'
import { enUS, ja, zhCN } from 'date-fns/locale'

const LOCALES: Partial<Record<string, Locale>> = { 'zh-CN': zhCN, 'en-US': enUS, 'ja-JP': ja }

/** date-fns locale for the current UI language (calendar month / weekday names) */
export function dateLocale(lang: string): Locale {
  return LOCALES[lang] || zhCN
}
