# フロントエンド

フロントエンドは `apps/web` にあり、技術スタックは React 19 + Vite + shadcn/ui + Tailwind CSS v4 + motion + lucide-react、言語は TypeScript（TSX）です。このページでは、動的ルーティング、標準的なページ構成、API の呼び出し、共通コンポーネント、スタイル規約について説明します。

参考実装：

| ファイル | 参考になる用途 |
|---|---|
| `apps/web/src/modules/admin/pages/users/index.tsx` | 標準的な CRUD 一覧ページ |
| `apps/web/src/modules/admin/pages/dashboard/index.tsx` | カード、グラフ、アニメーション |
| `apps/web/src/modules/admin/pages/profile/index.tsx` | フォームページ |
| `docs/templates/frontend/` | 一覧ページと詳細ページのテンプレート |

## 動的ルーティング {#dynamic-routing}

フロントエンドには手書きのルート定義がありません。`apps/web/src/App.tsx` が現在のユーザーのメニューからルートを生成し、`lib/page-modules.ts` が `import.meta.glob` で `modules/**/pages/**/index.tsx` をスキャンして各メニューのページを見つけます。

- メニューの `path` フィールドはブラウザのアドレスです（例：`/system/users`）
- メニューの `component` フィールドは読み込むページを決めます。形式は `<module>/<pages 配下のページのパス>` です。システムのページは `pages/` の直下に置かれ（例：`admin/users`）、コンポーネント例のページはグループのディレクトリを 1 階層挟んだ `<module>/<subdir>/<page>` になります

| `component` の値 | 対応するファイル |
|---|---|
| `admin/users` | `modules/admin/pages/users/index.tsx` |
| `component_center/patterns/kanban_page` | `modules/component_center/pages/patterns/kanban_page/index.tsx` |
| `component_center/dataviz/dashboard_page` | `modules/component_center/pages/dataviz/dashboard_page/index.tsx` |

ルートが生成されるのは、有効かつ表示状態で、種類が `menu` のメニューだけです。ページコンポーネントは必要に応じて遅延読み込みされます。メニューは存在するのに対応するファイルが見つからない場合、ページ領域に「ページが設定されていません」と表示されます。

::: warning ページの配置場所
ページは必ず `apps/web/src/modules/<module>/pages/<page>/index.tsx`（間にグループのディレクトリを挟んで `pages/<subdir>/<page>/index.tsx` としてもよい）に置いてください。そうしないと動的ルーティングがページを見つけられません。対応する API ファイルは `apps/web/src/modules/<module>/api/<page>.ts` に置きます。
:::

ページを追加したら、`seed-rbac.ts` にメニューも追加する必要があります。[権限（RBAC）](/ja/guide/rbac) を参照してください。

## 標準的なページ構成

一覧ページはユーザー管理ページの構成にならって組み立てます。

```text
PageHeader     タイトル + 右側の操作（インポート / エクスポートは outline、追加は variant="brand"）
→ FilterBar    SearchInput / FilterSelect、検索 + リセット
→ DataTable    ページング、行選択、行操作（ghost ボタン + ConfirmAction による削除）
→ FormDialog   新規作成 / 編集ダイアログ（react-hook-form + FormFields）
→ ImportDialog / ExportDialog
```

- `variant="brand"` のボタンは 1 ページにつき最大 1 つです。ページタイトルの下に機能の説明文は書きません。
- 区画には `Panel`、ステータスには `StatusBadge`、空の状態には `EmptyState` を使います。
- 通知はすべて `@/lib/toast` を使います。成功時は `toast.success('已保存')`、API の失敗時は `toast.apiError(err, '保存失败')` です。
- フォームの送信に失敗したときは、`toast.apiError` を呼んだあとに再度 `throw` すると、ダイアログが開いたままになります。
- 一覧の状態（データ、ページング、フィルター、読み込み中）は `@/shared/hooks/useCrudList` で管理します。

簡略化した骨格：

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

完全な書き方は `apps/web/src/modules/admin/pages/users/index.tsx` を基準にしてください。`docs/templates/frontend/list_page/` は `pnpm scaffold` が使うテンプレートです。行の型は API ファイルから取り、フォームには専用の `FormValues` インターフェースを定義します。ページでは `any` も型アサーションも使いません。

## API の呼び出し

リクエストはすべて共有の Axios インスタンス `@/shared/api/request` を通して送ります。`fetch` や `XMLHttpRequest` を直接使わないでください。

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

型は OpenAPI ドキュメントから生成されます（`pnpm openapi:generate` が `apps/web/src/shared/api/openapi.d.ts` を出力し、パスは `/api` プレフィックスと `{param}` プレースホルダーを含みます）。エンドポイントがまだドキュメントに書かれていないと、`ApiItem` / `ApiBody` は `never` になります。`pnpm scaffold` はドキュメントの項目とこのファイルの両方を書き出します。テンプレートは `docs/templates/frontend/list_page/api.ts` です。

`request.ts` が処理済みの内容：

- `baseURL` は `/api` なので、パスは `/admin/...` と書きます。リクエストは 10 秒でタイムアウトします
- レスポンスはアンラップ済みです。`res.items`、`res.total` をそのまま使い、`res.data.items` とは**書かない**でください
- 書き込みリクエスト（POST / PUT / PATCH / DELETE）には `X-CSRF-Token` ヘッダーが自動で付きます
- `Accept-Language` ヘッダーが自動で付き、バックエンドはこれに基づいてエラーメッセージを翻訳します。`X-Time-Zone` ヘッダーはブラウザのタイムゾーンを伝え、エクスポートとダッシュボードの集計に使われます
- 401 が返されるとログインページに遷移します（ログインページとパスワード再設定ページ自体を除く）
- 失敗時に reject されるのはバックエンドが返した `{ error, ... }` オブジェクトなので、そのまま `toast.apiError` に渡せます。ネットワークエラー、タイムアウト、そうした本文のない 5xx も、読みやすいメッセージ付きの `{ error }` に変換されます

パスエイリアス `@` は `apps/web/src` を指します。

## 共通コンポーネント

コンポーネントは 2 層に分かれています。shadcn/ui のアトミックコンポーネントは `@/components/ui/*`（ソースはリポジトリ内にあり、必要に応じて変更可能）、業務向けの共通コンポーネントは `@/shared/components/*` にあります。アイコンは `lucide-react` だけを使います。各共通コンポーネントのライブのサンプル、ソース、主要なプロパティは、コンポーネント例の[コンポーネント](/ja/guide/components#components)グループにあります。

| コンポーネント | 用途 |
|---|---|
| `PageHeader` / `Panel` | ページヘッダー（タイトル + 操作）/ カードによる区画（`padded={false}` で余白なし） |
| `DataTable` + `DataPagination` | テーブル：列定義、ページング、行選択、読み込み中のスケルトンと空の状態 |
| `FilterBar` / `SearchInput` / `FilterSelect` | フィルターバー。`FilterSelect` の `''` は「すべて」を表す |
| `FormDialog` / `FormSheet` / `DetailSheet` / `DescriptionList` | 新規作成・編集ダイアログ / サイドシート / 読み取り専用の詳細シート / キーと値のリスト |
| `FormFields`：`FormInput` / `FormTextarea` / `FormNumber` / `FormSelect` / `FormMultiSelect` / `FormSwitch` / `FormRadioGroup` / `FormCheckboxGroup` / `FormDate` / `FormDateTime` / `FormTags` / `FormTreeSelect` / `FormFileUpload` / `FormImageUpload` / `FormAvatarUpload` / `FormCustom` / `FormGrid` | react-hook-form のフォームフィールド。アップロード系フィールドの値はファイルセンターのファイル ID（アバターはファイル URL） |
| `ConfirmAction` / `RowActions` | 危険な操作の確認 / 行操作 |
| `StatusBadge` | ステータスバッジ。`tone` は neutral / brand / info / success / warning / danger から選択 |
| `EmptyState` / `SegmentedTabs` / `TreeView` / `StatCard` | 空の状態 / セグメントタブ / ツリー / 指標カード |
| `DatePicker` / `DateTimePicker` / `MultiSelect` / `TagInput` | `DatePicker` の値は `'YYYY-MM-DD'`。`DateTimePicker` は API の時刻（ISO 8601）を受け取り、ブラウザのオフセット付き ISO 8601 を返す（API が UTC に変換して保存） |
| `data-transfer/ImportDialog` / `data-transfer/ExportDialog` | インポート / エクスポートダイアログ |
| `TreeSelect` / `CheckableTree` | 検索できるツリーの単一選択 / 親子連動のツリー複数選択 |
| `upload/FileUpload` / `upload/ImageUpload` / `upload/AvatarUpload` / `upload/FileIdUpload` | ファイル（ドラッグ＆ドロップ、進捗表示）/ 画像 / アバターのアップロード。`@/shared/api/files` の `uploadFile` と組み合わせてファイルセンターに保存。`FileIdUpload` はファイルセンターのファイル ID を値として直接持つ |
| `ConditionBuilder` | フィールド / 演算子 / 値からなる条件を AND / OR で組み合わせ、1 階層の条件グループも使える。制御コンポーネントで、値の `ConditionTree` はそのまま保存したり API に送ったりできるプレーンな JSON |
| `Chart` | `@/lib/echarts` のオンデマンドビルドに紐づいた ECharts ラッパー。`option` は型付きで、`summary`（スクリーンリーダー向けの代替テキスト）は必須 |
| `UserAvatar` / `markdown/MarkdownView` | 頭文字のフォールバック付きアバター / Markdown レンダラー |

フォームフィールドの例：

```tsx
<FormInput control={form.control} name="name" label="客户名称" rules={{ required: '请输入客户名称' }} />
```

ユーティリティライブラリ：

| モジュール | 内容 |
|---|---|
| `@/lib/utils` | `cn()` によるクラス名の結合 |
| `@/lib/toast` | `toast.success / error / warning / info`、`toast.apiError(err, fallback)` |
| `@/lib/format` | `formatDate / formatDateTime / formatNumber / formatRelative` |
| `@/lib/motion` | `fadeUp / stagger / pageTransition / layoutSpring` などのアニメーションのプリセット |
| `@/lib/chart-theme` | `useChartColors()` と `chartBase` / `brandLine` / `brandArea`。グラフの色は必ずここから取る |
| `@/lib/echarts` | ECharts のオンデマンドビルド。新しいグラフの種類やコンポーネントはここに登録する |
| `@/lib/menu-icons` | メニューのアイコン名から lucide アイコンへのマッピング |

::: tip コンポーネントの使い方とアトミックコンポーネントの追加
コンポーネントの詳しい props やよくあるページのパターンは `.claude/skills/shadcn-ui-skills/` を参照してください。shadcn のアトミックコンポーネントが足りない場合は、中継スクリプトで追加します。

```bash
apps/web/scripts/shadcn-add.sh hover-card        # コンポーネントを追加
apps/web/scripts/shadcn-add.sh --view badge      # registry の内容を表示するだけで、ファイルは書き込まない
```

スクリプトはローカルの registry 中継を起動して `npx shadcn@latest add` を実行します。追加したら `apps/web/package.json` の変更を確認し、コンポーネントがセマンティックカラークラスだけを使っていることを確かめてください。
:::

## インポート / エクスポート {#import-export}

- エクスポートダイアログ `@/shared/components/data-transfer/ExportDialog`：`open` / `onOpenChange` / `fieldOptions` / `onConfirm({ fields, fileType })`
- インポートダイアログ `@/shared/components/data-transfer/ImportDialog`：`onDownloadTemplate(fileType)` / `onImport(file)` / `onImported(res)`。形式は CSV / XLSX のみで、エラー行はダウンロードできます
- ファイルのダウンロード：`import { downloadBlobFile } from '@/shared/utils/file'`

ユーザー管理ページでは、「行が選択されていれば選択行を、そうでなければフィルター条件に合う行をエクスポートする」書き方を示しています。バックエンド側は [バックエンド](/ja/guide/backend#import-export) を参照してください。

## スタイル規約

### セマンティックカラークラスだけを使う

色には必ず Tailwind のセマンティックカラークラスを使います。ライトモードとダークモード、アクセントカラーの切り替えに自動で対応します。

| 用途 | クラス名 |
|---|---|
| 背景 / カード / 控えめな背景 | `bg-background` / `bg-card` / `bg-muted` |
| 文字 | `text-foreground` / `text-muted-foreground` |
| アクセントカラー | `text-primary` / `bg-primary` / `bg-brand-soft` |
| ステータス | `text-success` / `bg-success-soft` / `text-warning` / `text-danger` / `bg-danger-soft` / `text-info` |
| ブランドのグラデーション（アクセント用途のみ） | `bg-brand-gradient` / `bg-brand-gradient-strong` / `text-brand-gradient` / `border-brand-gradient` / `shadow-brand` / `bg-brand-glow` |

- ニュートラルなグレーを基調とし、アクセントカラーは差し色にとどめます。`bg-brand-glow` は小さな装飾にだけ使い、コンテンツ領域の大きな背景には敷かないでください。
- 特定のアクセントカラーを直接書かないでください。ユーザーが外観設定で切り替えても追従しなくなります。詳しくは [テーマとレイアウト](/ja/guide/appearance) を参照してください。
- 余白は Tailwind のユーティリティクラス（`space-y-4`、`gap-4`）で指定し、数字には `tabular-nums` を使います。
- モバイル（幅 768px 未満）では横方向にはみ出してはいけません。テーブルのコンテナは横スクロールさせます。
- インタラクションのアニメーションは 150〜250ms に収めます。`prefers-reduced-motion` はグローバルに処理済みです。

### 禁止事項

| 禁止 | 理由 / 代替手段 |
|---|---|
| antd、MUI などのほかの UI コンポーネントライブラリ | `@/components/ui/*`、`@/shared/components/*`、lucide-react と Tailwind のセマンティックカラークラスだけを使う |
| ページ内での 16 進カラーコードの直書き | セマンティックカラークラスを使う。canvas / WebGL 内部の着色、グラフのデータ色は例外で、グラフでは `useChartColors` を優先する |
| 大量のインラインスタイルによるレイアウト | Tailwind のユーティリティクラスを使う |
| 絵文字をアイコンとして使う | `lucide-react` を使う |
| ページごとにテーブル、ダイアログ、確認ボックスを独自に作る | `DataTable` / `FormDialog` / `ConfirmAction` などを再利用する |
| `fetch` でリクエストを送る | `@/shared/api/request` を使う |
| `echarts` / `echarts-for-react` を直接インポートする | `@/shared/components/Chart` を使い、グラフの種類は `@/lib/echarts` に登録する |

## メニューアイコン

`menus.icon` フィールドには lucide のアイコン名（例：`Users`、`Settings`）が保存されており、`apps/web/src/lib/menu-icons.ts` で lucide のアイコンコンポーネントに解決されます。メニューを追加するときは `MENU_ICONS` マッピング表にある既存の名前を使ってください。新しいアイコンが必要な場合は、そのファイルでアイコンをインポートしてマッピング表に追加します。マッピング表にない名前は `List` アイコンで表示されます。

## 多言語対応と副作用

- UI の文言は中国語の原文で書き、ルールに従って翻訳を組み込みます。[多言語対応](/ja/guide/i18n) を参照してください。
- タブバーが有効な場合、ページは状態保持されるため、副作用は必ず `useEffect` の中に書いて正しくクリーンアップしてください。[テーマとレイアウト](/ja/guide/appearance#tabs-and-keep-alive) を参照してください。

## テストとチェック

```bash
pnpm --filter @castorjs/web test     # フロントエンドの Vitest
pnpm --filter @castorjs/web lint     # フロントエンドの ESLint
node apps/web/scripts/i18n-scan.mjs src/modules/admin/pages/users   # 特定のページディレクトリの未翻訳の文言をスキャン
```
