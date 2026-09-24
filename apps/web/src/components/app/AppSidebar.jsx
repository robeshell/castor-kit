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
import { layoutSpring } from '@/lib/motion'
import { cn } from '@/lib/utils'
import BrandMark from '@/components/app/BrandMark'
import UserMenu from '@/components/app/UserMenu'
import { findActiveMenu, flattenMenus, isNavVisible, visibleChildren } from '@/components/app/menu-tree'

/*
 * 侧栏对齐规则（展开 256px / 折叠 48px 共用一条轴）：
 * - 左轴 16px：Logo、分组标题、菜单图标、头像的左边缘都在 x=16；子菜单文字与一级菜单文字同在 x=40
 * - 右边缘统一 x=248（一级、子级的底板同宽）
 * - 行高统一 36px、行距 2px；折叠时按钮 32px 居中于 48px 栏宽
 * - 选中 = 灰底 + 深色字 + 蓝色图标；悬停 = 更浅的灰，避免悬停项看起来比选中项更「选中」
 */
const ITEM = 'h-9 gap-2.5 text-sidebar-foreground hover:bg-black/[0.035] dark:hover:bg-white/[0.045] data-[state=open]:hover:bg-black/[0.035] dark:data-[state=open]:hover:bg-white/[0.045]'

function ActivePill() {
  // 选中项背后的滑动底板：跨菜单项切换时用 layoutId 做连续动画
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
        tooltip={menu.name}
        className={cn(ITEM, 'relative z-0 data-[active=true]:bg-transparent data-[active=true]:font-medium data-[active=true]:text-foreground')}
      >
        <Link to={menu.path || '#'} onClick={onNavigate}>
          {active ? <ActivePill /> : null}
          {createElement(resolveMenuIcon(menu), { className: cn(active && 'text-primary') })}
          <span>{menu.name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function MenuBranch({ menu, activeId, openIds, toggleOpen, onNavigate }) {
  const { state } = useSidebar()
  const children = visibleChildren(menu)
  const open = openIds.has(menu.id)
  // 折叠成图标栏时子菜单不可见：当前页在这个分组里，就把分组图标标成选中
  const holdsActive = state === 'collapsed' && children.some((c) => c.id === activeId)
  return (
    <Collapsible asChild open={open} onOpenChange={() => toggleOpen(menu.id)} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={menu.name} className={cn(ITEM, 'relative z-0')}>
            {holdsActive ? <ActivePill /> : null}
            {createElement(resolveMenuIcon(menu), { className: cn(holdsActive && 'text-primary') })}
            <span>{menu.name}</span>
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
                      <span>{child.name}</span>
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
  const { menus } = useAuth()
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  const flat = useMemo(() => flattenMenus(menus), [menus])
  const active = useMemo(() => findActiveMenu(flat, location.pathname), [flat, location.pathname])
  const [openIds, setOpenIds] = useState(() => new Set())
  const [seenActiveId, setSeenActiveId] = useState(null)

  // 路由切换时自动展开当前页的祖先分组，不收起用户手动展开的分组（渲染期派生，避免 effect 里 setState）
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
              {group.name}
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
