import { createContext, useContext, useState, useEffect } from 'react'
import { getMe, getMyMenus, logout as apiLogout } from '@/modules/admin/api/auth'
import { PUBLIC_PATHS } from '@/shared/api/request'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [menus, setMenus] = useState([])
  const [menuCodes, setMenuCodes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (PUBLIC_PATHS.includes(window.location.pathname)) {
      // Public pages (sign-in, password reset) don't need to fetch the current user: end the loading state directly (one-time init, won't cause cascading renders)
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

  // Menus are fetched before the user is set: once `user` is set the login page redirects to "/", and with an
  // empty menu list the index route would briefly render the "no accessible pages" screen
  const login = async (userData) => {
    const data = await getMyMenus()
    setMenus(Array.isArray(data) ? data : data.menus || [])
    setMenuCodes(userData.menu_codes || [])
    setUser(userData)
  }

  const logout = async () => {
    await apiLogout().catch(() => {})
    setUser(null)
    setMenus([])
    setMenuCodes([])
  }

  // After the user edits their own profile: swap in the fresh user returned by the API
  const updateUser = (userData) => {
    setUser(userData)
    setMenuCodes(userData?.menu_codes || [])
  }

  const hasPermission = (code) => {
    if (menuCodes.includes('super_admin')) return true
    return menuCodes.includes(code)
  }

  return (
    <AuthContext.Provider value={{ user, menus, menuCodes, loading, login, logout, updateUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
