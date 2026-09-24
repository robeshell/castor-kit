export interface ShadowCase {
  name: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  /** 是否带登录会话（写请求自动带 X-CSRF-Token，除非 noCsrf） */
  auth?: boolean
  noCsrf?: boolean
  /** 比较前把这些键（任意层级）的值替换为 <ignored>，用于 id / 时间戳等必然不同的字段 */
  ignoreKeys?: string[]
}
