import type { DayPickerLocale } from 'react-day-picker'
import { enUS, ja, zhCN } from 'react-day-picker/locale'

// react-day-picker's locales: date-fns month / weekday names plus the calendar's own accessible labels
// ("Go to the next month", "Choose the year" …), which date-fns locales don't carry
const LOCALES: Partial<Record<string, DayPickerLocale>> = { 'zh-CN': zhCN, 'en-US': enUS, 'ja-JP': ja }

/** Calendar locale for the current UI language (month / weekday names and the calendar's screen-reader labels) */
export function dateLocale(lang: string): DayPickerLocale {
  return LOCALES[lang] || zhCN
}
