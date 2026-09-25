import { useEffect, useState } from 'react'
import { useMonaco } from '@monaco-editor/react'
import { useTheme } from '@/context/ThemeContext'

/**
 * Monaco theme follows the app's light/dark theme: based on the built-in vs / vs-dark, with editor background, line numbers, current line, etc.
 * read from CSS variables (matching the card background), redefined after the theme switches.
 *   const monacoTheme = useMonacoTheme()            // follow the app theme
 *   const monacoTheme = useMonacoTheme('dark')      // always dark (built-in vs-dark)
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
    // ThemeProvider toggles <html class="dark"> only in a parent effect, so wait a frame before reading the variables
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
