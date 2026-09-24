/**
 * 认证模块 service 层（对齐 AuraStack backend/app/admin/service/auth.py）
 *
 * 会话读写属于 HTTP 层，由 routes 负责；这里只返回结果或抛 ServiceError。
 */

import { loadAdminWithRoles } from '@/common/auth'
import { ServiceError } from '@/common/errors'
import { checkPasswordHash, generatePasswordHash } from '@/common/password'
import type { AppConfig } from '@/config'
import type { Db } from '@/db/client'
import { adminUserToDict } from '@/db/schema'
import { AuthRepository } from './repository'
import { validateChangePasswordPayload, type ChangePasswordPayload } from './schema'

export interface ClientMeta {
  ip: string
  userAgent: string
}

export class AuthService {
  private readonly repo: AuthRepository

  constructor(
    private readonly db: Db,
    private readonly config: Pick<AppConfig, 'loginMaxFailures' | 'loginLockoutMinutes'>,
    private readonly log: { warn: (obj: unknown, msg: string) => void } = console,
  ) {
    this.repo = new AuthRepository(db)
  }

  /**
   * 基于 login_logs 的近窗口失败计数，超过阈值则锁定。双维度（任一命中即拦截）：
   * - IP 维度：防针对多用户名的分布式撞库
   * - 用户名维度：防同一账号多 IP 换着试
   */
  private async isLoginBlocked(username: string, ip: string): Promise<boolean> {
    const { loginMaxFailures: max, loginLockoutMinutes: minutes } = this.config
    if (ip && (await this.repo.countRecentFailures({ ip }, minutes)) >= max) return true
    if (username && (await this.repo.countRecentFailures({ username }, minutes)) >= max) return true
    return false
  }

  /** 审计写入失败不影响主流程（对应 Python 的 try/except + rollback） */
  private async bestEffort(what: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn()
    } catch (err) {
      this.log.warn({ err }, `${what}失败`)
    }
  }

  /** 成功返回 `{ message, user }`；调用方负责写会话并附加 csrf_token */
  async login(usernameRaw: unknown, password: unknown, meta: ClientMeta) {
    const username = typeof usernameRaw === 'string' ? usernameRaw : ''
    if (await this.isLoginBlocked(username, meta.ip)) {
      throw new ServiceError('登录失败次数过多，请稍后再试', 429)
    }

    const user = username ? await this.repo.getAdminByUsername(username) : null

    if (user && (await checkPasswordHash(user.password_hash, password))) {
      await this.bestEffort('记录登录日志', async () => {
        await this.repo.addLoginLog({
          username,
          user_id: user.id,
          status: 'success',
          ip: meta.ip,
          user_agent: meta.userAgent,
          message: '登录成功',
        })
        // 登录成功：清零窗口内失败计数，避免历史误触继续限流
        await this.repo.clearRecentFailures(username, meta.ip, this.config.loginLockoutMinutes)
      })

      const withRoles = await loadAdminWithRoles(this.db, username)
      if (!withRoles) throw new ServiceError('用户不存在', 500)
      return { username, payload: { message: '登录成功', user: adminUserToDict(withRoles) } }
    }

    await this.bestEffort('记录登录日志', () =>
      this.repo.addLoginLog({
        username,
        user_id: user?.id ?? null,
        status: 'failed',
        ip: meta.ip,
        user_agent: meta.userAgent,
        message: '用户名或密码错误',
      }),
    )
    throw new ServiceError('用户名或密码错误', 401)
  }

  /** 记录登出操作日志；调用方负责清空会话 */
  async logout(username: string, meta: ClientMeta) {
    const user = username ? await this.repo.getAdminByUsername(username) : null
    await this.bestEffort('记录登出日志', () =>
      this.repo.addOperationLog({
        username: username || 'unknown',
        user_id: user?.id ?? null,
        module: 'auth',
        action: 'logout',
        method: 'POST',
        path: '/api/admin/logout',
        target_id: null,
        payload: null,
        ip: meta.ip,
        user_agent: meta.userAgent,
        status_code: 200,
      }),
    )
    return { message: '已退出登录' }
  }

  async changePassword(username: string | undefined, data: ChangePasswordPayload) {
    const error = validateChangePasswordPayload(data)
    if (error) throw new ServiceError(error, 400)

    const admin = username ? await this.repo.getAdminByUsername(username) : null
    if (!admin) throw new ServiceError('用户不存在', 404)
    if (!(await checkPasswordHash(admin.password_hash, data?.old_password))) {
      throw new ServiceError('旧密码错误', 400)
    }

    try {
      // 并行运行期新哈希也写 werkzeug 格式，保证 Flask 端可验（rewrite-plan §2.3）
      await this.repo.updatePasswordHash(admin.id, await generatePasswordHash(String(data?.new_password)))
    } catch (err) {
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
    return { message: '密码修改成功' }
  }

  async getCurrentUser(username: string | undefined) {
    if (!username) throw new ServiceError('未登录', 401)
    const user = await loadAdminWithRoles(this.db, username)
    if (!user) throw new ServiceError('登录已失效，请重新登录', 401)
    return { user: adminUserToDict(user) }
  }
}
