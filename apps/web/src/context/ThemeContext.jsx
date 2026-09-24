import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * 主题：light / dark，<html class="dark"> 切换（shadcn / Tailwind 约定）。
 * 偏好存 localStorage('theme')；没有存过则跟随系统。
 */
const ThemeContext = createContext({ theme: 'light', isDark: false, toggleTheme: () => {}, setTheme: () => {} })

function readInitialTheme() {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    /* 隐私模式等场景 localStorage 不可用 */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * 同步写 <html class="dark">：必须在 setState 之前完成，这样本次渲染里读取 CSS 变量的代码
 * （如 useChartColors、Monaco 主题）拿到的已经是新主题的值。
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
    // 切换时短暂开启全局颜色过渡，切完移除，避免平时的 hover 过渡被拖慢
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
