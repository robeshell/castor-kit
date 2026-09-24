# 设计 tokens 与动效规范

视觉方向：简洁、动效丝滑、偏英文 SaaS 风格（Linear / Vercel / Stripe）。中性灰为底，**Ocean 渐变（blue → sky → cyan）是唯一强调色**，渐变只做点缀，不用紫色。
tokens 定义在 `apps/web/src/index.css`（`:root` 亮色、`.dark` 暗色，`@theme inline` 暴露给 Tailwind），完整说明见 `docs/frontend-redesign-plan.md` §3。

## 颜色：只用语义类

| 用途 | 类 |
|---|---|
| 页面 / 卡片 / 弹层背景 | `bg-background` / `bg-card` / `bg-popover` |
| 正文 / 次要文字 | `text-foreground` / `text-muted-foreground` |
| 边框 / 输入框边 / 焦点环 | `border`（默认色即 `--border`）/ `border-input` / `ring-ring` |
| 弱底色（hover、占位） | `bg-muted` / `bg-accent` / `hover:bg-muted/60` |
| 品牌色 | `text-primary` / `bg-primary` / `bg-brand-soft`（选中态浅底） |
| 状态 | `text-success` `bg-success-soft` / `text-warning` `bg-warning-soft` / `text-danger` `bg-danger-soft` / `text-info` `bg-info-soft` |
| 危险操作文字 | `text-danger hover:text-danger`（ghost 按钮）；实心危险按钮用 `variant="destructive"` |

只用语义类，暗色模式（`<html class="dark">`，由 ThemeContext 切换）就天然正确；**不要**写 `text-gray-500`、`#2563eb`、`dark:` 分支来手动配色。

## 品牌渐变工具类（只做点缀）

| 类 | 用在哪 |
|---|---|
| `bg-brand-gradient` | 装饰：Logo、进度条、指示条、图表面积 |
| `bg-brand-gradient-strong` | 承载白字的元素：主按钮（`Button variant="brand"` 已内置）、头像块 |
| `text-brand-gradient` | 少量强调文字（大数字、标题关键词） |
| `border-brand-gradient` | AI 入口卡片等渐变描边 |
| `shadow-brand` | 主按钮柔和辉光 |
| `bg-brand-glow` | 小块装饰柔光（如图片占位）；不要铺在内容区大背景上，浅色下会显脏 |
| `surface-card` | 卡片表面（白底 + 1px 发丝边 + 圆角；`Panel` 已使用） |

一页里渐变元素屈指可数：主按钮 1 个 + 少量指示 / 装饰。大面积背景不用渐变。

## 尺寸与排版

- 圆角 10–14px（`rounded-lg` / `rounded-xl`；卡片由 `surface-card` 统一）；不用重阴影，靠 1px 边框分层
- 正文 13–14px（`text-[13px]` / `text-sm`），辅助 12px（`text-xs`），页面标题由 PageHeader 统一（24–26px / 600）
- 数字一律 `tabular-nums`；ID、时间列加 `text-muted-foreground`
- 间距用 Tailwind：页面分区 `space-y-4` / `space-y-5`，并列 `gap-4`；表单字段间距由 FormDialog 处理
- 字体：Geist / Geist Mono（本地打包）+ 中文回退 PingFang SC / Microsoft YaHei，不要再引 CDN 字体
- 响应式：<768px 不能横向撑破（DataTable 容器自带横向滚动；两栏布局用 `md:grid-cols-[…]` 在移动端堆叠）；`useIsMobile()` 判断断点
- 图标：`lucide-react`，按钮内不设尺寸，其余一般 `size-4`；emoji 不当图标

## 动效规范（`motion/react` + `@/lib/motion`）

| 场景 | 做法 |
|---|---|
| 交互（hover / 按下 / 展开） | 150–250ms，ease-out（CSS `transition-colors` 等即可） |
| 弹层进出 | 已由 shadcn 组件 + `tw-animate-css` 提供（曲线 `--ease-spring: cubic-bezier(.32,.72,0,1)`），不要再包 motion |
| 页面切换 | 应用外壳已统一处理（`pageTransition`），页面不用自己加 |
| 列表错峰入场 | `<motion.ul variants={stagger.container} initial="hidden" animate="show">` + 子项 `variants={stagger.item}` |
| 单块淡入 | `<motion.div {...fadeUp}>` |
| 滑动指示条 / 选中背景 | `layoutId` + `layoutSpring`（`SegmentedTabs` 已内置） |
| 数字滚动 | `CountUp` / `StatCard` |
| 条件出现的提示条 | `AnimatePresence` + `height: 0 → 'auto'`（见 users 页勾选提示条） |

原则：动效服务于状态变化，不做无意义的循环 / 弹跳；`prefers-reduced-motion` 已在全局处理 CSS 动画，motion 动画保持短小。

## 图表（ECharts）

颜色一律从 `@/lib/chart-theme` 取，亮暗自动切换：

```jsx
const c = useChartColors()
const option = {
  ...chartBase(c),                                        // 坐标轴 / 网格 / tooltip 中性样式
  series: [{ type: 'line', smooth: true, lineStyle: { color: brandLine(c) }, areaStyle: brandArea(c) }],
}
```

`c` 里有 `brand-from / brand-via / brand-to`、`chart-1`…`chart-5`、`foreground`、`muted-foreground`、`border`、`card`、`popover`、`success / warning / danger`；多系列用 `c['chart-1']`… 等 token 值，不要写死十六进制。
