# 组件示例

登录后，“组件示例中心”菜单下有 36 个示例页面，分为六组：页面模板、组件、数据可视化、AI 应用、编辑器 / 低代码、工程 / 工具类。组件示例中心是开发者和 AI 智能体照着写的参考：每个页面都严格遵循项目的前端规范。每种页面模式都有一个页面作为它的参考实现，每组公共组件都有一个页面演示它们的用法。要做卡片列表或看板，就从对应的页面模板开始；要用 `DataTable` 或上传字段，就到[组件](#components)里查。

页面源码位于 `apps/web/src/modules/component_center/pages/<分组目录>/<页面>/index.tsx`，每个页面顶部的文档注释写明了适用场景和值得照抄的写法。带后端接口的示例对应 `apps/api/src/modules/component-center/` 下的模块。

## 页面模板

分组目录 `patterns/`。十个页面通过同一个共享接口操作同一份演示数据（见[下文](#shared-demo-api)）。

| 模式 | 路由 | 展示内容 | 参考目录 |
|---|---|---|---|
| 标准列表 | `/component-center/patterns/standard-list` | 普通的 CRUD 资源：分类 / 状态 / 启用筛选，带分页和行选择的表格，新建 / 编辑弹窗，删除，导入导出（导出选中行或全部）。它是 `pnpm scaffold` 的生成结果加上筛选，结构与用户管理页相同 | `patterns/demo_record_page` |
| 卡片列表 | `/component-center/patterns/card-list` | 把标准列表的表格换成响应式卡片网格：封面图（上传到文件中心，缺失时显示占位图）、分类 / 状态徽标、标签、负责人；加载时显示骨架卡片，无数据时显示空状态 | `patterns/card_list_page` |
| 树形列表 | `/component-center/patterns/tree-list` | 按 `parent_id` 嵌套的记录：左侧是整棵树（在服务端搜索，保留每个匹配项的上级），右侧表格显示选中记录的下级，带面包屑；在同级之间上移 / 下移，上级选择器会排除记录自身的下级 | `patterns/tree_list_page` |
| 统计列表 | `/component-center/patterns/stats-list` | 表格上方是指标卡（记录数、金额、数量、完成率）、分类环形图和状态堆叠条；统计和表格使用同一组筛选条件，每次写操作后两者一起刷新 | `patterns/stats_list_page` |
| 详情页 | `/component-center/patterns/detail` | 单条记录的详情：左侧选择记录，右侧是带关键信息和编辑 / 删除的头部，下面分标签页（概览、下级记录、标签与扩展字段）；当前记录写在 URL 里（`?id=`） | `patterns/detail_page` |
| 分步表单 | `/component-center/patterns/step-form` | 整页的新建向导：各步骤共用一个表单，点“下一步”时校验当前步骤，最后一步汇总核对（可跳回各步骤修改），提交后显示成功状态 | `patterns/step_form_page` |
| 动态表单 | `/component-center/patterns/dynamic-form` | 固定字段加上用户可增删的扩展字段（文本 / 数字 / 布尔 / 日期），保存在记录的 jsonb 字段 `extra` 中 | `patterns/dynamic_form_page` |
| 看板 | `/component-center/patterns/kanban` | 列是状态值（待办 / 进行中 / 已完成 / 已归档）；卡片可在列内和跨列拖拽（dnd-kit），乐观更新，只发一次排序请求，失败时回滚；“已归档”列收起为窄栏 | `patterns/kanban_page` |
| 甘特图 | `/component-center/patterns/gantt` | 按工作分解顺序（`parent_id` 层级，可折叠）把记录排在时间轴上：日 / 周刻度、周末底色、今日线，上级显示为汇总条，末级显示为进度条；点击任务条即可编辑 | `patterns/gantt_page` |
| 高级表格 | `/component-center/patterns/advanced-table` | 直接在表格里处理数据：服务端排序、行内编辑（可撤销）、勾选行后批量修改（状态 / 负责人 / 启用）和批量删除、列显示设置 | `patterns/advanced_table_page` |

各页面共用的选项（分类、状态的名称与徽标色调）在 `patterns/demo-record-options.ts`。单个公共组件怎么用，见[组件](#components)。

### 从页面模板开始做功能 {#from-a-pattern}

`pnpm scaffold` 生成的页面总是标准列表。功能更适合别的展现方式时，照常生成模块（后端、菜单、迁移、带类型的 API 文件），再照着对应的模板页面重写页面，并补上该模板依赖的后端部分：

| 功能需要 | 参照 | 需补的后端（见[共享的演示接口](#shared-demo-api)） |
|---|---|---|
| 用卡片代替表格行 | 卡片列表 | 脚手架接口之外无需新增 |
| 按上级嵌套的记录 | 树形列表 | 树接口、`parent_id` 筛选、按 `sort_order` 排序、删除 / 移动校验 |
| 列表上方的统计 | 统计列表 | 读取与列表相同筛选条件的统计接口 |
| 每条记录一个带标签页的页面 | 详情页 | 脚手架接口之外无需新增 |
| 分步填写的长表单 | 分步表单 | 脚手架接口之外无需新增 |
| 用户自定义的扩展字段 | 动态表单 | 一个 jsonb 列 |
| 在状态之间拖动卡片 | 看板 | 带独立排序列的排序接口 |
| 时间轴上的日期区间 | 甘特图 | 日期区间与进度列 |
| 排序、行内编辑、批量操作 | 高级表格 | 可排序字段、批量更新 / 删除接口 |

[AGENTS.md](https://github.com/robeshell/castor-kit/blob/main/AGENTS.md) 的「Page patterns (which page to copy)」一节有同样的表，并列出要参照的 service 与 repository 函数，因此 AI 助手会自己选对页面：描述功能（「做一个工单看板」），它就会从看板页面开始。

### 共享的演示接口 {#shared-demo-api}

十个页面模板没有各自的后端，而是共用一个模块 `apps/api/src/modules/component-center/demo-record` 和一张表 `demo_records`，接口前缀为 `/api/admin/component-center/demo-records`：

| 接口 | 使用方 |
|---|---|
| `GET /demo-records`（筛选、分页、排序）、`GET /demo-records/{id}` | 所有页面 |
| `POST` / `PUT /{id}` / `DELETE /{id}` | 新建、编辑、删除（还有下级的记录不能删除） |
| `GET /demo-records/tree` | 树形列表、上级选择器 |
| `GET /demo-records/stats` | 统计列表：合计、按状态和按分类的数量，筛选条件与列表相同 |
| `POST /demo-records/batch-update`、`POST /demo-records/batch-delete` | 高级表格 |
| `PUT /demo-records/reorder` | 树形列表（`sort_order`）、看板（`board_order` 和 `status`） |
| `POST /demo-records/export`、`GET /demo-records/template`、`POST /demo-records/import` | 标准列表 |

除了通用字段（`name`、`code`、`category`、`status`、`owner`、`priority`、`is_active`、`description`），每种模式还各用几个字段：`parent_id` + `sort_order`（树形）、`board_order`（看板卡片顺序，和树形的顺序分开）、`amount` + `quantity`（统计）、`start_date` / `end_date` / `progress`（甘特图）、`cover` + `tags`（卡片）、`extra`（动态表单）。`status` 取值为 `todo` / `in_progress` / `done` / `archived`，`category` 取值为 `product` / `design` / `engineering` / `marketing` / `operations`。

权限属于“页面模板”目录（菜单编码 `cc_patterns`），而不是某个页面：目录下的按钮 `cc_patterns_add` / `_edit` / `_delete` / `_export` / `_import` 控制写操作，拥有该目录或其下任一页面的权限即可读取（见模块 `schema.ts` 中的 `DEMO_RECORD_VIEW_CODES`）。详见 [权限 RBAC](/zh/guide/rbac#权限编码)。[演示模式](/zh/reference/configuration#公开演示)下组件示例仍可写入，演示记录会按周期从 `apps/api/src/demo/fixtures.ts` 恢复。

## 组件 {#components}

分组目录 `components/`。页面模板展示的是整个页面，这组页面展示的是 `apps/web/src/shared/components/` 里每个公共组件怎么用：每个示例都是在页面上实时渲染的真实代码，点一下就能看到它的完整源码（语法高亮，可一键复制），另有一张组件关键属性的表格。使用公共组件前先来这里查。数据全部是模拟数据，也没有按钮权限要分配：这些页面没有自己的后端（上传页会把文件存进真实的文件中心）。

| 页面 | 路由 | 涵盖的组件 |
|---|---|---|
| 数据表格 | `/component-center/components/data-table` | `DataTable`（列定义、自定义单元格、勾选行与批量操作栏、分页、加载和空状态）、`RowActions`、`ConfirmAction` |
| 表单 | `/component-center/components/forms` | `FormFields` 中基于 react-hook-form 的字段（`FormInput`、`FormSelect`、`FormDate`、`FormTreeSelect`、`FormFileUpload`、`FormCustom` 等）和 `FormGrid`；`FormDialog`、`FormSheet`，以及只读的 `DetailSheet` / `DescriptionList` |
| 筛选 | `/component-center/components/filters` | `FilterBar` 与 `SearchInput` / `FilterSelect`、`SegmentedTabs` |
| 选择器 | `/component-center/components/pickers` | 单独使用（受控的 `value` + `onChange`）的 `MultiSelect`、`TagInput`、`DatePicker` / `DateTimePicker`、`TreeSelect` |
| 树 | `/component-center/components/trees` | `TreeView`（选中、展开、自定义行、过滤）、`CheckableTree`（父子联动勾选，放在表单中） |
| 上传 | `/component-center/components/uploads` | `FileUpload`、`ImageUpload`、`AvatarUpload`、`FileIdUpload`，上传到文件中心 |
| 导入导出 | `/component-center/components/import-export` | `ImportDialog`（导入成功与失败的行）和 `ExportDialog`，接的是模拟的处理函数 |
| 反馈 | `/component-center/components/feedback` | `StatusBadge`、`EmptyState`、`ConfirmAction`、`toast`（`@/lib/toast`）、`Skeleton` 加载占位的写法 |
| 数据展示 | `/component-center/components/data-display` | `StatCard`（含 `CountUp` / `Sparkline`）、`Chart`（跟随主题配色的 ECharts）、`Panel`、`PageHeader`、`UserAvatar` |
| Markdown | `/component-center/components/markdown` | `MarkdownView` |
| 条件构建器 | `/component-center/components/condition-builder` | `ConditionBuilder`：由字段 / 运算符 / 值组成的条件，用 AND / OR 组合，还可以加条件组；它的值是普通 JSON，可直接保存或传给接口（示例：过滤表格数据、在表单中保存查询、单层与只读） |

每个页面位于 `components/<分组>_page/`：每个示例是 `examples/` 下的一个独立文件，页面把它导入两次，一次作为组件用于实时预览，一次用 Vite 的 `?raw` 取得下方显示的源码，所以预览和代码不会对不上；属性表格在页面的 `props.ts` 中。布局组件（`ShowcasePage`、`ShowcaseSection`、`Example`、`PropsTable`、`CodeBlock`）在 `apps/web/src/modules/component_center/showcase/`。要新增页面或示例，按 [AGENTS.md](https://github.com/robeshell/castor-kit/blob/main/AGENTS.md) 的 “Component showcase pages” 一节来做；示例文件没有按两种方式导入时，会有测试报错。

## 数据可视化

分组目录 `dataviz/`，基于 ECharts，图表颜色通过 `useChartColors()` 跟随主题与强调色。

| 页面 | 路由 | 说明 |
|---|---|---|
| 数据大屏 | `/component-center/dashboard-page` | 多个图表与事件流组成的综合大屏 |
| 实时折线图 | `/component-center/dataviz/realtime-chart` | 持续滚动更新的传感器曲线（纯前端） |
| 热力日历图 | `/component-center/dataviz/heatmap` | 年度日历热力图与小时 × 星期热力图（纯前端） |
| 流量转化分析 | `/component-center/dataviz/traffic-flow` | 桑基图展示访问来源 → 落地页 → 结果的流向，旁边是从访问到支付的转化漏斗 |

## AI 应用

分组目录 `ai/`，需要在「系统设置」的「AI」页签配置模型服务，见 [配置项](/zh/reference/configuration#ai-模型)。

| 页面 | 路由 | 说明 |
|---|---|---|
| AI 对话 | `/component-center/ai/chat` | 流式对话界面（Vercel AI SDK `useChat` + AI Elements） |
| AI 提示词工坊 | `/component-center/ai/prompt` | 提示词模板库，提取模板变量并实时预览 |
| AI 数据查询 | `/component-center/ai/sql` | 用自然语言生成 SQL，在只读连接上执行并展示结果与图表 |

::: tip AI 数据查询的安全边界
查询在独立的只读连接上执行，结果行数有上限，并过滤权限、日志等敏感表。生产环境必须配置指向只读账号的 `AI_SQL_DATABASE_URL`，见 [部署指南](/zh/deploy/)。
:::

## 编辑器 / 低代码

分组目录 `editor/`。

| 页面 | 路由 | 说明 |
|---|---|---|
| 富文本编辑器 | `/component-center/editor/rich-text` | 基于 react-quill-new |
| 代码编辑器 | `/component-center/editor/code` | 基于 Monaco，可切换语言，主题默认跟随应用 |
| JSON 编辑器 | `/component-center/editor/json` | JSON 编辑与树形预览 |
| Markdown 预览 | `/component-center/editor/markdown` | 左侧编辑、右侧实时预览 |

## 工程 / 工具类

分组目录 `devtools/`。

| 页面 | 路由 | 说明 |
|---|---|---|
| 拖拽布局 | `/component-center/devtools/drag-layout` | 可拖拽、可缩放的网格布局，布局保存在浏览器本地 |
| 虚拟滚动列表 | `/component-center/devtools/virtual-scroll` | 基于 react-window 渲染大量数据行 |
| WebSocket 通信 | `/component-center/devtools/websocket` | 连接后端 `/ws/devtools`，演示消息收发与回显 |
| 性能监控面板 | `/component-center/devtools/perf-monitor` | 通过 `/ws/devtools` 每秒接收服务器 CPU、内存、磁盘、网络指标 |

::: info WebSocket 与反向代理
WebSocket 和性能监控页面依赖 `/ws/devtools`。部署在反向代理后面时，需要为 `/ws` 配置 WebSocket 转发，见 [部署指南](/zh/deploy/#反向代理与-https)。
:::

## 系统管理

除组件示例外，“系统管理”下是脚手架自带的业务功能，按“组织权限”（用户、角色、部门）、“安全审计”（在线用户、日志）、“系统配置”（系统设置、菜单、字典、定时任务）、“内容消息”（文件、通知、公告）四组排列：

| 页面 | 路由 | 说明 |
|---|---|---|
| 用户管理 | `/system/users` | 用户增删改、分配角色、启用 / 停用、导入导出（标准列表页的参考实现） |
| 角色权限 | `/system/roles` | 角色管理、菜单 / 按钮授权与数据范围 |
| 部门管理 | `/system/departments` | 部门树：新增下级、编辑、上下移动；用户归属与数据权限的基础 |
| 文件管理 | `/system/files` | 文件中心里的全部文件：预览、下载、查看是否被使用、删除未使用的文件 |
| 在线用户 | `/system/sessions` | 当前登录的会话，可强制下线（见 [账号安全与系统设置](/zh/guide/security)） |
| 系统设置 | `/system/settings` | 两步验证、找回密码等功能开关，密码规则、会话有效期与限流参数 |
| 菜单管理 | `/system/menus` | 菜单树管理 |
| 日志管理 | `/system/logs` | 操作日志与登录日志 |
| 数据字典 | `/system/dicts` | 维护字典数据，并为下拉选项提供数据源 |
| 定时任务 | `/system/scheduled-tasks` | 按 cron 定时调用 HTTP 地址，查看执行记录 |
| 消息通知 | `/system/notifications` | 站内通知 |
| 公告管理 | `/system/announcements` | 公告发布与管理 |

另外还有首页（`/dashboard`）和个人设置页（`/profile`：查看账号与最后登录，修改昵称 / 邮箱 / 手机 / 头像和密码）。
