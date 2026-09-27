/**
 * i18n: Simplified Chinese / English / Japanese (i18next)
 *
 * Convention: **the Chinese source text is the key**. Code writes `t('保存')`, `t('共 {{count}} 条', { count })`;
 * Chinese needs no translation file (when no translation is found the key itself is shown); English / Japanese go in the nearby locales/<lang>.json as "Chinese → translation".
 *
 * - Shared strings: src/locales/en-US.json, ja-JP.json
 * - Page strings: live next to the page, e.g. modules/admin/pages/users/locales/en-US.json
 * - Menu names: translated by menu code in src/locales/menus/<lang>.json; without a translation the name from the database is shown (see lib/menu-label.ts)
 *
 * All locales/*.json files are merged into one namespace at build time; giving the same Chinese key different translations in two places is caught by a test (test/i18n.test.ts).
 */

import { useCallback } from 'react'
import i18n, { type Resource, type TOptions } from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'

// i18n-ignore-file: language names are shown in their own language and are not translated
export const LANGUAGES = [
  { code: 'zh-CN', label: '简体中文', short: '中' },
  { code: 'en-US', label: 'English', short: 'EN' },
  { code: 'ja-JP', label: '日本語', short: '日' },
] as const

/** A supported UI language code */
export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const DEFAULT_LANGUAGE: LanguageCode = 'en-US'
const STORAGE_KEY = 'lang'
const CODES = LANGUAGES.map((l) => l.code)

/** Every locales file maps Chinese source text (or a menu code) to its translation */
type Messages = Record<string, string>

const textFiles = import.meta.glob<Messages>('../**/locales/*.json', { eager: true, import: 'default' })
const menuFiles = import.meta.glob<Messages>('../locales/menus/*.json', { eager: true, import: 'default' })

/** File path → language code (…/locales/en-US.json → en-US) */
function langOf(path: string): string {
  return path.split('/').pop()!.replace(/\.json$/, '')
}

function buildResources(): Resource {
  const resources: Record<string, { translation: Messages; menu: Messages }> = Object.fromEntries(
    CODES.map((code) => [code, { translation: {}, menu: {} }]),
  )
  for (const [path, messages] of Object.entries(textFiles)) {
    const lang = langOf(path)
    if (resources[lang]) Object.assign(resources[lang].translation, messages)
  }
  for (const [path, names] of Object.entries(menuFiles)) {
    const lang = langOf(path)
    if (resources[lang]) Object.assign(resources[lang].menu, names)
  }
  return resources
}

/** Normalize to a supported language code: zh* → zh-CN, en* → en-US, ja* → ja-JP, anything else null */
export function normalizeLanguage(value: string | null | undefined): LanguageCode | null {
  const text = String(value || '').toLowerCase()
  if (text.startsWith('zh')) return 'zh-CN'
  if (text.startsWith('en')) return 'en-US'
  if (text.startsWith('ja')) return 'ja-JP'
  return null
}

/** Initial language: last choice → browser language → English */
export function detectLanguage(): LanguageCode {
  try {
    const saved = normalizeLanguage(localStorage.getItem(STORAGE_KEY))
    if (saved) return saved
  } catch {
    /* localStorage is unavailable in private mode and similar cases */
  }
  for (const candidate of navigator.languages || [navigator.language]) {
    const lang = normalizeLanguage(candidate)
    if (lang) return lang
  }
  return DEFAULT_LANGUAGE
}

i18n.use(initReactI18next).init({
  resources: buildResources(),
  lng: detectLanguage(),
  fallbackLng: false,
  // Chinese source text as keys: disable the . and : separators in keys
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

function syncDocument(lang: string) {
  document.documentElement.lang = lang
}
syncDocument(i18n.language)
i18n.on('languageChanged', syncDocument)

/**
 * For shared components: strings are translated into the current language; other values (ReactNode, numbers, undefined) are returned as is.
 * So Chinese title / label / placeholder / options etc. passed from pages to shared components need no individual t() wrapping; already-translated text has no matching key and is shown as is.
 */
export type Tx = <T>(value: T, options?: TOptions) => T | string

export function useTx(): Tx {
  const { t } = useTranslation()
  return useCallback<Tx>((value, options) => (typeof value === 'string' && value ? t(value as string, options) : value), [t])
}

/** Switch language and remember the choice */
export function setLanguage(lang: string | null | undefined) {
  const next = normalizeLanguage(lang) || DEFAULT_LANGUAGE
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
  return i18n.changeLanguage(next)
}

export default i18n
