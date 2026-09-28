# 前端开发

前端位于 `apps/web`，技术栈是 React 19 + Vite + shadcn/ui + Tailwind CSS v4 + motion + lucide-react，语言为 TypeScript（TSX）。本页介绍动态路由、标准页面结构、API 调用、公共组件和样式规范。

参考实现：

| 文件 | 参考用途 |
|---|---|
| `apps/web/src/modules/admin/pages/users/index.tsx` | 标准 CRUD 列表页 |
| `apps/web/src/modules/admin/pages/dashboard/index.tsx` | 卡片、图表、动效 |
| `apps/web/src/modules/admin/pages/profile/index.tsx` | 表单页 |
| `docs/templates/frontend/` | 列表页与详情页模板 |

## 动态路由

前端没有手写的路由表。`apps/web/src/App.tsx` 根据当前用户的菜单生成路由，`lib/page-modules.ts` 用 `import.meta.glob` 扫描 `modules/**/pages/**/index.tsx`，为每个菜单找到对应页面：

- 菜单的 `path` 字段是浏览器地址，例如 `/system/users`
- 菜单的 `component` 字段决定加载哪个页面，格式为 `<module>/<pages 下的页面路径>`：系统页面直接放在 `pages/` 下，如 `admin/users`；示例中心的页面多一层分组目录，即 `<module>/<subdir>/<page>`

| `component` 值 | 对应文件 |
|---|---|
| `admin/users` | `modules/admin/pages/users/index.tsx` |
| `component_center/patterns/kanban_page` | `modules/component_center/pages/patterns/kanban_page/index.tsx` |
| `component_center/dataviz/dashboard_page` | `modules/component_center/pages/dataviz/dashboard_page/index.tsx` |

只有启用且可见、类型为 `menu` 的菜单会生成路由。页面组件按需懒加载。菜单存在但找不到对应文件时，页面区域会显示“页面未配置”提示。

::: warning 页面位置
页面必须放在 `apps/web/src/modules/<module>/pages/<page>/index.tsx`（中间可以有分组目录，如 `pages/<subdir>/<page>/index.tsx`），否则动态路由找不到。对应的 API 文件放在 `apps/web/src/modules/<module>/api/<page>.ts`。
:::

新增页面后还需要在 `seed-rbac.ts` 中添加菜单，见 [权限 RBAC](/zh/guide/rbac)。

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

```tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '@/lib/toast'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import { FilterBar, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormInput } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { getItems, type Customer as Row } from '@/modules/admin/api/customer'

interface FormValues {
  name: string
}

export default function Customers() {
  const list = useCrudList((params) =>
    getItems(params).catch((err: unknown) => {
      toast.apiError(err, '加载失败')
      return { items: [], total: 0 }
    }),
  )
  const form = useForm<FormValues>({ defaultValues: { name: '' } })
  const columns: DataTableColumn<Row>[] = [/* ... */]

  useEffect(() => {
    list.fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ... PageHeader / FilterBar / DataTable / FormDialog
}
```

完整写法以 `apps/web/src/modules/admin/pages/users/index.tsx` 为准；`docs/templates/frontend/list_page/` 是 `pnpm scaffold` 套用的模板。行类型来自 API 文件，表单单独定义 `FormValues` 接口，页面里不用 `any`，也不做类型断言。

## API 调用

所有请求都通过共享的 Axios 实例 `@/shared/api/request` 发出，不要直接使用 `fetch` 或 `XMLHttpRequest`。

```ts
import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiQuery, ApiResponse } from '@/shared/api/types'

/** A record as the API returns it */
export type Customer = ApiItem<'/api/admin/customers'>

const BASE = '/admin/customers'

// The second type argument of request.get<unknown, T> is the (already unwrapped) response body
export const getItems = (params?: ApiQuery<'/api/admin/customers'>) =>
  request.get<unknown, ApiResponse<'/api/admin/customers'>>(BASE, { params })
export const createItem = (data: ApiBody<'/api/admin/customers', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/customers', 'post'>>(BASE, data)
export const updateItem = (id: number, data: ApiBody<'/api/admin/customers/{item_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/customers/{item_id}', 'put'>>(`${BASE}/${id}`, data)
export const deleteItem = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/customers/{item_id}', 'delete'>>(`${BASE}/${id}`)

// Export (blob)
export const exportItems = (data: ApiBody<'/api/admin/customers/export', 'post'>) =>
  request.post<unknown, Blob>(`${BASE}/export`, data, { responseType: 'blob' })
// Download the import template
export const downloadTemplate = (fileType: 'csv' | 'xlsx' = 'xlsx') =>
  request.get<unknown, Blob>(`${BASE}/template`, { params: { file_type: fileType }, responseType: 'blob' })
// Import (multipart/form-data)
export const importItems = (file: Blob) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, ApiResponse<'/api/admin/customers/import', 'post'>>(`${BASE}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
```

类型来自 OpenAPI 文档（`pnpm openapi:generate` 生成 `apps/web/src/shared/api/openapi.d.ts`，路径保留 `/api` 前缀和 `{param}` 占位符）。接口还没写进文档时，`ApiItem` / `ApiBody` 会解析成 `never`。`pnpm scaffold` 会同时写好文档条目和这个文件，模板见 `docs/templates/frontend/list_page/api.ts`。

`request.ts` 已处理：

- `baseURL` 为 `/api`，所以路径写 `/admin/...`；请求 10 秒超时
- 响应已解包：直接用 `res.items`、`res.total`，**不要**写 `res.data.items`
- 写请求（POST / PUT / PATCH / DELETE）自动带 `X-CSRF-Token` 头
- 自动带 `Accept-Language` 头，后端据此翻译报错；`X-Time-Zone` 头带上浏览器时区，导出文件和首页统计按它计算
- 返回 401 时跳转登录页（登录页和重置密码页本身除外）
- 失败时 reject 的是后端返回的 `{ error, ... }` 对象，可以直接交给 `toast.apiError`。网络错误、超时以及没有这种响应体的 5xx 也会被转成带可读提示的 `{ error }`

路径别名 `@` 指向 `apps/web/src`。

## 公共组件

组件分两层：shadcn/ui 原子组件在 `@/components/ui/*`（源码在仓库内，可按需修改），业务公共组件在 `@/shared/components/*`。图标只用 `lucide-react`。每个公共组件的实时示例、源码和关键属性见组件示例中心的[组件](/zh/guide/components#components)分组。

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
| `DatePicker` / `DateTimePicker` / `MultiSelect` / `TagInput` | `DatePicker` 的值是 `'YYYY-MM-DD'`；`DateTimePicker` 接收接口返回的时间（ISO 8601），输出带浏览器时区偏移的 ISO 8601，由接口转成 UTC 保存 |
| `data-transfer/ImportDialog` / `data-transfer/ExportDialog` | 导入 / 导出弹窗 |
| `TreeSelect` / `CheckableTree` | 可搜索的树形单选 / 带父子联动的树形多选 |
| `upload/FileUpload` / `upload/ImageUpload` / `upload/AvatarUpload` / `upload/FileIdUpload` | 文件（拖拽、进度）/ 图片 / 头像上传；配合 `@/shared/api/files` 的 `uploadFile` 上传到文件中心。`FileIdUpload` 的值直接就是文件中心的文件 ID |
| `ConditionBuilder` | 由字段 / 运算符 / 值组成的条件，用 AND / OR 组合，支持一层条件组；受控组件，值 `ConditionTree` 是普通 JSON，可直接保存或传给接口 |
| `Chart` | ECharts 封装，绑定 `@/lib/echarts` 的按需构建；`option` 有类型约束，`summary`（给读屏软件的文字说明）必填 |
| `UserAvatar` / `markdown/MarkdownView` | 带首字母兜底的头像 / Markdown 渲染 |

表单字段示例：

```tsx
<FormInput control={form.control} name="name" label="客户名称" rules={{ required: '请输入客户名称' }} />
```

工具库：

| 模块 | 内容 |
|---|---|
| `@/lib/utils` | `cn()` 合并类名 |
| `@/lib/toast` | `toast.success / error / warning / info`、`toast.apiError(err, fallback)` |
| `@/lib/format` | `formatDate / formatDateTime / formatNumber / formatRelative` |
| `@/lib/motion` | `fadeUp / stagger / pageTransition / layoutSpring` 等动效预设 |
| `@/lib/chart-theme` | `useChartColors()` 以及 `chartBase` / `brandLine` / `brandArea`；图表颜色必须从这里取 |
| `@/lib/echarts` | ECharts 按需构建；新的图表类型和组件在这里注册 |
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

用户管理页演示了“有勾选时导出勾选行，否则按筛选条件导出”的写法。后端部分见 [后端开发](/zh/guide/backend#导入导出)。

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
- 不要写死某个强调色，否则用户在外观设置里切换后不会跟随。详见 [主题与布局](/zh/guide/appearance)。
- 间距用 Tailwind 工具类（`space-y-4`、`gap-4`），数字用 `tabular-nums`。
- 移动端（宽度小于 768px）不能出现横向撑破，表格容器横向滚动。
- 交互动效控制在 150–250ms；`prefers-reduced-motion` 已全局处理。

### 禁止事项

| 禁止 | 原因 / 替代 |
|---|---|
| antd、MUI 等其他 UI 组件库 | 只用 `@/components/ui/*`、`@/shared/components/*`、lucide-react 与 Tailwind 语义色类 |
| 页面里写死十六进制颜色 | 使用语义色类；canvas / WebGL 内部着色、图表数据色除外，图表优先用 `useChartColors` |
| 大段 inline style 做布局 | 使用 Tailwind 工具类 |
| 用 emoji 当图标 | 使用 `lucide-react` |
| 每个页面各写一套表格、弹窗、确认框 | 复用 `DataTable` / `FormDialog` / `ConfirmAction` 等 |
| 用 `fetch` 发请求 | 使用 `@/shared/api/request` |
| 直接引入 `echarts` / `echarts-for-react` | 使用 `@/shared/components/Chart`，图表类型在 `@/lib/echarts` 注册 |

## 菜单图标

`menus.icon` 字段存的是 lucide 图标名（如 `Users`、`Settings`），由 `apps/web/src/lib/menu-icons.ts` 解析成 lucide 图标组件。新增菜单时沿用 `MENU_ICONS` 映射表中已有的名字；需要新图标时，在该文件里引入图标并加进映射表。映射表里没有的名字会显示为 `List` 图标。

## 多语言与副作用

- 界面文案写中文原文，并按规则接入翻译，见 [多语言](/zh/guide/i18n)。
- 标签栏开启时页面会被保活，副作用必须写在 `useEffect` 里并正确清理，见 [主题与布局](/zh/guide/appearance#标签栏与页面保活)。

## 测试与检查

```bash
pnpm --filter @castorjs/web test     # 前端 Vitest
pnpm --filter @castorjs/web lint     # 前端 ESLint
node apps/web/scripts/i18n-scan.mjs src/modules/admin/pages/users   # 扫描某个页面目录的未翻译文案
```
