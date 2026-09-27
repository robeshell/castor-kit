# castor-kit 前端设计系统

> `apps/web` 的 UI 体系：shadcn/ui + Tailwind CSS v4 + motion + lucide-react（JSX）。视觉方向：简洁、动效丝滑、偏英文 SaaS 风格（Linear / Vercel / Stripe），
> 中性灰为底，**Ocean 渐变（blue → sky → cyan）**作为默认强调色，渐变只做点缀。强调色可在「外观设置」切换为其他预设（`src/lib/appearance.js`），所有强调色 token 由 `--brand-from/via/to` 派生。
> 组件用法、常见页面模式与禁止事项见 `.claude/skills/shadcn-ui-skills/`；项目约定见 `AGENTS.md`「前端架构约定」。

## 1. 技术栈

| 关注点 | 选型 |
|---|---|
| React | React 19（JavaScript / JSX） |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite`）+ CSS 变量主题（亮/暗） |
| 组件 | shadcn/ui（new-york，Radix），源码在 `src/components/ui/`，JSX |
| 动效 | `motion`（页面切换、列表错峰入场、layoutId 指示条、数字滚动）+ `tw-animate-css`（弹层进出） |
| 图标 | `lucide-react`；菜单表存 lucide 图标名（如 `Users`、`Settings`），经 `lib/menu-icons.js` 解析 |
| 表格 | 公共组件 `DataTable`（分页、选择、空态、骨架） |
| 表单 | `react-hook-form`（shadcn Form 模式）+ `FormFields` |
| 提示 | `sonner`（统一 `toast`） |
| 命令面板 | `cmdk`（⌘K：跳转菜单、切换主题、退出登录） |
| 日期 | `react-day-picker` + `date-fns`（Calendar + Popover） |
| 字体 | Geist / Geist Mono（`@fontsource-variable`，本地打包，不走 CDN）+ 中文回退 PingFang SC / Microsoft YaHei |
| 其他 | echarts、three、monaco、dnd-kit、react-grid-layout、react-window、react-markdown、react-quill-new（富文本） |

## 2. 设计 tokens

tokens 定义在 `apps/web/src/index.css`（`:root` 亮色、`.dark` 暗色，`@theme inline` 暴露给 Tailwind）。页面只用语义色类（`bg-card`、`text-muted-foreground`、`bg-brand-soft` …），不写死十六进制颜色。

- 中性色：纯中性灰（不带蓝紫色偏，否则配蓝色强调会显脏）；内容区纯白 `#ffffff`、侧栏冷调浅灰 `#f7f8fa`，卡片 1px 发丝边（`--border #ebebeb`）+ 极浅投影，不用重阴影；圆角 10–14px。
- 强调色（Ocean）：`--primary` 取 `--brand-from`（默认 `#2563eb`），渐变 `--brand-gradient: linear-gradient(135deg, brand-from, brand-via 55%, brand-to)`（默认 #2563eb → #0284c7 → #22d3ee）；
  带文字的元素用两段深渐变 `--brand-gradient-strong`（brand-from → brand-via），保证白字对比度。
- 渐变只用于：Logo、主按钮（带柔和辉光）、Tab 指示条、进度条、图表线与面积、在线头像环。内容区不铺大面积柔光/渐变底（浅色下会像污渍）；同一屏除主按钮外尽量不再出现第二处渐变。
- 数据可视化：按天计数用柱状图；稀疏数据不画趋势线（Sparkline 有效点 <2 自动不渲染）；失败状态用小号红色状态码提示，不整块染红。
- 状态：成功 green、警告 amber、危险 red（`--success` / `--warning` / `--danger` 及对应 `-soft` 浅底）；徽章用浅底深字。
- 文案：不写没用的描述。页面标题下不放介绍语；描述只在带信息时写（数据、当前对象、约束与后果、快捷键、空状态下一步），复述标题 / 功能介绍 / 技术栈 / 宣传语一律不写。
- 加载态：一律用 `<Skeleton>`（已内置 200ms 延迟淡入 + 扫光，秒回时不出现），不要手写 `animate-pulse`；骨架形状对齐真实内容（表格用 DataTable 自带行骨架、指标卡传 `loading`），不要用 0 或「共 0 条」冒充加载中；页面代码加载由 AppLayout 的 Suspense 统一处理，页面内不要再包 Suspense。
- 多语言：简体中文 / English / 日本語，中文原文即 key；顶栏与登录页右上角切换，选择记在 localStorage，请求带 `Accept-Language`。约定见 AGENTS.md「多语言（i18n）与代码注释」。
- 字号：正文 13–14px，标题 24–26px / 600，数字 `tabular-nums`。
- 动效：交互 150–250ms ease-out；弹层 spring 曲线 `cubic-bezier(.32,.72,0,1)`；尊重 `prefers-reduced-motion`。
- 暗色：同一套 token 暗色版，`<html class="dark">` 切换。

## 3. 目录结构

```
apps/web/src/
├── components/
│   ├── ui/                 # shadcn 原子组件（button、input、dialog、sheet、table、select、…）
│   └── app/                # 应用外壳：AppLayout、AppSidebar、TopBar、TopNav、TagsView、CommandMenu、ThemeToggle、
│                           #           AppearanceMenu、LanguageSwitcher、NotificationBell、UserMenu、StatusPages、PrivateRoute
├── shared/
│   ├── components/         # 业务通用：PageHeader、Filters、DataTable、RowActions、ConfirmAction、FormDialog、FormFields、
│   │                       #           data-transfer/（ImportDialog、ExportDialog）、upload/、StatusBadge、EmptyState、
│   │                       #           TreeView、CheckableTree、TreeSelect、StatCard、Panel、SegmentedTabs …
│   ├── hooks/              # useCrudList、useIsMobile、useDebouncedValue、useDictOptions …
│   └── api/request.js      # axios 封装（CSRF、401 跳转、响应 unwrap）
├── lib/                    # utils(cn)、toast、menu-icons、motion 预设、format(日期/数字)、appearance、chart-theme
├── context/                # AuthContext、ThemeContext（html.dark）、TagsViewContext
├── i18n/                   # i18next 初始化与日期 locale
└── modules/**/pages/**/index.jsx   # 页面（由 App.jsx 的 import.meta.glob 动态路由）
```

## 4. 公共组件约定（页面必须复用，不各写一套）

组件都在 `apps/web/src/shared/components/`，完整用法见 `.claude/skills/shadcn-ui-skills/COMPONENTS.md`。

- `PageHeader`：标题 + 右侧操作区（description 只放数据类信息）。
- `Filters`（`FilterBar` / `SearchInput` / `FilterSelect`）：搜索框 + 筛选项 + 查询/重置。
- `DataTable`：列定义 `{ key, title, dataIndex, render, … }`；`loading` 骨架、空态、分页（total/page/perPage）、行选择。
- `FormDialog` / `FormSheet` + `FormFields`：新建/编辑表单容器（react-hook-form），提交 loading、错误提示。
- `ConfirmAction`：删除等危险操作的确认弹层；`RowActions`：行操作。
- `data-transfer/ImportDialog` / `ExportDialog`：导入导出，只支持 csv/xlsx。
- `useAuth().hasPermission(code)`：按钮权限（`@/context/AuthContext`）。
- `toast.success / toast.error / toast.apiError`（`@/lib/toast`）：统一反馈；后端 `{error}` 文案直接展示。

只用 `@/components/ui/*`、`@/shared/components/*`、lucide-react 与 Tailwind 语义色类；不引入其他 UI 组件库（antd、MUI 等）。
