import { createElement, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { motion } from 'motion/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/AuthContext'
import { resolveMenuIcon } from '@/lib/menu-icons'
import { menuLabel } from '@/lib/menu-label'
import { layoutSpring } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { findActiveMenu, firstPage, flattenMenus, isNavVisible, sectionOf, visibleChildren } from '@/components/app/menu-tree'
import { useTranslation } from 'react-i18next'

const TAB =
  'relative z-0 flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0'

function TabPill() {
  // Same sliding selection background as the sidebar, keyed separately so the two never animate into each other
  return <motion.span layoutId="top-nav-pill" transition={layoutSpring} className="bg-accent absolute inset-0 -z-10 rounded-md" />
}

function tabClass(active) {
  return cn(TAB, active ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground')
}

/** Nested dropdown items; branches become submenus. Like the sidebar, only the first level under a root shows icons */
function MenuItems({ menus, activeId, activePath, depth = 0 }) {
  return menus.map((menu) => {
    const children = visibleChildren(menu)
    const icon = depth === 0 ? createElement(resolveMenuIcon(menu), { className: cn(activePath.has(menu.id) && 'text-primary') }) : null
    if (children.length > 0) {
      return (
        <DropdownMenuSub key={menu.id}>
          <DropdownMenuSubTrigger className={cn('gap-2', activePath.has(menu.id) && 'font-medium')}>
            {icon}
            {menuLabel(menu)}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-44">
            <MenuItems menus={children} activeId={activeId} activePath={activePath} depth={depth + 1} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }
    return (
      <DropdownMenuItem key={menu.id} asChild className={cn(menu.id === activeId && 'font-medium')}>
        <Link to={menu.path || '#'}>
          {icon}
          {menuLabel(menu)}
        </Link>
      </DropdownMenuItem>
    )
  })
}

/**
 * Horizontal navigation in the top bar.
 * - mode="full" (top nav mode): every root; groups open a dropdown with the whole subtree
 * - mode="sections" (mixed mode): every root as a tab; a group tab jumps to its first page and the sidebar shows its menus
 */
export default function TopNav({ mode = 'full', className }) {
  useTranslation() // re-render menu names when the language switches
  const { menus } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const flat = useMemo(() => flattenMenus(menus), [menus])
  const active = useMemo(() => findActiveMenu(flat, location.pathname), [flat, location.pathname])
  const activePath = useMemo(() => new Set(active ? [...active.parents.map((p) => p.id), active.id] : []), [active])
  const section = sectionOf(active)
  const roots = (menus || []).filter(isNavVisible)

  return (
    <nav className={cn('flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]', className)}>
      {roots.map((root) => {
        const children = visibleChildren(root)
        const isActive = activePath.has(root.id)
        const icon = createElement(resolveMenuIcon(root), { className: cn(isActive && 'text-primary') })

        if (children.length === 0) {
          return (
            <Link key={root.id} to={root.path || '#'} className={tabClass(isActive)}>
              {isActive ? <TabPill /> : null}
              {icon}
              {menuLabel(root)}
            </Link>
          )
        }

        if (mode === 'sections') {
          const selected = section === root.id
          return (
            <button
              key={root.id}
              type="button"
              className={tabClass(selected)}
              onClick={() => {
                const page = firstPage(root)
                if (page && !selected) navigate(page.path)
              }}
            >
              {selected ? <TabPill /> : null}
              {createElement(resolveMenuIcon(root), { className: cn(selected && 'text-primary') })}
              {menuLabel(root)}
            </button>
          )
        }

        return (
          <DropdownMenu key={root.id}>
            <DropdownMenuTrigger className={cn(tabClass(isActive), 'data-[state=open]:text-foreground data-[state=open]:bg-accent/60')}>
              {isActive ? <TabPill /> : null}
              {icon}
              {menuLabel(root)}
              <ChevronDown className="text-muted-foreground size-3.5!" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8} className="min-w-48">
              <MenuItems menus={children} activeId={active?.id} activePath={activePath} />
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </nav>
  )
}
