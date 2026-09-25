#!/usr/bin/env node
/**
 * i18n scanner for apps/web/src (Chinese source text is the i18n key, see src/i18n/index.js).
 *
 * Reports, per file:
 *   - missing:  a Chinese string literal with no en-US / ja-JP translation in any locales/*.json
 *   - jsx-text: Chinese written directly as JSX text (never goes through t(), so it is never translated)
 *   - template: a template literal containing Chinese (use t('… {{name}} …', { name }) instead)
 *
 * Escape hatches (for demo content that is data, not UI):
 *   - a file containing the comment `i18n-ignore-file` is skipped
 *   - a line preceded by a comment containing `i18n-ignore-next-line` is skipped
 *
 * CLI:
 *   node scripts/i18n-scan.mjs                 # scan all of src, exit 1 on problems
 *   node scripts/i18n-scan.mjs src/modules/admin/pages/users
 *   node scripts/i18n-scan.mjs --json <path>   # machine-readable output
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@babel/parser'

export const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const SRC_DIR = join(WEB_DIR, 'src')
export const LANGS = ['en-US', 'ja-JP']
const CJK = /[㐀-鿿豈-﫿]/
// shadcn primitives are vendored and carry no UI copy
const SKIP_DIRS = new Set(['node_modules', join(SRC_DIR, 'components', 'ui')])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (SKIP_DIRS.has(path) || name === 'node_modules') continue
    const st = statSync(path)
    if (st.isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

/** Merged catalogs: { 'en-US': { zh: text }, ... } plus conflicts where two files translate a key differently */
export function loadCatalogs() {
  const catalogs = Object.fromEntries(LANGS.map((l) => [l, {}]))
  const origin = Object.fromEntries(LANGS.map((l) => [l, {}]))
  const conflicts = []
  for (const path of walk(SRC_DIR)) {
    const match = /\/locales\/([A-Za-z-]+)\.json$/.exec(path)
    if (!match || !catalogs[match[1]]) continue
    const lang = match[1]
    const messages = JSON.parse(readFileSync(path, 'utf8'))
    for (const [key, value] of Object.entries(messages)) {
      const prev = catalogs[lang][key]
      if (prev !== undefined && prev !== value) {
        conflicts.push({ lang, key, a: prev, fileA: origin[lang][key], b: value, fileB: relative(WEB_DIR, path) })
      }
      catalogs[lang][key] = value
      origin[lang][key] = relative(WEB_DIR, path)
    }
  }
  return { catalogs, conflicts }
}

function sourceFiles(target) {
  const root = resolve(WEB_DIR, target || 'src')
  const files = statSync(root).isDirectory() ? walk(root) : [root]
  return files.filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.endsWith('.test.js') && !f.endsWith('.test.jsx'))
}

/** Walk the AST without @babel/traverse; calls visit(node, parent, parentKey) */
function visitAst(node, visit, parent = null, parentKey = null) {
  if (!node || typeof node.type !== 'string') return
  visit(node, parent, parentKey)
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'leadingComments' || key === 'trailingComments') continue
    const child = node[key]
    if (Array.isArray(child)) child.forEach((c) => visitAst(c, visit, node, key))
    else if (child && typeof child.type === 'string') visitAst(child, visit, node, key)
  }
}

export function scanFile(path, catalogs) {
  const code = readFileSync(path, 'utf8')
  if (code.includes('i18n-ignore-file')) return []
  const ignored = new Set()
  const lines = code.split('\n')
  lines.forEach((line, i) => {
    if (line.includes('i18n-ignore-next-line')) ignored.add(i + 2)
  })
  let ast
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true })
  } catch (err) {
    return [{ file: relative(WEB_DIR, path), line: 0, kind: 'parse-error', text: String(err.message) }]
  }
  const problems = []
  const report = (node, kind, text) => {
    const line = node.loc?.start.line ?? 0
    if (ignored.has(line)) return
    problems.push({ file: relative(WEB_DIR, path), line, kind, text })
  }
  visitAst(ast.program, (node, parent, parentKey) => {
    if (node.type === 'StringLiteral' && CJK.test(node.value)) {
      // object keys and import paths are not UI copy
      if ((parent?.type === 'ObjectProperty' && parentKey === 'key' && !parent.computed) || parent?.type === 'ImportDeclaration') return
      const missing = LANGS.filter((lang) => !catalogs[lang][node.value])
      if (missing.length) report(node, 'missing', node.value)
    } else if (node.type === 'JSXText' && CJK.test(node.value)) {
      report(node, 'jsx-text', node.value.trim())
    } else if (node.type === 'TemplateLiteral' && node.quasis.some((q) => CJK.test(q.value.cooked ?? q.value.raw))) {
      report(node, 'template', node.quasis.map((q) => q.value.raw).join('${…}'))
    }
  })
  return problems
}

export function scan(target) {
  const { catalogs, conflicts } = loadCatalogs()
  const problems = sourceFiles(target).flatMap((f) => scanFile(f, catalogs))
  return { problems, conflicts }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const target = args.find((a) => !a.startsWith('--'))
  const { problems, conflicts } = scan(target)
  if (json) {
    process.stdout.write(`${JSON.stringify({ problems, conflicts }, null, 2)}\n`)
  } else {
    for (const p of problems) console.log(`${p.file}:${p.line}  [${p.kind}]  ${p.text}`)
    for (const c of conflicts) console.log(`[conflict ${c.lang}] ${c.key}: "${c.a}" (${c.fileA}) vs "${c.b}" (${c.fileB})`)
    console.log(`\n${problems.length} problem(s), ${conflicts.length} conflict(s)`)
  }
  // exitCode instead of exit(): exit() can truncate large piped stdout
  process.exitCode = problems.length || conflicts.length ? 1 : 0
}
