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
 * 菜单图标：menus.icon 字段存的是 IconXxx 形式的图标名（如 IconHome），这里映射到 lucide。
 * 新增图标：在 SEMI_TO_LUCIDE 里加一条「名称 → lucide 组件」映射（按需导入，避免把整个图标库打进包）；
 * 未知名称回退为 List。
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
