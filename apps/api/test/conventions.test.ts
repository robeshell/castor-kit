/**
 * Guards for two conventions that are easy to lose when a route or service is copied from an old one
 * (AGENTS.md「API 路由规范」):
 *
 * 1. Routes check permissions before loading a record: loading first answers 404 vs 403, which tells a caller without
 *    permission which ids exist. Reading the caller's own context first (the signed-in user, their data scope) is fine.
 * 2. No hand-written `new ServiceError(…, 500)`: input problems are 4xx, and real server failures go through
 *    internalError() / writeError() (common/errors.ts, common/db-errors.ts), so every 500 is recognisably one.
 * 3. No emulation of the old Python backend: request bodies are declared with common/validation.ts, not coerced by the
 *    Python-semantics helpers (common/py*.ts, sqla-bind.ts, scheduler/py-*.ts, ai-sql/pg-values.ts), and code doesn't
 *    describe itself in Python terms. The files not yet migrated are listed below; the lists only shrink.
 *
 * The first two run over the repository's modules, the backend template and what `pnpm scaffold` generates.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildSpec, genModuleSchema, genRoutes, genService } from '../scripts/scaffold'

const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = resolve(API_DIR, '..', '..')
const SRC = join(API_DIR, 'src')

/** Awaited calls that read the caller's own context, not the requested record */
const CALLER_CONTEXT = new Set(['getCurrentAdminUser', 'resolveDataScope', 'currentActor', 'callerOf', 'actorOf'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (name.endsWith('.ts')) out.push(path)
  }
  return out
}

/** Route handlers whose first permission check comes after an awaited lookup: "METHOD path ← lookup" */
export function lookupsBeforePermission(source: string): string[] {
  const starts = [...source.matchAll(/\n\s*app\.(get|post|put|patch|delete)\(/g)].map((m) => m.index!)
  const found: string[] = []
  starts.forEach((start, i) => {
    const block = source.slice(start, starts[i + 1] ?? source.length)
    const permission = /has(?:Any)?MenuPermission\(/.exec(block)
    if (!permission) return
    for (const call of block.slice(0, permission.index).matchAll(/await\s+(?:[\w.]+\.)?(\w+)\(/g)) {
      if (CALLER_CONTEXT.has(call[1]!)) continue
      const route = /app\.(\w+)\(([^,]+),/.exec(block)
      found.push(`${route?.[1]?.toUpperCase()} ${route?.[2]?.trim()} ← ${call[1]}()`)
      return
    }
  })
  return found
}

/** `new ServiceError(…, 500)` written by hand (arguments may span lines and contain one level of parentheses) */
export function handWritten500s(source: string): string[] {
  return [...source.matchAll(/new ServiceError\((?:[^()]|\([^()]*\))*?,\s*500\s*,?\s*\)/g)].map((m) => m[0].replace(/\s+/g, ' ').slice(0, 120))
}

/** Imports of the Python-semantics helpers */
const PY_COMPAT_IMPORT = /from '(@\/common\/(py|py-values|py-date|sqla-bind|scheduler\/py-compat|scheduler\/py-json)|\.\/(py-compat|py-json|pg-values|py|py-values|py-date|sqla-bind))'/

/** Files still importing them, until their module is migrated (remove a file here once it no longer does) */
const PY_COMPAT_PENDING = [
  'src/common/py-date.ts',
  'src/common/py-values.ts',
  'src/common/scheduler/cron.ts',
  'src/common/scheduler/ssrf.ts',
  'src/db/schema/component-center/list-page.ts',
  'src/modules/admin/announcement/schema.ts',
  'src/modules/admin/announcement/service.ts',
  'src/modules/admin/auth/schema.ts',
  'src/modules/admin/logs/routes.ts',
  'src/modules/admin/logs/service.ts',
  'src/modules/admin/menu/routes.ts',
  'src/modules/admin/menu/schema.ts',
  'src/modules/admin/menu/service.ts',
  'src/modules/admin/notification/schema.ts',
  'src/modules/admin/notification/service.ts',
  'src/modules/admin/roles/routes.ts',
  'src/modules/admin/roles/service.ts',
  'src/modules/admin/scheduled-task/routes.ts',
  'src/modules/admin/scheduled-task/schema.ts',
  'src/modules/admin/scheduled-task/service.ts',
  'src/modules/admin/users/service.ts',
  'src/modules/component-center/advanced-table/routes.ts',
  'src/modules/component-center/advanced-table/schema.ts',
  'src/modules/component-center/advanced-table/service.ts',
  'src/modules/component-center/ai-prompt/schema.ts',
  'src/modules/component-center/ai-prompt/service.ts',
  'src/modules/component-center/ai-sql/routes.ts',
  'src/modules/component-center/ai-sql/service.ts',
  'src/modules/component-center/card-list-page/schema.ts',
  'src/modules/component-center/card-list-page/service.ts',
  'src/modules/component-center/detail-tabs/schema.ts',
  'src/modules/component-center/detail-tabs/service.ts',
  'src/modules/component-center/devtools/routes.ts',
  'src/modules/component-center/dynamic-form-page/schema.ts',
  'src/modules/component-center/dynamic-form-page/service.ts',
  'src/modules/component-center/gantt/schema.ts',
  'src/modules/component-center/gantt/service.ts',
  'src/modules/component-center/kanban/routes.ts',
  'src/modules/component-center/kanban/schema.ts',
  'src/modules/component-center/kanban/service.ts',
  'src/modules/component-center/list-page/schema.ts',
  'src/modules/component-center/list-page/service.ts',
  'src/modules/component-center/stats-list-page/schema.ts',
  'src/modules/component-center/stats-list-page/service.ts',
  'src/modules/component-center/tree-list-page/schema.ts',
  'src/modules/component-center/tree-list-page/service.ts',
]

/** Files still mentioning Python / Flask / SQLAlchemy */
const PY_MENTION_PENDING = [
  'src/common/py-date.ts',
  'src/common/py-values.ts',
  'src/common/py.ts',
  'src/common/request-meta.ts',
  'src/common/scheduler/http.ts',
  'src/common/scheduler/py-compat.ts',
  'src/common/scheduler/py-json.ts',
  'src/common/scheduler/ssrf.ts',
  'src/common/sqla-bind.ts',
  'src/modules/component-center/advanced-table/schema.ts',
  'src/modules/component-center/ai-sql/pg-values.ts',
  'src/modules/component-center/list-page/schema.ts',
  'src/modules/component-center/stats-list-page/schema.ts',
]

const specs = [buildSpec('ck_guard', 'admin', [['name', 'str']]), buildSpec('ck_guard', 'admin', [['name', 'str']], { dataScope: true })]

describe('conventions', () => {
  it('routes check permissions before loading the record (403 before 404)', () => {
    const problems: string[] = []
    for (const file of walk(join(SRC, 'modules')).filter((f) => f.endsWith('routes.ts'))) {
      for (const hit of lookupsBeforePermission(readFileSync(file, 'utf8'))) problems.push(`${relative(API_DIR, file)}: ${hit}`)
    }
    for (const hit of lookupsBeforePermission(readFileSync(join(REPO, 'docs/templates/backend/routes.ts'), 'utf8'))) {
      problems.push(`docs/templates/backend/routes.ts: ${hit}`)
    }
    for (const s of specs) for (const hit of lookupsBeforePermission(genRoutes(s))) problems.push(`scaffold genRoutes: ${hit}`)
    expect(problems, 'move the permission check above the lookup (AGENTS.md「API 路由规范」)').toEqual([])
  })

  it('no hand-written ServiceError 500: use internalError() / writeError()', () => {
    const problems: string[] = []
    for (const file of walk(SRC).filter((f) => !f.endsWith('common/errors.ts'))) {
      for (const hit of handWritten500s(readFileSync(file, 'utf8'))) problems.push(`${relative(API_DIR, file)}: ${hit}`)
    }
    for (const hit of handWritten500s(readFileSync(join(REPO, 'docs/templates/backend/service.ts'), 'utf8'))) {
      problems.push(`docs/templates/backend/service.ts: ${hit}`)
    }
    for (const s of specs) for (const hit of handWritten500s(genService(s))) problems.push(`scaffold genService: ${hit}`)
    expect(problems, 'input problems are 4xx; server failures use internalError() / writeError()').toEqual([])
  })

  it('no Python emulation: helper imports and Python / Flask / SQLAlchemy mentions only in files not yet migrated', () => {
    const files = walk(SRC).map((f) => ({ path: relative(API_DIR, f), source: readFileSync(f, 'utf8') }))
    expect(files.filter((f) => PY_COMPAT_IMPORT.test(f.source)).map((f) => f.path).sort(), 'declare the body with common/validation.ts').toEqual(
      PY_COMPAT_PENDING,
    )
    expect(files.filter((f) => /python|flask|sqlalchemy/i.test(f.source)).map((f) => f.path).sort()).toEqual(PY_MENTION_PENDING)
    const outside: Array<[string, string]> = [
      ['docs/templates/backend/schema.ts', readFileSync(join(REPO, 'docs/templates/backend/schema.ts'), 'utf8')],
      ['docs/templates/backend/service.ts', readFileSync(join(REPO, 'docs/templates/backend/service.ts'), 'utf8')],
      ...specs.flatMap((s): Array<[string, string]> => [
        ['scaffold genModuleSchema', genModuleSchema(s)],
        ['scaffold genService', genService(s)],
        ['scaffold genRoutes', genRoutes(s)],
      ]),
    ]
    expect(outside.filter(([, source]) => PY_COMPAT_IMPORT.test(source) || /python/i.test(source)).map(([name]) => name)).toEqual([])
  })

  it('the checks themselves catch what they are for', () => {
    const route = (body: string) => `\n  app.put(itemPath, opts, async (request, reply) => {\n${body}\n  })\n`
    const permission = "    if (!(await hasMenuPermission(request, 'x_edit'))) {\n      return reply.status(403).send({ error: '无权限' })\n    }"
    expect(lookupsBeforePermission(route(`    const item = await service.getOr404(1)\n${permission}`))).toEqual(['PUT itemPath ← getOr404()'])
    expect(lookupsBeforePermission(route(`${permission}\n    const item = await service.getOr404(1)`))).toEqual([])
    expect(lookupsBeforePermission(route(`    const user = await getCurrentAdminUser(request)\n${permission}`))).toEqual([])
    expect(handWritten500s("throw new ServiceError('失败', 500)")).toHaveLength(1)
    expect(handWritten500s('throw new ServiceError(\n  err instanceof Error ? err.message : String(err),\n  500,\n)')).toHaveLength(1)
    expect(handWritten500s("throw new ServiceError('无权限', 403)")).toEqual([])
  })
})
