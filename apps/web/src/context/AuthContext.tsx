import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getMe, getMyMenus, logout as apiLogout } from '@/modules/admin/api/auth'
import { PUBLIC_PATHS } from '@/shared/api/request'

/** A node of the my-menus tree (children exists only when there are child nodes) */
export interface MenuNode {
  id: number
  name: string
  code: string
  /** lucide icon name, see lib/menu-icons */
  icon: string | null
  path: string | null
  /** Page component, "<module>/<page_path>" */
  component: string | null
  parent_id: number | null
  sort_order: number | null
  is_visible: boolean | null
  is_active: boolean | null
  /** 'menu' | 'button' (or a directory) */
  menu_type: string | null
  description: string | null
  created_at: string | null
  updated_at: string | null
  children?: MenuNode[]
}

/** A role as listed on the signed-in user */
export interface UserRole {
  id: number
  name: string
  code: string
  description: string | null
  created_at: string | null
}

/** The signed-in user as returned by login / me (times are ISO 8601 UTC) */
export interface CurrentUser {
  id: number
  username: string
  nickname: string | null
  email: string | null
  phone: string | null
  avatar: string | null
  /** 'active' | 'disabled' */
  status: string
  dept_id: number | null
  dept_name: string | null
  last_login_at: string | null
  last_login_ip: string | null
  totp_enabled: boolean
  created_at: string | null
  updated_at: string | null
  roles: UserRole[]
  /** Codes of every menu / button the user may use ('super_admin' for the super admin) */
  menu_codes: string[]
}

export interface AuthContextValue {
  user: CurrentUser | null
  menus: MenuNode[]
  menuCodes: string[]
  /** True until the current user has been fetched (or found signed out) */
  loading: boolean
  /** After a successful sign-in: load the menus, then set the user */
  login: (userData: CurrentUser) => Promise<void>
  logout: () => Promise<void>
  /** After the user edits their own profile: swap in the fresh user returned by the API */
  updateUser: (userData: CurrentUser) => void
  hasPermission: (code: string) => boolean
}

const fetchMe: () => Promise<{ user: CurrentUser }> = getMe
const fetchMyMenus: () => Promise<MenuNode[] | { menus?: MenuNode[] }> = getMyMenus

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children?: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [menus, setMenus] = useState<MenuNode[]>([])
  const [menuCodes, setMenuCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (PUBLIC_PATHS.includes(window.location.pathname)) {
      // Public pages (sign-in, password reset) don't need to fetch the current user: end the loading state directly (one-time init, won't cause cascading renders)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }
    fetchMe()
      .then((data) => {
        setUser(data.user)
        setMenuCodes(data.user.menu_codes || [])
        return fetchMyMenus()
      })
      .then((data) => setMenus(Array.isArray(data) ? data : data.menus || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Menus are fetched before the user is set: once `user` is set the login page redirects to "/", and with an
  // empty menu list the index route would briefly render the "no accessible pages" screen
  const login = async (userData: CurrentUser) => {
    const data = await fetchMyMenus()
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
  const updateUser = (userData: CurrentUser) => {
    setUser(userData)
    setMenuCodes(userData?.menu_codes || [])
  }

  const hasPermission = (code: string) => {
    if (menuCodes.includes('super_admin')) return true
    return menuCodes.includes(code)
  }

  return (
    <AuthContext.Provider value={{ user, menus, menuCodes, loading, login, logout, updateUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

/** The auth state; null outside <AuthProvider> */
export const useAuth = (): AuthContextValue | null => useContext(AuthContext)
