# 组件示例

登录后，“组件示例中心”菜单下有 28 个示例页面，按六个分组组织。它们都遵循项目的前端规范，可以直接作为新页面的参考或起点。

页面源码位于 `apps/web/src/modules/component_center/pages/<分组目录>/<页面>/index.jsx`，带后端接口的示例对应 `apps/api/src/modules/component-center/` 下的模块。

## 管理系统

分组目录 `admin/`，均带后端接口与数据表。

| 页面 | 路由 | 说明 |
|---|---|---|
| 列表页 | `/component-center/list-page` | 功能最完整的 CRUD 列表：筛选、分页、增删改、导入导出、图片与文件上传 |
| 统计列表页 | `/component-center/stats-list-page` | 列表上方配指标卡和分类分布、发布状态图表，新建使用分步表单 |
| 卡片列表页 | `/component-center/card-list-page` | 以卡片网格展示记录，支持增删改 |
| 树形列表页 | `/component-center/tree-list-page` | 左侧树、右侧详情，支持调整父节点，带成环校验 |
| 动态表单页 | `/component-center/dynamic-form-page` | 基础信息加可增减的动态字段子表 |
| 拖拽看板页 | `/component-center/admin/kanban` | 看板列与卡片的拖拽排序，支持 WIP 限制 |
| 详情标签页 | `/component-center/admin/detail-tabs` | 左侧成员列表，右侧分标签页展示详情 |
| 甘特图页 | `/component-center/admin/gantt` | 项目任务的甘特图排期 |
| 高级表格页 | `/component-center/admin/advanced-table` | 行内编辑、列设置、拖拽排序、批量操作、固定操作列 |

## 数据可视化

分组目录 `dataviz/`，基于 ECharts，图表颜色通过 `useChartColors()` 跟随主题与强调色。

| 页面 | 路由 | 说明 |
|---|---|---|
| 数据大屏 | `/component-center/dashboard-page` | 多个图表与事件流组成的综合大屏 |
| 实时折线图 | `/component-center/dataviz/realtime-chart` | 持续滚动更新的传感器曲线（纯前端） |
| 热力日历图 | `/component-center/dataviz/heatmap` | 年度日历热力图与小时 × 星期热力图（纯前端） |
| 地图热力图 | `/component-center/dataviz/map-heatmap` | 中国地图省份热力与 Top 10 排行，地图数据随仓库提供 |

## 3D / 创意

分组目录 `creative/`，纯前端页面。

| 页面 | 路由 | 说明 |
|---|---|---|
| 粒子连线动画 | `/component-center/creative/particle` | Canvas 粒子连线效果，默认配色取自当前强调色 |
| CSS 3D 卡片 | `/component-center/creative/css-3d` | 悬停翻转、自旋立方体、视差跟随等纯 CSS 3D 效果 |
| Three.js 地球 | `/component-center/creative/globe` | Three.js 渲染的 3D 地球，场景配色跟随强调色 |
| 粒子形态变换 | `/component-center/creative/morphing` | WebGL 粒子在多种形态之间变换 |

## AI 应用

分组目录 `ai/`，需要配置 OpenAI 兼容接口（`AI_API_BASE`、`AI_API_KEY`、`AI_MODEL`），见 [配置项](/reference/configuration)。

| 页面 | 路由 | 说明 |
|---|---|---|
| AI 对话 | `/component-center/ai/chat` | 流式（SSE）对话界面 |
| AI 提示词工坊 | `/component-center/ai/prompt` | 提示词模板库，提取模板变量并实时预览 |
| AI 数据查询 | `/component-center/ai/sql` | 用自然语言生成 SQL，在只读连接上执行并展示结果与图表 |

::: tip AI 数据查询的安全边界
查询在独立的只读连接上执行，结果行数有上限，并过滤权限、日志等敏感表。生产环境必须配置指向只读账号的 `AI_SQL_DATABASE_URL`，见 [部署指南](/deploy/)。
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
WebSocket 和性能监控页面依赖 `/ws/devtools`。部署在反向代理后面时，需要为 `/ws` 配置 WebSocket 转发，见 [部署指南](/deploy/#反向代理与-https)。
:::

## 系统管理

除组件示例外，“系统管理”下是脚手架自带的业务功能：

| 页面 | 路由 | 说明 |
|---|---|---|
| 用户管理 | `/system/users` | 用户增删改、分配角色、导入导出（标准列表页的参考实现） |
| 角色权限 | `/system/roles` | 角色管理与菜单 / 按钮授权 |
| 菜单管理 | `/system/menus` | 菜单树管理 |
| 日志管理 | `/system/logs` | 操作日志与登录日志 |
| 数据字典 | `/system/dicts` | 维护字典数据，并为下拉选项提供数据源 |
| 定时任务 | `/system/scheduled-tasks` | 按 cron 定时调用 HTTP 地址，查看执行记录 |
| 消息通知 | `/system/notifications` | 站内通知 |
| 公告管理 | `/system/announcements` | 公告发布与管理 |

另外还有首页（`/dashboard`）和个人资料页（`/profile`）。
