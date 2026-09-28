# Frontend

The frontend lives in `apps/web` and is built with React 19 + Vite + shadcn/ui + Tailwind CSS v4 + motion + lucide-react, written in TypeScript (TSX). This page covers dynamic routing, the standard page structure, API calls, shared components and styling rules.

Reference implementations:

| File | Use it as a reference for |
|---|---|
| `apps/web/src/modules/admin/pages/users/index.tsx` | Standard CRUD list page |
| `apps/web/src/modules/admin/pages/dashboard/index.tsx` | Cards, charts, motion |
| `apps/web/src/modules/admin/pages/profile/index.tsx` | Form page |
| `docs/templates/frontend/` | List page and detail page templates |

## Dynamic routing

There is no hand-written route table. `apps/web/src/App.tsx` builds the routes from the current user's menus, and `lib/page-modules.ts` finds each menu's page with `import.meta.glob` over `modules/**/pages/**/index.tsx`:

- A menu's `path` field is the browser URL, e.g. `/system/users`
- A menu's `component` field decides which page to load: `<module>/<page path under pages/>`, e.g. `admin/users` (system pages sit directly under `pages/`) or `<module>/<subdir>/<page>` (gallery pages sit in a group directory)

| `component` value | File |
|---|---|
| `admin/users` | `modules/admin/pages/users/index.tsx` |
| `component_center/patterns/kanban_page` | `modules/component_center/pages/patterns/kanban_page/index.tsx` |
| `component_center/dataviz/dashboard_page` | `modules/component_center/pages/dataviz/dashboard_page/index.tsx` |

Only menus that are active, visible and of type `menu` produce routes. Page components are lazy-loaded. If a menu exists but its file can't be found, the page area shows a "Page not configured" notice.

::: warning Page location
Pages must live at `apps/web/src/modules/<module>/pages/<page>/index.tsx` (optionally with group directories in between, e.g. `pages/<subdir>/<page>/index.tsx`), otherwise dynamic routing won't find them. The matching API file goes in `apps/web/src/modules/<module>/api/<page>.ts`.
:::

After adding a page, you also need to add its menu in `seed-rbac.ts`; see [Permissions (RBAC)](/guide/rbac).

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

For the complete version, `apps/web/src/modules/admin/pages/users/index.tsx` is the source of truth; `docs/templates/frontend/list_page/` is the template that `pnpm scaffold` fills in. The row type comes from the API file, the form has its own `FormValues` interface, and pages use no `any` or type casts.

## API calls

Send every request through the shared Axios instance `@/shared/api/request`; don't use `fetch` or `XMLHttpRequest` directly.

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

The types come from the OpenAPI document (`pnpm openapi:generate` writes `apps/web/src/shared/api/openapi.d.ts`; paths keep the `/api` prefix and `{param}` placeholders). If an endpoint isn't documented yet, `ApiItem` / `ApiBody` resolve to `never`. `pnpm scaffold` writes both the document entries and this file for you; the template is `docs/templates/frontend/list_page/api.ts`.

`request.ts` already takes care of:

- `baseURL` is `/api`, so paths start with `/admin/...`; requests time out after 10 seconds
- Responses are unwrapped: use `res.items` and `res.total` directly; **don't** write `res.data.items`
- Write requests (POST / PUT / PATCH / DELETE) send the `X-CSRF-Token` header automatically
- The `Accept-Language` header is sent automatically, and the backend uses it to translate errors; the `X-Time-Zone` header carries the browser's time zone, which exports and the dashboard use
- A 401 response redirects to the login page (except on the sign-in and password-reset pages themselves)
- On failure it rejects with the `{ error, ... }` object returned by the backend, which you can pass straight to `toast.apiError`. Network errors, timeouts and 5xx responses without such a body are turned into an `{ error }` with a readable message as well

The path alias `@` points to `apps/web/src`.

## Shared components

Components come in two layers: shadcn/ui primitives in `@/components/ui/*` (source lives in the repo, edit as needed) and shared business components in `@/shared/components/*`. Use only `lucide-react` for icons. Live examples of each shared component, with their source and key props, are in the Component Gallery's [Components](/guide/components#components) section.

| Component | Purpose |
|---|---|
| `PageHeader` / `Panel` | Page header (title + actions) / card section (`padded={false}` for edge-to-edge content) |
| `DataTable` + `DataPagination` | Table: column definitions, pagination, row selection, loading skeleton and empty state |
| `FilterBar` / `SearchInput` / `FilterSelect` | Filter bar; in `FilterSelect`, `''` means "all" |
| `FormDialog` / `FormSheet` / `DetailSheet` / `DescriptionList` | Create/edit dialog / side sheet / read-only detail sheet / key-value list |
| `FormFields`: `FormInput` / `FormTextarea` / `FormNumber` / `FormSelect` / `FormMultiSelect` / `FormSwitch` / `FormRadioGroup` / `FormCheckboxGroup` / `FormDate` / `FormDateTime` / `FormTags` / `FormTreeSelect` / `FormFileUpload` / `FormImageUpload` / `FormAvatarUpload` / `FormCustom` / `FormGrid` | react-hook-form form fields; upload fields hold file-center ids (avatars hold the file URL) |
| `ConfirmAction` / `RowActions` | Confirmation for destructive actions / row actions |
| `StatusBadge` | Status badge; `tone` can be neutral / brand / info / success / warning / danger |
| `EmptyState` / `SegmentedTabs` / `TreeView` / `StatCard` | Empty state / segmented tabs / tree / stat card |
| `DatePicker` / `DateTimePicker` / `MultiSelect` / `TagInput` | `DatePicker` values are `'YYYY-MM-DD'`; `DateTimePicker` takes an API time (ISO 8601) and returns ISO 8601 with the browser's offset, which the API stores as UTC |
| `data-transfer/ImportDialog` / `data-transfer/ExportDialog` | Import / export dialogs |
| `TreeSelect` / `CheckableTree` | Searchable single-pick tree / multi-select tree with cascading checks |
| `upload/FileUpload` / `upload/ImageUpload` / `upload/AvatarUpload` / `upload/FileIdUpload` | File (drag and drop, progress) / image / avatar upload; pair with `uploadFile` from `@/shared/api/files` to store in the file center. `FileIdUpload` holds file-center ids directly |
| `ConditionBuilder` | Conditions (field / operator / value) combined with AND / OR, plus one level of condition groups; controlled, and its value `ConditionTree` is plain JSON to save or send to an API |
| `Chart` | ECharts wrapper bound to the on-demand build in `@/lib/echarts`; takes a typed `option` and a required `summary` (text alternative for screen readers) |
| `UserAvatar` / `markdown/MarkdownView` | Avatar with a letter fallback / Markdown renderer |

Form field example:

```tsx
<FormInput control={form.control} name="name" label="客户名称" rules={{ required: '请输入客户名称' }} />
```

Utility libraries:

| Module | Contents |
|---|---|
| `@/lib/utils` | `cn()` for merging class names |
| `@/lib/toast` | `toast.success / error / warning / info`, `toast.apiError(err, fallback)` |
| `@/lib/format` | `formatDate / formatDateTime / formatNumber / formatRelative` |
| `@/lib/motion` | Motion presets such as `fadeUp / stagger / pageTransition / layoutSpring` |
| `@/lib/chart-theme` | `useChartColors()` plus `chartBase` / `brandLine` / `brandArea`; charts must take their colors from here |
| `@/lib/echarts` | The on-demand ECharts build; register new chart types and components here |
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

The Users page shows how to "export the selected rows if any are selected, otherwise export by the current filters". For the backend side, see [Backend](/guide/backend#import-and-export).

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
- Don't hard-code any accent color, or the page won't follow when the user switches it in Appearance. See [Theme & layout](/guide/appearance).
- Use Tailwind utilities for spacing (`space-y-4`, `gap-4`) and `tabular-nums` for numbers.
- On mobile (width under 768px), nothing may overflow horizontally; table containers scroll horizontally.
- Keep interaction animations within 150–250ms; `prefers-reduced-motion` is handled globally.

### Don'ts

| Don't | Why / use instead |
|---|---|
| antd, MUI or other UI component libraries | Use only `@/components/ui/*`, `@/shared/components/*`, lucide-react and Tailwind semantic color classes |
| Hard-coded hex colors in pages | Use semantic color classes. Exceptions: shading inside canvas / WebGL and chart data colors; for charts, prefer `useChartColors` |
| Large inline styles for layout | Use Tailwind utilities |
| Emoji as icons | Use `lucide-react` |
| A separate table, dialog or confirm box written for every page | Reuse `DataTable` / `FormDialog` / `ConfirmAction` and friends |
| Sending requests with `fetch` | Use `@/shared/api/request` |
| Importing `echarts` / `echarts-for-react` directly | Use `@/shared/components/Chart`; register chart types in `@/lib/echarts` |

## Menu icons

The `menus.icon` field stores a lucide icon name (e.g. `Users`, `Settings`), which `apps/web/src/lib/menu-icons.ts` resolves to a lucide icon component. When adding a menu, reuse a name that already exists in the `MENU_ICONS` map; if you need a new icon, import it in that file and add it to the map. Names not in the map fall back to the `List` icon.

## i18n and side effects

- Write UI text as the Chinese source text and wire it up for translation according to the rules; see [Internationalization](/guide/i18n).
- When the tabs bar is on, pages are kept alive, so side effects must live in `useEffect` and be cleaned up properly; see [Theme & layout](/guide/appearance#tabs-bar-and-page-keep-alive).

## Testing and checks

```bash
pnpm --filter @castorjs/web test     # Frontend Vitest
pnpm --filter @castorjs/web lint     # Frontend ESLint
node apps/web/scripts/i18n-scan.mjs src/modules/admin/pages/users   # Scan one page directory for untranslated text
```
