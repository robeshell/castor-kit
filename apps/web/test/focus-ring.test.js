/**
 * One focus style across the UI: a 2px ring at 20% of the brand color next to the ring-colored border.
 * shadcn's default (a 3px ring at 50%) looks heavy with the brand orange and comes back with every newly added
 * component, so the old values are rejected here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../src')
const HEAVY = /ring-\[3px\]|ring-ring\/(?:[3-9]\d|100)\b/g

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(jsx?|css)$/.test(name)) out.push(path)
  }
  return out
}

describe('focus style', () => {
  it('uses ring-2 + ring-ring/20, not the heavy shadcn default', () => {
    const hits = walk(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) => (line.match(HEAVY) ?? []).map((m) => `${relative(SRC, file)}:${i + 1} ${m}`)),
    )
    expect(hits).toEqual([])
  })
})
