import { AnimatePresence, motion } from 'motion/react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/context/ThemeContext'
import { useTranslation } from 'react-i18next'

export default function ThemeToggle() {
  const { t } = useTranslation()
  const { isDark, toggleTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 overflow-hidden"
      onClick={toggleTheme}
      aria-label={isDark ? t('切换浅色模式') : t('切换深色模式')}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'sun' : 'moon'}
          initial={{ y: -14, opacity: 0, rotate: -40 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 14, opacity: 0, rotate: 40 }}
          transition={{ duration: 0.2 }}
          className="flex"
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}
