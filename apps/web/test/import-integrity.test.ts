/**
 * Import integrity test: scan all JS/JSX/TS/TSX under apps/web/src and verify every module import path resolves.
 *
 * Covers two forms:
 *  - @/ alias (must point to a real file under the src root)
 *  - ./ or ../ relative paths (allowed for assets like CSS/images only; JS modules import through the @/ alias)
 */
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const SRC = resolve(process.cwd(), 'src')

const SPECIFIER_RE = /(?:from\s*|import\s*)['"]([^'"]+)['"]/g
const RESOURCE_RE = /\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|woff2?|ttf|otf|eot|json)$/i

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      collectFiles(full, out)
    } else if (/\.[jt]sx?$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

function collectSpecifiers(file: string): { spec: string; line: number }[] {
  const source = readFileSync(file, 'utf-8')
  const out: { spec: string; line: number }[] = []
  for (const [i, text] of source.split('\n').entries()) {
    if (text.includes('import.meta.glob') || /import\s*\(/.test(text)) {
      continue
    }
    for (const [, spec] of text.matchAll(SPECIFIER_RE)) {
      if (spec !== undefined) out.push({ spec, line: i + 1 })
    }
  }
  return out
}

describe('导入完整性', () => {
  it('每个模块导入路径都能解析到真实文件（@/ 别名或相对路径）', () => {
    const files = collectFiles(SRC)
    expect(files.length).toBeGreaterThan(50)
    const broken: string[] = []
    let aliasCount = 0
    let relativeJsCount = 0

    for (const file of files) {
      for (const { spec, line } of collectSpecifiers(file)) {
        if (spec.startsWith('@/')) {
          aliasCount++
          const target = join(SRC, spec.slice(2))
          if (!existsSync(target) && !['.tsx', '.ts', '.d.ts', '.jsx', '.js'].some((ext) => existsSync(`${target}${ext}`))) {
            broken.push(`${file}:${line} → ${spec}（无法解析）`)
          }
        } else if (spec.startsWith('./') || spec.startsWith('../')) {
          // Keeping asset imports (CSS/images) relative is fine
          if (RESOURCE_RE.test(spec)) continue
          // JS modules import through the @/ alias
          relativeJsCount++
          broken.push(`${file}:${line} → ${spec}（JS 模块应使用 @/ 别名）`)
        }
      }
    }

    expect(aliasCount).toBeGreaterThan(150) // Sanity check that the scan actually found alias imports
    expect(relativeJsCount).toBe(0) // JS relative imports must be zero
    expect(broken).toEqual([])
  })
})
