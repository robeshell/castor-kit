#!/usr/bin/env node
/**
 * Generates src/shared/api/openapi.d.ts from docs/apifox-full.openapi.json (openapi-typescript).
 *
 * Response objects in the doc rarely list `required`, but the backend's xxxToDict() always returns every key (nullable
 * ones are typed `[..., "null"]`), so every response property is marked required before generating. Request bodies are
 * left as documented: a body without `required` really does accept any subset of its fields.
 * An `{ type: 'object' }` without properties means "any keys" in JSON Schema; openapi-typescript would type it as
 * Record<string, never>, so it gets `additionalProperties: true` (→ Record<string, unknown>).
 *
 *   node scripts/api-types.mjs           write the file (also run by `pnpm openapi:generate`)
 *   node scripts/api-types.mjs --check   exit 1 if the file is out of date
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOC = resolve(WEB_DIR, '../../docs/apifox-full.openapi.json')
export const OUT = resolve(WEB_DIR, 'src/shared/api/openapi.d.ts')

function requireAll(schema) {
  if (!schema || typeof schema !== 'object') return
  if (schema.properties) {
    schema.required ??= Object.keys(schema.properties)
    Object.values(schema.properties).forEach(requireAll)
  }
  requireAll(schema.items)
  for (const key of ['oneOf', 'anyOf', 'allOf']) schema[key]?.forEach(requireAll)
}

function openObjects(node) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) return node.forEach(openObjects)
  const types = [node.type].flat()
  if (types.includes('object') && !node.properties && node.additionalProperties === undefined) node.additionalProperties = true
  Object.values(node).forEach(openObjects)
}

/** The generated file's content */
export async function generate() {
  const doc = JSON.parse(readFileSync(DOC, 'utf8'))
  for (const operations of Object.values(doc.paths)) {
    for (const operation of Object.values(operations)) {
      for (const response of Object.values(operation?.responses ?? {})) {
        for (const media of Object.values(response?.content ?? {})) requireAll(media.schema)
      }
    }
  }
  openObjects(doc.paths)
  const ast = await openapiTS(doc)
  return `/**\n * Generated from docs/apifox-full.openapi.json by apps/web/scripts/api-types.mjs. Do not edit;\n * run \`pnpm openapi:generate\` after changing the doc.\n */\n\n${astToString(ast)}`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const content = await generate()
  if (process.argv.includes('--check')) {
    const current = (() => {
      try {
        return readFileSync(OUT, 'utf8')
      } catch {
        return ''
      }
    })()
    if (current !== content) {
      console.error('❌ src/shared/api/openapi.d.ts is out of date: run pnpm openapi:generate')
      process.exit(1)
    }
    console.log('✅ src/shared/api/openapi.d.ts is up to date')
  } else {
    writeFileSync(OUT, content)
    console.log(`✅ Wrote ${OUT.slice(WEB_DIR.length + 1)}`)
  }
}
