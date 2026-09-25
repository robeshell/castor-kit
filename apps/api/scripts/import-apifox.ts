/**
 * Import OpenAPI/Swagger via the Apifox open API
 *
 * By default, matched endpoints/schemas "overwrite existing".
 *
 * Usage:
 *   pnpm openapi:apifox -- [--project-id ID] [--access-token TOKEN] [--spec-file PATH | --input-url URL] ...
 * Environment variables: APIFOX_PROJECT_ID / APIFOX_ACCESS_TOKEN / APIFOX_API_VERSION (default 2024-03-28)
 *
 * Exit codes: 2 for argument errors; 1 for input/request failures or HTTP >= 400; 2 when errors or any *Failed count > 0 is returned; 0 on success.
 * The request body is encoded like Python requests' `json=` (ensure_ascii + ', '/': ' separators).
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { pyStr } from '../src/common/py'
import { dumpIndented, dumpPythonDefault, parseOrderedJson, toOrdered, type OrderedJson } from './lib/ordered-json'

export const API_BASE_URL = 'https://api.apifox.com'
export const DEFAULT_API_VERSION = '2024-03-28'
export const OVERWRITE_BEHAVIORS = ['OVERWRITE_EXISTING', 'AUTO_MERGE', 'KEEP_EXISTING', 'CREATE_NEW'] as const
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const PROG = 'import-apifox'

export interface ImportArgs {
  projectId: string | undefined
  accessToken: string | undefined
  apiVersion: string
  locale: string
  specFile: string
  inputUrl: string | null
  inputBasicAuthUsername: string | null
  inputBasicAuthPassword: string | null
  targetEndpointFolderId: number | null
  targetSchemaFolderId: number | null
  targetBranchId: number | null
  moduleId: number | null
  endpointOverwriteBehavior: string
  schemaOverwriteBehavior: string
  updateFolderOfChangedEndpoint: boolean
  prependBasePath: boolean
  deleteUnmatchedResources: boolean
  timeout: number
}

/** Argument error: print usage and the error, then exit with 2 */
export class ArgumentError extends Error {}

/** Python int(): allows leading/trailing whitespace, a sign, and underscores between digits */
function parsePyInt(option: string, raw: string): number {
  if (!/^\s*[+-]?\d+(?:_\d+)*\s*$/.test(raw)) {
    throw new ArgumentError(`argument --${option}: invalid int value: '${raw}'`)
  }
  return Number(raw.trim().replace(/_/g, ''))
}

export function parseImportArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): ImportArgs {
  let values: Record<string, string | boolean | undefined>
  try {
    values = parseArgs({
      args: argv.filter((arg) => arg !== '--'),
      options: {
        'project-id': { type: 'string' },
        'access-token': { type: 'string' },
        'api-version': { type: 'string' },
        locale: { type: 'string' },
        'spec-file': { type: 'string' },
        'input-url': { type: 'string' },
        'input-basic-auth-username': { type: 'string' },
        'input-basic-auth-password': { type: 'string' },
        'target-endpoint-folder-id': { type: 'string' },
        'target-schema-folder-id': { type: 'string' },
        'target-branch-id': { type: 'string' },
        'module-id': { type: 'string' },
        'endpoint-overwrite-behavior': { type: 'string' },
        'schema-overwrite-behavior': { type: 'string' },
        'update-folder-of-changed-endpoint': { type: 'boolean' },
        'prepend-base-path': { type: 'boolean' },
        'delete-unmatched-resources': { type: 'boolean' },
        timeout: { type: 'string' },
      },
    }).values
  } catch (err) {
    throw new ArgumentError(err instanceof Error ? err.message : String(err))
  }

  const str = (key: string): string | undefined => values[key] as string | undefined
  const optInt = (key: string): number | null => {
    const raw = str(key)
    return raw === undefined ? null : parsePyInt(key, raw)
  }
  const choice = (key: string): string => {
    const raw = str(key) ?? 'OVERWRITE_EXISTING'
    if (!(OVERWRITE_BEHAVIORS as readonly string[]).includes(raw)) {
      throw new ArgumentError(
        `argument --${key}: invalid choice: '${raw}' (choose from ${OVERWRITE_BEHAVIORS.join(', ')})`,
      )
    }
    return raw
  }

  return {
    projectId: str('project-id') ?? env.APIFOX_PROJECT_ID,
    accessToken: str('access-token') ?? env.APIFOX_ACCESS_TOKEN,
    // os.getenv('APIFOX_API_VERSION', DEFAULT): if the variable exists but is empty, the result is an empty string
    apiVersion: str('api-version') ?? env.APIFOX_API_VERSION ?? DEFAULT_API_VERSION,
    locale: str('locale') ?? 'zh-CN',
    specFile: str('spec-file') ?? resolve(REPO_ROOT, 'docs/apifox-full.openapi.json'),
    inputUrl: str('input-url') ?? null,
    inputBasicAuthUsername: str('input-basic-auth-username') ?? null,
    inputBasicAuthPassword: str('input-basic-auth-password') ?? null,
    targetEndpointFolderId: optInt('target-endpoint-folder-id'),
    targetSchemaFolderId: optInt('target-schema-folder-id'),
    targetBranchId: optInt('target-branch-id'),
    moduleId: optInt('module-id'),
    endpointOverwriteBehavior: choice('endpoint-overwrite-behavior'),
    schemaOverwriteBehavior: choice('schema-overwrite-behavior'),
    updateFolderOfChangedEndpoint: Boolean(values['update-folder-of-changed-endpoint']),
    prependBasePath: Boolean(values['prepend-base-path']),
    deleteUnmatchedResources: Boolean(values['delete-unmatched-resources']),
    timeout: str('timeout') === undefined ? 120 : parsePyInt('timeout', str('timeout')!),
  }
}

export function buildInput(args: ImportArgs): string | Record<string, unknown> {
  if (args.inputUrl) {
    const input: Record<string, unknown> = { url: args.inputUrl }
    if (args.inputBasicAuthUsername || args.inputBasicAuthPassword) {
      if (!(args.inputBasicAuthUsername && args.inputBasicAuthPassword)) {
        throw new Error(
          'Both --input-basic-auth-username and --input-basic-auth-password are required together.',
        )
      }
      input.basicAuth = { username: args.inputBasicAuthUsername, password: args.inputBasicAuthPassword }
    }
    return input
  }
  if (!existsSync(args.specFile)) throw new Error(`OpenAPI file not found: ${args.specFile}`)
  return readFileSync(args.specFile, 'utf8')
}

export function buildOptions(args: ImportArgs): Record<string, unknown> {
  const options: Record<string, unknown> = {
    endpointOverwriteBehavior: args.endpointOverwriteBehavior,
    schemaOverwriteBehavior: args.schemaOverwriteBehavior,
    updateFolderOfChangedEndpoint: args.updateFolderOfChangedEndpoint,
    prependBasePath: args.prependBasePath,
    deleteUnmatchedResources: args.deleteUnmatchedResources,
  }
  const optional: Array<[string, number | null]> = [
    ['targetEndpointFolderId', args.targetEndpointFolderId],
    ['targetSchemaFolderId', args.targetSchemaFolderId],
    ['targetBranchId', args.targetBranchId],
    ['moduleId', args.moduleId],
  ]
  for (const [key, value] of optional) {
    if (value !== null) options[key] = value
  }
  return options
}

/** Python urllib.parse.quote_plus */
function quotePlus(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+')
}

export interface ImportRequest {
  url: string
  headers: Record<string, string>
  body: string
}

export function buildImportRequest(args: ImportArgs, input: string | Record<string, unknown>, baseUrl = API_BASE_URL): ImportRequest {
  const url = `${baseUrl}/v1/projects/${args.projectId}/import-openapi?locale=${quotePlus(args.locale)}`
  return {
    url,
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'X-Apifox-Api-Version': args.apiVersion,
      'Content-Type': 'application/json',
    },
    body: dumpPythonDefault(toOrdered({ input, options: buildOptions(args) })),
  }
}

function asMap(value: OrderedJson | undefined): Map<string, OrderedJson> | null {
  return value instanceof Map ? value : null
}

/** Convert an order-preserving JSON value to the result of Python str() (for printing counts / error messages) */
function pyStrOf(value: OrderedJson | undefined): string {
  if (value === undefined) return ''
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Map)) {
    return value.raw
  }
  return pyStr(JSON.parse(JSON.stringify(value, (_k, v: unknown) => (v instanceof Map ? Object.fromEntries(v) : v))))
}

/** OrderedJson number/string → Python int(x or 0); throws when it can't convert (exits with 1) */
function pyIntOf(value: OrderedJson | undefined): number {
  if (value === undefined || value === null || value === false || value === '') return 0
  if (value === true) return 1
  if (typeof value === 'string') return parsePyInt('counter', value)
  if (typeof value === 'object' && 'raw' in value) return Math.trunc(Number(value.raw))
  if (Array.isArray(value) && value.length === 0) return 0
  if (value instanceof Map && value.size === 0) return 0
  throw new TypeError(`int() argument must be a string or a number: ${pyStrOf(value)}`)
}

const COUNTER_KEYS = [
  'endpointCreated',
  'endpointUpdated',
  'endpointFailed',
  'endpointIgnored',
  'schemaCreated',
  'schemaUpdated',
  'schemaFailed',
  'schemaIgnored',
  'endpointFolderCreated',
  'endpointFolderUpdated',
  'endpointFolderFailed',
  'endpointFolderIgnored',
  'schemaFolderCreated',
  'schemaFolderUpdated',
  'schemaFolderFailed',
  'schemaFolderIgnored',
]

function isTruthyJson(value: OrderedJson | undefined): boolean {
  if (value === undefined || value === null || value === false || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  if (value instanceof Map) return value.size > 0
  if (typeof value === 'object') return Number(value.raw) !== 0
  return true
}

export interface RunImportOptions {
  env?: NodeJS.ProcessEnv
  /** Test only: override the Apifox base URL */
  baseUrl?: string
  out?: (line: string) => void
  err?: (line: string) => void
}

export async function runImport(argv: string[], options: RunImportOptions = {}): Promise<number> {
  const out = options.out ?? ((line: string) => process.stdout.write(`${line}\n`))
  const err = options.err ?? ((line: string) => process.stderr.write(`${line}\n`))
  const usage = `usage: ${PROG} [-h] [--project-id PROJECT_ID] [--access-token ACCESS_TOKEN] ...`

  let args: ImportArgs
  try {
    args = parseImportArgs(argv, options.env ?? process.env)
    if (!args.projectId) throw new ArgumentError('Missing --project-id (or APIFOX_PROJECT_ID env var).')
    if (!args.accessToken) throw new ArgumentError('Missing --access-token (or APIFOX_ACCESS_TOKEN env var).')
  } catch (e) {
    if (!(e instanceof ArgumentError)) throw e
    err(usage)
    err(`${PROG}: error: ${e.message}`)
    return 2
  }

  let input: string | Record<string, unknown>
  try {
    input = buildInput(args)
  } catch (e) {
    err(`Input build failed: ${e instanceof Error ? e.message : String(e)}`)
    return 1
  }

  const request = buildImportRequest(args, input, options.baseUrl)
  let statusCode: number
  let body: OrderedJson
  try {
    const resp = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(args.timeout * 1000),
    })
    statusCode = resp.status
    const text = await resp.text()
    try {
      body = parseOrderedJson(text)
    } catch {
      body = new Map([['raw', text]])
    }
  } catch (e) {
    err(`Request failed: ${e instanceof Error ? e.message : String(e)}`)
    return 1
  }

  if (statusCode >= 400) {
    err(`Import failed. HTTP ${statusCode}`)
    err(dumpIndented(body))
    return 1
  }

  out('Import request accepted.')
  out(dumpIndented(body))

  const bodyMap = asMap(body)
  const data = bodyMap ? (bodyMap.has('data') ? bodyMap.get('data') : new Map()) : new Map()
  const dataMap = asMap(data)
  const counters = dataMap ? dataMap.get('counters') : undefined
  const errors = dataMap ? dataMap.get('errors') : undefined

  if (!isTruthyJson(counters)) {
    out('No counters returned.')
  } else {
    out('Import counters:')
    const counterMap = asMap(counters)
    if (counterMap) {
      for (const key of COUNTER_KEYS) {
        if (counterMap.has(key)) out(`  - ${key}: ${pyStrOf(counterMap.get(key))}`)
      }
    }
  }

  if (Array.isArray(errors) && errors.length > 0) {
    err('Import returned errors:')
    for (const item of errors) {
      const itemMap = asMap(item)
      const message = itemMap ? (itemMap.has('message') ? pyStrOf(itemMap.get('message')) : '') : pyStrOf(item)
      const code = itemMap ? (itemMap.has('code') ? pyStrOf(itemMap.get('code')) : '') : ''
      err(`  - code=${code} message=${message}`)
    }
    return 2
  }

  let failedCount = 0
  const counterMap = asMap(counters)
  if (counterMap) {
    for (const key of ['endpointFailed', 'schemaFailed', 'endpointFolderFailed', 'schemaFolderFailed']) {
      failedCount += pyIntOf(counterMap.get(key))
    }
  }
  if (failedCount > 0) return 2
  return 0
}

const isMain = /[\\/]import-apifox\.(?:ts|js|mjs)$/.test(process.argv[1] ?? '')
if (isMain) {
  runImport(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e: unknown) => {
      console.error(e)
      process.exit(1)
    })
}
