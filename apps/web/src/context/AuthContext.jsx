import { createContext, useContext, useState, useEffect } from 'react'
import { getMe, getMyMenus, logout as apiLogout } from '@/modules/admin/api/auth'
import { PUBLIC_PATHS } from '@/shared/api/request'

const AuthContext = createContext(null)

/** Retries of the first user fetch while the API is unreachable (about 30 s) */
const RETRY_LIMIT = 30
const RETRY_MS = 1000

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
    let alive = true
    let timer = null
    // Only a 401 (answered with a `redirect`) means signed out. When the API can't be reached — e.g. the dev server
    // restarting because the visual modeler just generated code — try again for a while instead of dropping to the
    // sign-in page.
    const load = (attempt) =>
      getMe()
        .then((data) => {
          if (!alive) return null
          setUser(data.user)
          setMenuCodes(data.user.menu_codes || [])
          return getMyMenus().then((menuData) => {
            if (alive) setMenus(Array.isArray(menuData) ? menuData : menuData.menus || [])
          })
        })
        .then(() => alive && setLoading(false))
        .catch((err) => {
          if (!alive) return
          const unreachable = !err?.redirect && !err?.error
          if (unreachable && attempt < RETRY_LIMIT) timer = setTimeout(() => load(attempt + 1), RETRY_MS)
          else setLoading(false)
        })
    load(0)
    return () => {
      alive = false
      clearTimeout(timer)
    }
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

  // After menus change on the server (e.g. the visual modeler added a module): fetch the user and menus again
  const refreshMenus = async () => {
    const data = await getMe()
    setUser(data.user)
    setMenuCodes(data.user.menu_codes || [])
    const menuData = await getMyMenus()
    setMenus(Array.isArray(menuData) ? menuData : menuData.menus || [])
  }

  const hasPermission = (code) => {
    if (menuCodes.includes('super_admin')) return true
    return menuCodes.includes(code)
  }

  return (
    <AuthContext.Provider value={{ user, menus, menuCodes, loading, login, logout, updateUser, refreshMenus, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
