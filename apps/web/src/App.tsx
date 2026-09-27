import { lazy, Suspense, useMemo } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, type MenuNode } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import AppLayout from '@/components/app/AppLayout'
import PrivateRoute from '@/components/app/PrivateRoute'
import { ErrorPage, NoPermissionPage, RouteNotConfigured } from '@/components/app/StatusPages'
import { hasRoutePath, type RoutedMenu } from '@/components/app/menu-tree'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { resolvePageComponent } from '@/lib/page-modules'
import { useTranslation } from 'react-i18next'

// Loaded when first opened, like the menu pages (signed-in users never need the sign-in page's code, and vice versa)
const Login = lazy(() => import('@/modules/auth/pages/login'))
const ResetPassword = lazy(() => import('@/modules/auth/pages/reset_password'))
const Profile = lazy(() => import('@/modules/admin/pages/profile'))

function collectRouteMenus(menus: MenuNode[] = []): RoutedMenu[] {
  const result: RoutedMenu[] = []
  const walk = (nodes: MenuNode[] = []) => {
    nodes.forEach((menu) => {
      if (!menu?.is_active || !menu?.is_visible) {
        return
      }
      if (menu.menu_type === 'menu' && hasRoutePath(menu)) {
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

function normalizeRoutePath(pathname = ''): string {
  return pathname.replace(/^\/+/, '')
}

function AppRoutes() {
  const { t } = useTranslation()
  const { menus } = useAuth()

  const routeMenus = useMemo(() => {
    const all = collectRouteMenus(menus)
    const dedup = new Map<string, RoutedMenu>()
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
    // routeMenus is non-empty here (checked above)
    return (dashboardMenu || routeMenus[0]!).path
  }, [routeMenus])

  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={null}><Login /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={null}><ResetPassword /></Suspense>} />
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
