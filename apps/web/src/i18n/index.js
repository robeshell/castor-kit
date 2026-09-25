/**
 * 多语言：简体中文 / English / 日本語（i18next）
 *
 * 约定：**中文原文就是 key**。代码里写 `t('保存')`、`t('共 {{count}} 条', { count })`，
 * 中文不需要译文文件（找不到译文时直接显示 key 本身）；英文 / 日文在各处的 locales/<语言>.json 里写「中文 → 译文」。
 *
 * - 公共文案：src/locales/en-US.json、ja-JP.json
 * - 页面文案：和页面放在一起，如 modules/admin/pages/users/locales/en-US.json
 * - 菜单名：按菜单 code 翻译，src/locales/menus/<语言>.json；没有译文时显示数据库里的名字（见 lib/menu-label.js）
 *
 * 所有 locales/*.json 在构建时合并成一个命名空间；同一个中文 key 在两处给出不同译文会被测试拦下（test/i18n.test.js）。
 */

import { useCallback } from 'react'
import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'

// i18n-ignore-file: language names are shown in their own language and are not translated
export const LANGUAGES = [
  { code: 'zh-CN', label: '简体中文', short: '中' },
  { code: 'en-US', label: 'English', short: 'EN' },
  { code: 'ja-JP', label: '日本語', short: '日' },
]
export const DEFAULT_LANGUAGE = 'zh-CN'
const STORAGE_KEY = 'lang'
const CODES = LANGUAGES.map((l) => l.code)

const textFiles = import.meta.glob('../**/locales/*.json', { eager: true, import: 'default' })
const menuFiles = import.meta.glob('../locales/menus/*.json', { eager: true, import: 'default' })

/** 文件路径 → 语言代码（…/locales/en-US.json → en-US） */
function langOf(path) {
  return path.split('/').pop().replace(/\.json$/, '')
}

function buildResources() {
  const resources = Object.fromEntries(CODES.map((code) => [code, { translation: {}, menu: {} }]))
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

/** 规范成支持的语言代码：zh* → zh-CN，en* → en-US，ja* → ja-JP，其余 null */
export function normalizeLanguage(value) {
  const text = String(value || '').toLowerCase()
  if (text.startsWith('zh')) return 'zh-CN'
  if (text.startsWith('en')) return 'en-US'
  if (text.startsWith('ja')) return 'ja-JP'
  return null
}

/** 初始语言：上次选择 → 浏览器语言 → 简体中文 */
export function detectLanguage() {
  try {
    const saved = normalizeLanguage(localStorage.getItem(STORAGE_KEY))
    if (saved) return saved
  } catch {
    /* 隐私模式等场景 localStorage 不可用 */
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
  // 中文原文当 key：关掉 key 里的 . 和 : 分隔符
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

function syncDocument(lang) {
  document.documentElement.lang = lang
}
syncDocument(i18n.language)
i18n.on('languageChanged', syncDocument)

/**
 * 公共组件用：字符串按当前语言翻译，其他值（ReactNode、数字、undefined）原样返回。
 * 页面传给公共组件的中文 title / label / placeholder / 选项等因此不用逐个包 t()；已翻译的文字查不到 key，原样显示。
 */
export function useTx() {
  const { t } = useTranslation()
  return useCallback((value, options) => (typeof value === 'string' && value ? t(value, options) : value), [t])
}

/** 切换语言并记住选择 */
export function setLanguage(lang) {
  const next = normalizeLanguage(lang) || DEFAULT_LANGUAGE
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
  return i18n.changeLanguage(next)
}

export default i18n
