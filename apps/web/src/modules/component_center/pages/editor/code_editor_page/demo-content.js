// i18n-ignore-file: sample source code is demo content, not UI copy

/** Sample code loaded into the editor */
export const INITIAL_CODE = `// castor-kit 示例代码
// 基于 Monaco Editor 的代码编辑器

/**
 * 防抖函数 - 在指定延迟后执行函数
 * @param {Function} fn - 需要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖处理后的函数
 */
function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
      timer = null
    }, delay)
  }
}

/**
 * 深拷贝对象
 * @param {any} obj - 需要深拷贝的对象
 * @returns {any} 拷贝后的对象
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, deepClone(value)])
  )
}

// 示例：使用防抖处理搜索输入
const handleSearch = debounce((query) => {
  console.log('搜索关键词:', query)
  // 在这里调用 API
  fetch(\`/api/search?q=\${encodeURIComponent(query)}\`)
    .then(res => res.json())
    .then(data => console.log('搜索结果:', data))
    .catch(err => console.error('搜索失败:', err))
}, 500)

// 示例：对象操作
const config = {
  theme: 'dark',
  language: 'zh-CN',
  features: {
    autoSave: true,
    lineNumbers: true,
    minimap: false,
  },
}

const newConfig = deepClone(config)
newConfig.theme = 'light'

console.log('原始配置:', config.theme)   // dark
console.log('新配置:', newConfig.theme)  // light
`

