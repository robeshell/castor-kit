/**
 * Outgoing mail (password reset links). Configured by environment variables only (see MailConfig in config.ts):
 * - smtp: nodemailer over SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASSWORD, sender MAIL_FROM
 * - log: MAIL_DRIVER=log writes the mail to the server log instead (development: click the link from the console)
 * - none: no mail; features that need it can't be turned on in system settings
 */

import nodemailer from 'nodemailer'
import type { MailConfig } from '@/config'

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

export function createMailer(config: MailConfig, log: MailLogger): Mailer | null {
  if (config.driver === 'log') {
    return {
      async send(message) {
        log.info({ mail: message }, 'Mail not sent (MAIL_DRIVER=log)')
      },
    }
  }
  if (config.driver !== 'smtp') return null
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  })
  const from = config.from || config.user
  return {
    async send(message) {
      await transport.sendMail({ from, to: message.to, subject: message.subject, text: message.text })
    },
  }
}
