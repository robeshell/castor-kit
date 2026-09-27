import request from '@/shared/api/request'
import type { ApiBody, ApiQuery, ApiResponse } from '@/shared/api/types'

/** The signed-in user as returned by login / me (with roles and menu codes; times are ISO 8601 UTC) */
export type SignedInUser = ApiResponse<'/api/admin/me'>['user']
/** Sign-in result: `user` is missing while a second factor is pending (`mfa_required`) */
export type LoginResult = ApiResponse<'/api/admin/login', 'post'>
/** Public app info (demo mode, upload limits, security settings, AI assistant) */
export type AppInfoResponse = ApiResponse<'/api/admin/app-info'>
/** The signed-in user's two-step verification state */
export type TwoFactorStatus = ApiResponse<'/api/admin/two-factor'>
/** One of the user's signed-in devices (`current` marks this browser) */
export type MySession = ApiResponse<'/api/admin/profile/sessions'>['items'][number]

/**
 * A node of the my-menus tree; leaves have no `children`. Local type: the OpenAPI doc can't express the recursive
 * `children` (it has `{ [key: string]: unknown }[]`).
 */
export interface MyMenu extends Omit<ApiResponse<'/api/admin/my-menus'>[number], 'children'> {
  children?: MyMenu[]
}

/**
 * Result of enabling 2FA; `user` / `csrf_token` only come back when enabling finishes a sign-in that required setup.
 * `user` is overridden locally because the OpenAPI doc still types it as `{ [key: string]: unknown }`.
 */
export type EnableTwoFactorResult = Omit<ApiResponse<'/api/admin/two-factor/enable', 'post'>, 'user'> & { user?: SignedInUser }

export const login = (data: ApiBody<'/api/admin/login', 'post'>) => request.post<unknown, LoginResult>('/admin/login', data)
export const logout = () => request.post<unknown, ApiResponse<'/api/admin/logout', 'post'>>('/admin/logout')
export const getMe = () => request.get<unknown, ApiResponse<'/api/admin/me'>>('/admin/me')
export const changePassword = (data: ApiBody<'/api/admin/change-password', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/change-password', 'post'>>('/admin/change-password', data)
export const getMyMenus = () => request.get<unknown, MyMenu[]>('/admin/my-menus')
/** Public: demo mode flag and demo account (see DEMO_MODE) */
export const getAppInfo = () => request.get<unknown, AppInfoResponse>('/admin/app-info')

// ---- Two-step verification (TOTP) ----
/** Second sign-in step: { code } or { recovery_code } */
export const loginTwoFactor = (data: ApiBody<'/api/admin/login/two-factor', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/login/two-factor', 'post'>>('/admin/login/two-factor', data)
export const getTwoFactor = () => request.get<unknown, TwoFactorStatus>('/admin/two-factor')
export const setupTwoFactor = () =>
  request.post<unknown, ApiResponse<'/api/admin/two-factor/setup', 'post'>>('/admin/two-factor/setup')
export const enableTwoFactor = (code: string) =>
  request.post<unknown, EnableTwoFactorResult>('/admin/two-factor/enable', { code })
export const disableTwoFactor = (password: string) =>
  request.post<unknown, ApiResponse<'/api/admin/two-factor/disable', 'post'>>('/admin/two-factor/disable', { password })
export const regenerateRecoveryCodes = (password: string) =>
  request.post<unknown, ApiResponse<'/api/admin/two-factor/recovery-codes', 'post'>>('/admin/two-factor/recovery-codes', {
    password,
  })

// ---- Password reset by email (public) ----
export const requestPasswordReset = (email: string) =>
  request.post<unknown, ApiResponse<'/api/admin/password-reset/request', 'post'>>('/admin/password-reset/request', { email })
export const confirmPasswordReset = (token: string, newPassword: string) =>
  request.post<unknown, ApiResponse<'/api/admin/password-reset/confirm', 'post'>>('/admin/password-reset/confirm', {
    token,
    new_password: newPassword,
  })

// ---- My signed-in devices ----
export const getMySessions = (params?: ApiQuery<'/api/admin/profile/sessions'>) =>
  request.get<unknown, ApiResponse<'/api/admin/profile/sessions'>>('/admin/profile/sessions', { params })
export const revokeMySession = (key: string) =>
  request.delete<unknown, ApiResponse<'/api/admin/profile/sessions/{key}', 'delete'>>(`/admin/profile/sessions/${key}`)
export const revokeMyOtherSessions = () =>
  request.post<unknown, ApiResponse<'/api/admin/profile/sessions/revoke-others', 'post'>>('/admin/profile/sessions/revoke-others')

/** Re-verification before sensitive changes: { password } plus { code } or { recovery_code } when 2FA is on */
export const reauth = (data: ApiBody<'/api/admin/reauth', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/reauth', 'post'>>('/admin/reauth', data)
