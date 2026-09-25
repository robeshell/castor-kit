import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCatalogs, scan, SRC_DIR, WEB_DIR } from '../scripts/i18n-scan.mjs'

const LANGS = ['en-US', 'ja-JP']

// Pages not converted yet; remove entries as they are converted (goal: empty list)
const PENDING = ['src/modules/admin/pages/', 'src/modules/component_center/']
const isPending = (file) =>
  PENDING.some((prefix) => file.startsWith(prefix)) && !file.startsWith('src/modules/admin/pages/profile/')

function localeDirs(dir = SRC_DIR, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (!statSync(path).isDirectory() || name === 'node_modules') continue
    if (name === 'locales') out.push(path)
    localeDirs(path, out)
  }
  return out
}

describe('i18n catalogs', () => {
  it('every locales/ directory has en-US and ja-JP with the same keys', () => {
    for (const dir of localeDirs()) {
      for (const sub of [dir, join(dir, 'menus')]) {
        let files
        try {
          files = readdirSync(sub).filter((f) => f.endsWith('.json'))
        } catch {
          continue
        }
        if (files.length === 0) continue
        const keys = LANGS.map((lang) => {
          const file = join(sub, `${lang}.json`)
          return Object.keys(JSON.parse(readFileSync(file, 'utf8'))).sort()
        })
        expect(keys[1], relative(WEB_DIR, sub)).toEqual(keys[0])
      }
    }
  })

  it('no key is translated differently in two files', () => {
    expect(loadCatalogs().conflicts).toEqual([])
  })

  it('every menu code in seed-rbac has an en-US and ja-JP name', () => {
    const seed = readFileSync(join(WEB_DIR, '..', 'api', 'scripts', 'seed-rbac.ts'), 'utf8')
    const codes = [...seed.matchAll(/code:\s*"([^"]+)"/g)].map((m) => m[1])
    expect(codes.length).toBeGreaterThan(100)
    for (const lang of LANGS) {
      const names = JSON.parse(readFileSync(join(SRC_DIR, 'locales', 'menus', `${lang}.json`), 'utf8'))
      expect(codes.filter((code) => !names[code]), lang).toEqual([])
    }
  })
})

describe('i18n scan', () => {
  it('converted source has no untranslated Chinese, raw JSX Chinese text or Chinese template literals', () => {
    const { problems } = scan('src')
    const outstanding = problems.filter((p) => !isPending(p.file)).map((p) => `${p.file}:${p.line} [${p.kind}] ${p.text}`)
    expect(outstanding).toEqual([])
  })

  it('scanner flags the three problem kinds', () => {
    // sanity check against a fixture so a scanner regression cannot silently pass the test above
    const { problems } = scan(relative(WEB_DIR, join(dirname(new URL(import.meta.url).pathname), 'fixtures', 'i18n-sample.jsx')))
    expect(problems.map((p) => p.kind).sort()).toEqual(['jsx-text', 'missing', 'template'])
  })
})
