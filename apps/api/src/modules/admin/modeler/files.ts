/**
 * Visual modeler: where jobs and generated modules are recorded (development only).
 *
 * Everything lives in apps/api/.modeler/ (git-ignored, never imported, so writing there doesn't restart the dev server):
 *   jobs/<id>/spec.json   the module spec (generate) or { name } (undo)
 *   jobs/<id>/state.json  JobState, rewritten as the runner moves through the steps
 *   jobs/<id>/log.txt     the runner's output (scaffold, migrate, seed, openapi, verify)
 *   modules.json          GeneratedModule[]: what the modeler generated, so it can be undone
 *   lock                  { jobId, pid } while a runner is active (one job at a time)
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** apps/api */
export const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
export const REPO_ROOT = resolve(API_DIR, '..', '..')
/** apps/api/.modeler (MODELER_DIR overrides it, for tests) */
export const modelerDir = () => (process.env.MODELER_DIR ? resolve(process.env.MODELER_DIR) : join(API_DIR, '.modeler'))

export type JobKind = 'generate' | 'undo'
export type JobStatus = 'running' | 'success' | 'failed'
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export interface JobStep {
  key: string
  label: string
  status: StepStatus
}

export interface JobState {
  id: string
  kind: JobKind
  /** Module name (snake_case) */
  module: string
  title: string
  status: JobStatus
  steps: JobStep[]
  /** Why the job failed (Chinese, for the page) */
  error: string | null
  /** The failed generate was undone again */
  rolledBack: boolean
  created_at: string
  finished_at: string | null
}

export interface GeneratedModule {
  name: string
  title: string
  domain: 'admin' | 'component_center'
  table: string
  permPrefix: string
  pascal: string
  /** Backend directory name (kebab-case) */
  kebab: string
  domainDir: string
  apiBase: string
  /** Menu path of the page */
  path: string
  /** Files the generation created (repo-relative) */
  files: string[]
  /** The migration it added: journal tag and timestamp (the key in drizzle.__drizzle_migrations) */
  migration: { tag: string; when: number } | null
  jobId: string
  created_at: string
}

export const jobDir = (id: string) => join(modelerDir(), 'jobs', id)
const statePath = (id: string) => join(jobDir(id), 'state.json')
export const logPath = (id: string) => join(jobDir(id), 'log.txt')
export const specPath = (id: string) => join(jobDir(id), 'spec.json')
const modulesPath = () => join(modelerDir(), 'modules.json')
const lockPath = () => join(modelerDir(), 'lock')

/** Write JSON atomically (the API reads these files while the runner writes them) */
function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(tmp, path)
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return null
  }
}

export const readState = (id: string) => readJson<JobState>(statePath(id))
export const writeState = (state: JobState) => writeJson(statePath(state.id), state)

export function listJobs(): JobState[] {
  let ids: string[] = []
  try {
    ids = readdirSync(join(modelerDir(), 'jobs'))
  } catch {
    return []
  }
  return ids
    .map((id) => readState(id))
    .filter((s): s is JobState => s !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export const readModules = () => readJson<GeneratedModule[]>(modulesPath()) ?? []
export const writeModules = (modules: GeneratedModule[]) => writeJson(modulesPath(), modules)

/** Log text from byte `offset` on (at most 64 KB per read) */
export function readLog(id: string, offset: number): { text: string; offset: number } {
  let buffer: Buffer
  try {
    buffer = readFileSync(logPath(id))
  } catch {
    return { text: '', offset }
  }
  const start = Math.max(0, Math.min(offset, buffer.length))
  const end = Math.min(buffer.length, start + 64 * 1024)
  return { text: buffer.subarray(start, end).toString('utf8'), offset: end }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** The running job, if any (a lock left by a runner that died doesn't count) */
export function activeJobId(): string | null {
  const lock = readJson<{ jobId: string; pid: number }>(lockPath())
  if (!lock) return null
  if (lock.pid && !alive(lock.pid)) {
    rmSync(lockPath(), { force: true })
    return null
  }
  return lock.jobId
}

export function writeLock(jobId: string, pid: number): void {
  writeJson(lockPath(), { jobId, pid })
}

export function releaseLock(jobId: string): void {
  const lock = readJson<{ jobId: string }>(lockPath())
  if (lock?.jobId === jobId) rmSync(lockPath(), { force: true })
}

export function newJobId(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `${stamp}-${Math.random().toString(36).slice(2, 6)}`
}

export function ensureModelerDir(): void {
  mkdirSync(join(modelerDir(), 'jobs'), { recursive: true })
  if (!existsSync(join(modelerDir(), '.gitignore'))) writeFileSync(join(modelerDir(), '.gitignore'), '*\n', 'utf8')
}
