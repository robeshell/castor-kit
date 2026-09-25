import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Moon, Sun, UserRound } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { resolveMenuIcon } from '@/lib/menu-icons'
import { menuLabel } from '@/lib/menu-label'
import { flattenMenus, navigablePages } from '@/components/app/menu-tree'
import { useTranslation } from 'react-i18next'

/** ⌘K 命令面板：跳转页面、切换主题、个人设置、退出登录 */
export default function CommandMenu({ open, onOpenChange }) {
  const { t } = useTranslation()
  const { menus, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  const pages = useMemo(() => navigablePages(flattenMenus(menus)), [menus])
  const groups = useMemo(() => {
    const map = new Map()
    pages.forEach((page) => {
      const label = page.parents.length ? page.parents.map((p) => menuLabel(p)).join(' / ') : t('常用')
      if (!map.has(label)) map.set(label, [])
      map.get(label).push(page)
    })
    return Array.from(map.entries())
  }, [pages, t])

  const run = (fn) => {
    onOpenChange(false)
    fn()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t('搜索')} description={t('跳转页面或执行操作')}>
      <CommandInput placeholder={t('搜索页面或操作…')} />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>{t('没有匹配的结果')}</CommandEmpty>
        {groups.map(([label, items]) => (
          <CommandGroup key={label} heading={label}>
            {items.map((page) => {
              const Icon = resolveMenuIcon(page)
              return (
                <CommandItem
                  key={page.id}
                  value={`${menuLabel(page)} ${page.name} ${page.path} ${label}`}
                  onSelect={() => run(() => navigate(page.path))}
                >
                  <Icon />
                  {menuLabel(page)}
                  <CommandShortcut className="font-mono text-[11px] tracking-normal">{page.path}</CommandShortcut>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading={t('操作')}>
          <CommandItem value={`toggle theme ${t('切换深色模式')} ${t('切换浅色模式')}`} onSelect={() => run(toggleTheme)}>
            {isDark ? <Sun /> : <Moon />}
            {isDark ? t('切换浅色模式') : t('切换深色模式')}
          </CommandItem>
          <CommandItem value={`profile ${t('个人设置')}`} onSelect={() => run(() => navigate('/profile'))}>
            <UserRound />
            {t('个人设置')}
          </CommandItem>
          <CommandItem
            value={`logout ${t('退出登录')}`}
            onSelect={() =>
              run(async () => {
                await logout()
                navigate('/login')
              })
            }
          >
            <LogOut />
            {t('退出登录')}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
