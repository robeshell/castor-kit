import { useTranslation } from 'react-i18next'
import { useAppInfo } from '@/shared/hooks/useAppInfo'

const DEFAULT_POLICY = { min_length: 6, require_letters_digits: false, require_symbol: false }

/**
 * Password rule from system settings (served by app-info), checked in the browser before submitting; the API applies the
 * same rule. Returns `{ policy, validate, hint }`: `validate` fits react-hook-form rules (message or true), `hint` is
 * a short placeholder text like "至少 8 位，包含字母和数字".
 */
export function usePasswordPolicy() {
  const { t } = useTranslation()
  const policy = useAppInfo()?.security?.password_policy ?? DEFAULT_POLICY

  const validate = (value) => {
    const text = String(value ?? '')
    if (!text) return true
    if ([...text].length < policy.min_length) return t('密码长度至少 {{count}} 位', { count: policy.min_length })
    if (policy.require_letters_digits && !(/\p{L}/u.test(text) && /\p{Nd}/u.test(text))) return t('密码需同时包含字母和数字')
    if (policy.require_symbol && !/[^\p{L}\p{Nd}\s]/u.test(text)) return t('密码需包含至少一个符号')
    return true
  }

  const hint = [
    t('至少 {{count}} 位', { count: policy.min_length }),
    policy.require_letters_digits ? t('包含字母和数字') : null,
    policy.require_symbol ? t('包含符号') : null,
  ]
    .filter(Boolean)
    .join(t('，'))

  return { policy, validate, hint }
}
