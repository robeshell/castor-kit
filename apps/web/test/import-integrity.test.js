// -*- coding: utf-8 -*-
/**
 * 导入完整性测试：扫描 frontend/src 下所有 JS/JSX，验证每个模块导入路径都能解析。
 *
 * 覆盖两种形态：
 *  - @/ 别名（应指向 src 根下的真实文件）
 *  - ./ 或 ../ 相对路径（资源导入如 CSS/图片保留相对，JS 模块不应再出现相对）
 *
 * 该测试是「@ 别名统一」改动的回归防线：任何 broken import 或回退成相对 JS 导入都会在此失败。
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
          // 资源导入（CSS/图片）保留相对是合理的
          if (RESOURCE_RE.test(spec)) continue
          // JS 模块不应再出现相对导入（@ 别名统一）
          relativeJsCount++
          broken.push(`${file}:${line} → ${spec}（JS 模块应使用 @/ 别名）`)
        }
      }
    }

    expect(aliasCount).toBeGreaterThan(150) // 别名统一已覆盖绝大多数
    expect(relativeJsCount).toBe(0) // JS 相对导入必须清零
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
