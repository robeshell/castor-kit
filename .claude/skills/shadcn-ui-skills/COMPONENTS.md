# Component list

## 1. shadcn primitives (`@/components/ui/*`)

Source in `apps/web/src/components/ui/` (JSX, new-york style, Radix primitives, configured in `apps/web/components.json`). Official docs: https://ui.shadcn.com/docs/components .

| Category | Components (the file name is the import path, e.g. `@/components/ui/button`) |
|---|---|
| Actions | `button-group`, `button` (variant: default / brand / outline / secondary / ghost / link / destructive; size: xs / sm / default / lg / icon / icon-xs / icon-sm / icon-lg), `toggle`, `toggle-group`, `dropdown-menu`, `context-menu`, `command` (cmdk) |
| Inputs | `input`, `textarea`, `select`, `checkbox`, `switch`, `radio-group`, `slider`, `calendar`, `input-group`, `label`, `field`, `form` (react-hook-form binding) |
| Overlays | `dialog`, `alert-dialog`, `sheet`, `drawer` (vaul), `popover`, `tooltip`, `hover-card` |
| Display | `card`, `badge`, `avatar`, `table`, `tabs`, `accordion`, `collapsible`, `separator`, `scroll-area`, `breadcrumb`, `pagination`, `kbd`, `alert`, `empty` |
| Feedback | `skeleton`, `spinner`, `progress`, `sonner` (the global Toaster is mounted in the app shell; pages use `@/lib/toast`) |
| Layout | `sidebar` (used by the app shell in `apps/web/src/components/app/`; pages usually don't use it directly) |

Key points:

- **Primary action button**: `<Button size="sm" variant="brand">` (brand gradient + soft glow), at most one per page; secondary actions use `outline`, inline row actions use `ghost` + `size="sm"` + `className="h-7 px-2"`
- Put lucide components directly inside buttons: `<Button><Plus />新增</Button>` (size is handled by button)
- The enter / exit animations of `dialog` / `sheet` / `alert-dialog` come from `tw-animate-css`; don't wrap them in motion
- Pages rarely use `table` / `dialog` / `alert-dialog` directly: prefer DataTable / FormDialog / ConfirmAction below

### AI Elements (`@/components/ai-elements/*`)

Vercel's AI components (https://elements.ai-sdk.dev , built on shadcn), used with the AI SDK's `useChat`; reference implementation in `apps/web/src/modules/component_center/pages/ai/ai_chat_page/`. Installed:

| File | Components |
|---|---|
| `conversation` | `Conversation` / `ConversationContent` (sticks to the bottom automatically, use-stick-to-bottom) / `ConversationScrollButton` |
| `message` | `Message` / `MessageContent` / `MessageResponse` (Streamdown streaming Markdown) / `MessageActions` / `MessageAction` |
| `prompt-input` | `PromptInput` / `PromptInputTextarea` / `PromptInputFooter` / `PromptInputTools` / `PromptInputSubmit` (shows send / stop based on useChat's `status`) |
| `suggestion` | `Suggestions` / `Suggestion` |
| `confirmation` | `Confirmation` (pass the tool call's `approval` and `state`) / `ConfirmationTitle` / `ConfirmationRequest` / `ConfirmationAccepted` / `ConfirmationRejected` / `ConfirmationActions` / `ConfirmationAction`: tool calls that need user approval (`needsApproval`); see `components/app/assistant/ToolPart.jsx` |
| `streamdown-translations.ts` | `useStreamdownTranslations()`: translations of Streamdown's button labels in all three languages, passed to `MessageResponse` as `translations` |
| `code-highlighter.ts` | castor-kit's own Streamdown code highlighting plugin: common languages only, loaded on demand (the official `@streamdown/code` bundles 200+ grammars) |

Key points: override the components' built-in English copy (pass `t('中文')` to `aria-label` / `tooltip`, pass `useStreamdownTranslations()` to `MessageResponse`); `useChat` requests don't go through axios, so `DefaultChatTransport` has to send `X-CSRF-Token` and `Accept-Language` itself; the math and mermaid plugins are not installed (too large). To add AI Elements components, see AGENTS.md "Adding AI Elements components".

## 2. castor-kit shared business components (`@/shared/components/*`)

Source in `apps/web/src/shared/components/`.

### Page skeleton

> **Loading states:** use `<Skeleton>` (fades in only after 200ms, with a shimmer); don't hand-write `animate-pulse`; match the skeleton's shape to the real content, pass `loading` to stat cards, and don't use 0 as a placeholder.

> **Languages:** shared components automatically translate the string props they receive (title / label / placeholder / options[].label / column title / rules messages / StatusBadge text, etc.) into the current language, so pages write the Chinese source text directly and add translations in the page directory's `locales/en-US.json` and `ja-JP.json`; Chinese written directly in JSX, native element attributes and text with variables use `t('... {{x}} ...', { x })` from `const { t } = useTranslation()`. Menu names use `menuLabel(menu)` (`@/lib/menu-label`). Details in AGENTS.md "Internationalization (i18n) and code comments".

> **Copy principle: don't write useless descriptions.** No feature intro under the page title; descriptions on Panels / dialogs / stat cards are written only when they carry information:
> data (`共 N 条` "N items", `最近 60 个采样点` "last 60 samples"), the current object (`正在编辑 X` "Editing X"), constraints and consequences (`删除后不可恢复` "cannot be undone once deleted", `编码创建后不可修改` "the code cannot be changed after creation"),
> shortcuts, the next step in an empty state. Never restate the title, introduce the feature or tech stack, or write marketing lines.

```jsx
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'

<PageHeader title="用户管理" actions={<>…buttons…</>} />
<Panel title="系统活跃度" description={`近 7 天共 ${total} 条`} actions={…}>content</Panel>
<Panel padded={false}>edge-to-edge content (table / list)</Panel>
```

### Tables

```jsx
import DataTable, { DataPagination } from '@/shared/components/DataTable'

const columns = [
  { key: 'id', title: 'ID', dataIndex: 'id', width: 72, className: 'text-muted-foreground tabular-nums' },
  { key: 'name', title: '名称', dataIndex: 'name', ellipsis: true },
  { key: 'status', title: '状态', dataIndex: 'status', render: (value, row, index) => <StatusBadge … /> },
  { key: 'actions', title: '', align: 'right', width: 132, render: (_, row) => … },
]
<DataTable
  columns={columns} data={data} loading={loading} rowKey="id"
  pagination={{ page, perPage, total, onChange: handlePageChange }}   // omit to disable pagination
  selectable selectedKeys={keys} onSelectionChange={(keys, rows) => …}
  onRowClick={(row) => …} emptyTitle="没有找到数据" emptyDescription="…" emptyAction={…}
  bordered dense
/>
```

### Filters

```jsx
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'   // debounce for live filtering

<FilterBar onSearch={runSearch} onReset={reset} extra={…extra items on the right…}>
  <SearchInput value={kw} onChange={setKw} onSubmit={runSearch} placeholder="搜索用户名" />
  <FilterSelect value={status} onChange={setStatus} options={[{ label: '启用', value: 'active' }]} placeholder="全部状态" />
</FilterBar>
```

For `FilterSelect`, `''` / `undefined` means "all".

### Forms (react-hook-form)

```jsx
import { useForm } from 'react-hook-form'
import { FormDialog, FormSheet } from '@/shared/components/FormDialog'
import { FormInput, FormSelect, FormSwitch, FormGrid } from '@/shared/components/FormFields'

const form = useForm({ defaultValues: { name: '', status: 'active', enabled: true } })
<FormDialog open={open} onOpenChange={setOpen} title="新建" description="…" form={form} onSubmit={save} size="sm|md|lg" submitText="保存">
  <FormInput control={form.control} name="name" label="名称" placeholder="…" rules={{ required: '请输入名称' }} />
  <FormGrid columns={2}>…two-column fields…</FormGrid>
</FormDialog>
```

- `onSubmit(values)` returns a Promise; **if it throws, the dialog stays open**, so the submit function does `catch (err) { toast.apiError(err, '保存失败'); throw err }`
- For many fields, or when the list context should stay visible, use `FormSheet` (right-side drawer, `width` defaults to 520)
- Field components (all accept `control / name / label / description / rules / required / className`):

| Component | Extra props | Value |
|---|---|---|
| `FormInput` | `type` / `placeholder` / `autoComplete` / `disabled` | string |
| `FormTextarea` | `rows` (default 3) / `placeholder` | string |
| `FormNumber` | `min` / `max` / `step` / `placeholder` | number, `null` when empty |
| `FormSelect` | `options=[{label,value}]` / `clearable` / `placeholder` | keeps the value's original type |
| `FormMultiSelect` | `options` / `placeholder` | array |
| `FormSwitch` | `layout` (default inline: label on the left, switch on the right) | boolean |
| `FormRadioGroup` | `options` / `direction` | any |
| `FormCheckboxGroup` | `options` / `columns` | array |
| `FormDate` | `placeholder` | `'YYYY-MM-DD'` |
| `FormDateTime` | - | `'YYYY-MM-DD HH:mm:ss'` |
| `FormTags` | `placeholder` | string[] |
| `FormCustom` | `render({ value, onChange, field, fieldState })` | anything |
| `FormGrid` | `columns` (default 2, single column on mobile) | layout container |

### Details / confirmation / status

```jsx
import { DetailSheet, DescriptionList } from '@/shared/components/FormDialog'
import ConfirmAction from '@/shared/components/ConfirmAction'
import RowActions from '@/shared/components/RowActions'
import StatusBadge from '@/shared/components/StatusBadge'
import EmptyState from '@/shared/components/EmptyState'

<DetailSheet open={open} onOpenChange={setOpen} title="详情" width={480} footer={…}>
  <DescriptionList columns={2} items={[{ label: '名称', value: row.name }, { label: '备注', value: row.remark, full: true }]} />
</DetailSheet>

<ConfirmAction title="删除该用户？" description="删除后不可恢复。" confirmText="删除" onConfirm={() => remove(row)}>
  <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">删除</Button>
</ConfirmAction>   // if onConfirm returns a Promise, the button shows loading and stays open on failure; destructive defaults to true

<RowActions actions={[{ label: '编辑', onClick: () => edit(row) }, { label: '复制', onClick: … }]} inline={2} />
<StatusBadge tone="success" dot>启用</StatusBadge>             // tone: neutral | brand | info | success | warning | danger
<StatusBadge tone="neutral" variant="plain" dot>草稿</StatusBadge>
<EmptyState icon={Inbox} title="暂无数据" description="…" action={<Button …/>} />
```

### Other

| Component | Usage |
|---|---|
| `SegmentedTabs` | `<SegmentedTabs value={tab} onChange={setTab} items={[{ value: 'all', label: '全部', count: 12 }]} />`; `variant="pill"` for small toggles (24h / 7d) |
| `TreeView` | `nodes=[{ key, label, children }]`, `selectedKey` / `onSelect`, `renderLabel` / `renderActions`, `defaultExpandAll`, controlled `expandedKeys` / `onExpandedChange` |
| `StatCard` / `Sparkline` / `CountUp` | `<StatCard label="用户数" value={128} delta="+12%" trend={[...]} icon={Users} />` |
| `DatePicker` / `DateTimePicker` | Date picking outside forms; value formats as above |
| `MultiSelect` / `TagInput` | Multi-select / tag input outside forms |
| `data-transfer/ImportDialog` | `open` / `onOpenChange` / `title` / `targetLabel` / `onDownloadTemplate(fileType)` / `onImport(file)` / `onImported(res)` / `errorExportFileName`; failed rows are shown automatically and can be downloaded |
| `data-transfer/ExportDialog` | `open` / `onOpenChange` / `title` / `fieldOptions` / `defaultFields` / `ruleHint` / `onConfirm({ fields, fileType })` (returns a Promise; the caller closes the dialog on success) |
| `upload/FileUpload` / `upload/ImageUpload` | `fileList` / `onFileListChange` / `uploadApi` / `limit` / `accept` / `maxSizeMB`; entries are `{ uid, name, url, status: 'uploading' \| 'success' \| 'error', response }` |

## 3. lib and hooks

| Module | Exports |
|---|---|
| `@/lib/utils` | `cn(...classes)` (clsx + tailwind-merge) |
| `@/lib/toast` | `toast.success / error / warning / info`, `toast.apiError(err, fallback)` (the backend's `{error}` message takes precedence), `errorMessage(err, fallback)` |
| `@/lib/format` | `formatDateTime(v)`, `formatDate(v)`, `formatNumber(v)`, `formatRelative(v)` (the second argument is the placeholder for empty values, default `'-'`) |
| `@/lib/motion` | `fadeUp`, `stagger.container / stagger.item`, `pageTransition`, `layoutSpring`, `EASE_OUT`, `EASE_SPRING` |
| `@/lib/chart-theme` | `useChartColors()`, `chartBase(c)`, `brandArea(c, opacity)`, `brandLine(c)`, `hexToRgba(hex, alpha)`: ECharts colors must come from here; switches automatically between light and dark |
| `@/lib/menu-icons` | `resolveMenuIcon(menu)`: menu icon field (lucide icon name, e.g. `Users`) → lucide component |
| `@/shared/hooks/useCrudList` | `{ data, total, page, perPage, loading, filters, fetchData, handleSearch, handleReset, handlePageChange }` |
| `@/shared/hooks/useIsMobile` / `@/shared/hooks/useDebouncedValue` | Breakpoint check (default 768) / debounced value |
| `@/shared/api/request` | Axios instance (CSRF, redirect to login on 401, responses already unwrapped) |
| `@/shared/utils/file` | `downloadBlobFile(blob, filename)`, `downloadErrorRowsCsv` |
