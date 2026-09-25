// 不用 '@testing-library/jest-dom/vitest'：它会从 jest-dom 包的位置解析 vitest，
// monorepo 里 api 用 vitest 5、web 用 vitest 2，CI 上会解析到根目录提升的另一个实例，matchers 注册不到当前 expect。
// 这里用 web 自己的 vitest 显式注册。
import * as matchers from '@testing-library/jest-dom/matchers'
import { expect } from 'vitest'

expect.extend(matchers)

// Node 25 ships a global localStorage stub without methods that shadows jsdom's; fall back to an in-memory Storage
if (typeof globalThis.localStorage?.setItem !== 'function') {
  const store = new Map()
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
}

// Test assertions are written in Chinese: pin the UI language (jsdom's navigator.language is en-US)
localStorage.setItem('lang', 'zh-CN')

// jsdom 缺少的浏览器 API（Radix / motion 组件会用到）
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
