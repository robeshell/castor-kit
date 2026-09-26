/**
 * Password reset by email link
 *
 * - request: always answers the same message, whether or not the email belongs to an account (no user enumeration);
 *   the mail is sent in the background so the response time doesn't tell either
 * - The link is built from APP_BASE_URL (never from the request's Host header) and carries a 32-byte random token;
 *   only its sha256 is stored. Valid for 30 minutes, once; a newer request replaces older links
 * - confirm: the password policy applies, every session of the user is signed out. 2FA is not bypassed: the next
 *   sign-in still asks for the code
 */

import { createHash, randomBytes } from 'node:crypto'
import { ServiceError } from '@/common/errors'
import type { Language } from '@/common/i18n'
import type { Mailer } from '@/common/mailer'
import { generatePasswordHash } from '@/common/password'
import { passwordPolicyError, passwordPolicyOf } from '@/common/password-policy'
import { revokeSessions } from '@/common/session'
import type { SettingsStore } from '@/common/settings'
import type { Db } from '@/db/client'
import { PasswordResetRepository, TOKEN_MINUTES } from './repository'

type Data = Record<string, unknown>

const REQUESTED = '如果该邮箱属于某个账号，重置链接已发送，请查收邮件'

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

const MAILS: Record<Language, (p: { username: string; link: string }) => { subject: string; text: string }> = {
  'zh-CN': ({ username, link }) => ({
    subject: '重置密码',
    text: `${username}，你好：\n\n我们收到了重置你的账号密码的请求。点击下面的链接设置新密码（${TOKEN_MINUTES} 分钟内有效，只能使用一次）：\n\n${link}\n\n如果不是你本人操作，请忽略这封邮件，你的密码不会改变。`,
  }),
  'en-US': ({ username, link }) => ({
    subject: 'Reset your password',
    text: `Hello ${username},\n\nWe received a request to reset the password of your account. Open the link below to set a new one (valid for ${TOKEN_MINUTES} minutes, single use):\n\n${link}\n\nIf you didn't ask for this, ignore this email; your password stays the same.`,
  }),
  'ja-JP': ({ username, link }) => ({
    subject: 'パスワードの再設定',
    text: `${username} 様\n\nアカウントのパスワード再設定のリクエストを受け付けました。下のリンクから新しいパスワードを設定してください（有効期限 ${TOKEN_MINUTES} 分、1 回のみ有効）：\n\n${link}\n\nお心当たりがない場合は、このメールを破棄してください。パスワードは変更されません。`,
  }),
}

export interface ResetLogger {
  error(obj: object, msg: string): void
}

export class PasswordResetService {
  private readonly repo: PasswordResetRepository

  constructor(
    private readonly db: Db,
    private readonly settings: SettingsStore,
    private readonly mailer: Mailer | null,
    private readonly appBaseUrl: string,
    private readonly log: ResetLogger,
  ) {
    this.repo = new PasswordResetRepository(db)
  }

  private async assertAvailable() {
    const settings = await this.settings.get()
    if (!this.mailer || !this.settings.isAvailable('security.password_reset_enabled', settings)) {
      throw new ServiceError('找回密码功能未开启', 400)
    }
  }

  /** Send a reset link to the account with this email (if any). Returns the mail job for tests to await. */
  async request(data: Data, ip: string, lang: Language): Promise<{ body: { message: string }; sent: Promise<void> }> {
    await this.assertAvailable()
    const email = typeof data.email === 'string' ? data.email.trim() : ''
    if (!email || email.length > 100 || !email.includes('@')) throw new ServiceError('请输入正确的邮箱地址', 400)
    const user = await this.repo.findActiveByEmail(email)
    let sent: Promise<void> = Promise.resolve()
    if (user && user.email) {
      const token = randomBytes(32).toString('base64url')
      await this.repo.issue(user.id, hashToken(token), ip)
      const link = `${this.appBaseUrl}/reset-password?token=${token}`
      const mail = MAILS[lang]({ username: user.username, link })
      sent = this.mailer!.send({ to: user.email, ...mail }).catch((err) => {
        this.log.error({ err, userId: user.id }, 'Password reset mail failed')
      })
    }
    return { body: { message: REQUESTED }, sent }
  }

  /** Set a new password with a token from the mail */
  async confirm(data: Data) {
    await this.assertAvailable()
    const token = typeof data.token === 'string' ? data.token.trim() : ''
    const password = typeof data.new_password === 'string' ? data.new_password : ''
    if (!token || !password) throw new ServiceError('请填写完整信息', 400)
    const policyError = passwordPolicyError(password, passwordPolicyOf(await this.settings.get()), '新密码')
    if (policyError) throw new ServiceError(policyError, 400)
    const passwordHash = await generatePasswordHash(password)
    const userId = await this.db.transaction(async (tx) => {
      const repo = new PasswordResetRepository(tx)
      const id = await repo.consume(hashToken(token))
      if (id === null) return null
      await repo.setPasswordHash(id, passwordHash)
      await revokeSessions(tx, { userId: id })
      return id
    })
    if (userId === null) throw new ServiceError('重置链接无效或已过期，请重新申请', 400)
    return { message: '密码已重置，请使用新密码登录' }
  }
}
