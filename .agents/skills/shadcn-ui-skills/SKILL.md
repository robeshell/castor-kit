---
name: shadcn-ui-skills
description: castor-kit 前端（apps/web）的 shadcn/ui + Tailwind CSS v4 + motion 使用指南：组件清单、castor-kit 公共组件用法、设计 tokens、动效规范、常见页面模式与禁止事项，以及如何经本地中转用 shadcn CLI 新增原子组件。写或改任何前端页面 / 组件、查询 shadcn 组件用法时使用。
---

# shadcn/ui 使用指南（castor-kit）

castor-kit 的前端已从 Semi Design 整体迁移到 **shadcn/ui（new-york，Radix）+ Tailwind CSS v4 + motion + lucide-react**，语言是 JavaScript（JSX），文案中文。
完整方案：`docs/frontend-redesign-plan.md`；项目约定：`AGENTS.md`「前端架构约定」。

## 文件说明

| 文件 | 内容 | 何时看 |
|---|---|---|
| [COMPONENTS.md](COMPONENTS.md) | shadcn 原子组件清单（`@/components/ui/*`）+ castor-kit 业务公共组件（`@/shared/components/*`）与 lib 的 props / 用法 | 选组件、查 props |
| [DESIGN.md](DESIGN.md) | 设计 tokens（语义色类、品牌渐变工具类、圆角 / 字号 / 间距）+ 动效规范（`@/lib/motion`） | 写样式、加动效 |
| [PATTERNS.md](PATTERNS.md) | 常见模式：CRUD 列表页、表单弹窗 / 抽屉、详情抽屉、导入导出、状态徽章、图表、空态与加载 | 新建 / 改写页面 |

## 工作流程

1. **先看参考实现，再写代码**：
   - 标准 CRUD 列表页：`apps/web/src/modules/admin/pages/users/index.jsx`
   - 卡片 / 图表 / 动效：`apps/web/src/modules/admin/pages/dashboard/index.jsx`
   - 表单页：`apps/web/src/modules/admin/pages/profile/index.jsx`
   - 模板：`docs/templates/frontend/list_page/index.jsx`、`docs/templates/frontend/detail_page/index.jsx`
   - `pnpm scaffold` 生成的页面就是列表页模式的实例（字段类型 → 表单组件映射见 PATTERNS.md）
2. **优先复用** `@/shared/components/*`（PageHeader / DataTable / FilterBar / FormDialog / FormFields / ConfirmAction / StatusBadge / ImportDialog / ExportDialog …），缺能力时才直接组合 `@/components/ui/*`。
3. **查文档**：shadcn 组件 API 以官方文档为准（https://ui.shadcn.com/docs/components ，有 shadcn MCP 时优先用 MCP 查 registry）；与仓库里 `apps/web/src/components/ui/` 的实现冲突时以仓库为准（已按本项目 tokens 调整过，例如 Button 多了 `variant="brand"`）。
4. **需要新的原子组件**：用中转脚本（本机 shadcn CLI 直连 ui.shadcn.com 会失败）：

   ```bash
   apps/web/scripts/shadcn-add.sh hover-card        # 新增
   apps/web/scripts/shadcn-add.sh --view badge      # 只看 registry 源码
   apps/web/scripts/shadcn-add.sh badge -o -y       # 覆盖已有文件（会丢掉本地改动，例如 button 的 brand 变体，先确认）
   ```

   脚本起一个 python 本地中转（curl 走系统代理拉 https://ui.shadcn.com/r/…），清掉 `HTTP(S)_PROXY` 后用 `REGISTRY_URL=http://127.0.0.1:<port>/r npx shadcn@latest add …` 执行，
   结束后关闭中转；还会把 registry 源码里的 `import { cn } from "cn"` 改回 `@/lib/utils` 并撤掉误装的 `cn` 包。新增后 `git diff apps/web/package.json` 确认依赖变化，组件里的颜色改成语义类。
5. **自检**：`cd apps/web && npx eslint <文件>` 零错误；`npx vite build` 通过；亮 / 暗两种主题、<768px 宽度都看一遍；`pnpm verify -- --module <name>` 的 `frontend_no_legacy_ui` 通过。

## 禁止事项

- ❌ 任何 `@douyinfe/*` 导入（Semi 已下线；verify 的 `frontend_no_legacy_ui` 会拦截）、antd / material-ui 等其他 UI 库
- ❌ `var(--semi-*)`、页面里写死十六进制颜色（例外：canvas / three.js / WebGL 内部着色、图表数据色——图表先用 `useChartColors`）
- ❌ 大段 inline style 做布局（用 Tailwind 类；只有动态数值可以用 style）
- ❌ emoji 当图标（用 lucide-react）
- ❌ 页面各写一套表格 / 弹窗 / 确认框 / 导入导出（复用公共组件）
- ❌ 一个页面多个 `variant="brand"` 主按钮（其余用 outline / ghost）；紫色；大面积渐变（渐变只做点缀）
- ❌ 花哨无意义的动画；忽略 `prefers-reduced-motion`
- ❌ 在 `useEffect` 里同步 `setState`（eslint 的 react-hooks/set-state-in-effect 会报错；用 promise 回调或 `useCrudList`）
- ❌ 直接 `fetch`（请求一律 `@/shared/api/request`，响应已 unwrap：`res.items` 而不是 `res.data.items`）
- ❌ 引用已下线的旧公共组件：`@/shared/components/import-export/*`、`@/shared/components/upload/*UploadField`、`@/shared/styles`
