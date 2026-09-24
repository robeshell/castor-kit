import axios from 'axios'

const request = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10000,
})

// CSRF token：登录/getMe 响应会携带，状态变更请求自动附加 X-CSRF-Token 头
let _csrfToken = ''
export const setCsrfToken = (token) => {
  _csrfToken = token || ''
}
export const getCsrfToken = () => _csrfToken

request.interceptors.request.use((config) => {
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
    // 401 = 未登录/会话过期：统一整页跳转登录页（登录页本身的 401，如密码错误，除外）
    const status = err.response?.status
    if (status === 401 && window.location.pathname !== '/login') {
      window.location.replace('/login')
    }
    return Promise.reject(err.response?.data || err)
  }
)

export default request
