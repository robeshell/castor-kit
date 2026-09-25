import request from '@/shared/api/request'

export const login = (data) => request.post('/admin/login', data)
export const logout = () => request.post('/admin/logout')
export const getMe = () => request.get('/admin/me')
export const changePassword = (data) => request.post('/admin/change-password', data)
export const getMyMenus = () => request.get('/admin/my-menus')
/** Public: demo mode flag and demo account (see DEMO_MODE) */
export const getAppInfo = () => request.get('/admin/app-info')
