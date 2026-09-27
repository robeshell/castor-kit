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
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

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

/** An integer option value */
function parseIntArg(option: string, raw: string): number {
  if (!/^\s*-?\d+\s*$/.test(raw)) throw new ArgumentError(`--${option} must be an integer: '${raw}'`)
  return Number(raw.trim())
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
    return raw === undefined ? null : parseIntArg(key, raw)
  }
  const choice = (key: string): string => {
    const raw = str(key) ?? 'OVERWRITE_EXISTING'
    if (!(OVERWRITE_BEHAVIORS as readonly string[]).includes(raw)) {
      throw new ArgumentError(
        `--${key} must be one of ${OVERWRITE_BEHAVIORS.join(', ')}: '${raw}'`,
      )
    }
    return raw
  }

  return {
    projectId: str('project-id') ?? env.APIFOX_PROJECT_ID,
    accessToken: str('access-token') ?? env.APIFOX_ACCESS_TOKEN,
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
    timeout: str('timeout') === undefined ? 120 : parseIntArg('timeout', str('timeout')!),
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

export interface ImportRequest {
  url: string
  headers: Record<string, string>
  body: string
}

export function buildImportRequest(args: ImportArgs, input: string | Record<string, unknown>, baseUrl = API_BASE_URL): ImportRequest {
  const url = `${baseUrl}/v1/projects/${args.projectId}/import-openapi?${new URLSearchParams({ locale: args.locale })}`
  return {
    url,
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'X-Apifox-Api-Version': args.apiVersion,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input, options: buildOptions(args) }),
  }
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

const isRecord = (value: unknown): value is Record<string, Json> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** A response value as printed text */
function textOf(value: Json | undefined): string {
  if (value === undefined || value === null) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
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
  const usage = `usage: ${PROG} [--project-id PROJECT_ID] [--access-token ACCESS_TOKEN] ...`

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
  let body: Json
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
      body = JSON.parse(text) as Json
    } catch {
      body = { raw: text }
    }
  } catch (e) {
    err(`Request failed: ${e instanceof Error ? e.message : String(e)}`)
    return 1
  }

  if (statusCode >= 400) {
    err(`Import failed. HTTP ${statusCode}`)
    err(JSON.stringify(body, null, 2))
    return 1
  }

  out('Import request accepted.')
  out(JSON.stringify(body, null, 2))

  const data = isRecord(body) && isRecord(body.data) ? body.data : {}
  const counters = isRecord(data.counters) ? data.counters : {}
  const errors = Array.isArray(data.errors) ? data.errors : []

  if (Object.keys(counters).length === 0) {
    out('No counters returned.')
  } else {
    out('Import counters:')
    for (const key of COUNTER_KEYS) {
      if (Object.hasOwn(counters, key)) out(`  - ${key}: ${textOf(counters[key])}`)
    }
  }

  if (errors.length > 0) {
    err('Import returned errors:')
    for (const item of errors) {
      const message = isRecord(item) ? textOf(item.message) : textOf(item)
      const code = isRecord(item) ? textOf(item.code) : ''
      err(`  - code=${code} message=${message}`)
    }
    return 2
  }

  const failedCount = ['endpointFailed', 'schemaFailed', 'endpointFolderFailed', 'schemaFolderFailed'].reduce(
    (sum, key) => sum + (Number(counters[key] ?? 0) || 0),
    0,
  )
  return failedCount > 0 ? 2 : 0
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
