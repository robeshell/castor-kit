/**
 * AI Text-to-SQL routes
 *
 * User SQL always runs on a separate read-only pool (db/readonly.ts); the pool is created lazily
 * and released on app shutdown. All 500s here are returned by the route with a specific message, bypassing the global generic 500 message.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { ReadonlyDb } from '@/db/readonly'
import { AiSqlRepository } from './repository'
import { routeBody } from '@/common/validation'
import { executeBody, generateBody, isSafeSql } from './schema'
import { AiSqlService, LlmConfigError } from './service'

const PERMISSION = 'cc_ai_sql'

export async function registerAiSqlRoutes(app: FastifyInstance): Promise<void> {
  let readonlyDb: ReadonlyDb | undefined
  const getReadonlyDb = () => {
    readonlyDb ??= new ReadonlyDb(app.config.aiSqlDatabaseUrl, app.config.aiSqlStatementTimeoutMs)
    return readonlyDb
  }
  const service = new AiSqlService(new AiSqlRepository(getReadonlyDb), app.config, async () => (await app.settings.get()).ai, {
    allowPrivate: app.config.settingsAllowPrivateNetwork || app.settings.isPinned('ai.api_base'),
  })
  app.addHook('onClose', async () => {
    await service.close()
    if (readonlyDb) await readonlyDb.close()
  })

  const opts = { preHandler: loginRequired }
  const forbidden = async (request: FastifyRequest) => !(await hasMenuPermission(request, PERMISSION))

  /** Get the DB table structure (for frontend display; sensitive tables are not exposed) */
  app.get('/api/admin/component-center/ai/sql/schema', opts, async (request, reply) => {
    if (await forbidden(request)) return reply.status(403).send({ error: '无权限' })
    try {
      const tables = await service.visibleTables()
      const schemaText = await service.getDbSchema()
      return { tables, schema: schemaText }
    } catch (err) {
      request.log.warn({ err }, 'ai_sql schema failed')
      return reply.status(500).send({ error: '获取数据库结构失败' })
    }
  })

  /** Natural language → SQL → execute → return results */
  const generateInput = routeBody(generateBody, 'create')
  app.post('/api/admin/component-center/ai/sql/generate', { ...opts, ...generateInput.route }, async (request, reply) => {
    if (await forbidden(request)) return reply.status(403).send({ error: '无权限' })

    const { question } = generateInput.parse(request)

    let sql: string
    try {
      const schemaText = await service.getDbSchema()
      sql = await service.callLlm(question, schemaText)
    } catch (err) {
      request.log.warn({ err }, 'ai_sql generate failed')
      if (err instanceof LlmConfigError) {
        // Show the model API's status so quota (429), auth (401/403) and model-name (404) problems are told apart
        const status = err.upstreamStatus
        if (status === 429) return reply.status(500).send({ error: 'AI 生成失败：模型服务的调用次数已达上限（429），请稍后再试' })
        if (status) return reply.status(500).send({ error: `AI 生成失败（模型服务返回 ${status}），请检查模型配置后重试` })
        return reply.status(500).send({ error: 'AI 生成失败，请检查模型配置后重试' })
      }
      return reply.status(500).send({ error: 'AI 生成失败' })
    }

    const [safe, reason] = isSafeSql(sql)
    if (!safe) return reply.status(400).send({ error: reason, sql })

    try {
      const result = await service.executeSql(sql)
      return { sql, ...result }
    } catch (err) {
      request.log.warn({ err }, 'ai_sql execute failed')
      return reply.status(400).send({ error: 'SQL 执行错误，请检查语法或表权限', sql })
    }
  })

  /** Execute SQL manually edited by the user */
  const executeInput = routeBody(executeBody, 'create')
  app.post('/api/admin/component-center/ai/sql/execute', { ...opts, ...executeInput.route }, async (request, reply) => {
    if (await forbidden(request)) return reply.status(403).send({ error: '无权限' })

    const { sql } = executeInput.parse(request)

    const [safe, reason] = isSafeSql(sql)
    if (!safe) return reply.status(400).send({ error: reason })

    try {
      const result = await service.executeSql(sql)
      return { sql, ...result }
    } catch (err) {
      request.log.warn({ err }, 'ai_sql execute failed')
      return reply.status(400).send({ error: 'SQL 执行错误，请检查语法或表权限', sql })
    }
  })
}
