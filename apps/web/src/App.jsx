import { lazy, useMemo } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import AppLayout from '@/components/app/AppLayout'
import PrivateRoute from '@/components/app/PrivateRoute'
import { ErrorPage, NoPermissionPage, RouteNotConfigured } from '@/components/app/StatusPages'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Login from '@/modules/auth/pages/login'
import Profile from '@/modules/admin/pages/profile'
import { useTranslation } from 'react-i18next'

// Not eager: page components are lazy-loaded on demand (React.lazy) to avoid downloading heavy deps like three/echarts/monaco on first load
const PAGE_MODULES = import.meta.glob('./modules/**/pages/**/index.jsx')
// Cache lazy components by componentName, so re-renders don't recreate the component type and remount the page
const _lazyPageCache = new Map()

function resolvePageComponent(componentName) {
  if (!componentName || typeof componentName !== 'string') {
    return null
  }
  const normalizedComponentName = componentName
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
  if (!normalizedComponentName) {
    return null
  }
  const componentParts = normalizedComponentName.split('/').filter(Boolean)
  let matchedEntry = null

  // New convention: component uses "<module>/<page_path>", e.g. "admin/roles"
  if (componentParts.length >= 2) {
    const [moduleName, ...pageParts] = componentParts
    const newPathSuffix = `/modules/${moduleName}/pages/${pageParts.join('/')}/index.jsx`
    matchedEntry = Object.entries(PAGE_MODULES).find(([modulePath]) =>
      modulePath.endsWith(newPathSuffix)
    )
  }

  // Backward compatible with legacy values, so historical menu data doesn't make pages inaccessible
  if (!matchedEntry) {
    const legacyPathSuffix = `/pages/${normalizedComponentName}/index.jsx`
    matchedEntry = Object.entries(PAGE_MODULES).find(([modulePath]) =>
      modulePath.endsWith(legacyPathSuffix)
    )
  }

  const loader = matchedEntry?.[1]
  if (!loader) {
    return null
  }
  if (!_lazyPageCache.has(normalizedComponentName)) {
    _lazyPageCache.set(normalizedComponentName, lazy(loader))
  }
  return _lazyPageCache.get(normalizedComponentName)
}

function collectRouteMenus(menus = []) {
  const result = []
  const walk = (nodes = []) => {
    nodes.forEach((menu) => {
      if (!menu?.is_active || !menu?.is_visible) {
        return
      }
      if (menu.menu_type === 'menu' && menu.path?.startsWith('/')) {
        result.push(menu)
      }
      if (Array.isArray(menu.children) && menu.children.length > 0) {
        walk(menu.children)
      }
    })
  }
  walk(menus)
  return result
}

function normalizeRoutePath(pathname = '') {
  return pathname.replace(/^\/+/, '')
}

function AppRoutes() {
  const { t } = useTranslation()
  const { menus } = useAuth()

  const routeMenus = useMemo(() => {
    const all = collectRouteMenus(menus)
    const dedup = new Map()
    all.forEach((menu) => {
      if (!dedup.has(menu.path)) {
        dedup.set(menu.path, menu)
      }
    })
    return Array.from(dedup.values())
  }, [menus])

  const defaultPath = useMemo(() => {
    if (routeMenus.length === 0) {
      return null
    }
    const dashboardMenu = routeMenus.find((menu) => menu.path === '/dashboard')
    return (dashboardMenu || routeMenus[0]).path
  }, [routeMenus])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={defaultPath ? <Navigate to={defaultPath} replace /> : <NoPermissionPage />} />
        <Route path="profile" element={<Profile />} />
        <Route path="403" element={<ErrorPage code="403" title={t('无访问权限')} description={t('您没有权限访问该页面，请联系管理员。')} />} />
        {routeMenus.map((menu) => {
          const Component = resolvePageComponent(menu.component)
          return (
            <Route
              key={menu.path}
              path={normalizeRoutePath(menu.path)}
              // Suspense lives in AppLayout (one boundary shared across routes), so the old page stays until the new page's code has loaded
              element={Component ? (
                <Component />
              ) : (
                <RouteNotConfigured path={menu.path} component={menu.component} />
              )}
            />
          )
        })}
        <Route path="*" element={<ErrorPage code="404" title={t('页面不存在')} description={t('您访问的页面不存在或已被移除。')} />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <TooltipProvider delayDuration={300}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
          <Toaster position="top-center" richColors={false} closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
