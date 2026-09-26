/**
 * Auth module service layer
 *
 * Session reads/writes belong to the HTTP layer and are handled by routes; this layer only returns results or throws ServiceError.
 */

import { loadAdminWithRoles } from '@/common/auth'
import { ServiceError } from '@/common/errors'
import { checkPasswordHash, generatePasswordHash } from '@/common/password'
import type { PasswordPolicy } from '@/common/password-policy'
import type { SettingsStore } from '@/common/settings'
import type { MfaState } from '@/common/session'
import type { AppConfig } from '@/config'
import type { Db } from '@/db/client'
import { adminUserToDict, type AdminUserWithRoles } from '@/db/schema'
import { AuthRepository } from './repository'
import { validateChangePasswordPayload, type ChangePasswordPayload } from './schema'

export interface ClientMeta {
  ip: string
  userAgent: string
}

/** Whether sign-in asks for a second factor (from system settings) */
export interface TwoFactorPolicy {
  enabled: boolean
  requiredRoles: string[]
}

export type LoginResult =
  | { kind: 'signed_in'; userId: number; payload: { message: string; user: Awaited<ReturnType<AuthService['userDict']>> } }
  /** Password was right; the session waits for the code ('verify') or for enrollment ('setup') */
  | { kind: 'mfa'; userId: number; state: MfaState }

export class AuthService {
  private readonly repo: AuthRepository

  constructor(
    private readonly db: Db,
    private readonly config: Partial<Pick<AppConfig, 'demoMode'>>,
    private readonly log: { warn: (obj: unknown, msg: string) => void } = console,
    /** Lockout thresholds (security.login_max_failures / login_lockout_minutes) */
    private readonly settings: Pick<SettingsStore, 'get'>,
  ) {
    this.repo = new AuthRepository(db)
  }

  /** 429 while the IP or the username is locked out (password and 2FA code failures both count) */
  async assertNotBlocked(username: string, ip: string): Promise<void> {
    if (await this.isLoginBlocked(username, ip)) throw new ServiceError('登录失败次数过多，请稍后再试', 429)
  }

  /**
   * Recent-window failure count from login_logs; lock out once over the threshold. Two dimensions (either one blocks):
   * - IP: guards against distributed credential stuffing across many usernames
   * - Username: guards against one account being tried from rotating IPs
   * In DEMO_MODE the username dimension is skipped: the demo credentials are public, so anyone could otherwise lock
   * the shared account for everyone by typing a wrong password on purpose.
   */
  private async isLoginBlocked(username: string, ip: string): Promise<boolean> {
    const { loginMaxFailures: max, loginLockoutMinutes: minutes } = await this.settings.get()
    if (ip && (await this.repo.countRecentFailures({ ip }, minutes)) >= max) return true
    if (username && !this.config.demoMode && (await this.repo.countRecentFailures({ username }, minutes)) >= max) return true
    return false
  }

  /** Audit write failures don't affect the main flow (log a warning and swallow the error) */
  private async bestEffort(what: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn()
    } catch (err) {
      this.log.warn({ err }, `${what}失败`)
    }
  }

  /**
   * Check the password. Signed in right away, or — with 2FA on and the user enrolled (or required to enroll by role) —
   * a second step first; "login succeeded" is only recorded once that step passes. The caller writes the session.
   */
  async login(usernameRaw: unknown, password: unknown, meta: ClientMeta, twoFactor: TwoFactorPolicy): Promise<LoginResult> {
    const username = typeof usernameRaw === 'string' ? usernameRaw : ''
    await this.assertNotBlocked(username, meta.ip)

    const user = username ? await this.repo.getAdminByUsername(username) : null

    if (user && (await checkPasswordHash(user.password_hash, password))) {
      // Checked only after the password matches, so the message doesn't reveal which usernames exist
      if (user.status !== 'active') {
        await this.bestEffort('记录登录日志', () =>
          this.repo.addLoginLog({
            username,
            user_id: user.id,
            status: 'failed',
            ip: meta.ip,
            user_agent: meta.userAgent,
            message: '账号已停用',
          }),
        )
        throw new ServiceError('账号已停用，请联系管理员', 403)
      }
      const withRoles = await loadAdminWithRoles(this.db, username)
      if (!withRoles) throw new ServiceError('用户不存在', 500)
      const state: MfaState | null = !twoFactor.enabled
        ? null
        : user.totp_enabled_at
          ? 'verify'
          : withRoles.roles.some((r) => twoFactor.requiredRoles.includes(r.code))
            ? 'setup'
            : null
      if (state) return { kind: 'mfa', userId: user.id, state }
      return { kind: 'signed_in', userId: user.id, payload: await this.finishSignIn(withRoles, meta) }
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

  /** Record a completed sign-in (last login, login log, reset the failure window); returns the login response body */
  async finishSignIn(user: AdminUserWithRoles, meta: ClientMeta) {
    await this.bestEffort('记录登录时间', () => this.repo.recordLogin(user.id, meta.ip))
    await this.bestEffort('记录登录日志', async () => {
      await this.repo.addLoginLog({
        username: user.username,
        user_id: user.id,
        status: 'success',
        ip: meta.ip,
        user_agent: meta.userAgent,
        message: '登录成功',
      })
      // Login succeeded: reset the window's failure count so earlier mistakes don't keep rate limiting
      await this.repo.clearRecentFailures(user.username, meta.ip, (await this.settings.get()).loginLockoutMinutes)
    })
    return { message: '登录成功', user: await this.userDict(user) }
  }

  /** A wrong 2FA code: logged as a failed login, so it counts toward the lockout like a wrong password */
  async recordSecondFactorFailure(user: { id: number; username: string }, meta: ClientMeta) {
    await this.bestEffort('记录登录日志', () =>
      this.repo.addLoginLog({
        username: user.username,
        user_id: user.id,
        status: 'failed',
        ip: meta.ip,
        user_agent: meta.userAgent,
        message: '两步验证码错误',
      }),
    )
  }

  /** Record the logout operation log; the caller clears the session */
  async logout(user: { id: number; username: string } | null, meta: ClientMeta) {
    await this.bestEffort('记录登出日志', () =>
      this.repo.addOperationLog({
        username: user?.username || 'unknown',
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

  async changePassword(userId: number | undefined, data: ChangePasswordPayload, policy: PasswordPolicy) {
    const error = validateChangePasswordPayload(data, policy)
    if (error) throw new ServiceError(error, 400)

    const admin = userId !== undefined ? await this.repo.getAdminById(userId) : null
    if (!admin) throw new ServiceError('用户不存在', 404)
    if (!(await checkPasswordHash(admin.password_hash, data?.old_password))) {
      throw new ServiceError('旧密码错误', 400)
    }

    try {
      // New hashes keep the existing `pbkdf2:sha256:<iterations>$<salt>$<hex>` format, compatible with hashes already stored
      await this.repo.updatePasswordHash(admin.id, await generatePasswordHash(String(data?.new_password)))
    } catch (err) {
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
    return { message: '密码修改成功' }
  }

  async getCurrentUser(user: AdminUserWithRoles | null) {
    if (!user) throw new ServiceError('登录已失效，请重新登录', 401)
    return { user: await this.userDict(user) }
  }

  /** The signed-in user as returned by login / me: the usual user dict plus the department name */
  async userDict(user: AdminUserWithRoles) {
    return { ...adminUserToDict(user), dept_name: await this.repo.deptName(user.dept_id) }
  }
}
