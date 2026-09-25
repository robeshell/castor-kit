// -*- coding: utf-8 -*-
/**
 * Import integrity test: scan all JS/JSX under frontend/src and verify every module import path resolves.
 *
 * Covers two forms:
 *  - @/ alias (should point to a real file under the src root)
 *  - ./ or ../ relative paths (asset imports like CSS/images stay relative; JS modules should no longer use relative imports)
 *
 * This test is the regression guard for the "unified @ alias" change: any broken import or regression to relative JS imports fails here.
 */
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const SRC = resolve(process.cwd(), 'src')

const SPECIFIER_RE = /(?:from\s*|import\s*)['"]([^'"]+)['"]/g
const RESOURCE_RE = /\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|woff2?|ttf|otf|eot|json)$/i

function collectFiles(dir, out = [], ext = /\.(js|jsx)$/) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      collectFiles(full, out, ext)
    } else if (ext.test(name)) {
      out.push(full)
    }
  }
  return out
}

function collectSpecifiers(file) {
  const source = readFileSync(file, 'utf-8')
  const out = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('import.meta.glob') || /import\s*\(/.test(lines[i])) {
      continue
    }
    for (const m of lines[i].matchAll(SPECIFIER_RE)) {
      out.push({ spec: m[1], line: i + 1 })
    }
  }
  return out
}

describe('导入完整性', () => {
  it('每个模块导入路径都能解析到真实文件（@/ 别名或相对路径）', () => {
    const files = collectFiles(SRC)
    expect(files.length).toBeGreaterThan(50)
    const broken = []
    let aliasCount = 0
    let relativeJsCount = 0

    for (const file of files) {
      for (const { spec, line } of collectSpecifiers(file)) {
        if (spec.startsWith('@/')) {
          aliasCount++
          const target = join(SRC, spec.slice(2))
          if (!existsSync(target) && !existsSync(`${target}.jsx`) && !existsSync(`${target}.js`)) {
            broken.push(`${file}:${line} → ${spec}（无法解析）`)
          }
        } else if (spec.startsWith('./') || spec.startsWith('../')) {
          // Keeping asset imports (CSS/images) relative is fine
          if (RESOURCE_RE.test(spec)) continue
          // JS modules should no longer use relative imports (unified @ alias)
          relativeJsCount++
          broken.push(`${file}:${line} → ${spec}（JS 模块应使用 @/ 别名）`)
        }
      }
    }

    expect(aliasCount).toBeGreaterThan(150) // Alias unification already covers the vast majority
    expect(relativeJsCount).toBe(0) // JS relative imports must be zero
    expect(broken).toEqual([])
  })

  it('已下线的 Semi Design / 旧富文本依赖不得再出现（防回退）', () => {
    const LEGACY = [
      [/from\s*['"]@douyinfe\//, '@douyinfe/semi-*'],
      [/var\(--semi-/, 'var(--semi-*)'],
      [/from\s*['"]react-quill['"]/, 'react-quill（改用 react-quill-new）'],
      [/['"]@\/shared\/styles['"]/, '@/shared/styles（改用 Tailwind 工具类）'],
    ]
    const problems = []
    for (const file of collectFiles(SRC, [], /\.(js|jsx|css)$/)) {
      const t = readFileSync(file, 'utf-8')
      for (const [re, label] of LEGACY) if (re.test(t)) problems.push(`${file} 使用了 ${label}`)
    }
    for (const dir of ['src/components/Layout', 'src/shared/components/import-export']) {
      if (existsSync(resolve(process.cwd(), dir))) problems.push(`${dir} 应已删除`)
    }
    expect(problems).toEqual([])
  })
})
