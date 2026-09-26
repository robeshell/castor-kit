/**
 * Outgoing mail (password reset links, test mails). SMTP is configured in system settings (group "mail", or pinned
 * by SMTP_* environment variables); MAIL_DRIVER=log prints mails to the server log instead (development), and
 * MAIL_DRIVER=none never sends.
 */

import nodemailer from 'nodemailer'
import type { AppConfig } from '@/config'
import type { Settings, SettingsStore } from '@/common/settings'

export interface MailMessage {
  to: string
  subject: string
  text: string
}

export interface Mailer {
  send(message: MailMessage): Promise<void>
}

export interface MailLogger {
  info(obj: object, msg: string): void
}

/** A mailer for the given settings, or null when mail isn't configured */
export function createMailer(config: Pick<AppConfig, 'mailDriver'>, mail: Settings['mail'], log: MailLogger): Mailer | null {
  if (config.mailDriver === 'log') {
    return {
      async send(message) {
        log.info({ mail: message }, 'Mail not sent (MAIL_DRIVER=log)')
      },
    }
  }
  if (config.mailDriver === 'none' || !mail.host) return null
  const transport = nodemailer.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.secure,
    auth: mail.user ? { user: mail.user, pass: mail.password } : undefined,
    // A wrong host / port should fail the "send test mail" button in seconds, not minutes
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  })
  return {
    async send(message) {
      await transport.sendMail({ from: mail.from, to: message.to, subject: message.subject, text: message.text })
    },
  }
}

/** The mailer for the current settings, rebuilt when they change; tests can pin one */
export class MailerProvider {
  private cached: { key: string; mailer: Mailer | null } | null = null

  constructor(
    private readonly settings: Pick<SettingsStore, 'get'>,
    private readonly config: Pick<AppConfig, 'mailDriver'>,
    private readonly log: MailLogger,
    private readonly fixed?: Mailer | null,
  ) {}

  async get(): Promise<Mailer | null> {
    if (this.fixed !== undefined) return this.fixed
    const mail = (await this.settings.get()).mail
    const key = JSON.stringify(mail)
    if (this.cached?.key !== key) this.cached = { key, mailer: createMailer(this.config, mail, this.log) }
    return this.cached.mailer
  }
}
