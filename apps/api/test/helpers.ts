import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify'
import { eq, inArray, like, or } from 'drizzle-orm'
import { buildApp, SESSION_COOKIE_NAME } from '../src/app'
import { generatePasswordHash } from '../src/common/password'
import { loadConfig, type AppConfig } from '../src/config'
import { createDb, type DbHandle } from '../src/db/client'
import { admin_users, login_logs, menus, operation_logs, role_menus, roles, user_roles } from '../src/db/schema'

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://wangwenyu@localhost/castor_kit_test'

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig({ NODE_ENV: 'test', TEST_DATABASE_URL, WEB_DIST_DIR: '/nonexistent-castor-kit-dist' }),
    ...overrides,
  }
}

export async function buildTestApp(overrides: Partial<AppConfig> = {}): Promise<FastifyInstance> {
  const app = await buildApp({ config: testConfig(overrides) })
  await app.ready()
  return app
}

/** Extracts the castor_session cookie value from a response, for later inject calls to carry */
export function sessionCookie(res: LightMyRequestResponse): string | undefined {
  return res.cookies.find((c) => c.name === SESSION_COOKIE_NAME)?.value
}

// ---- Fixtures: dedicated test user / role / menus, independent of seed data in the dev DB ----

export const FIXTURE_PREFIX = 'ck_test_'
export const FIXTURE_USER = `${FIXTURE_PREFIX}user`
export const FIXTURE_PASSWORD = 'fixture-pass-1'

export interface Fixture {
  userId: number
  roleId: number
  /** Root directory (not directly assigned to the role; pulled in by its child menus) */
  rootId: number
  /** Visible child menu assigned to the role */
  childId: number
  /** Button assigned to the role (not visible; must not appear in my-menus) */
  buttonId: number
  /** Assigned to the role but disabled */
  inactiveId: number
  assignedCodes: string[]
}

export async function cleanupFixture(handle: DbHandle): Promise<void> {
  const { db } = handle
  const users = await db.select({ id: admin_users.id }).from(admin_users).where(like(admin_users.username, `${FIXTURE_PREFIX}%`))
  const userIds = users.map((u) => u.id)
  await db
    .delete(login_logs)
    .where(or(like(login_logs.username, `${FIXTURE_PREFIX}%`), eq(login_logs.ip, '10.99.0.1')))
  if (userIds.length > 0) await db.delete(operation_logs).where(inArray(operation_logs.user_id, userIds))
  await db.delete(admin_users).where(like(admin_users.username, `${FIXTURE_PREFIX}%`))
  await db.delete(roles).where(like(roles.code, `${FIXTURE_PREFIX}%`))
  await db.delete(menus).where(like(menus.code, `${FIXTURE_PREFIX}%`))
}

export async function createFixture(handle: DbHandle): Promise<Fixture> {
  await cleanupFixture(handle)
  const { db } = handle
  const passwordHash = await generatePasswordHash(FIXTURE_PASSWORD, 1000)
  const [user] = await db.insert(admin_users).values({ username: FIXTURE_USER, password_hash: passwordHash }).returning()
  const [role] = await db
    .insert(roles)
    .values({ name: '测试角色', code: `${FIXTURE_PREFIX}role`, description: 'castor-kit 测试夹具' })
    .returning()
  const [root] = await db
    .insert(menus)
    .values({ name: '测试目录', code: `${FIXTURE_PREFIX}root`, path: '/ck-test', sort_order: 9990, menu_type: 'directory' })
    .returning()
  const [child] = await db
    .insert(menus)
    .values({ name: '测试页面', code: `${FIXTURE_PREFIX}page`, path: '/ck-test/page', component: 'admin/ck/test', parent_id: root!.id, sort_order: 1 })
    .returning()
  const [button] = await db
    .insert(menus)
    .values({ name: '测试按钮', code: `${FIXTURE_PREFIX}page_add`, parent_id: child!.id, sort_order: 1, is_visible: false, menu_type: 'button' })
    .returning()
  const [inactive] = await db
    .insert(menus)
    .values({ name: '停用页面', code: `${FIXTURE_PREFIX}inactive`, parent_id: root!.id, sort_order: 2, is_active: false })
    .returning()
  await db.insert(user_roles).values({ user_id: user!.id, role_id: role!.id })
  await db.insert(role_menus).values([child!, button!, inactive!].map((m) => ({ role_id: role!.id, menu_id: m.id })))
  return {
    userId: user!.id,
    roleId: role!.id,
    rootId: root!.id,
    childId: child!.id,
    buttonId: button!.id,
    inactiveId: inactive!.id,
    assignedCodes: [child!.code, button!.code, inactive!.code],
  }
}

export function openTestDb(): DbHandle {
  return createDb(TEST_DATABASE_URL, { max: 2 })
}

// ---- Logged-in session: super_admin test account (super_admin role is created automatically if missing from the DB) ----

export const SUPER_USER = `${FIXTURE_PREFIX}super`
export const SUPER_PASSWORD = 'super-pass-1'

export interface AuthedSession {
  cookie: string
  csrf: string
  userId: number
  /** inject with session cookie + CSRF header */
  inject: (opts: InjectOptions) => Promise<LightMyRequestResponse>
}


export async function ensureSuperAdmin(handle: DbHandle): Promise<number> {
  const { db } = handle
  let [role] = await db.select().from(roles).where(eq(roles.code, 'super_admin'))
  if (!role) {
    ;[role] = await db.insert(roles).values({ name: '超级管理员', code: 'super_admin', description: '测试创建' }).returning()
  }
  const [existing] = await db.select().from(admin_users).where(eq(admin_users.username, SUPER_USER))
  if (existing) await db.delete(admin_users).where(eq(admin_users.id, existing.id))
  const [user] = await db
    .insert(admin_users)
    .values({ username: SUPER_USER, password_hash: await generatePasswordHash(SUPER_PASSWORD, 1000) })
    .returning()
  await db.insert(user_roles).values({ user_id: user!.id, role_id: role!.id })
  return user!.id
}

export async function loginSession(
  app: FastifyInstance,
  username: string,
  password: string,
  userId = 0,
): Promise<AuthedSession> {
  const res = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { username, password } })
  if (res.statusCode !== 200) throw new Error(`登录失败 ${res.statusCode} ${res.body}`)
  const cookie = sessionCookie(res)!
  const csrf = res.json().csrf_token as string
  return {
    cookie,
    csrf,
    userId,
    inject: (opts) =>
      app.inject({
        ...opts,
        cookies: { castor_session: cookie, ...(opts.cookies ?? {}) },
        headers: { 'x-csrf-token': csrf, ...(opts.headers ?? {}) },
      } as InjectOptions),
  }
}

export async function superAdminSession(app: FastifyInstance, handle: DbHandle): Promise<AuthedSession> {
  const userId = await ensureSuperAdmin(handle)
  return loginSession(app, SUPER_USER, SUPER_PASSWORD, userId)
}

/** Builds a multipart/form-data request body (single file field) */
export function multipartFile(
  filename: string,
  content: Buffer | string,
  field = 'file',
  contentType = 'application/octet-stream',
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = `----castorkit${Math.random().toString(16).slice(2)}`
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return {
    payload: Buffer.concat([head, Buffer.isBuffer(content) ? content : Buffer.from(content), tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  }
}
