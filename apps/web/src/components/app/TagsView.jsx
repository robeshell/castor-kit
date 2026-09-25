import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeftToLine, ArrowRightToLine, ChevronDown, RotateCw, X, XCircle } from 'lucide-react'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/AuthContext'
import { menuLabel } from '@/lib/menu-label'
import { cn } from '@/lib/utils'
import { STATIC_TITLES, findActiveMenu, flattenMenus } from '@/components/app/menu-tree'
import { useTagsView } from '@/context/TagsViewContext'
import { useTranslation } from 'react-i18next'

/** The actions shared by the right-click menu of a tab and the menu at the end of the bar */
function TabActions({ Item, Separator, tab }) {
  const { t } = useTranslation()
  const { tabs, close, closeOthers, closeRight, closeAll, refresh } = useTagsView()
  const index = tabs.findIndex((x) => x.path === tab.path)
  const closable = tabs.some((x) => !x.affix)
  return (
    <>
      <Item onSelect={() => refresh(tab.path)}>
        <RotateCw />
        {t('刷新')}
      </Item>
      <Separator />
      <Item disabled={tab.affix} onSelect={() => close(tab.path)}>
        <X />
        {t('关闭')}
      </Item>
      <Item disabled={!tabs.some((x) => !x.affix && x.path !== tab.path)} onSelect={() => closeOthers(tab.path)}>
        <ArrowLeftToLine />
        {t('关闭其他')}
      </Item>
      <Item disabled={!tabs.slice(index + 1).some((x) => !x.affix)} onSelect={() => closeRight(tab.path)}>
        <ArrowRightToLine />
        {t('关闭右侧')}
      </Item>
      <Item disabled={!closable} onSelect={closeAll}>
        <XCircle />
        {t('关闭全部')}
      </Item>
    </>
  )
}

/**
 * Tags view: one tab per opened page under the top bar (state in context/TagsViewContext.jsx).
 * Tabs are text only (third-level menus show no icon in the sidebar either, so icons here would be inconsistent).
 * Middle-click closes a tab; right-click opens the tab menu. Desktop only.
 */
export default function TagsView() {
  const { t } = useTranslation()
  const { menus } = useAuth()
  const { tabs, activePath, close } = useTagsView()
  const flat = flattenMenus(menus)
  const activeRef = useRef(null)

  // Keep the active tab visible when the bar overflows
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [activePath])

  const activeTab = tabs.find((tab) => tab.path === activePath)

  return (
    <div className="bg-background hidden h-10 shrink-0 items-center gap-2 border-b pr-2 pl-3 md:flex md:pl-4">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        <AnimatePresence initial={false}>
          {tabs.map((tab) => {
            const menu = findActiveMenu(flat, tab.path)
            const title = menu ? menuLabel(menu) : t(STATIC_TITLES[tab.path] ?? tab.path)
            const active = tab.path === activePath
            return (
              <motion.div
                key={tab.path}
                layout="position"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18 }}
                className="shrink-0"
              >
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <Link
                      ref={active ? activeRef : undefined}
                      to={tab.fullPath}
                      onAuxClick={(e) => {
                        if (e.button === 1 && !tab.affix) {
                          e.preventDefault()
                          close(tab.path)
                        }
                      }}
                      className={cn(
                        'group flex h-7 items-center gap-1 rounded-md pr-1.5 pl-2.5 text-[12.5px] whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                        tab.affix && 'pr-2.5',
                        active ? 'bg-brand-soft text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      <span className="max-w-40 truncate">{title}</span>
                      {tab.affix ? null : (
                        <span
                          role="button"
                          tabIndex={-1}
                          aria-label={t('关闭')}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            close(tab.path)
                          }}
                          className={cn(
                            'flex size-4 items-center justify-center rounded-sm transition-opacity hover:bg-foreground/10',
                            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                          )}
                        >
                          <X className="size-3" />
                        </span>
                      )}
                    </Link>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="min-w-40">
                    <TabActions Item={ContextMenuItem} Separator={ContextMenuSeparator} tab={tab} />
                  </ContextMenuContent>
                </ContextMenu>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
      {activeTab ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('标签页操作')}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <TabActions Item={DropdownMenuItem} Separator={DropdownMenuSeparator} tab={activeTab} />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
