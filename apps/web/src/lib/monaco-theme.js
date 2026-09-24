import { useEffect, useState } from 'react'
import { useMonaco } from '@monaco-editor/react'
import { useTheme } from '@/context/ThemeContext'

/**
 * Monaco 主题跟随应用亮/暗主题：以内置 vs / vs-dark 为底，编辑区背景、行号、当前行等
 * 从 CSS 变量读取（与卡片底色一致），主题切换后重新定义。
 *   const monacoTheme = useMonacoTheme()            // 跟随应用主题
 *   const monacoTheme = useMonacoTheme('dark')      // 固定深色（内置 vs-dark）
 *   <Editor theme={monacoTheme} … />
 */
function readVars() {
  const style = getComputedStyle(document.documentElement)
  const v = (name) => style.getPropertyValue(name).trim()
  return {
    card: v('--card'),
    muted: v('--muted'),
    mutedForeground: v('--muted-foreground'),
    foreground: v('--foreground'),
    border: v('--border'),
  }
}

const isHex = (value) => /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value || '')

function defineAppTheme(monaco, dark) {
  const c = readVars()
  const colors = {}
  if (isHex(c.card)) {
    colors['editor.background'] = c.card
    colors['editorGutter.background'] = c.card
    colors['minimap.background'] = c.card
  }
  if (isHex(c.muted)) colors['editor.lineHighlightBackground'] = c.muted
  if (isHex(c.border)) colors['editor.lineHighlightBorder'] = c.border
  if (isHex(c.mutedForeground)) colors['editorLineNumber.foreground'] = c.mutedForeground
  if (isHex(c.foreground)) colors['editorLineNumber.activeForeground'] = c.foreground
  const name = dark ? 'castor-dark' : 'castor-light'
  monaco.editor.defineTheme(name, { base: dark ? 'vs-dark' : 'vs', inherit: true, rules: [], colors })
  return name
}

export function useMonacoTheme(mode = 'auto') {
  const monaco = useMonaco()
  const { isDark } = useTheme()
  const [defined, setDefined] = useState(null)

  useEffect(() => {
    if (!monaco || mode !== 'auto') return undefined
    // ThemeProvider 在父级 effect 里才切换 <html class="dark">，等下一帧再读变量
    const frame = requestAnimationFrame(() => {
      const name = defineAppTheme(monaco, isDark)
      monaco.editor.setTheme(name)
      setDefined({ name, dark: isDark })
    })
    return () => cancelAnimationFrame(frame)
  }, [monaco, isDark, mode])

  if (mode === 'light') return 'vs'
  if (mode === 'dark') return 'vs-dark'
  if (defined && defined.dark === isDark) return defined.name
  return isDark ? 'vs-dark' : 'vs'
}
