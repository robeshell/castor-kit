// Not using '@testing-library/jest-dom/vitest': it resolves vitest from the jest-dom package's location;
// in the monorepo api uses vitest 5 and web uses vitest 2, so CI resolves the other instance hoisted to the root and the matchers don't register on the current expect.
// Register them explicitly here with web's own vitest.
import * as matchers from '@testing-library/jest-dom/matchers'
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'
import { expect } from 'vitest'

expect.extend(matchers)

// The matchers' types, for the same reason not from '@testing-library/jest-dom/vitest' (its `declare module 'vitest'`
// can land on the other vitest). Declared here rather than in a .d.ts, which skipLibCheck would leave unchecked.
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging needs an interface; the members come from `extends`
  interface Assertion<T> extends TestingLibraryMatchers<unknown, T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- same as above
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}

// Node 25 ships a global localStorage stub without methods that shadows jsdom's; fall back to an in-memory Storage
if (typeof globalThis.localStorage?.setItem !== 'function') {
  const store = new Map<string, string>()
  const storage: Storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
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

// Browser APIs missing from jsdom (used by Radix / motion components)
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
