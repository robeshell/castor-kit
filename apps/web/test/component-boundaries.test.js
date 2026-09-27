/**
 * Component layer boundaries (docs/frontend-design-system.md "Component layers"):
 * - components/ui (shadcn primitives) imports only other primitives, @/lib/utils and shadcn's use-mobile hook.
 * - shared/components receives data through props and callbacks: no API clients, auth / app context,
 *   business modules or app shell. This keeps them reusable outside this app (a future shadcn registry).
 * Files in ALLOWED predate the rule; don't add to the list, move the dependency into a prop instead.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../src')
const SPECIFIER_RE = /(?:from\s*|import\s*\(?\s*)['"](@\/[^'"]+)['"]/g

const RULES = [
  {
    dir: 'components/ui',
    allowed: (spec) => spec.startsWith('@/components/ui/') || spec === '@/lib/utils' || spec === '@/shared/hooks/use-mobile',
  },
  {
    dir: 'shared/components',
    allowed: (spec) =>
      !/^@\/(context|modules|components\/app|shared\/api)(\/|$)/.test(spec) && spec !== '@/shared/hooks/useAppInfo',
  },
]

const ALLOWED = new Map([
  // Project changes to shadcn originals: form translates validation messages, sonner follows the app theme
  ['components/ui/form.jsx', /@\/i18n/],
  ['components/ui/sonner.jsx', /@\/context\/ThemeContext/],
  // Upload components still call the files API and read upload limits from the app info
  ['shared/components/upload/FileIdUpload.jsx', /@\/(shared\/api|shared\/hooks\/useAppInfo)/],
  ['shared/components/upload/AvatarUpload.jsx', /@\/(shared\/api|shared\/hooks\/useAppInfo)/],
])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.[jt]sx?$/.test(name) && !/\.test\.[jt]sx?$/.test(name)) out.push(path)
  }
  return out
}

describe('component boundaries', () => {
  for (const rule of RULES) {
    it(`${rule.dir} imports stay inside its layer`, () => {
      const offenders = walk(join(SRC, rule.dir)).flatMap((file) => {
        const rel = relative(SRC, file)
        if (ALLOWED.has(rel)) return []
        const specs = [...readFileSync(file, 'utf8').matchAll(SPECIFIER_RE)].map((m) => m[1])
        return specs.filter((spec) => !rule.allowed(spec)).map((spec) => `${rel} → ${spec}`)
      })
      expect(offenders).toEqual([])
    })
  }

  it('the allowlist only names files that exist and still need it', () => {
    for (const [rel, needs] of ALLOWED) expect(readFileSync(join(SRC, rel), 'utf8'), rel).toMatch(needs)
  })
})
