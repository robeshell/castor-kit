# 前端开发

前端位于 `apps/web`，技术栈是 React 19 + Vite + shadcn/ui + Tailwind CSS v4 + motion + lucide-react，语言为 JavaScript（JSX）。本页介绍动态路由、标准页面结构、API 调用、公共组件和样式规范。

参考实现：

| 文件 | 参考用途 |
|---|---|
| `apps/web/src/modules/admin/pages/users/index.jsx` | 标准 CRUD 列表页 |
| `apps/web/src/modules/admin/pages/dashboard/index.jsx` | 卡片、图表、动效 |
| `apps/web/src/modules/admin/pages/profile/index.jsx` | 表单页 |
| `docs/templates/frontend/` | 列表页与详情页模板 |

## 动态路由

前端没有手写的路由表。`apps/web/src/App.jsx` 用 `import.meta.glob('./modules/**/pages/**/index.jsx')` 扫描所有页面，再根据当前用户的菜单生成路由：

- 菜单的 `path` 字段是浏览器地址，例如 `/system/users`
- 菜单的 `component` 字段决定加载哪个页面，格式为 `<module>/<subdir>/<page>`

| `component` 值 | 对应文件 |
|---|---|
| `admin/users` | `modules/admin/pages/users/index.jsx` |
| `component_center/admin/list_page` | `modules/component_center/pages/admin/list_page/index.jsx` |
| `component_center/dataviz/dashboard_page` | `modules/component_center/pages/dataviz/dashboard_page/index.jsx` |

只有启用且可见、类型为 `menu` 的菜单会生成路由。页面组件按需懒加载。菜单存在但找不到对应文件时，页面区域会显示“页面未配置”提示。

::: warning 页面位置
页面必须放在 `apps/web/src/modules/<module>/pages/<subdir>/<page>/index.jsx`，否则动态路由找不到。对应的 API 文件放在 `apps/web/src/modules/<module>/api/<page>.js`。
:::

新增页面后还需要在 `seed-rbac.ts` 中添加菜单，见 [权限 RBAC](/guide/rbac)。

## 标准页面结构

列表页照用户管理页的结构组织：

```text
PageHeader     标题 + 右侧操作（导入 / 导出用 outline，新增用 variant="brand"）
→ FilterBar    SearchInput / FilterSelect，查询 + 重置
→ DataTable    分页、勾选、行操作（ghost 按钮 + ConfirmAction 删除）
→ FormDialog   新建 / 编辑弹窗（react-hook-form + FormFields）
→ ImportDialog / ExportDialog
```

- 每页最多一个 `variant="brand"` 按钮；页面标题下不写功能介绍。
- 分区用 `Panel`，状态用 `StatusBadge`，空态用 `EmptyState`。
- 提示统一用 `@/lib/toast`：成功用 `toast.success('已保存')`，接口失败用 `toast.apiError(err, '保存失败')`。
- 表单提交失败时 `toast.apiError` 后重新 `throw`，弹窗会保持打开。
- 列表状态（数据、分页、筛选、加载）用 `@/shared/hooks/useCrudList` 管理。

简化后的骨架：

```jsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/toast'
import DataTable from '@/shared/components/DataTable'
import { FilterBar, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormInput } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { getItems } from '@/modules/admin/api/customer'

export default function Customers() {
  const list = useCrudList((params) =>
    getItems(params).catch((err) => {
      toast.apiError(err, '加载失败')
      return { items: [], total: 0 }
    }),
  )
  const form = useForm({ defaultValues: { name: '' } })

  useEffect(() => {
    list.fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ... PageHeader / FilterBar / DataTable / FormDialog
}
```

完整写法以 `apps/web/src/modules/admin/pages/users/index.jsx` 为准。

## API 调用

所有请求都通过共享的 Axios 实例 `@/shared/api/request` 发出，不要直接使用 `fetch` 或 `XMLHttpRequest`。

```js
import request from '@/shared/api/request'

const BASE = '/admin/customers'

export const getItems = (params) => request.get(BASE, { params })
export const createItem = (data) => request.post(BASE, data)
export const updateItem = (id, data) => request.put(`${BASE}/${id}`, data)
export const deleteItem = (id) => request.delete(`${BASE}/${id}`)

// Export (blob)
export const exportItems = (data) => request.post(`${BASE}/export`, data, { responseType: 'blob' })
// Download the import template
export const downloadTemplate = (fileType = 'xlsx') =>
  request.get(`${BASE}/template`, { params: { file_type: fileType }, responseType: 'blob' })
// Import (multipart/form-data)
export const importItems = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`${BASE}/import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}
```

`request.js` 已处理：

- `baseURL` 为 `/api`，所以路径写 `/admin/...`
- 响应已解包：直接用 `res.items`、`res.total`，**不要**写 `res.data.items`
- 写请求（POST / PUT / PATCH / DELETE）自动带 `X-CSRF-Token` 头
- 自动带 `Accept-Language` 头，后端据此翻译报错
- 返回 401 时跳转登录页
- 失败时 reject 的是后端返回的 `{ error, ... }` 对象，可以直接交给 `toast.apiError`

路径别名 `@` 指向 `apps/web/src`。

## 公共组件

组件分两层：shadcn/ui 原子组件在 `@/components/ui/*`（源码在仓库内，可按需修改），业务公共组件在 `@/shared/components/*`。图标只用 `lucide-react`。

| 组件 | 用途 |
|---|---|
| `PageHeader` / `Panel` | 页头（标题 + 操作）/ 卡片分区（`padded={false}` 贴边） |
| `DataTable` + `DataPagination` | 表格：列定义、分页、勾选、加载骨架与空态 |
| `FilterBar` / `SearchInput` / `FilterSelect` | 筛选栏；`FilterSelect` 的 `''` 表示全部 |
| `FormDialog` / `FormSheet` / `DetailSheet` / `DescriptionList` | 新建编辑弹窗 / 侧边抽屉 / 只读详情抽屉 / 键值列表 |
| `FormFields`：`FormInput` / `FormTextarea` / `FormNumber` / `FormSelect` / `FormMultiSelect` / `FormSwitch` / `FormRadioGroup` / `FormCheckboxGroup` / `FormDate` / `FormDateTime` / `FormTags` / `FormTreeSelect` / `FormFileUpload` / `FormImageUpload` / `FormAvatarUpload` / `FormCustom` / `FormGrid` | react-hook-form 表单字段；上传类字段的值是文件中心的文件 ID（头像是文件地址） |
| `ConfirmAction` / `RowActions` | 危险操作二次确认 / 行操作 |
| `StatusBadge` | 状态徽章，`tone` 可选 neutral / brand / info / success / warning / danger |
| `EmptyState` / `SegmentedTabs` / `TreeView` / `StatCard` | 空态 / 分段标签 / 树 / 指标卡 |
| `DatePicker` / `DateTimePicker` / `MultiSelect` / `TagInput` | 日期值格式为 `'YYYY-MM-DD'` / `'YYYY-MM-DD HH:mm:ss'` |
| `data-transfer/ImportDialog` / `data-transfer/ExportDialog` | 导入 / 导出弹窗 |
| `TreeSelect` / `CheckableTree` | 可搜索的树形单选 / 带父子联动的树形多选 |
| `upload/FileUpload` / `upload/ImageUpload` / `upload/AvatarUpload` | 文件（拖拽、进度）/ 图片 / 头像上传；配合 `@/shared/api/files` 的 `uploadFile` 上传到文件中心 |

表单字段示例：

```jsx
<FormInput control={form.control} name="name" label="客户名称" rules={{ required: '请输入客户名称' }} />
```

工具库：

| 模块 | 内容 |
|---|---|
| `@/lib/utils` | `cn()` 合并类名 |
| `@/lib/toast` | `toast.success / error / warning / info`、`toast.apiError(err, fallback)` |
| `@/lib/format` | `formatDate / formatDateTime / formatNumber / formatRelative` |
| `@/lib/motion` | `fadeUp / stagger / pageTransition / layoutSpring` 等动效预设 |
| `@/lib/chart-theme` | `useChartColors()`，ECharts 必须用它取主题色 |
| `@/lib/menu-icons` | 菜单图标名到 lucide 图标的映射 |

::: tip 组件用法与新增原子组件
组件的详细 props 和常见页面模式见 `.claude/skills/shadcn-ui-skills/`。缺少 shadcn 原子组件时，用中转脚本添加：

```bash
apps/web/scripts/shadcn-add.sh hover-card        # 添加组件
apps/web/scripts/shadcn-add.sh --view badge      # 只查看 registry 内容，不写文件
```

脚本会启动本地 registry 中转执行 `npx shadcn@latest add`。添加后检查 `apps/web/package.json` 的变更，并确认组件只用语义色类。
:::

## 导入导出

- 导出弹窗 `@/shared/components/data-transfer/ExportDialog`：`open` / `onOpenChange` / `fieldOptions` / `onConfirm({ fields, fileType })`
- 导入弹窗 `@/shared/components/data-transfer/ImportDialog`：`onDownloadTemplate(fileType)` / `onImport(file)` / `onImported(res)`，格式只有 CSV / XLSX，错误行可下载
- 下载文件：`import { downloadBlobFile } from '@/shared/utils/file'`

用户管理页演示了“有勾选时导出勾选行，否则按筛选条件导出”的写法。后端部分见 [后端开发](/guide/backend#导入导出)。

## 样式规范

### 只用语义色类

颜色一律使用 Tailwind 语义色类，浅色和深色模式、以及强调色切换都会自动适配：

| 用途 | 类名 |
|---|---|
| 背景 / 卡片 / 弱背景 | `bg-background` / `bg-card` / `bg-muted` |
| 文字 | `text-foreground` / `text-muted-foreground` |
| 强调色 | `text-primary` / `bg-primary` / `bg-brand-soft` |
| 状态 | `text-success` / `bg-success-soft` / `text-warning` / `text-danger` / `bg-danger-soft` / `text-info` |
| 品牌渐变（仅点缀） | `bg-brand-gradient` / `bg-brand-gradient-strong` / `text-brand-gradient` / `border-brand-gradient` / `shadow-brand` / `bg-brand-glow` |

- 以中性灰为底，强调色只做点缀。`bg-brand-glow` 只用于小块装饰，不要铺在内容区的大背景上。
- 不要写死某个强调色，否则用户在外观设置里切换后不会跟随。详见 [主题与布局](/guide/appearance)。
- 间距用 Tailwind 工具类（`space-y-4`、`gap-4`），数字用 `tabular-nums`。
- 移动端（宽度小于 768px）不能出现横向撑破，表格容器横向滚动。
- 交互动效控制在 150–250ms；`prefers-reduced-motion` 已全局处理。

### 禁止事项

| 禁止 | 原因 / 替代 |
|---|---|
| 导入 `@douyinfe/*` | Semi Design 已下线，`pnpm verify` 的 `frontend_no_legacy_ui` 会拦截 |
| antd、material-ui 等其他 UI 库 | 使用 shadcn/ui 与公共组件 |
| `var(--semi-*)` | 已下线的变量 |
| 页面里写死十六进制颜色 | 使用语义色类；canvas / WebGL 内部着色、图表数据色除外，图表优先用 `useChartColors` |
| 大段 inline style 做布局 | 使用 Tailwind 工具类 |
| 用 emoji 当图标 | 使用 `lucide-react` |
| 每个页面各写一套表格、弹窗、确认框 | 复用 `DataTable` / `FormDialog` / `ConfirmAction` 等 |
| 用 `fetch` 发请求 | 使用 `@/shared/api/request` |

## 菜单图标

`menus.icon` 字段存的是图标名（如 `IconUser`），由 `apps/web/src/lib/menu-icons.js` 映射到 lucide 图标。新增菜单时沿用映射表中已有的名字，需要新图标时在映射表里补一条。

## 多语言与副作用

- 界面文案写中文原文，并按规则接入翻译，见 [多语言](/guide/i18n)。
- 标签栏开启时页面会被保活，副作用必须写在 `useEffect` 里并正确清理，见 [主题与布局](/guide/appearance#标签栏与页面保活)。

## 测试与检查

```bash
pnpm --filter @castor-kit/web test     # 前端 Vitest
pnpm --filter @castor-kit/web lint     # 前端 ESLint
node apps/web/scripts/i18n-scan.mjs src/modules/admin/pages/users   # 扫描某个页面目录的未翻译文案
```
