import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * Theme: light / dark, toggled via <html class="dark"> (shadcn / Tailwind convention).
 * The preference is stored in localStorage('theme'); if never stored, follow the system.
 */
const ThemeContext = createContext({ theme: 'light', isDark: false, toggleTheme: () => {}, setTheme: () => {} })

function readInitialTheme() {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    /* localStorage is unavailable in cases like private browsing */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Synchronously write <html class="dark">: this must happen before setState, so code that reads CSS variables during this render
 * (e.g. useChartColors, the Monaco theme) already gets the new theme's values.
 */
function applyTheme(theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const initial = readInitialTheme()
    applyTheme(initial)
    return initial
  })

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const setTheme = useCallback((next) => {
    // Briefly enable a global color transition while switching and remove it afterwards, so normal hover transitions aren't slowed down
    const root = document.documentElement
    root.classList.add('theme-transition')
    applyTheme(next)
    setThemeState(next)
    window.setTimeout(() => root.classList.remove('theme-transition'), 320)
  }, [])

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
