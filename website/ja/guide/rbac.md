# 権限（RBAC）

castor-kit はロールベースのアクセス制御を採用しています。ユーザーはロールを持ち、ロールにはメニューとボタンの権限が付与されます。メニューは、サイドバーの表示、フロントエンドのルーティング、バックエンド API へのアクセス権限をまとめて決定します。

## データ構造

| テーブル | 説明 |
|---|---|
| `admin_users` | 管理画面のユーザー |
| `roles` | ロール |
| `menus` | メニューとボタン権限。`parent_id` の自己参照でツリーを構成 |
| `user_roles` | ユーザー ↔ ロール。多対多（複合主キー） |
| `role_menus` | ロール ↔ メニュー。多対多（複合主キー） |

`menus` テーブルの `menu_type` で 2 種類のレコードを区別します。

| `menu_type` | 意味 | ナビゲーションに表示されるか |
|---|---|---|
| `menu` | ページメニューまたはグループ | はい（`is_visible` が真の場合） |
| `button` | ボタン権限。ページメニューの下にぶら下がる | いいえ |

メニューレコードの主なフィールドは `id`、`name`、`code`、`icon`、`path`、`component`、`parent_id`、`sort_order`、`menu_type`、`is_visible`、`is_active` です。このうち `path` はブラウザのアドレス、`component` は読み込むフロントエンドのページを決めます（[フロントエンド](/ja/guide/frontend#dynamic-routing) を参照）。

## 権限コード

| 種類 | 形式 | 例 |
|---|---|---|
| メニュー権限 | `<domain>_<resource>` | `system_users` |
| 追加ボタン | `<domain>_<resource>_add` | `system_users_add` |
| 編集ボタン | `<domain>_<resource>_edit` | `system_users_edit` |
| 削除ボタン | `<domain>_<resource>_delete` | `system_users_delete` |
| エクスポートボタン | `<domain>_<resource>_export` | `system_users_export` |
| インポートボタン | `<domain>_<resource>_import` | `system_users_import` |

ドメインのプレフィックスは、`admin` ドメインが `system_`、`component_center` ドメインが `cc_` です。標準的な一覧ページには、上記の 5 つのボタン権限をすべて用意します。

::: info 過去のコード
コンポーネント例の 31、33〜37 番のメニューは `system_*` コード（例：`system_list_page`）を使っており、ほかにも一部のページが `cc_admin_*` 形式を使っています。これらのコードはすでにデータベースに登録済みなので変更しないでください。新しいモジュールはすべて `cc_<name>` を使い、`pnpm scaffold` が出力する権限プレフィックスと揃えてください。
:::

## 権限が適用される場所

| 場所 | 仕組み |
|---|---|
| バックエンド API | routes で `await hasMenuPermission(request, code)` を呼び出し、満たさない場合は 403 を返す。[バックエンド](/ja/guide/backend#権限チェック) を参照 |
| サイドバーとルーティング | フロントエンドは `GET /api/admin/my-menus` で現在のユーザーのメニューツリーを取得し、その中のページメニューに対してだけルートを生成する |
| フロントエンドのボタン | `useAuth()` が `menuCodes` と `hasPermission(code)` を提供し、権限に応じてボタンを非表示にできる |

本当のセキュリティ境界はバックエンドのチェックです。フロントエンドでボタンを隠すのは、あくまで使い勝手の向上のためです。

## スーパー管理者

`code = 'super_admin'` のロールはすべての権限を持ちます。

- バックエンドの `hasMenuPermission` は無条件に許可します。
- `seed-rbac` は実行のたびに、すべてのメニューをこのロールに付与します。

例外：`GET /api/admin/my-menus` はスーパー管理者の短絡判定を行わず、ロールに実際に付与されているメニューを返します。`seed-rbac` がすべてのメニューをスーパー管理者に付与するため、通常は両者が一致します。

## メニューの唯一の情報源：seed-rbac.ts

メニューとボタン権限はすべて `apps/api/scripts/seed-rbac.ts` の `MENUS_DATA` で定義されています。メニューを追加・変更するときはこのファイルを修正し、データベースに同期します。

### メニューを追加する

「システム管理」の下に「顧客管理」を追加する例です（ID は説明用です。実際の値は後述の「メニュー ID の割り当て」を参照してください）。

```ts
// Page menu
{ id: 26, name: "客户管理", code: "system_customer", icon: "IconUser", path: "/system/customers", component: "admin/customer", parent_id: 2, sort_order: 10, menu_type: "menu", is_visible: true, is_active: true },
// Button permissions: id = menu id × 10 + index
{ id: 261, name: "新增客户", code: "system_customer_add", icon: null, path: null, component: null, parent_id: 26, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
{ id: 262, name: "编辑客户", code: "system_customer_edit", icon: null, path: null, component: null, parent_id: 26, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
{ id: 263, name: "删除客户", code: "system_customer_delete", icon: null, path: null, component: null, parent_id: 26, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
{ id: 264, name: "导出客户", code: "system_customer_export", icon: null, path: null, component: null, parent_id: 26, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
{ id: 265, name: "导入客户", code: "system_customer_import", icon: null, path: null, component: null, parent_id: 26, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
```

- `component` には `pnpm scaffold` が出力する Menu component の値を使います。
- `icon` には `apps/web/src/lib/menu-icons.js` のマッピング表にある既存の名前を使います。
- 新しいメニューは、`apps/web/src/locales/menus/en-US.json` と `ja-JP.json` にも `code` をキーとして訳名を追加する必要があります。[多言語対応](/ja/guide/i18n#メニュー名の翻訳) を参照してください。

### データベースに同期する

```bash
pnpm seed:rbac -- --incremental
```

`--incremental` の動作：

- `code` で照合します。既存のメニューはフィールドだけを更新し（ID は変わりません）、存在しないメニューは指定した ID で挿入します
- 追加と更新だけを行い、既存のレコードは**一切削除しません**
- すべてのメニューをスーパー管理者に付与します
- 挿入後に `menus` テーブルの ID シーケンスを同期し、以降の追加で主キーが衝突しないようにします
- `admin` アカウントは存在しない場合にだけ作成します

メニューを削除するには、`DELETE FROM menus WHERE id = <id>` のような SQL を手動で実行する必要があります。

::: warning 全件再構築
`--incremental` を付けない `pnpm seed:rbac` は、`user_roles`、`role_menus`、`admin_users`、`roles`、`menus` を空にしてから書き込み直します。空のデータベースの初期化にだけ使ってください。
:::

::: tip デプロイ時の自動同期
Docker でデプロイした場合、コンテナは起動のたびに `setup-once` を実行し、その中で RBAC の増分同期が行われます。そのため新しいメニューはコードの更新とともに自動で反映され、既存のユーザーやロールが消えることはありません。
:::

## メニュー ID の割り当て

メニュー ID は `MENUS_DATA` にハードコードされており、`role_menus` は ID でメニューを参照するため、既存の ID を振り直すことはできません。

| 範囲 | ID の区間 |
|---|---|
| システム管理（`parent_id=2`） | 21–39 |
| コンポーネント例（`parent_id=3`） | 40–499 |
| 　管理画面（`parent_id=40`） | 401–409 |
| 　データ可視化（`parent_id=41`） | 411–419 |
| 　3D / クリエイティブ（`parent_id=42`） | 421–429 |
| 　AI アプリ（`parent_id=44`） | 441–449 |
| 　エディター / ローコード（`parent_id=45`） | 451–459 |
| 　開発ツール（`parent_id=46`） | 461–469 |
| 新しい業務ドメイン | 1000 から |
| ボタン権限 | メニュー ID × 10 + 連番（例：21 → 211〜215） |

区間の中には過去の経緯による ID が混在しています。31、33〜37 はコンポーネント例に属し、32 は定期タスク、通知とお知らせは 100002、100003 です。ID を決める前に、実際に使われている ID を確認してください。

```bash
grep -oE "id: [0-9]+" apps/api/scripts/seed-rbac.ts | awk '{print $2}' | sort -n | uniq
```

## 画面上での管理

「システム管理」の下にある 3 つのページが RBAC のデータに対応しています。

| ページ | 役割 |
|---|---|
| ユーザー管理 | ユーザーの作成、ロールの割り当て、ニックネーム / メール / 電話番号 / アバターの編集、アカウントの有効化・無効化 |
| ロール権限 | ロールの作成、ロールへのメニューとボタン権限の付与 |
| メニュー管理 | メニューツリーの確認と調整 |

### アカウントの無効化

ユーザー管理の「無効化」にはボタン権限 `system_users_status` が必要です（編集権限には含まれません）。無効化すると：

- 正しいパスワードでもログインできず、API は 403「このアカウントは無効化されています」を返し、失敗したログインとして記録します
- ログイン中のセッションは次のリクエストで無効になります（401、フロントエンドはログイン画面に戻ります）。ログインが必要なリクエストでは毎回、アカウントが存在し有効であることを確認します
- 自分自身は無効化できず、有効な最後のスーパー管理者も無効化・削除できません。インポートのステータス列にも同じ制限が適用されます

::: tip
画面上で追加・変更したメニューは `seed-rbac.ts` に書き戻されません。また、増分同期は `MENUS_DATA` に基づいて同じ `code` のメニューのフィールドを更新するため、定義済みのメニューに対して画面上で行った変更は、次回の同期（コンテナの再起動を含む）で上書きされます。長期的に保持し、コードとともにデプロイしたいメニューは `MENUS_DATA` に書いてください。
:::
