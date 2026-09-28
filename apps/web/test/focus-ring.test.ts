/**
 * One focus indicator across the UI: a solid outline in the full-strength ring color.
 * - Borderless controls: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`.
 * - Bordered text fields: `focus-visible:border-ring focus-visible:outline-1 focus-visible:outline-ring`
 *   (the 1px border and the 1px outline form one 2px perimeter).
 * An outline, unlike a box-shadow ring, survives forced-colors mode, and the full-strength ring color measures
 * at least 3:1 against every surface. So this test rejects the old translucent halo (`ring-ring/20`) as a focus
 * style, shadcn's heavy default (`ring-[3px]` + `ring-ring/50`) that comes back with every newly added component,
 * and a bare `outline-none` that removes the indicator with nothing in its place.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../src')
const HEAVY = /ring-\[3px\]/g
// A translucent ring color under a focus variant (`focus-visible:ring-ring/20`, `has-focus:ring-ring/20`, ...)
const FAINT = /\b(?:[\w-]*focus[\w-]*|data-\[active=true\]|has-\[[^\]]*focus[^\]]*\]):ring-(?:ring|primary|brand)\/\d+/g
// `outline-none` with no variant in front (`focus-visible:outline-none` on an input whose wrapper shows focus is fine)
const BARE_OUTLINE_NONE = /(?<![\w:-])outline-none\b/g
// Programmatic focus targets that are not controls (Radix moves focus to the dialog itself only when it has no focusable child)
const OUTLINE_NONE_ALLOWED = new Set(['components/ui/dialog.tsx'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.([jt]sx?|css)$/.test(name)) out.push(path)
  }
  return out
}

function hits(pattern: RegExp, skip: Set<string> = new Set()): string[] {
  return walk(SRC).flatMap((file) => {
    const rel = relative(SRC, file)
    if (skip.has(rel)) return []
    return readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, i) => (line.match(pattern) ?? []).map((m) => `${rel}:${i + 1} ${m}`))
  })
}

describe('focus style', () => {
  it('does not use the heavy shadcn default ring', () => {
    expect(hits(HEAVY)).toEqual([])
  })

  it('does not use a translucent ring as the focus indicator', () => {
    expect(hits(FAINT)).toEqual([])
  })

  it('never removes the outline without a replacement', () => {
    expect(hits(BARE_OUTLINE_NONE, OUTLINE_NONE_ALLOWED)).toEqual([])
  })
})
