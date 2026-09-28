/**
 * Castor: code highlighting for Streamdown (MessageResponse), in place of @streamdown/code.
 *
 * @streamdown/code bundles every Shiki grammar (200+ files, ~10 MB of build output). This plugin keeps the same
 * interface but only knows the languages below; each grammar is loaded the first time a code block uses it, and
 * anything else is shown as plain text.
 */

import { createHighlighterCore, type HighlighterCore, type TokensResult } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { CodeHighlighterPlugin } from 'streamdown'

type HighlightCallback = NonNullable<Parameters<CodeHighlighterPlugin['highlight']>[1]>

const THEMES: [string, string] = ['github-light', 'github-dark']

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

/** A language the highlighter can load */
export type GrammarName = keyof typeof GRAMMARS

const ALIASES: Record<string, string> = {
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

// Own keys only: plain-object lookups would also match inherited keys such as `constructor`
const resolve = (language: string): string => {
  const name = language.trim().toLowerCase()
  return (Object.hasOwn(ALIASES, name) && ALIASES[name]) || name
}

const isGrammar = (name: string): name is GrammarName => Object.hasOwn(GRAMMARS, name)

let highlighter: Promise<HighlighterCore> | null = null
const results = new Map<string, TokensResult>()
const waiting = new Map<string, Set<HighlightCallback>>()

function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= createHighlighterCore({
    themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
  return highlighter
}

/** Dual-theme tokens (each token's htmlStyle carries `color` and `--shiki-dark`); also used by the component gallery's code blocks */
export async function tokensFor(code: string, lang: GrammarName): Promise<TokensResult> {
  const shiki = await getHighlighter()
  if (!shiki.getLoadedLanguages().includes(lang)) await shiki.loadLanguage(GRAMMARS[lang]())
  return shiki.codeToTokens(code, { lang, themes: { light: THEMES[0], dark: THEMES[1] } })
}

/** Streamdown code-highlighter plugin (same shape as @streamdown/code's `code`) */
export const code: CodeHighlighterPlugin = {
  name: 'shiki',
  type: 'code-highlighter',
  supportsLanguage: (language) => isGrammar(resolve(language)),
  getSupportedLanguages: () => Object.keys(GRAMMARS),
  getThemes: () => THEMES,
  highlight({ code: source, language }, callback) {
    const lang = resolve(language)
    if (!isGrammar(lang)) return null
    const key = `${lang}:${source}`
    const cached = results.get(key)
    if (cached) return cached
    if (callback) {
      const callbacks = waiting.get(key)
      if (callbacks) callbacks.add(callback)
      else waiting.set(key, new Set([callback]))
    }
    tokensFor(source, lang)
      .then((tokens) => {
        results.set(key, tokens)
        // Code blocks re-render while streaming: keep the cache from growing without bound
        if (results.size > 200) {
          const oldest = results.keys().next().value
          if (oldest !== undefined) results.delete(oldest)
        }
        for (const done of waiting.get(key) ?? []) done(tokens)
        waiting.delete(key)
      })
      .catch(() => waiting.delete(key))
    return null
  },
}
