# 主题与布局

用户可以在顶栏切换浅色 / 深色模式，并在“外观设置”面板中选择强调色、导航模式、侧边栏样式、内容宽度，以及是否开启标签栏。所有选择立即生效，并保存在当前浏览器中。

本页介绍这些选项的实现方式，以及它们对页面代码的要求。

## 浅色 / 深色

- 通过 `<html class="dark">` 切换，遵循 shadcn / Tailwind 的约定。
- 选择保存在 `localStorage` 的 `theme` 键中；从未选择过时跟随系统设置。
- 切换时会短暂开启全局颜色过渡，结束后移除，不影响平常的 hover 动效。

实现位于 `apps/web/src/context/ThemeContext.jsx`。页面只要使用语义色类（见 [前端开发](/guide/frontend#样式规范)），深色模式就自动正确。

## 强调色

外观设置提供 6 种强调色，默认为海洋蓝：

| ID | 名称 |
|---|---|
| `ocean` | 海洋蓝（默认） |
| `violet` | 紫罗兰 |
| `emerald` | 翡翠绿 |
| `rose` | 玫瑰红 |
| `amber` | 琥珀橙 |
| `slate` | 石墨灰 |

### token 如何派生

强调色以 `<html data-accent="<id>">` 的形式应用。`apps/web/src/index.css` 中每个预设只定义三个渐变色标，浅色和深色各一组：

```css
[data-accent='ocean'] { --brand-from: #2563eb; --brand-via: #0284c7; --brand-to: #22d3ee; }
.dark[data-accent='ocean'], .dark [data-accent='ocean'] { --brand-from: #3b82f6; --brand-via: #0ea5e9; --brand-to: #22d3ee; }
```

其他所有跟随强调色的 token 都由这三个变量派生：

| token | 来源 |
|---|---|
| `--primary`、`--ring`、`--sidebar-primary`、`--sidebar-ring` | `--brand-from` |
| `--chart-1` / `--chart-2` / `--chart-3` | `--brand-from` / `--brand-via` / `--brand-to` |
| `--brand-gradient`、`--brand-gradient-strong` | 三个色标组成的线性渐变 |
| `--brand-soft`、`--brand-glow`、`--brand-shadow` | 用 `color-mix()` 与透明色混合 |

`--chart-4`、`--chart-5` 是固定颜色，不随强调色变化。

因此，页面里只要使用 `primary`、`brand-*` 等语义类，切换强调色时就会自动跟随。**不要在页面中写死某个强调色的色值。**

ECharts 图表通过 `@/lib/chart-theme` 的 `useChartColors()` 读取当前 CSS 变量的实际值，主题或强调色切换时会重新计算。canvas / WebGL 场景（如粒子动画、Three.js 地球）也从 `--brand-from/via/to` 取色。

### 新增一个强调色

1. 在 `apps/web/src/lib/appearance.js` 的 `ACCENTS` 中添加 `{ id, label }`，`label` 是中文原文，同时作为翻译 key。
2. 在 `apps/web/src/index.css` 中添加对应的 `[data-accent='<id>']` 浅色和深色两组色标。色标保持十六进制写法，`chart-theme.js` 会把 `--brand-from` 转换为 rgba。
3. 为 `label` 补充英文和日文译文。

## 导航模式

| ID | 名称 | 说明 |
|---|---|---|
| `sidebar` | 侧边栏（默认） | 左侧显示完整菜单树 |
| `top` | 顶部导航 | 菜单显示在顶栏，不显示侧边栏 |
| `mixed` | 混合 | 顶栏显示一级分区，左侧显示当前分区下的菜单 |

## 侧边栏样式

与 shadcn `<Sidebar variant>` 一一对应：

| ID | 名称 |
|---|---|
| `sidebar` | 标准（默认） |
| `floating` | 浮动 |
| `inset` | 内嵌 |

导航模式为“顶部导航”时不显示侧边栏，该选项不可用。

## 内容宽度

| ID | 名称 | 说明 |
|---|---|---|
| `boxed` | 定宽 | 内容区居中，最大宽度 1600px |
| `fluid` | 流式（默认） | 内容区占满可用宽度 |

## 移动端

视口宽度小于 768px 时：

- 所有导航模式都退化为抽屉式侧边栏，显示完整菜单
- 不显示标签栏，也不做页面保活

## 标签栏与页面保活

标签栏默认开启，可在外观设置中关闭。开启后，打开过的页面以标签形式显示在顶栏下方：

- 顶级页面（如首页）固定在最前，不能关闭
- 标签支持关闭、关闭其他、关闭右侧、关闭全部、刷新
- 标签列表保存在 `sessionStorage` 的 `tags-view` 键中，仅对当前浏览器标签页有效
- 切回某个标签时恢复它上次的查询参数和滚动位置

状态管理在 `apps/web/src/context/TagsViewContext.jsx`，页面区域的渲染在 `apps/web/src/components/app/AppLayout.jsx`。

### 保活机制

标签栏开启时，每个打开的标签页都用 React `<Activity>` 包裹并保持挂载：

| 状态 | 切走（隐藏）时 | 切回（显示）时 |
|---|---|---|
| 组件 state（筛选条件、分页、表单输入） | 保留 | 原样恢复 |
| `useEffect` 副作用 | 执行清理函数 | 重新执行 |

也就是说，切回页面时 `useEffect` 中的请求会重新拉取一次数据，隐藏期间定时器、轮询、WebSocket 会随清理函数自动停止。

关闭标签会卸载对应页面；刷新标签会重新挂载页面，并从顶部开始显示。

### 对页面代码的要求

::: warning 副作用必须写在 effect 里并正确清理
- 定时器、轮询、订阅、WebSocket 连接都放在 `useEffect` 中启动，并在清理函数中停止。
- 不要在模块顶层或渲染过程中启动定时器，否则页面隐藏后仍会继续运行。
:::

```jsx
useEffect(() => {
  const timer = setInterval(refresh, 5000)
  return () => clearInterval(timer)
}, [refresh])
```

## 偏好存储位置

| 存储 | 键 | 内容 |
|---|---|---|
| `localStorage` | `theme` | `light` / `dark` |
| `localStorage` | `appearance` | `{ accent, navMode, sidebarVariant, contentWidth, tagsView }` |
| `localStorage` | `lang` | 界面语言，见 [多语言](/guide/i18n) |
| `sessionStorage` | `tags-view` | 已打开的标签 |

`appearance` 中的未知键或非法值会被忽略并回退到默认值。外观设置面板提供“恢复默认”按钮。选项的唯一定义在 `apps/web/src/lib/appearance.js`。
