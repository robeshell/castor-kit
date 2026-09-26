/**
 * buildApp(): registers plugins / routes / error handling / static assets
 *
 * Plugin order matters: cookie → secure-session → CSRF (reads the session) → routes → 404/405/SPA.
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
import { registerDemoGuard } from './common/demo'
import { INTERNAL_ERROR_MESSAGE, registerErrorHandler } from './common/errors'
import { registerResponseTranslation } from './common/i18n'
import { utcNowIso } from './common/serialize'
import type { AppConfig } from './config'
import { createDb, type DbHandle } from './db/client'
import { registerRoutes } from './router'

export const SESSION_COOKIE_NAME = 'castor_session'
const STATIC_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.otf']

/** secure-session needs a 32-byte key; SECRET_KEY is an arbitrary-length string, so derive it with HKDF instead of truncating */
export function deriveSessionKey(secretKey: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secretKey, '', 'castor-kit-session', 32))
}

export interface BuildAppOptions {
  config: AppConfig
  logger?: FastifyServerOptions['logger']
  /** Tests may inject an existing connection; by default one is created from config.databaseUrl and closed in onClose */
  dbHandle?: DbHandle
}

export async function buildApp({ config, logger = false, dbHandle }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger,
    // Trust only the nearest reverse-proxy hop (X-Forwarded-For / X-Forwarded-Proto) so request.ip / protocol are the real values
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
  app.decorateRequest('dataScope', undefined)

  // ---- Session ----
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
      // Default auto: set Secure only over TLS (incl. proxy X-Forwarded-Proto=https) so plain-HTTP deployments aren't broken by Secure cookies
      secure: config.sessionCookieSecure,
      maxAge: ttlSeconds,
    },
  })
  // Sliding expiration: logged-in sessions are renewed on every request
  app.addHook('onRequest', async (request) => {
    if (request.session.get('logged_in')) request.session.touch()
  })

  registerCsrfProtection(app)

  await app.register(compress, { threshold: 500 })
  // Upload limit is MAX_CONTENT_LENGTH (413 when exceeded); see common/http.getUploadedFile for per-field file access
  await app.register(multipart, { limits: { fileSize: config.maxContentLength } })
  // Used by /ws/devtools (component-center/devtools); the session cookie is parsed as usual in the upgrade request's onRequest phase
  await app.register(websocket)
  if (config.corsOrigins.length > 0) {
    await app.register(cors, { origin: config.corsOrigins, credentials: true })
  }

  // Long-lived caching for static assets (header set by path extension, applies to all paths)
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
  // Public demo: system management is read-only (no-op unless DEMO_MODE)
  registerDemoGuard(app, config)
  // Translate response messages for en-US / ja-JP requests (Accept-Language)
  registerResponseTranslation(app)

  const spaIndex = join(config.webDistDir, 'index.html')
  const hasSpa = existsSync(spaIndex)
  // Always registered (provides reply.sendFile, also used to serve uploaded files back); static routes are skipped when there is no frontend build
  await app.register(
    fastifyStatic,
    hasSpa ? { root: config.webDistDir, wildcard: true } : { root: config.instanceDir, serve: false },
  )

  // 404 / 405 semantics: the SPA catch-all accepts GET on any path,
  // so an unmatched GET/HEAD is 404 (/api) or the SPA (elsewhere), while any unmatched non-GET method is 405 —
  // and "GET on a path that only registers POST" is also 404 rather than 405 (keeps existing API behavior).
  app.setNotFoundHandler(async (request, reply) => {
    const isRead = request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS'
    if (!isRead) return reply.status(405).send({ error: '请求方法不允许' })
    if (requestPath(request).startsWith('/api/')) {
      return reply.status(404).send({ error: '资源不存在' })
    }
    if (hasSpa) return reply.sendFile('index.html')
    return { message: 'castor-kit API', status: 'running' }
  })

  // ---- Built-in routes ----
  // Public: lets the login page show the demo account and the layout show the demo banner
  app.get('/api/admin/app-info', async () =>
    config.demoMode
      ? {
          demo_mode: true,
          demo_reset_hours: config.demoResetHours,
          demo_account: { username: config.adminUsername, password: config.adminPassword },
        }
      : { demo_mode: false },
  )

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
