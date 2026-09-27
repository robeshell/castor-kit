import {
  Activity,
  AppWindow,
  BarChart3,
  Bell,
  Box,
  Braces,
  Calendar,
  ChartColumn,
  ChartGantt,
  Code2,
  CreditCard,
  FileText,
  FolderOpen,
  FormInput,
  GitBranch,
  Globe,
  Hexagon,
  Home,
  IdCard,
  Inbox,
  Kanban,
  KeyRound,
  Layers,
  LayoutGrid,
  List,
  ListOrdered,
  ListTree,
  MapPin,
  MessageSquare,
  Monitor,
  Network,
  Newspaper,
  PenLine,
  PieChart,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Table2,
  Terminal,
  Type,
  User,
  Users,
  Webhook,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

/**
 * Menu icons: menus.icon stores a lucide icon name (e.g. Home, Users), resolved here to the component.
 * To offer another icon, import it above and add it to MENU_ICONS (named imports keep the bundle small);
 * unknown names fall back to List.
 */
export const MENU_ICONS = {
  Activity,
  AppWindow,
  BarChart3,
  Bell,
  Box,
  Braces,
  Calendar,
  ChartColumn,
  ChartGantt,
  Code2,
  CreditCard,
  FileText,
  FolderOpen,
  FormInput,
  GitBranch,
  Globe,
  Hexagon,
  Home,
  IdCard,
  Inbox,
  Kanban,
  KeyRound,
  Layers,
  LayoutGrid,
  List,
  ListOrdered,
  ListTree,
  MapPin,
  MessageSquare,
  Monitor,
  Network,
  Newspaper,
  PenLine,
  PieChart,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Table2,
  Terminal,
  Type,
  User,
  Users,
  Webhook,
  Workflow,
}

const BY_CODE: Partial<Record<string, LucideIcon>> = {
  dashboard: Home,
  system: Settings,
}

/** The menu fields the icon is resolved from */
export interface MenuIconSource {
  icon?: string | null
  code?: string | null
}

const ICONS_BY_NAME: Partial<Record<string, LucideIcon>> = MENU_ICONS

export function resolveMenuIcon(menu: MenuIconSource | null | undefined): LucideIcon {
  if (!menu) return List
  return ICONS_BY_NAME[menu.icon ?? ''] || BY_CODE[menu.code ?? ''] || List
}
