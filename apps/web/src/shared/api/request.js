import axios from 'axios'
import i18n from '@/i18n'

const request = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10000,
})

// CSRF token: returned by the login/getMe responses; state-changing requests automatically attach the X-CSRF-Token header
let _csrfToken = ''
export const setCsrfToken = (token) => {
  _csrfToken = token || ''
}
export const getCsrfToken = () => _csrfToken

request.interceptors.request.use((config) => {
  config.headers = config.headers || {}
  // The backend translates error and message text based on this header
  config.headers['Accept-Language'] = i18n.language
  if (_csrfToken && ['post', 'put', 'patch', 'delete'].includes((config.method || '').toLowerCase())) {
    config.headers = config.headers || {}
    config.headers['X-CSRF-Token'] = _csrfToken
  }
  return config
})

request.interceptors.response.use(
  (res) => {
    if (res.data && res.data.csrf_token) {
      setCsrfToken(res.data.csrf_token)
    }
    return res.data
  },
  (err) => {
    // 401 = not logged in / session expired: always do a full-page redirect to the login page (except 401s from the login page itself, e.g. wrong password)
    const status = err.response?.status
    if (status === 401 && window.location.pathname !== '/login') {
      window.location.replace('/login')
    }
    return Promise.reject(err.response?.data || err)
  }
)

export default request
