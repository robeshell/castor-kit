import { useNavigate } from 'react-router-dom'
import { ChevronsUpDown, LogOut, UserRound } from 'lucide-react'
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
import { roleName } from '@/lib/role-label'
import UserAvatar, { userDisplayName } from '@/shared/components/UserAvatar'
import { useTranslation } from 'react-i18next'

function MenuAvatar({ user, className }) {
  return <UserAvatar src={user?.avatar} name={userDisplayName(user)} className={className} />
}

function useUserMenu() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role = user?.roles?.[0]
  const roleText = role ? roleName(role) : t('成员')
  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }
  return { user, roleText, handleLogout }
}

/** Dropdown items shared by the sidebar footer menu and the compact top-bar menu */
function UserMenuItems({ user, roleText, onLogout }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <>
      <DropdownMenuLabel className="flex items-center gap-2.5 py-2 font-normal">
        <MenuAvatar user={user} />
        <div className="grid leading-tight">
          <span className="text-sm font-medium">{userDisplayName(user)}</span>
          <span className="text-muted-foreground text-xs">{roleText}</span>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <UserRound />
          {t('个人设置')}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onSelect={onLogout}>
        <LogOut />
        {t('退出登录')}
      </DropdownMenuItem>
    </>
  )
}

/** Avatar-only user menu for the top bar (used when the layout has no sidebar) */
export function UserMenuCompact() {
  const { t } = useTranslation()
  const { user, roleText, handleLogout } = useUserMenu()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={t('个人设置')} className="ml-1 flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <MenuAvatar user={user} className="size-7" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="end" sideOffset={8}>
        <UserMenuItems user={user} roleText={roleText} onLogout={handleLogout} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function UserMenu() {
  const { isMobile } = useSidebar()
  const { user, roleText, handleLogout } = useUserMenu()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="bg-background data-[state=open]:bg-sidebar-accent shadow-[0_0_0_1px_var(--sidebar-border)] group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none"
            >
              <MenuAvatar user={user} />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-medium">{userDisplayName(user)}</span>
                <span className="text-muted-foreground truncate text-[11px]">{roleText}</span>
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
            <UserMenuItems user={user} roleText={roleText} onLogout={handleLogout} />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
