import { lazy, Suspense, useMemo } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Button, Empty, Typography } from '@douyinfe/semi-ui'
import { AuthProvider } from '@/context/AuthContext'
import { useAuth } from '@/context/AuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import PrivateRoute from '@/components/Layout/PrivateRoute'
import Layout from '@/components/Layout'
import Login from '@/modules/auth/pages/login'
import Profile from '@/modules/admin/pages/profile'

// 非 eager：页面组件按需懒加载（React.lazy），避免首屏全量下载 three/echarts/monaco 等重型依赖
const PAGE_MODULES = import.meta.glob('./modules/**/pages/**/index.jsx')
// 按 componentName 缓存 lazy 组件，避免每次渲染重建组件类型导致页面重挂载
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

  // 新规范：component 使用 "<module>/<page_path>"，例如 "admin/roles"
  if (componentParts.length >= 2) {
    const [moduleName, ...pageParts] = componentParts
    const newPathSuffix = `/modules/${moduleName}/pages/${pageParts.join('/')}/index.jsx`
    matchedEntry = Object.entries(PAGE_MODULES).find(([modulePath]) =>
      modulePath.endsWith(newPathSuffix)
    )
  }

  // 兼容旧值，避免历史菜单数据导致页面不可访问
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

function NoPermissionPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360 }}>
      <Empty
        title="暂无可访问页面"
        description="当前账号没有分配可见菜单，请联系管理员分配权限。"
      />
    </div>
  )
}

function ErrorPage({ code, title, desc }) {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 480, gap: 12 }}>
      <div style={{ fontSize: 96, fontWeight: 800, color: 'var(--semi-color-fill-2)', lineHeight: 1 }}>{code}</div>
      <Typography.Title heading={4} style={{ margin: 0 }}>{title}</Typography.Title>
      <Typography.Text type="tertiary">{desc}</Typography.Text>
      <Button theme="solid" type="primary" style={{ marginTop: 8 }} onClick={() => navigate(-1)}>返回上一页</Button>
    </div>
  )
}

function PageLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360 }}>
      <Typography.Text type="tertiary">页面加载中...</Typography.Text>
    </div>
  )
}

function RouteNotConfigured({ path, component }) {
  return (
    <div style={{ padding: 24 }}>
      <Typography.Title heading={5}>页面未配置</Typography.Title>
      <Typography.Paragraph>
        菜单路径 <Typography.Text code>{path}</Typography.Text> 对应的组件
        <Typography.Text code style={{ marginLeft: 6 }}>{component || '(空)'}</Typography.Text>
        暂未在前端注册。组件值需与 `frontend/src/modules/**/pages/**/index.jsx` 对齐，
        例如 `admin/users`、`component_center/list_page`。
      </Typography.Paragraph>
    </div>
  )
}

function AppRoutes() {
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
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={defaultPath ? <Navigate to={defaultPath} replace /> : <NoPermissionPage />} />
        <Route path="profile" element={<Profile />} />
        <Route path="403" element={<ErrorPage code="403" title="无访问权限" desc="您没有权限访问该页面，请联系管理员" />} />
        {routeMenus.map((menu) => {
          const Component = resolvePageComponent(menu.component)
          return (
            <Route
              key={menu.path}
              path={normalizeRoutePath(menu.path)}
              element={Component ? (
                <Suspense fallback={<PageLoading />}>
                  <Component />
                </Suspense>
              ) : (
                <RouteNotConfigured path={menu.path} component={menu.component} />
              )}
            />
          )
        })}
        <Route path="*" element={<ErrorPage code="404" title="页面不存在" desc="您访问的页面不存在或已被移除" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
