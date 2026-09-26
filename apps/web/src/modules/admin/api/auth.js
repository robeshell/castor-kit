import request from '@/shared/api/request'

export const login = (data) => request.post('/admin/login', data)
export const logout = () => request.post('/admin/logout')
export const getMe = () => request.get('/admin/me')
export const changePassword = (data) => request.post('/admin/change-password', data)
export const getMyMenus = () => request.get('/admin/my-menus')
/** Public: demo mode flag and demo account (see DEMO_MODE) */
export const getAppInfo = () => request.get('/admin/app-info')

// ---- Two-step verification (TOTP) ----
/** Second sign-in step: { code } or { recovery_code } */
export const loginTwoFactor = (data) => request.post('/admin/login/two-factor', data)
export const getTwoFactor = () => request.get('/admin/two-factor')
export const setupTwoFactor = () => request.post('/admin/two-factor/setup')
export const enableTwoFactor = (code) => request.post('/admin/two-factor/enable', { code })
export const disableTwoFactor = (password) => request.post('/admin/two-factor/disable', { password })
export const regenerateRecoveryCodes = (password) => request.post('/admin/two-factor/recovery-codes', { password })

// ---- Password reset by email (public) ----
export const requestPasswordReset = (email) => request.post('/admin/password-reset/request', { email })
export const confirmPasswordReset = (token, newPassword) =>
  request.post('/admin/password-reset/confirm', { token, new_password: newPassword })

// ---- My signed-in devices ----
export const getMySessions = (params) => request.get('/admin/profile/sessions', { params })
export const revokeMySession = (key) => request.delete(`/admin/profile/sessions/${key}`)
export const revokeMyOtherSessions = () => request.post('/admin/profile/sessions/revoke-others')
