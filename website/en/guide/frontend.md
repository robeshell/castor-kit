# Frontend

The frontend lives in `apps/web` and is built with React 19 + Vite + shadcn/ui + Tailwind CSS v4 + motion + lucide-react, written in JavaScript (JSX). This page covers dynamic routing, the standard page structure, API calls, shared components and styling rules.

Reference implementations:

| File | Use it as a reference for |
|---|---|
| `apps/web/src/modules/admin/pages/users/index.jsx` | Standard CRUD list page |
| `apps/web/src/modules/admin/pages/dashboard/index.jsx` | Cards, charts, motion |
| `apps/web/src/modules/admin/pages/profile/index.jsx` | Form page |
| `docs/templates/frontend/` | List page and detail page templates |

## Dynamic routing

There is no hand-written route table. `apps/web/src/App.jsx` scans every page with `import.meta.glob('./modules/**/pages/**/index.jsx')` and builds the routes from the current user's menus:

- A menu's `path` field is the browser URL, e.g. `/system/users`
- A menu's `component` field decides which page to load, in the form `<module>/<subdir>/<page>`

| `component` value | File |
|---|---|
| `admin/users` | `modules/admin/pages/users/index.jsx` |
| `component_center/admin/list_page` | `modules/component_center/pages/admin/list_page/index.jsx` |
| `component_center/dataviz/dashboard_page` | `modules/component_center/pages/dataviz/dashboard_page/index.jsx` |

Only menus that are active, visible and of type `menu` produce routes. Page components are lazy-loaded. If a menu exists but its file can't be found, the page area shows a "Page not configured" notice.

::: warning Page location
Pages must live at `apps/web/src/modules/<module>/pages/<subdir>/<page>/index.jsx`, otherwise dynamic routing won't find them. The matching API file goes in `apps/web/src/modules/<module>/api/<page>.js`.
:::

After adding a page, you also need to add its menu in `seed-rbac.ts`; see [Permissions (RBAC)](/en/guide/rbac).

## Standard page structure

List pages follow the structure of the Users page:

```text
PageHeader     Title + actions on the right (outline for import / export, variant="brand" for create)
→ FilterBar    SearchInput / FilterSelect, search + reset
→ DataTable    Pagination, row selection, row actions (ghost buttons + ConfirmAction for delete)
→ FormDialog   Create / edit dialog (react-hook-form + FormFields)
→ ImportDialog / ExportDialog
```

- At most one `variant="brand"` button per page; don't put a feature description under the page title.
- Use `Panel` for sections, `StatusBadge` for statuses, `EmptyState` for empty states.
- Use `@/lib/toast` for all feedback: `toast.success('已保存')` on success, `toast.apiError(err, '保存失败')` when an API call fails.
- When a form submission fails, call `toast.apiError` and then re-`throw`, so the dialog stays open.
- Manage list state (data, pagination, filters, loading) with `@/shared/hooks/useCrudList`.

A simplified skeleton:

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

For the complete version, `apps/web/src/modules/admin/pages/users/index.jsx` is the source of truth.

## API calls

Send every request through the shared Axios instance `@/shared/api/request`; don't use `fetch` or `XMLHttpRequest` directly.

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

`request.js` already takes care of:

- `baseURL` is `/api`, so paths start with `/admin/...`
- Responses are unwrapped: use `res.items` and `res.total` directly; **don't** write `res.data.items`
- Write requests (POST / PUT / PATCH / DELETE) send the `X-CSRF-Token` header automatically
- The `Accept-Language` header is sent automatically, and the backend uses it to translate errors
- A 401 response redirects to the login page
- On failure it rejects with the `{ error, ... }` object returned by the backend, which you can pass straight to `toast.apiError`

The path alias `@` points to `apps/web/src`.

## Shared components

Components come in two layers: shadcn/ui primitives in `@/components/ui/*` (source lives in the repo, edit as needed) and shared business components in `@/shared/components/*`. Use only `lucide-react` for icons.

| Component | Purpose |
|---|---|
| `PageHeader` / `Panel` | Page header (title + actions) / card section (`padded={false}` for edge-to-edge content) |
| `DataTable` + `DataPagination` | Table: column definitions, pagination, row selection, loading skeleton and empty state |
| `FilterBar` / `SearchInput` / `FilterSelect` | Filter bar; in `FilterSelect`, `''` means "all" |
| `FormDialog` / `FormSheet` / `DetailSheet` / `DescriptionList` | Create/edit dialog / side sheet / read-only detail sheet / key-value list |
| `FormFields`: `FormInput` / `FormTextarea` / `FormNumber` / `FormSelect` / `FormMultiSelect` / `FormSwitch` / `FormRadioGroup` / `FormCheckboxGroup` / `FormDate` / `FormDateTime` / `FormTags` / `FormCustom` / `FormGrid` | react-hook-form form fields |
| `ConfirmAction` / `RowActions` | Confirmation for destructive actions / row actions |
| `StatusBadge` | Status badge; `tone` can be neutral / brand / info / success / warning / danger |
| `EmptyState` / `SegmentedTabs` / `TreeView` / `StatCard` | Empty state / segmented tabs / tree / stat card |
| `DatePicker` / `DateTimePicker` / `MultiSelect` / `TagInput` | Date values are formatted as `'YYYY-MM-DD'` / `'YYYY-MM-DD HH:mm:ss'` |
| `data-transfer/ImportDialog` / `data-transfer/ExportDialog` | Import / export dialogs |
| `upload/FileUpload` / `upload/ImageUpload` | File / image upload |

Form field example:

```jsx
<FormInput control={form.control} name="name" label="客户名称" rules={{ required: '请输入客户名称' }} />
```

Utility libraries:

| Module | Contents |
|---|---|
| `@/lib/utils` | `cn()` for merging class names |
| `@/lib/toast` | `toast.success / error / warning / info`, `toast.apiError(err, fallback)` |
| `@/lib/format` | `formatDate / formatDateTime / formatNumber / formatRelative` |
| `@/lib/motion` | Motion presets such as `fadeUp / stagger / pageTransition / layoutSpring` |
| `@/lib/chart-theme` | `useChartColors()`; ECharts must use it to get theme colors |
| `@/lib/menu-icons` | Maps menu icon names to lucide icons |

::: tip Component usage and adding primitives
For detailed props and common page patterns, see `.claude/skills/shadcn-ui-skills/`. If a shadcn primitive is missing, add it with the relay script:

```bash
apps/web/scripts/shadcn-add.sh hover-card        # Add a component
apps/web/scripts/shadcn-add.sh --view badge      # Only view the registry content; don't write files
```

The script starts a local registry relay and runs `npx shadcn@latest add` through it. After adding a component, review the changes to `apps/web/package.json` and make sure the component uses only semantic color classes.
:::

## Import and export

- Export dialog `@/shared/components/data-transfer/ExportDialog`: `open` / `onOpenChange` / `fieldOptions` / `onConfirm({ fields, fileType })`
- Import dialog `@/shared/components/data-transfer/ImportDialog`: `onDownloadTemplate(fileType)` / `onImport(file)` / `onImported(res)`; formats are CSV / XLSX only, and error rows can be downloaded
- Downloading files: `import { downloadBlobFile } from '@/shared/utils/file'`

The Users page shows how to "export the selected rows if any are selected, otherwise export by the current filters". For the backend side, see [Backend](/en/guide/backend#import-and-export).

## Styling rules

### Semantic color classes only

Always use Tailwind semantic color classes for color. They adapt automatically to light and dark mode and to accent color changes:

| Purpose | Classes |
|---|---|
| Background / card / muted background | `bg-background` / `bg-card` / `bg-muted` |
| Text | `text-foreground` / `text-muted-foreground` |
| Accent | `text-primary` / `bg-primary` / `bg-brand-soft` |
| Status | `text-success` / `bg-success-soft` / `text-warning` / `text-danger` / `bg-danger-soft` / `text-info` |
| Brand gradient (accents only) | `bg-brand-gradient` / `bg-brand-gradient-strong` / `text-brand-gradient` / `border-brand-gradient` / `shadow-brand` / `bg-brand-glow` |

- Use neutral grays as the base and the accent color only as a highlight. `bg-brand-glow` is for small decorative areas only; don't spread it across large content backgrounds.
- Don't hard-code any accent color, or the page won't follow when the user switches it in Appearance. See [Theme & layout](/en/guide/appearance).
- Use Tailwind utilities for spacing (`space-y-4`, `gap-4`) and `tabular-nums` for numbers.
- On mobile (width under 768px), nothing may overflow horizontally; table containers scroll horizontally.
- Keep interaction animations within 150–250ms; `prefers-reduced-motion` is handled globally.

### Don'ts

| Don't | Why / use instead |
|---|---|
| Import `@douyinfe/*` | Semi Design is retired; the `frontend_no_legacy_ui` check of `pnpm verify` catches it |
| antd, material-ui or other UI libraries | Use shadcn/ui and the shared components |
| `var(--semi-*)` | Retired variables |
| Hard-coded hex colors in pages | Use semantic color classes. Exceptions: shading inside canvas / WebGL and chart data colors; for charts, prefer `useChartColors` |
| Large inline styles for layout | Use Tailwind utilities |
| Emoji as icons | Use `lucide-react` |
| A separate table, dialog or confirm box written for every page | Reuse `DataTable` / `FormDialog` / `ConfirmAction` and friends |
| Sending requests with `fetch` | Use `@/shared/api/request` |

## Menu icons

The `menus.icon` field stores an icon name (e.g. `IconUser`), which `apps/web/src/lib/menu-icons.js` maps to a lucide icon. When adding a menu, reuse a name that already exists in the map; if you need a new icon, add an entry to the map.

## i18n and side effects

- Write UI text as the Chinese source text and wire it up for translation according to the rules; see [Internationalization](/en/guide/i18n).
- When the tabs bar is on, pages are kept alive, so side effects must live in `useEffect` and be cleaned up properly; see [Theme & layout](/en/guide/appearance#tabs-bar-and-page-keep-alive).

## Testing and checks

```bash
pnpm --filter @castor-kit/web test     # Frontend Vitest
pnpm --filter @castor-kit/web lint     # Frontend ESLint
node apps/web/scripts/i18n-scan.mjs src/modules/admin/pages/users   # Scan one page directory for untranslated text
```
