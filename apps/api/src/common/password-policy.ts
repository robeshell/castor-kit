/**
 * Password policy (system settings → password rules): minimum length plus optional letter+digit / symbol requirements.
 *
 * Applied wherever a password is set: change-password, user create / edit / import, password reset. Existing
 * passwords are not re-checked; the rule takes effect the next time a password is set. The browser reads the same
 * policy from app-info (security.password_policy) to validate before submitting.
 */

import type { Settings } from '@/common/settings'

export interface PasswordPolicy {
  minLength: number
  requireLettersDigits: boolean
  requireSymbol: boolean
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = { minLength: 6, requireLettersDigits: false, requireSymbol: false }

export function passwordPolicyOf(settings: Settings): PasswordPolicy {
  return {
    minLength: settings.passwordMinLength,
    requireLettersDigits: settings.passwordRequireLettersDigits,
    requireSymbol: settings.passwordRequireSymbol,
  }
}

/**
 * Why a password breaks the policy, or null. `label` names the field in the message ('新密码' on change-password /
 * reset, '密码' where an admin sets it).
 */
export function passwordPolicyError(password: string, policy: PasswordPolicy, label: '密码' | '新密码' = '密码'): string | null {
  const isNew = label === '新密码'
  if ([...password].length < policy.minLength) {
    return isNew ? `新密码长度至少${policy.minLength}位` : `密码长度至少${policy.minLength}位`
  }
  if (policy.requireLettersDigits && !(/\p{L}/u.test(password) && /\p{Nd}/u.test(password))) {
    return isNew ? '新密码需同时包含字母和数字' : '密码需同时包含字母和数字'
  }
  if (policy.requireSymbol && !/[^\p{L}\p{Nd}\s]/u.test(password)) {
    return isNew ? '新密码需包含至少一个符号' : '密码需包含至少一个符号'
  }
  return null
}
