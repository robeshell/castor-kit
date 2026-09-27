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
 *   node scripts/api-types.mjs                write the file (also run by `pnpm openapi:generate`)
 *   node scripts/api-types.mjs --check        exit 1 if the file is out of date
 *   node scripts/api-types.mjs --root <dir>   use another checkout's doc and output (`pnpm scaffold` passes its --root,
 *                                             so a module scaffolded into a temp copy gets its types there)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import openapiTS, { astToString } from 'openapi-typescript'

/** The repository this script belongs to */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/** The doc read and the file written for a repository root */
export function pathsFor(root = REPO_ROOT) {
  return { doc: resolve(root, 'docs/apifox-full.openapi.json'), out: resolve(root, 'apps/web/src/shared/api/openapi.d.ts') }
}

export const OUT = pathsFor().out

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

/** The generated file's content (from the doc of `root`, default: this repository) */
export async function generate(root = REPO_ROOT) {
  const doc = JSON.parse(readFileSync(pathsFor(root).doc, 'utf8'))
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
  const { values } = parseArgs({ options: { check: { type: 'boolean', default: false }, root: { type: 'string' } } })
  const root = values.root === undefined ? REPO_ROOT : resolve(values.root)
  const { out } = pathsFor(root)
  const content = await generate(root)
  if (values.check) {
    const current = (() => {
      try {
        return readFileSync(out, 'utf8')
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
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, content)
    console.log(`✅ Wrote ${relative(root, out)}`)
  }
}
