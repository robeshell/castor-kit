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

function collectFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      collectFiles(full, out)
    } else if (/\.(js|jsx)$/.test(name)) {
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

function collectExportNames(file) {
  // 提取 export const X / export function X 的符号名
  const t = readFileSync(file, 'utf-8')
  const names = new Set()
  for (const m of t.matchAll(/export\s+(?:const|function|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(m[1])
  }
  return [...names]
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

  it('共享样式常量必须在本地定义或被导入后才可引用（防 ReferenceError）', () => {
    // 读取 shared/styles.js 导出的全部符号名，逐一检查全库引用来源
    const stylesExports = collectExportNames(join(SRC, 'shared/styles.js'))
    expect(stylesExports.length).toBeGreaterThan(0)

    const problems = []
    for (const file of collectFiles(SRC)) {
      const t = readFileSync(file, 'utf-8')
      for (const name of stylesExports) {
        // 本地定义（const X =）则无需导入
        if (new RegExp(`const\\s+${name}\\s*=`).test(t)) continue
        const imported = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]@/shared/styles['"]`).test(t)
        // 非 import 行、非定义行的真实引用（含 CSS 变量注释等干扰少，这里从严）
        const refs = t.split('\n').filter(
          l => new RegExp(`\\b${name}\\b`).test(l) && !/^import\s/.test(l.trim()) && !new RegExp(`const\\s+${name}\\s*=`).test(l)
        ).length
        if (refs > 0 && !imported) {
          problems.push(`${file} 引用了 ${name} 但未导入（若本地定义请确认命名）`)
        }
      }
    }
    expect(problems).toEqual([])
  })
})
