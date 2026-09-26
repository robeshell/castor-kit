/**
 * Environment variables that can pin a system setting (see common/settings.ts). Kept in its own module so config.ts
 * can collect them without importing the settings store.
 *
 * A variable that is set and non-empty wins over the value saved on the settings page, and the page shows the setting
 * as read-only. Leave it unset to manage the setting in the UI.
 */
export const SETTING_ENV_NAMES = [
  'APP_BASE_URL',
  'LOGIN_MAX_FAILURES',
  'LOGIN_LOCKOUT_MINUTES',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'MAIL_FROM',
  'STORAGE_DRIVER',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_PUBLIC_URL',
  'S3_FORCE_PATH_STYLE',
  'UPLOAD_MAX_SIZE',
  'UPLOAD_ALLOWED_TYPES',
  'AI_PROVIDER',
  'AI_API_BASE',
  'AI_API_KEY',
  'AI_MODEL',
] as const

export type SettingEnvName = (typeof SETTING_ENV_NAMES)[number]

/** The pinning variables that are present and non-empty in `source` */
export function collectSettingsEnv(source: Record<string, string | undefined>): Partial<Record<SettingEnvName, string>> {
  const out: Partial<Record<SettingEnvName, string>> = {}
  for (const name of SETTING_ENV_NAMES) {
    const value = source[name]
    if (value !== undefined && value.trim() !== '') out[name] = value
  }
  return out
}
