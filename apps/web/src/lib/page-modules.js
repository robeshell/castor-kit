import { lazy } from 'react'

/**
 * Menu pages: every `modules/<module>/pages/<page>/index.{jsx,tsx}` is its own chunk, loaded when the page is first opened
 * (so heavy dependencies like ECharts, three.js or Monaco are not in the first download).
 * prefetchPage() starts that download early — on hover / focus of a menu item, or while the browser is idle —
 * so the first click doesn't wait for the page's code.
 */
const PAGE_MODULES = import.meta.glob('../modules/**/pages/**/index.{jsx,tsx}')

// One lazy component per page, so re-renders don't recreate the component type and remount the page
const lazyPages = new Map()
const prefetched = new Set()

/** menus.component ("<module>/<page_path>", e.g. "admin/roles") → the page's chunk loader, or null */
function findLoader(componentName) {
  if (!componentName || typeof componentName !== 'string') return null
  const name = componentName.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const [moduleName, ...pageParts] = name.split('/').filter(Boolean)
  if (!moduleName || pageParts.length === 0) return null
  const base = `/modules/${moduleName}/pages/${pageParts.join('/')}/index.`
  const entry = Object.entries(PAGE_MODULES).find(([path]) => path.endsWith(`${base}tsx`) || path.endsWith(`${base}jsx`))
  return entry ? { key: name, load: entry[1] } : null
}

/** The lazy page component for menus.component, or null when no such page exists */
export function resolvePageComponent(componentName) {
  const loader = findLoader(componentName)
  if (!loader) return null
  if (!lazyPages.has(loader.key)) lazyPages.set(loader.key, lazy(loader.load))
  return lazyPages.get(loader.key)
}

/** Start downloading a page's code (once); failures are ignored — the page loads normally when opened */
export function prefetchPage(componentName) {
  const loader = findLoader(componentName)
  if (!loader || prefetched.has(loader.key)) return Promise.resolve()
  prefetched.add(loader.key)
  return loader.load().catch(() => prefetched.delete(loader.key))
}

/**
 * Pages that are cheap to fetch ahead of time: the system pages and the component gallery's admin pages (tens of KB).
 * Charts, 3D, editors and dev tools are fetched on hover / focus only.
 */
export function isLightPage(componentName) {
  return typeof componentName === 'string' && /^(admin|component_center\/admin)\//.test(componentName.trim())
}
