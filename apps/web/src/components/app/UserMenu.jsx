import { useNavigate } from 'react-router-dom'
import { ChevronsUpDown, LogOut, Moon, Sun, UserRound } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'

export function UserAvatar({ name, className = 'size-8' }) {
  return (
    <span
      className={`bg-muted text-foreground ring-border flex shrink-0 items-center justify-center rounded-full text-xs font-medium ring-1 ${className}`}
    >
      {(name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function UserMenu() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const roleName = user?.roles?.[0]?.name || '成员'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="bg-background data-[state=open]:bg-sidebar-accent shadow-[0_0_0_1px_var(--sidebar-border)] group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none"
            >
              <UserAvatar name={user?.username} />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-medium">{user?.username}</span>
                <span className="text-muted-foreground truncate text-[11px]">{roleName}</span>
              </div>
              <ChevronsUpDown className="text-muted-foreground ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuLabel className="flex items-center gap-2.5 py-2 font-normal">
              <UserAvatar name={user?.username} />
              <div className="grid leading-tight">
                <span className="text-sm font-medium">{user?.username}</span>
                <span className="text-muted-foreground text-xs">{roleName}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => navigate('/profile')}>
                <UserRound />
                个人设置
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggleTheme}>
                {isDark ? <Sun /> : <Moon />}
                {isDark ? '切换浅色模式' : '切换深色模式'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
              <LogOut />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
