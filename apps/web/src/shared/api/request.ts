import axios, { type AxiosError } from 'axios'
import i18n from '@/i18n'

const request = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10000,
})

/** Pages reachable without signing in (no redirect to /login on 401) */
export const PUBLIC_PATHS = ['/login', '/reset-password']

// CSRF token: returned by the login/getMe responses; state-changing requests automatically attach the X-CSRF-Token header
let _csrfToken = ''
export const setCsrfToken = (token: string | null | undefined): void => {
  _csrfToken = token || ''
}
export const getCsrfToken = (): string => _csrfToken

const BROWSER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

request.interceptors.request.use((config) => {
  // The backend translates error and message text based on this header
  config.headers['Accept-Language'] = i18n.language
  // Exported files and the dashboard use the browser's time zone (API responses are always UTC)
  config.headers['X-Time-Zone'] = BROWSER_TIME_ZONE
  if (_csrfToken && ['post', 'put', 'patch', 'delete'].includes((config.method || '').toLowerCase())) {
    config.headers['X-CSRF-Token'] = _csrfToken
  }
  return config
})

request.interceptors.response.use(
  (res) => {
    const data: unknown = res.data
    if (data && typeof data === 'object' && 'csrf_token' in data && typeof data.csrf_token === 'string' && data.csrf_token) {
      setCsrfToken(data.csrf_token)
    }
    // Callers get the body, not the AxiosResponse: type calls as request.get<unknown, Body>(...)
    return res.data
  },
  (err: AxiosError) => {
    // 401 = not logged in / session expired: always do a full-page redirect to the login page (except on the public
    // pages themselves: a wrong password on /login, an expired link on /reset-password)
    const status = err.response?.status
    if (status === 401 && !PUBLIC_PATHS.includes(window.location.pathname)) {
      window.location.replace('/login')
    }
    return Promise.reject(err.response?.data || err)
  }
)

export default request
