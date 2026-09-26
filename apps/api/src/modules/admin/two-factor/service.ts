/**
 * Two-factor module service layer (two-step verification, TOTP)
 *
 * - Enrollment: setup stores a new sealed secret (not active yet), enable checks the first code, turns it on and
 *   returns 10 recovery codes (shown once)
 * - Verification: a TOTP code (each time step once) or an unused recovery code
 * - The system settings switch only decides whether sign-in asks for the code; turning it off keeps every binding, so turning
 *   it back on needs no re-enrollment. Roles in security.totp_required_roles can't turn their own 2FA off.
 */

import { ServiceError } from '@/common/errors'
import { checkPasswordHash } from '@/common/password'
import { openSecret, sealSecret } from '@/common/secret-box'
import { toIso } from '@/common/serialize'
import type { Settings, SettingsStore } from '@/common/settings'
import { hashRecoveryCode, matchTotpStep, newRecoveryCodes, newTotpSecret, totpUri } from '@/common/totp'
import type { Db } from '@/db/client'
import type { AdminUserWithRoles } from '@/db/schema'
import { TwoFactorRepository } from './repository'

type Data = Record<string, unknown>

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

export class TwoFactorService {
  private readonly repo: TwoFactorRepository

  constructor(
    private readonly db: Db,
    private readonly secretKey: string,
    private readonly settings: SettingsStore,
  ) {
    this.repo = new TwoFactorRepository(db)
  }

  private async userOr404(id: number) {
    const user = await this.repo.getUser(id)
    if (!user) throw new ServiceError('用户不存在', 404)
    return user
  }

  private isRequired(user: Pick<AdminUserWithRoles, 'roles'>, settings: Settings): boolean {
    return user.roles.some((r) => settings.totpRequiredRoles.includes(r.code))
  }

  private async switchOn(): Promise<boolean> {
    return this.settings.isAvailable('security.totp_enabled', await this.settings.get())
  }

  /** For the profile page */
  async status(user: AdminUserWithRoles) {
    const settings = await this.settings.get()
    const row = await this.userOr404(user.id)
    return {
      available: this.settings.isAvailable('security.totp_enabled', settings),
      enabled: Boolean(row.totp_enabled_at),
      enabled_at: toIso(row.totp_enabled_at),
      required: settings.totpEnabled && this.isRequired(user, settings),
      recovery_codes_left: row.totp_enabled_at ? await this.repo.countUnusedRecoveryCodes(user.id) : 0,
    }
  }

  /** Start enrollment: a new secret for the authenticator app (QR code from otpauth_url) */
  async startSetup(userId: number) {
    if (!(await this.switchOn())) throw new ServiceError('两步验证未开启', 400)
    const row = await this.userOr404(userId)
    if (row.totp_enabled_at) throw new ServiceError('已开启两步验证，如需更换请先关闭', 400)
    const secret = newTotpSecret()
    await this.repo.setPendingSecret(userId, sealSecret(secret, this.secretKey))
    return { secret, otpauth_url: totpUri(secret, row.username) }
  }

  /** Finish enrollment with the first code from the app; returns the recovery codes (only time they are shown) */
  async enable(userId: number, data: Data) {
    const row = await this.userOr404(userId)
    if (row.totp_enabled_at) throw new ServiceError('已开启两步验证，如需更换请先关闭', 400)
    const secret = row.totp_secret ? openSecret(row.totp_secret, this.secretKey) : null
    if (!secret) throw new ServiceError('请先获取绑定密钥', 400)
    const step = matchTotpStep(secret, str(data.code))
    if (step === null) throw new ServiceError('验证码错误', 400)
    const codes = newRecoveryCodes()
    await this.db.transaction(async (tx) => {
      const repo = new TwoFactorRepository(tx)
      await repo.markEnabled(userId, step)
      await repo.replaceRecoveryCodes(userId, codes.map(hashRecoveryCode))
    })
    return { recovery_codes: codes }
  }

  /**
   * Check a sign-in code: `code` (6 digits from the app) or `recovery_code`. False for a wrong, reused or missing code;
   * the caller logs the failure.
   */
  async verify(userId: number, data: Data): Promise<boolean> {
    const row = await this.userOr404(userId)
    if (!row.totp_enabled_at) return false
    const recovery = str(data.recovery_code)
    if (recovery) return this.repo.useRecoveryCode(userId, hashRecoveryCode(recovery))
    const secret = row.totp_secret ? openSecret(row.totp_secret, this.secretKey) : null
    if (!secret) return false
    const step = matchTotpStep(secret, str(data.code))
    return step !== null && (await this.repo.claimStep(userId, step))
  }

  /** For re-verification: whether the password is right */
  async passwordMatches(userId: number, password: unknown): Promise<boolean> {
    const row = await this.userOr404(userId)
    return checkPasswordHash(row.password_hash, password)
  }

  /** For re-verification: enrolled users also give a code while two-step verification is on */
  async codeRequired(userId: number): Promise<boolean> {
    const row = await this.userOr404(userId)
    return Boolean(row.totp_enabled_at) && (await this.switchOn())
  }

  private async assertPassword(userId: number, password: unknown) {
    const row = await this.userOr404(userId)
    if (!(await checkPasswordHash(row.password_hash, password))) throw new ServiceError('密码错误', 400)
    return row
  }

  /** Turn off (password required); not allowed for roles that must use 2FA while the switch is on */
  async disable(user: AdminUserWithRoles, data: Data) {
    const row = await this.assertPassword(user.id, data.password)
    if (!row.totp_enabled_at) throw new ServiceError('尚未开启两步验证', 400)
    const settings = await this.settings.get()
    if (settings.totpEnabled && this.isRequired(user, settings)) {
      throw new ServiceError('你所在的角色要求开启两步验证，不能关闭', 400)
    }
    await this.db.transaction(async (tx) => new TwoFactorRepository(tx).clear(user.id))
    return { message: '两步验证已关闭' }
  }

  /** New recovery codes (the old ones stop working); password required */
  async regenerateRecoveryCodes(userId: number, data: Data) {
    const row = await this.assertPassword(userId, data.password)
    if (!row.totp_enabled_at) throw new ServiceError('尚未开启两步验证', 400)
    const codes = newRecoveryCodes()
    await this.db.transaction(async (tx) => new TwoFactorRepository(tx).replaceRecoveryCodes(userId, codes.map(hashRecoveryCode)))
    return { recovery_codes: codes }
  }

  /** Admin: remove a user's binding (lost phone and recovery codes); they enroll again if their role requires it */
  async reset(userId: number) {
    await this.db.transaction(async (tx) => new TwoFactorRepository(tx).clear(userId))
    return { message: '已重置两步验证' }
  }
}
