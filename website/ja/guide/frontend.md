# フロントエンド

フロントエンドは `apps/web` にあり、技術スタックは React 19 + Vite + shadcn/ui + Tailwind CSS v4 + motion + lucide-react、言語は JavaScript（JSX）です。このページでは、動的ルーティング、標準的なページ構成、API の呼び出し、共通コンポーネント、スタイル規約について説明します。

参考実装：

| ファイル | 参考になる用途 |
|---|---|
| `apps/web/src/modules/admin/pages/users/index.jsx` | 標準的な CRUD 一覧ページ |
| `apps/web/src/modules/admin/pages/dashboard/index.jsx` | カード、グラフ、アニメーション |
| `apps/web/src/modules/admin/pages/profile/index.jsx` | フォームページ |
| `docs/templates/frontend/` | 一覧ページと詳細ページのテンプレート |

## 動的ルーティング {#dynamic-routing}

フロントエンドには手書きのルート定義がありません。`apps/web/src/App.jsx` が `import.meta.glob('./modules/**/pages/**/index.jsx')` ですべてのページをスキャンし、現在のユーザーのメニューからルートを生成します。

- メニューの `path` フィールドはブラウザのアドレスです（例：`/system/users`）
- メニューの `component` フィールドは読み込むページを決めます。形式は `<module>/<subdir>/<page>` です

| `component` の値 | 対応するファイル |
|---|---|
| `admin/users` | `modules/admin/pages/users/index.jsx` |
| `component_center/admin/list_page` | `modules/component_center/pages/admin/list_page/index.jsx` |
| `component_center/dataviz/dashboard_page` | `modules/component_center/pages/dataviz/dashboard_page/index.jsx` |

ルートが生成されるのは、有効かつ表示状態で、種類が `menu` のメニューだけです。ページコンポーネントは必要に応じて遅延読み込みされます。メニューは存在するのに対応するファイルが見つからない場合、ページ領域に「ページが設定されていません」と表示されます。

::: warning ページの配置場所
ページは必ず `apps/web/src/modules/<module>/pages/<subdir>/<page>/index.jsx` に置いてください。そうしないと動的ルーティングがページを見つけられません。対応する API ファイルは `apps/web/src/modules/<module>/api/<page>.js` に置きます。
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

完全な書き方は `apps/web/src/modules/admin/pages/users/index.jsx` を基準にしてください。

## API の呼び出し

リクエストはすべて共有の Axios インスタンス `@/shared/api/request` を通して送ります。`fetch` や `XMLHttpRequest` を直接使わないでください。

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

`request.js` が処理済みの内容：

- `baseURL` は `/api` なので、パスは `/admin/...` と書きます
- レスポンスはアンラップ済みです。`res.items`、`res.total` をそのまま使い、`res.data.items` とは**書かない**でください
- 書き込みリクエスト（POST / PUT / PATCH / DELETE）には `X-CSRF-Token` ヘッダーが自動で付きます
- `Accept-Language` ヘッダーが自動で付き、バックエンドはこれに基づいてエラーメッセージを翻訳します
- 401 が返されるとログインページに遷移します
- 失敗時に reject されるのはバックエンドが返した `{ error, ... }` オブジェクトなので、そのまま `toast.apiError` に渡せます

パスエイリアス `@` は `apps/web/src` を指します。

## 共通コンポーネント

コンポーネントは 2 層に分かれています。shadcn/ui のアトミックコンポーネントは `@/components/ui/*`（ソースはリポジトリ内にあり、必要に応じて変更可能）、業務向けの共通コンポーネントは `@/shared/components/*` にあります。アイコンは `lucide-react` だけを使います。

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
| `DatePicker` / `DateTimePicker` / `MultiSelect` / `TagInput` | 日付の値の形式は `'YYYY-MM-DD'` / `'YYYY-MM-DD HH:mm:ss'` |
| `data-transfer/ImportDialog` / `data-transfer/ExportDialog` | インポート / エクスポートダイアログ |
| `TreeSelect` / `CheckableTree` | 検索できるツリーの単一選択 / 親子連動のツリー複数選択 |
| `upload/FileUpload` / `upload/ImageUpload` / `upload/AvatarUpload` | ファイル（ドラッグ＆ドロップ、進捗表示）/ 画像 / アバターのアップロード。`@/shared/api/files` の `uploadFile` と組み合わせてファイルセンターに保存 |

フォームフィールドの例：

```jsx
<FormInput control={form.control} name="name" label="客户名称" rules={{ required: '请输入客户名称' }} />
```

ユーティリティライブラリ：

| モジュール | 内容 |
|---|---|
| `@/lib/utils` | `cn()` によるクラス名の結合 |
| `@/lib/toast` | `toast.success / error / warning / info`、`toast.apiError(err, fallback)` |
| `@/lib/format` | `formatDate / formatDateTime / formatNumber / formatRelative` |
| `@/lib/motion` | `fadeUp / stagger / pageTransition / layoutSpring` などのアニメーションのプリセット |
| `@/lib/chart-theme` | `useChartColors()`。ECharts では必ずこれでテーマカラーを取得する |
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
| `@douyinfe/*` のインポート | Semi Design は廃止済み。`pnpm verify` の `frontend_no_legacy_ui` でブロックされる |
| antd、material-ui などのほかの UI ライブラリ | shadcn/ui と共通コンポーネントを使う |
| `var(--semi-*)` | 廃止済みの変数 |
| ページ内での 16 進カラーコードの直書き | セマンティックカラークラスを使う。canvas / WebGL 内部の着色、グラフのデータ色は例外で、グラフでは `useChartColors` を優先する |
| 大量のインラインスタイルによるレイアウト | Tailwind のユーティリティクラスを使う |
| 絵文字をアイコンとして使う | `lucide-react` を使う |
| ページごとにテーブル、ダイアログ、確認ボックスを独自に作る | `DataTable` / `FormDialog` / `ConfirmAction` などを再利用する |
| `fetch` でリクエストを送る | `@/shared/api/request` を使う |

## メニューアイコン

`menus.icon` フィールドにはアイコン名（例：`IconUser`）が保存されており、`apps/web/src/lib/menu-icons.js` で lucide アイコンにマッピングされます。メニューを追加するときはマッピング表にある既存の名前を使い、新しいアイコンが必要な場合はマッピング表に 1 行追加してください。

## 多言語対応と副作用

- UI の文言は中国語の原文で書き、ルールに従って翻訳を組み込みます。[多言語対応](/ja/guide/i18n) を参照してください。
- タブバーが有効な場合、ページは状態保持されるため、副作用は必ず `useEffect` の中に書いて正しくクリーンアップしてください。[テーマとレイアウト](/ja/guide/appearance#tabs-and-keep-alive) を参照してください。

## テストとチェック

```bash
pnpm --filter @castor-kit/web test     # フロントエンドの Vitest
pnpm --filter @castor-kit/web lint     # フロントエンドの ESLint
node apps/web/scripts/i18n-scan.mjs src/modules/admin/pages/users   # 特定のページディレクトリの未翻訳の文言をスキャン
```
