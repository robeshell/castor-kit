#!/usr/bin/env node
// -*- coding: utf-8 -*-
/**
 * 将 frontend/src 下所有 JS/JSX 的相对导入（./ 或 ../ 开头）统一转换为 @/ 别名。
 *
 * 规则：
 *  - 只处理 .js/.jsx 模块导入；CSS / 图片等资源导入（./x.css 等）保持相对路径，
 *    符合同目录资源引用惯例（Vite 也能正确处理）。
 *  - import.meta.glob(...) 等 glob 调用不改动。
 *  - 转换后目标必须位于 src 根内，否则报错退出（防止误改跨目录）。
 *
 * 用法：
 *   node scripts/align-imports.mjs            # 直接改写文件
 *   node scripts/align-imports.mjs --dry-run  # 只打印统计，不改写
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const dryRun = process.argv.includes('--dry-run')

// 匹配 from '...' / from "..." / import '...'，捕获路径
const SPECIFIER_RE = /(?:from\s*|import\s*)['"]([^'"]+)['"]/g

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

function isResourceImport(spec) {
  return /\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|woff2?|ttf|otf|eot|json)$/i.test(spec)
}

function convertFile(file, stats) {
  const dir = dirname(file)
  const text = readFileSync(file, 'utf-8')
  const lines = text.split('\n')
  let changed = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 跳过 import.meta.glob / import( 动态调用
    if (line.includes('import.meta.glob') || /import\s*\(/.test(line)) {
      continue
    }
    lines[i] = line.replace(SPECIFIER_RE, (match, spec) => {
      if (!spec.startsWith('./') && !spec.startsWith('../')) {
        return match // 包名或 @/ 已别名，不动
      }
      if (isResourceImport(spec)) {
        return match // 资源相对导入保持
      }
      const target = join(dir, spec)
      const rel = relative(root, target)
      if (rel.startsWith('..') || rel.startsWith(sep)) {
        throw new Error(`[align-imports] ${file}:${i + 1} 相对导入越出 src 根: ${spec}`)
      }
      const alias = '@/' + rel.split(sep).join('/')
      if (alias === spec) return match
      changed++
      return match.replace(spec, alias)
    })
  }

  if (changed > 0) {
    stats[file] = { changed, before: text }
    if (!dryRun) {
      writeFileSync(file, lines.join('\n'), 'utf-8')
    }
  }
}

const files = collectFiles(root)
const stats = {}
for (const f of files) convertFile(f, stats)

const total = Object.values(stats).reduce((s, x) => s + x.changed, 0)
const fileCount = Object.keys(stats).length
console.log(`[align-imports] ${dryRun ? '(dry-run) ' : ''}共转换 ${total} 处导入，涉及 ${fileCount} 个文件`)

if (dryRun) {
  for (const [f, { changed }] of Object.entries(stats)) {
    console.log(`  ${changed.toString().padStart(3)}  ${f.slice(root.length + 1)}`)
  }
}
