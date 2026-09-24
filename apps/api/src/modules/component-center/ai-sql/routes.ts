/**
 * AI Text-to-SQL 路由（对齐 AuraStack backend/app/component_center/api/ai_sql.py）
 *
 * 用户 SQL 一律在独立只读连接池（db/readonly.ts）上执行；连接池懒加载（对齐 get_ai_sql_engine），
 * 应用关闭时释放。这里的 500 都是 Flask 路由里直接 jsonify 的具体文案，不走全局通用 500 文案。
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { jsonBody } from '@/common/http'
import { pyTruthy } from '@/common/py'
import { ReadonlyDb } from '@/db/readonly'
import { AiSqlRepository } from './repository'
import { isSafeSql, pyStrip } from './schema'
import { AiSqlService, LlmConfigError } from './service'

const PERMISSION = 'cc_ai_sql'

/** Python `(data.get(key) or '').strip()`：非字符串的真值会触发 AttributeError → 500 */
function strippedField(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  if (!pyTruthy(value)) return ''
  if (typeof value !== 'string') throw new TypeError(`'${typeof value}' object has no attribute 'strip'`)
  return pyStrip(value)
}

export async function registerAiSqlRoutes(app: FastifyInstance): Promise<void> {
  let readonlyDb: ReadonlyDb | undefined
  const getReadonlyDb = () => {
    readonlyDb ??= new ReadonlyDb(app.config.aiSqlDatabaseUrl, app.config.aiSqlStatementTimeoutMs)
    return readonlyDb
  }
  const service = new AiSqlService(new AiSqlRepository(getReadonlyDb), app.config)
  app.addHook('onClose', async () => {
    await service.close()
    if (readonlyDb) await readonlyDb.close()
  })

  const opts = { preHandler: loginRequired }
  const forbidden = async (request: FastifyRequest) => !(await hasMenuPermission(request, PERMISSION))

  /** 获取数据库表结构（供前端展示，敏感表不暴露） */
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

  /** 自然语言 → SQL → 执行 → 返回结果 */
  app.post('/api/admin/component-center/ai/sql/generate', opts, async (request, reply) => {
    if (await forbidden(request)) return reply.status(403).send({ error: '无权限' })

    const question = strippedField(jsonBody(request), 'question')
    if (!question) return reply.status(400).send({ error: '问题不能为空' })

    let sql: string
    try {
      const schemaText = await service.getDbSchema()
      sql = await service.callLlm(question, schemaText)
    } catch (err) {
      request.log.warn({ err }, 'ai_sql generate failed')
      if (err instanceof LlmConfigError) {
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

  /** 执行用户手动修改后的 SQL */
  app.post('/api/admin/component-center/ai/sql/execute', opts, async (request, reply) => {
    if (await forbidden(request)) return reply.status(403).send({ error: '无权限' })

    const sql = strippedField(jsonBody(request), 'sql')
    if (!sql) return reply.status(400).send({ error: 'SQL 不能为空' })

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
