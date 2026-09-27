/**
 * apps/web/src is TypeScript only: tsconfig.json has no allowJs, so a .js / .jsx file there would be built by Vite
 * but never type-checked. New code is .ts / .tsx (see AGENTS.md "TypeScript").
 */
import { readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../src')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(c|m)?jsx?$/.test(name)) out.push(relative(SRC, path))
  }
  return out
}

describe('TypeScript only', () => {
  it('src has no .js / .jsx files', () => {
    expect(walk(SRC)).toEqual([])
  })
})
