# castor-kit 前台改造方案：Semi Design → shadcn/ui

> 状态：已完成（2026-09-25），验收结果见第 8 节。视觉方向已确认：简洁、动效丝滑、偏英文 SaaS 风格（Linear / Vercel / Stripe），
> 中性灰为底，**Ocean 渐变（blue → sky → cyan）**作为唯一强调色，渐变只做点缀，不用紫色。
> 参考设计稿：castor-kit admin redesign 画布（Overview / Users / Sign in 三屏）。

## 1. 目标与边界

- 重写 `apps/web` 的全部 UI：39 个页面 + 布局 + 登录 + 公共组件，移除 `@douyinfe/semi-ui` / `semi-icons`。
- **不变的部分**（保证前后端契约与工具链约定）：
  - 路由机制：菜单 `component` 字段 `<module>/<subdir>/<page>` → `src/modules/<module>/pages/<subdir>/<page>/index.jsx`（`import.meta.glob` 动态路由）
  - API 层：`src/shared/api/request.js`（CSRF / 401 跳转）与 `src/modules/*/api/*.js` 原样保留
  - `AuthContext`、`useCrudList`、`shared/utils/file.js`
  - 页面功能与交互流程：每个页面的查询条件、列、表单字段、导入导出、权限按钮与现状一致
- 文案语言：保持中文（菜单名、后端错误信息都来自后端，中英混排会更割裂）；风格按英文 SaaS 的克制与简洁来写。i18n 作为后续独立任务。
- 语言：保持 JavaScript（JSX），不在本次引入 TypeScript（改动面已足够大；TS 化另行安排）。

## 2. 技术选型

| 关注点 | 选型 |
|---|---|
| React | 升级到 React 19（shadcn 当前版本基于 19） |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite`）+ CSS 变量主题（亮/暗） |
| 组件 | shadcn/ui（new-york，Radix），源码在 `src/components/ui/`，JSX |
| 动效 | `motion`（页面切换、列表错峰入场、layoutId 指示条、数字滚动）+ `tw-animate-css`（弹层进出） |
| 图标 | `lucide-react`；菜单图标名（库里存的 Semi 名，如 `IconHome`）经 `lib/menu-icons.js` 映射 |
| 表格 | `@tanstack/react-table` 封装 `DataTable`（分页、选择、排序、空态、骨架） |
| 表单 | `react-hook-form`（shadcn Form 模式），规则与原 Semi Form rules 一致 |
| 提示 | `sonner`（统一 `toast`） |
| 命令面板 | `cmdk`（⌘K：跳转菜单、切换主题、退出登录） |
| 日期 | `react-day-picker` + `date-fns`（Calendar + Popover） |
| 字体 | Geist / Geist Mono（`@fontsource-variable`，本地打包，不走 CDN）+ 中文回退 PingFang SC / Microsoft YaHei |
| 保留 | echarts、three、monaco、dnd-kit、react-grid-layout、react-window、react-markdown |
| 替换 | `react-quill` → `react-quill-new`（React 19 兼容） |

## 3. 设计系统（tokens）

- 中性色：纯中性灰（不带蓝紫色偏，否则配蓝色强调会显脏）；内容区纯白 `#ffffff`、侧栏 `#fafafa`，卡片 1px 发丝边（`--border #ebebeb`）+ 极浅投影，不用重阴影；圆角 10–14px。
- 强调色（Ocean）：`--primary #2563eb`，渐变 `--brand-gradient: linear-gradient(135deg,#2563eb,#0284c7 55%,#22d3ee)`；
  带文字的元素用两段深渐变 `--brand-gradient-strong`（#2563eb → #0284c7），保证白字对比度。
- 渐变只用于：Logo、主按钮（带柔和辉光）、Tab 指示条、进度条、图表线与面积、在线头像环。内容区不铺大面积柔光/渐变底（浅色下会像污渍）；同一屏除主按钮外尽量不再出现第二处渐变。
- 数据可视化：按天计数用柱状图；稀疏数据不画趋势线（Sparkline 有效点 <2 自动不渲染）；失败状态用小号红色状态码提示，不整块染红。
- 状态：成功 green-500 小圆点、警告 amber-500、危险 red-500；徽章用浅底深字。
- 文案：不写没用的描述。页面标题下不放介绍语；描述只在带信息时写（数据、当前对象、约束与后果、快捷键、空状态下一步），复述标题 / 功能介绍 / 技术栈 / 宣传语一律不写。
- 字号：正文 13–14px，标题 24–26px / 600，数字 `tabular-nums`。
- 动效：交互 150–250ms ease-out；弹层 spring 曲线 `cubic-bezier(.32,.72,0,1)`；尊重 `prefers-reduced-motion`。
- 暗色：同一套 token 暗色版，`<html class="dark">` 切换。

## 4. 目录结构

```
apps/web/src/
├── components/
│   ├── ui/                 # shadcn 原子组件（button、input、dialog、sheet、table、select、…）
│   └── app/                # 应用外壳：AppLayout、AppSidebar、TopBar、CommandMenu、ThemeToggle、
│                           #           NotificationBell、UserMenu、PageTransition、ErrorPage、PrivateRoute
├── shared/
│   ├── components/         # 业务通用：PageHeader、DataTable、ListToolbar、ConfirmButton、FormDialog、
│   │                       #           ImportDialog、ExportDialog、FileUpload、ImageUpload、StatusBadge、
│   │                       #           EmptyState、TreeView、StatCard、Section、PermissionGate
│   ├── hooks/              # useCrudList（保留）、useIsMobile、useDebounce
│   ├── api/request.js      # 保留
│   └── utils/file.js       # 保留
├── lib/                    # utils(cn)、toast、menu-icons、motion 预设、format(日期/数字)
├── context/                # AuthContext（保留）、ThemeContext（改为 html.dark）
└── modules/**/pages/**/index.jsx   # 页面（路径不变）
```

## 5. 公共组件约定（页面必须复用，不各写一套）

- `PageHeader`：标题、描述、右侧操作区。
- `ListToolbar`：搜索框 + 筛选项 + 查询/重置；
- `DataTable`：列定义（TanStack），`loading` 骨架、空态、分页（total/page/perPage）、行选择、行 hover 操作。
- `FormDialog` / `FormSheet`：新建/编辑表单容器（react-hook-form），提交 loading、错误提示。
- `ConfirmButton`：删除等危险操作的确认弹层（替代 Popconfirm）。
- `ImportDialog` / `ExportDialog`：替代 ImportCsvModal / ExportFieldsModal，接口与原组件 props 对齐，只支持 csv/xlsx。
- `PermissionGate` / `useAuth().hasPermission`：按钮权限。
- `toast.success / toast.error`：统一反馈；后端 `{error}` 文案直接展示。

## 6. 实施步骤

1. **基础设施**：React 19、Tailwind v4、shadcn 初始化与原子组件、主题 tokens、字体、motion、ThemeContext 改造、`lib/*`。
2. **外壳**：AppLayout（侧边栏按 `my-menus` 动态生成、可折叠、移动端抽屉）、TopBar（面包屑、⌘K、通知、主题、用户菜单）、登录页、错误页、页面切换动效。
3. **公共组件**：第 5 节全部组件 + 单测。
4. **参考页**：首页 Overview（dashboard）与用户管理（users）作为标准实现。
5. **页面分组并行改写**（每组独立文件，互不冲突）：
   - A 系统管理：roles、menus、logs、dicts、scheduled_tasks、notifications、announcement_page、profile
   - B 组件中心·管理 1：list_page、stats_list_page、card_list_page、tree_list_page、dynamic_form_page
   - C 组件中心·管理 2：kanban_page、detail_tabs_page、gantt_page、advanced_table_page
   - D AI 与编辑器：ai_chat_page、ai_prompt_page、ai_sql_page、rich_text、code_editor、json_editor、markdown
   - E 可视化 / 创意 / 工具：dashboard_page、realtime_chart、heatmap、map_heatmap、particle、css_3d、globe、morphing、
     drag_layout、virtual_scroll、websocket、perf_monitor（内部画布/图表保留，外壳与控件换新，图表主题改为中性 + Ocean）
6. **工具链同步**：scaffold 生成的前端页面与 api 模板、`docs/templates/frontend`、verify、AGENTS/CLAUDE 规则（semi-mcp → shadcn）、skills、文档站前端章节。
7. **收尾**：删除 Semi 依赖与遗留 CSS、ESLint 清零、构建体积对比。

## 7. 验收

- `pnpm --filter @castor-kit/web build`、`test`、`lint` 全绿；`grep` 无 `@douyinfe`、无 `var(--semi-`。
- 浏览器逐页走查（亮/暗、桌面/移动宽度）：37 个菜单页 + 个人中心 + 登录 + 404/403，页面接口调用无失败、控制台无报错。
- 功能抽测：每个 CRUD 页至少一次新增/编辑/删除/搜索/分页；导入（含错误行回显）/导出/模板；上传与回读；AI 对话流式；WebSocket；看板拖拽；主题切换与 ⌘K。
- 工具链：scaffold 生成新模块 → verify 全绿 → 页面为新组件体系、可在菜单打开。

## 8. 验收结果（2026-09-25）

- web：`eslint .` 0 问题；`vitest` 22/22；`vite build` 通过；`@douyinfe`、`var(--semi-`、`react-quill`、`@/shared/styles`
  已由 `test/import-integrity.test.js` 守护（出现即失败）。依赖已移除 `@douyinfe/semi-ui`、`@douyinfe/semi-icons`、`react-quill`。
- api：`vitest` 430 通过 / 2 跳过；`pnpm verify` 全部检查通过（含 frontend build / frontend tests）。
- 浏览器走查：37 个菜单页 + 个人设置 + 404，在 1440 桌面宽与 375 手机宽各扫一遍——标题正确、无失败请求、控制台无报错、
  无页面级横向溢出；各页亮/暗色由改写时逐页目检。
- 功能抽测（各页改写时完成）：所有 CRUD 页的增删改查/搜索/分页；导入（含错误行下载）/导出/模板；看板鼠标与触屏拖拽并回读排序；
  高级表格行内编辑/撤销/批量操作；角色菜单树半选联动；定时任务立即执行与执行记录；WebSocket 经 dev 代理握手 101。
- 顺带修复的旧页面缺陷：logs 失败状态筛选值（`fail`→`failed`）与失败原因字段；动态表单编辑未加载 fields 导致保存清空；
  树形列表导出参数签名不匹配；提示词列表为空；SQL 错误读取；拖拽布局适配 react-grid-layout 2.x；性能监控重复 key；
  地图热力图改为调用接口；dev 环境 `/ws` 代理的 `changeOrigin` 导致握手被拒。

### 未覆盖的验收项

- 登录页与 403 未做实时走查（走查会话为 admin，退出会中断其它验证；admin 拥有全部权限，触发不到 403）；公告页亮色仅 DOM 校验、无截图。
- 第 6 节第 7 步的「构建体积对比」未做。

### 遗留（未在本次范围内处理）

- 开发库序列：`cc_detail_members`、`cc_gantt_tasks`、`cc_advanced_table_rows` 的演示数据是手写 ID 插入、未同步序列
  （只有 kanban / menus 做了同步），导致新建返回 500。本次已在开发库手动 `setval` 修正（未改任何行数据），
  但重新灌种子会复现；种子来源尚未定位。

- 后端：定时任务新建时 URL 校验失败统一返回 500（应为 400 并带原因），且新建/执行两处校验规则不一致；
  tree-list-page 更新未校验 `parent_id` 成环（前端已拦截）；菜单树搜索只匹配顶层。
- 共享组件可继续沉淀：可勾选树（父子联动/半选）、DataTable 树形行与右侧固定列、FormCombobox、取色字段、步骤表单弹窗、
  树选择器、可排序字段数组编辑器、勾选提示条、可由下拉菜单项打开的受控确认框。
