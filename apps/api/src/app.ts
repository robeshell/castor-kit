/**
 * buildApp()：注册插件 / 路由 / 错误处理 / 静态资源
 *
 * 插件顺序有依赖：cookie → secure-session → CSRF（要读 session）→ 路由 → 404/405/SPA。
 */

import { hkdfSync } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import compress from '@fastify/compress'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import secureSession from '@fastify/secure-session'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { registerCsrfProtection, requestPath } from './common/csrf'
import { INTERNAL_ERROR_MESSAGE, registerErrorHandler } from './common/errors'
import { utcNowIso } from './common/serialize'
import type { AppConfig } from './config'
import { createDb, type DbHandle } from './db/client'
import { registerRoutes } from './router'

export const SESSION_COOKIE_NAME = 'castor_session'
const STATIC_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.otf']

/** secure-session 需要 32 字节密钥；SECRET_KEY 是任意长度字符串，用 HKDF 派生而不是截断 */
export function deriveSessionKey(secretKey: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secretKey, '', 'castor-kit-session', 32))
}

export interface BuildAppOptions {
  config: AppConfig
  logger?: FastifyServerOptions['logger']
  /** 测试可注入已有连接；默认按 config.databaseUrl 新建并在 onClose 时关闭 */
  dbHandle?: DbHandle
}

export async function buildApp({ config, logger = false, dbHandle }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger,
    // 只信任最近一跳反代（X-Forwarded-For / X-Forwarded-Proto），request.ip / protocol 即真实值
    trustProxy: (_address: string, hop: number) => hop < 1,
    bodyLimit: config.maxContentLength,
  })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const handle = dbHandle ?? createDb(config.databaseUrl)
  app.decorate('config', config)
  app.decorate('db', handle.db)
  if (!dbHandle) app.addHook('onClose', async () => handle.pool.end())
  app.decorateRequest('currentAdminUser', undefined)

  // ---- 会话 ----
  const ttlSeconds = config.sessionTtlHours * 3600
  await app.register(cookie)
  await app.register(secureSession, {
    key: deriveSessionKey(config.secretKey),
    cookieName: SESSION_COOKIE_NAME,
    expiry: ttlSeconds,
    cookie: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      // 默认 auto：TLS（含反代 X-Forwarded-Proto=https）才打 Secure，裸 HTTP 部署不被 Secure cookie 弄挂
      secure: config.sessionCookieSecure,
      maxAge: ttlSeconds,
    },
  })
  // 滑动过期：已登录会话每次请求都续期
  app.addHook('onRequest', async (request) => {
    if (request.session.get('logged_in')) request.session.touch()
  })

  registerCsrfProtection(app)

  await app.register(compress, { threshold: 500 })
  // 上传上限取 MAX_CONTENT_LENGTH（超限 413）；按字段取文件见 common/http.getUploadedFile
  await app.register(multipart, { limits: { fileSize: config.maxContentLength } })
  // /ws/devtools 用（component-center/devtools）；会话 cookie 在 upgrade 请求的 onRequest 阶段照常解析
  await app.register(websocket)
  if (config.corsOrigins.length > 0) {
    await app.register(cors, { origin: config.corsOrigins, credentials: true })
  }

  // 静态资源长缓存（按路径后缀加头，对所有路径生效）
  app.addHook('onSend', async (request, reply, payload) => {
    const path = requestPath(request)
    if (STATIC_EXTENSIONS.some((ext) => path.endsWith(ext))) {
      reply.header('Cache-Control', 'public, max-age=604800')
      reply.removeHeader('Expires')
      reply.removeHeader('Pragma')
    }
    return payload
  })

  registerErrorHandler(app)

  const spaIndex = join(config.webDistDir, 'index.html')
  const hasSpa = existsSync(spaIndex)
  // 始终注册（提供 reply.sendFile，上传文件回读等也要用）；没有前端产物时不挂静态路由
  await app.register(
    fastifyStatic,
    hasSpa ? { root: config.webDistDir, wildcard: true } : { root: config.instanceDir, serve: false },
  )

  // 404 / 405 语义：SPA catch-all 对任意路径都接受 GET，
  // 所以未命中的 GET/HEAD 是 404（/api）或 SPA（其他），而任何未命中的非 GET 方法都是 405 ——
  // 包括“路径存在但只注册了 POST 时的 GET”也是 404 而不是 405（保持既有接口行为）。
  app.setNotFoundHandler(async (request, reply) => {
    const isRead = request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS'
    if (!isRead) return reply.status(405).send({ error: '请求方法不允许' })
    if (requestPath(request).startsWith('/api/')) {
      return reply.status(404).send({ error: '资源不存在' })
    }
    if (hasSpa) return reply.sendFile('index.html')
    return { message: 'castor-kit API', status: 'running' }
  })

  // ---- 内置路由 ----
  app.get('/health', async (request, reply) => {
    try {
      await handle.pool.query('SELECT 1')
      return { status: 'healthy', timestamp: utcNowIso(), database: 'connected' }
    } catch (err) {
      request.log.error({ err }, '健康检查失败')
      return reply.status(500).send({
        status: 'unhealthy',
        error: err instanceof Error ? err.message : INTERNAL_ERROR_MESSAGE,
        timestamp: utcNowIso(),
      })
    }
  })

  await registerRoutes(app)
  return app
}
