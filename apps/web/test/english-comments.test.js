/**
 * Code comments must be English across the repo (api, web, mcp, docs/templates).
 * Chinese is allowed inside quotes / backticks, where a comment quotes a real string from the code
 * (an error message, or the Chinese source text that doubles as an i18n key).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parse } from '@babel/parser'
import { describe, expect, it } from 'vitest'

const REPO = resolve(__dirname, '../../..')
const ROOTS = [
  'apps/api/src',
  'apps/api/test',
  'apps/api/scripts',
  'apps/web/src',
  'apps/web/test',
  'apps/web/scripts',
  'apps/mcp/src',
  'apps/mcp/test',
  'docs/templates',
]
const SKIP = new Set(['node_modules', 'dist', 'fixtures'])
const CJK = /[㐀-鿿豈-﫿]/
const QUOTED = /`[^`]*`|'[^'\n]*'|"[^"\n]*"|「[^」]*」|“[^”]*”/g

function walk(dir, out = []) {
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    if (SKIP.has(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(m?[jt]sx?)$/.test(name)) out.push(path)
  }
  return out
}

describe('code comments', () => {
  it('are written in English (Chinese only inside quoted strings)', () => {
    const offenders = []
    for (const file of ROOTS.flatMap((root) => walk(join(REPO, root)))) {
      const code = readFileSync(file, 'utf8')
      let comments
      try {
        comments = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true }).comments ?? []
      } catch {
        // docs/templates contain placeholders such as <Resource> and are not valid code: check comment-looking lines
        comments = code
          .split('\n')
          .map((value, i) => ({ value, loc: { start: { line: i + 1 } } }))
          .filter((c) => /^\s*(\/\/|\/\*|\*|\{\/\*)/.test(c.value))
      }
      for (const comment of comments) {
        const line = comment.value.split('\n').find((l) => CJK.test(l.replace(QUOTED, '')))
        if (line) offenders.push(`${relative(REPO, file)}:${comment.loc.start.line}  ${line.trim().slice(0, 100)}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
