/**
 * castor-kit: code highlighting for Streamdown (MessageResponse), in place of @streamdown/code.
 *
 * @streamdown/code bundles every Shiki grammar (200+ files, ~10 MB of build output). This plugin keeps the same
 * interface but only knows the languages below; each grammar is loaded the first time a code block uses it, and
 * anything else is shown as plain text.
 */

import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

const THEMES = ['github-light', 'github-dark']

const GRAMMARS = {
  javascript: () => import('shiki/langs/javascript.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  shellscript: () => import('shiki/langs/shellscript.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
}

const ALIASES = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  bash: 'shellscript',
  sh: 'shellscript',
  shell: 'shellscript',
  zsh: 'shellscript',
  console: 'shellscript',
  py: 'python',
  yml: 'yaml',
  md: 'markdown',
  golang: 'go',
  rs: 'rust',
  docker: 'dockerfile',
  patch: 'diff',
  jsonc: 'json',
  psql: 'sql',
  postgresql: 'sql',
}

const resolve = (language) => {
  const name = String(language || '').trim().toLowerCase()
  return ALIASES[name] || name
}

let highlighter = null
const results = new Map()
const waiting = new Map()

function getHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
  return highlighter
}

async function tokensFor(code, lang) {
  const shiki = await getHighlighter()
  if (!shiki.getLoadedLanguages().includes(lang)) await shiki.loadLanguage(GRAMMARS[lang]())
  return shiki.codeToTokens(code, { lang, themes: { light: THEMES[0], dark: THEMES[1] } })
}

/** Streamdown code-highlighter plugin (same shape as @streamdown/code's `code`) */
export const code = {
  name: 'shiki',
  type: 'code-highlighter',
  supportsLanguage: (language) => resolve(language) in GRAMMARS,
  getSupportedLanguages: () => Object.keys(GRAMMARS),
  getThemes: () => THEMES,
  highlight({ code: source, language }, callback) {
    const lang = resolve(language)
    if (!(lang in GRAMMARS)) return null
    const key = `${lang}:${source}`
    if (results.has(key)) return results.get(key)
    if (callback) {
      if (!waiting.has(key)) waiting.set(key, new Set())
      waiting.get(key).add(callback)
    }
    tokensFor(source, lang)
      .then((tokens) => {
        results.set(key, tokens)
        // Code blocks re-render while streaming: keep the cache from growing without bound
        if (results.size > 200) results.delete(results.keys().next().value)
        for (const done of waiting.get(key) ?? []) done(tokens)
        waiting.delete(key)
      })
      .catch(() => waiting.delete(key))
    return null
  },
}
