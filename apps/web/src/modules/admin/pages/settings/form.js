/**
 * Settings page: labels of every setting and the conversion between API values and form values.
 *
 * - Form field names replace the dots of the API keys ("mail.smtp_host" → "mail__smtp_host"): react-hook-form treats
 *   dots as nesting
 * - Secrets start empty (the API never returns them): typing sets a new value, null means "clear on save"
 * - upload.max_size is edited in MB
 */

const MB = 1024 * 1024

export const fieldName = (key) => key.replaceAll('.', '__')

/**
 * Per-setting UI: label, description, placeholder; `options` labels an enum; `input` picks a special editor
 * (roles / tags / mb); `unit` is shown after number inputs.
 */
export const FIELD_META = {
  'general.app_base_url': { label: '网站地址', description: '用户访问后台的地址，找回密码邮件里的链接用它拼接', placeholder: 'https://admin.example.com' },

  'security.totp_enabled': { label: '启用两步验证', description: '关闭后登录不再询问验证码，用户已有的绑定会保留' },
  'security.totp_required_roles': { label: '必须开启的角色', description: '这些角色的成员登录时如果还没绑定，会先要求绑定，且不能自行关闭', placeholder: '不强制', input: 'roles' },
  'security.password_reset_enabled': { label: '启用邮件找回密码', description: '登录页显示「忘记密码」；链接 30 分钟内有效、只能使用一次' },
  'security.api_tokens_enabled': {
    label: '允许使用 API Token',
    description: '开启后用户可以在个人设置里创建 API Token；关闭后已有的 Token 全部暂停使用，重新开启后恢复',
  },
  'security.password_min_length': { label: '最短长度', unit: '位' },
  'security.password_require_letters_digits': { label: '必须同时包含字母和数字' },
  'security.password_require_symbol': { label: '必须包含符号' },
  'security.session_ttl_hours': { label: '登录有效期', description: '一段时间不操作后需要重新登录（有操作时自动续期）', unit: '小时' },
  'security.login_max_failures': { label: '登录失败锁定次数', description: '同一 IP 或同一账号连续失败达到次数后暂时锁定', unit: '次' },
  'security.login_lockout_minutes': { label: '锁定时长', unit: '分钟' },
  'security.rate_limit_per_minute': { label: '每分钟请求上限', description: '每个 IP 的接口请求数', unit: '次' },
  'security.auth_rate_limit_per_minute': { label: '每分钟登录类请求上限', description: '登录、两步验证、找回密码共用', unit: '次' },

  'mail.smtp_host': { label: 'SMTP 服务器', placeholder: 'smtp.example.com' },
  'mail.smtp_port': { label: '端口', description: '常见：587（STARTTLS）、465（SSL/TLS）' },
  'mail.smtp_security': {
    label: '加密方式',
    description: '自动：465 端口用 SSL/TLS，其他端口用 STARTTLS',
    options: { auto: '自动', tls: 'SSL/TLS', starttls: 'STARTTLS' },
  },
  'mail.smtp_user': { label: '账号', placeholder: 'noreply@example.com' },
  'mail.smtp_password': { label: '密码 / 授权码', description: '加密保存，保存后不再显示' },
  'mail.from': { label: '发件人', description: '留空时使用账号', placeholder: 'castor-kit <noreply@example.com>' },

  'storage.driver': {
    label: '保存到',
    description: 'S3 兼容存储包括 AWS S3、MinIO、阿里云 OSS、腾讯云 COS、Cloudflare R2',
    options: { local: '本机磁盘', s3: 'S3 兼容存储' },
  },
  'storage.s3_endpoint': { label: '接口地址', description: '使用 AWS S3 时留空', placeholder: 'https://<account>.r2.cloudflarestorage.com' },
  'storage.s3_region': { label: '区域', description: '留空为 us-east-1；Cloudflare R2 填 auto', placeholder: 'us-east-1' },
  'storage.s3_bucket': { label: 'Bucket' },
  'storage.s3_access_key': { label: 'Access Key' },
  'storage.s3_secret_key': { label: 'Secret Key', description: '加密保存，保存后不再显示' },
  'storage.s3_public_url': { label: '公开访问地址', description: '桶可公开读取时填写，下载直接跳到这里；留空则使用 10 分钟有效的签名地址', placeholder: 'https://cdn.example.com' },
  'storage.s3_path_style': {
    label: '访问方式',
    description: '自动：填了接口地址时用路径风格（MinIO 等自建服务需要）',
    options: { auto: '自动', path: '路径风格', virtual: '虚拟主机风格' },
  },
  'upload.max_size': { label: '单个文件上限', description: '同时受服务器请求体上限 MAX_CONTENT_LENGTH 限制', unit: 'MB', input: 'mb' },
  'upload.allowed_types': { label: '允许的文件类型', description: '扩展名，回车添加；上传时还会检查文件内容与扩展名是否一致', placeholder: '如 pdf', input: 'tags' },

  'ai.provider': {
    label: '服务类型',
    description: 'OpenAI 兼容接口适用于 DeepSeek、通义千问、Gemini 兼容接口、Ollama 等；其余三项直接使用各家官方接口',
    options: { 'openai-compatible': 'OpenAI 兼容接口', openai: 'OpenAI', anthropic: 'Anthropic (Claude)', google: 'Google (Gemini)' },
  },
  'ai.api_base': {
    label: '接口地址',
    description: 'OpenAI 兼容接口必填，请求发往 <地址>/chat/completions；其他服务类型留空使用官方地址，也可以填代理地址',
    placeholder: 'https://api.openai.com/v1',
  },
  'ai.api_key': { label: 'API Key', description: '加密保存，保存后不再显示' },
  'ai.model': { label: '模型', placeholder: 'gpt-4o-mini' },
  'ai.assistant_enabled': {
    label: '启用 AI 小助手',
    description: '右下角的 AI 小助手：以当前用户的身份查询数据，修改数据前逐条请用户确认；账号安全、系统设置和导入导出不开放给它',
  },
}

/** API items → form values */
export function toFormValues(items) {
  return Object.fromEntries(
    items.map((item) => {
      if (item.type === 'secret') return [fieldName(item.key), '']
      if (item.key === 'upload.max_size') return [fieldName(item.key), Math.round((item.value / MB) * 100) / 100]
      return [fieldName(item.key), item.value]
    }),
  )
}

/**
 * Changed settings as the API expects them ({ key: value }); `prefixes` limits them to some groups (test buttons).
 * Compared with the values the form was loaded with, so reverting an edit by hand counts as unchanged.
 */
export function toChanges(items, values, initial, prefixes) {
  const changes = {}
  for (const item of items) {
    if (prefixes && !prefixes.some((p) => item.key.startsWith(p))) continue
    const name = fieldName(item.key)
    const value = values[name]
    if (item.type === 'secret') {
      if (value === null) changes[item.key] = null
      else if (value) changes[item.key] = value
      continue
    }
    if (JSON.stringify(value) === JSON.stringify(initial?.[name])) continue
    changes[item.key] = item.key === 'upload.max_size' ? Math.round(Number(value) * MB) : value
  }
  return changes
}
