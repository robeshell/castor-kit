import { createContext, useContext, useState, useEffect } from 'react'
import { getMe, getMyMenus, logout as apiLogout } from '@/modules/admin/api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [menus, setMenus] = useState([])
  const [menuCodes, setMenuCodes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (window.location.pathname === '/login') {
      // 登录页不需要拉取当前用户：直接结束加载态（一次性初始化，不会形成级联渲染）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }
    getMe()
      .then((data) => {
        setUser(data.user)
        setMenuCodes(data.user.menu_codes || [])
        return getMyMenus()
      })
      .then((data) => setMenus(Array.isArray(data) ? data : data.menus || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = (userData) => {
    setUser(userData)
    setMenuCodes(userData.menu_codes || [])
    return getMyMenus().then((data) => setMenus(Array.isArray(data) ? data : data.menus || []))
  }

  const logout = async () => {
    await apiLogout().catch(() => {})
    setUser(null)
    setMenus([])
    setMenuCodes([])
  }

  const hasPermission = (code) => {
    if (menuCodes.includes('super_admin')) return true
    return menuCodes.includes(code)
  }

  return (
    <AuthContext.Provider value={{ user, menus, menuCodes, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
