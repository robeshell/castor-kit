import {
  Activity,
  AppWindow,
  BarChart3,
  Bell,
  Box,
  Braces,
  Calendar,
  Code2,
  CreditCard,
  FileText,
  FolderOpen,
  Globe,
  GitBranch,
  Hexagon,
  Home,
  IdCard,
  Kanban,
  LayoutGrid,
  Layers,
  List,
  MapPin,
  Network,
  MessageSquare,
  Monitor,
  Newspaper,
  PenLine,
  PieChart,
  Send,
  Settings,
  Star,
  Terminal,
  Type,
  User,
} from 'lucide-react'

/**
 * Menu icons: the menus.icon field stores icon names in IconXxx form (e.g. IconHome), mapped here to lucide.
 * To add an icon: add a "name → lucide component" entry to SEMI_TO_LUCIDE (import on demand to avoid bundling the whole icon library);
 * unknown names fall back to List.
 */
const SEMI_TO_LUCIDE = {
  IconActivity: Activity,
  IconApps: AppWindow,
  IconArticle: Newspaper,
  IconBarChart: BarChart3,
  IconBell: Bell,
  IconBox: Box,
  IconBrackets: Braces,
  IconBranch: GitBranch,
  IconCalendar: Calendar,
  IconCode: Code2,
  IconComment: MessageSquare,
  IconCreditCard: CreditCard,
  IconDesktop: Monitor,
  IconEdit2: PenLine,
  IconFile: FileText,
  IconFolder: FolderOpen,
  IconFont: Type,
  IconGlobe: Globe,
  IconGridSquare: LayoutGrid,
  IconHexagon: Hexagon,
  IconHistogram: BarChart3,
  IconHome: Home,
  IconIdCard: IdCard,
  IconKanban: Kanban,
  IconLayers: Layers,
  IconList: List,
  IconMapPin: MapPin,
  IconOrg: Network,
  IconPieChartStroked: PieChart,
  IconSend: Send,
  IconSetting: Settings,
  IconStar: Star,
  IconTerminal: Terminal,
  IconUser: User,
}

const BY_CODE = {
  dashboard: Home,
  system: Settings,
}

export function resolveMenuIcon(menu) {
  if (!menu) return List
  return SEMI_TO_LUCIDE[menu.icon] || BY_CODE[menu.code] || List
}
