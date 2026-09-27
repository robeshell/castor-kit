import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_APPEARANCE, readAppearance, saveAppearance, type Accent, type Appearance } from '@/lib/appearance'

/**
 * Theme + appearance.
 * - Light / dark is toggled via <html class="dark"> (shadcn / Tailwind convention), stored in localStorage('theme');
 *   if never stored, follow the system.
 * - Appearance (accent, nav mode, sidebar variant, content width; options in lib/appearance.ts) is stored in
 *   localStorage('appearance'); the accent is applied as <html data-accent>.
 */
export type Theme = 'light' | 'dark'

export type ThemeContextValue = Appearance & {
  theme: Theme
  isDark: boolean
  toggleTheme: () => void
  setTheme: (next: Theme) => void
  /** Merge a partial update, e.g. setAppearance({ accent: 'violet' }) */
  setAppearance: (patch: Partial<Appearance>) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
  ...DEFAULT_APPEARANCE,
  setAppearance: () => {},
})

function readInitialTheme(): Theme {
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
function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

/** Same reasoning as applyTheme: the accent attribute must be on <html> before anything reads the variables */
function applyAccent(accent: Accent) {
  document.documentElement.dataset.accent = accent
}

/** Briefly enable a global color transition while switching and remove it afterwards, so normal hover transitions aren't slowed down */
function withColorTransition(apply: () => void) {
  const root = document.documentElement
  root.classList.add('theme-transition')
  apply()
  window.setTimeout(() => root.classList.remove('theme-transition'), 320)
}

export function ThemeProvider({ children }: { children?: ReactNode }) {
  const [theme, setThemeState] = useState(() => {
    const initial = readInitialTheme()
    applyTheme(initial)
    return initial
  })

  const [appearance, setAppearanceState] = useState(() => {
    const initial = readAppearance()
    applyAccent(initial.accent)
    return initial
  })

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  useEffect(() => saveAppearance(appearance), [appearance])

  const setTheme = useCallback((next: Theme) => {
    withColorTransition(() => applyTheme(next))
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme])

  /** Merge a partial update, e.g. setAppearance({ accent: 'violet' }) */
  const setAppearance = useCallback(
    (patch: Partial<Appearance>) => {
      const { accent } = patch
      if (accent && accent !== appearance.accent) withColorTransition(() => applyAccent(accent))
      setAppearanceState((prev) => ({ ...prev, ...patch }))
    },
    [appearance.accent],
  )

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme, setTheme, ...appearance, setAppearance }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
