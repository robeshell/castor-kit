import { createElement, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAuth } from '@/context/AuthContext'
import { resolveMenuIcon } from '@/lib/menu-icons'
import { menuLabel } from '@/lib/menu-label'
import { layoutSpring } from '@/lib/motion'
import { cn } from '@/lib/utils'
import BrandMark from '@/components/app/BrandMark'
import UserMenu from '@/components/app/UserMenu'
import { findActiveMenu, flattenMenus, isNavVisible, visibleChildren } from '@/components/app/menu-tree'
import { useTranslation } from 'react-i18next'

/*
 * Sidebar alignment rules (expanded 256px / collapsed 48px share one axis):
 * - Left axis 16px: the left edges of the logo, group titles, menu icons and avatar are all at x=16; submenu text and top-level menu text are both at x=40
 * - Right edge is uniformly x=248 (top-level and child backgrounds have the same width)
 * - Row height is uniformly 36px with 2px spacing; when collapsed, the 32px button is centered in the 48px rail
 * - Selected = gray background + dark text + blue icon; hover = lighter gray, so a hovered item never looks more "selected" than the selected one
 */
const ITEM = 'h-9 gap-2.5 text-sidebar-foreground hover:bg-black/[0.035] dark:hover:bg-white/[0.045] data-[state=open]:hover:bg-black/[0.035] dark:data-[state=open]:hover:bg-white/[0.045]'

function ActivePill() {
  // Sliding background behind the selected item: uses layoutId for a continuous animation when switching between items
  return (
    <motion.span
      layoutId="sidebar-active-pill"
      transition={layoutSpring}
      className="bg-sidebar-accent absolute inset-0 -z-10 rounded-md"
    />
  )
}

function MenuLeaf({ menu, activeId, onNavigate }) {
  const active = menu.id === activeId
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={menuLabel(menu)}
        className={cn(ITEM, 'relative z-0 data-[active=true]:bg-transparent data-[active=true]:font-medium data-[active=true]:text-foreground')}
      >
        <Link to={menu.path || '#'} onClick={onNavigate}>
          {active ? <ActivePill /> : null}
          {createElement(resolveMenuIcon(menu), { className: cn(active && 'text-primary') })}
          <span>{menuLabel(menu)}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function MenuBranch({ menu, activeId, openIds, toggleOpen, onNavigate }) {
  const { state } = useSidebar()
  const children = visibleChildren(menu)
  const open = openIds.has(menu.id)
  // Submenus are hidden when collapsed to an icon rail: if the current page is in this group, mark the group icon as selected
  const holdsActive = state === 'collapsed' && children.some((c) => c.id === activeId)
  return (
    <Collapsible asChild open={open} onOpenChange={() => toggleOpen(menu.id)} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={menuLabel(menu)} className={cn(ITEM, 'relative z-0')}>
            {holdsActive ? <ActivePill /> : null}
            {createElement(resolveMenuIcon(menu), { className: cn(holdsActive && 'text-primary') })}
            <span>{menuLabel(menu)}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
          <SidebarMenuSub className="mr-0 gap-0.5 pr-0">
            {children.map((child) => {
              const active = child.id === activeId
              return (
                <SidebarMenuSubItem key={child.id}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={active}
                    className={cn(ITEM, 'relative z-0 pr-2.5 pl-[9px] data-[active=true]:bg-transparent data-[active=true]:font-medium data-[active=true]:text-foreground')}
                  >
                    <Link to={child.path || '#'} onClick={onNavigate}>
                      {active ? <ActivePill /> : null}
                      <span>{menuLabel(child)}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export default function AppSidebar() {
  // Subscribe to language changes: re-render menu names when the language switches (menuLabel reads i18n directly)
  useTranslation()
  const { menus } = useAuth()
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  const flat = useMemo(() => flattenMenus(menus), [menus])
  const active = useMemo(() => findActiveMenu(flat, location.pathname), [flat, location.pathname])
  const [openIds, setOpenIds] = useState(() => new Set())
  const [seenActiveId, setSeenActiveId] = useState(null)

  // On route change, auto-expand the current page's ancestor groups without collapsing groups the user expanded manually (derived during render to avoid setState in an effect)
  if (active && active.id !== seenActiveId) {
    setSeenActiveId(active.id)
    setOpenIds((prev) => {
      const next = new Set(prev)
      active.parents.forEach((p) => next.add(p.id))
      return next
    })
  }

  const toggleOpen = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const onNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }

  const roots = (menus || []).filter(isNavVisible)
  const leafRoots = roots.filter((m) => visibleChildren(m).length === 0)
  const groupRoots = roots.filter((m) => visibleChildren(m).length > 0)

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-2 pt-3 pb-1">
        <Link
          to="/"
          className="flex h-12 items-center rounded-md px-2 outline-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <BrandMark className="group-data-[collapsible=icon]:[&>div:last-child]:hidden" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {leafRoots.length > 0 ? (
          <SidebarGroup>
            <SidebarMenu className="gap-0.5">
              {leafRoots.map((menu) => (
                <MenuLeaf key={menu.id} menu={menu} activeId={active?.id} onNavigate={onNavigate} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
        {groupRoots.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel className="text-muted-foreground text-xs font-normal">
              {menuLabel(group)}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {visibleChildren(group).map((menu) =>
                visibleChildren(menu).length > 0 ? (
                  <MenuBranch
                    key={menu.id}
                    menu={menu}
                    activeId={active?.id}
                    openIds={openIds}
                    toggleOpen={toggleOpen}
                    onNavigate={onNavigate}
                  />
                ) : (
                  <MenuLeaf key={menu.id} menu={menu} activeId={active?.id} onNavigate={onNavigate} />
                ),
              )}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-2">
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
