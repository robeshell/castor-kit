import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACCENTS, DEFAULT_APPEARANCE, normalizeAppearance } from '@/lib/appearance'

const css = readFileSync(join(__dirname, '..', 'src', 'index.css'), 'utf8')
const HEX = /^#[0-9a-f]{6}$/i

/** Declarations of the first rule whose selector list starts with `selector` */
function presetVars(selector) {
  const start = css.indexOf(`${selector} {`) >= 0 ? css.indexOf(`${selector} {`) : css.indexOf(`${selector},`)
  if (start < 0) return null
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries(body.split(';').map((d) => d.split(':').map((p) => p.trim())).filter(([k]) => k))
}

describe('accent presets', () => {
  it('every accent in lib/appearance.js has light and dark hex stops in index.css', () => {
    for (const { id } of ACCENTS) {
      for (const selector of [`[data-accent='${id}']`, `.dark[data-accent='${id}']`]) {
        const vars = presetVars(selector)
        expect(vars, selector).not.toBeNull()
        // chart-theme.js converts --brand-from to rgba, so the stops must stay plain hex
        for (const name of ['--brand-from', '--brand-via', '--brand-to']) expect(vars[name], `${selector} ${name}`).toMatch(HEX)
      }
    }
  })

  it('index.css has no preset missing from lib/appearance.js', () => {
    const ids = [...css.matchAll(/^\[data-accent='([a-z]+)'\]/gm)].map((m) => m[1])
    expect(ids.sort()).toEqual(ACCENTS.map((a) => a.id).sort())
  })
})

describe('normalizeAppearance', () => {
  it('keeps valid values and drops unknown ones', () => {
    expect(normalizeAppearance({ accent: 'violet', navMode: 'nope', contentWidth: 'fluid', extra: 1 })).toEqual({
      ...DEFAULT_APPEARANCE,
      accent: 'violet',
      contentWidth: 'fluid',
    })
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE)
  })
})
