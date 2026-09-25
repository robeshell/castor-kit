#!/usr/bin/env node
// -*- coding: utf-8 -*-
/**
 * Convert all relative imports (starting with ./ or ../) in JS/JSX under frontend/src to the @/ alias.
 *
 * Rules:
 *  - Only .js/.jsx module imports are handled; asset imports like CSS / images (./x.css etc.) stay relative,
 *    following the convention for same-directory asset references (Vite handles them correctly too).
 *  - Glob calls such as import.meta.glob(...) are left untouched.
 *  - The converted target must be inside the src root, otherwise exit with an error (prevents accidental cross-directory rewrites).
 *
 * Usage:
 *   node scripts/align-imports.mjs            # rewrite files in place
 *   node scripts/align-imports.mjs --dry-run  # print stats only, no rewrite
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const dryRun = process.argv.includes('--dry-run')

// Match from '...' / from "..." / import '...', capturing the path
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
    // Skip import.meta.glob / import( dynamic calls
    if (line.includes('import.meta.glob') || /import\s*\(/.test(line)) {
      continue
    }
    lines[i] = line.replace(SPECIFIER_RE, (match, spec) => {
      if (!spec.startsWith('./') && !spec.startsWith('../')) {
        return match // Package name or already @/ aliased, leave as is
      }
      if (isResourceImport(spec)) {
        return match // Keep relative asset imports
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
