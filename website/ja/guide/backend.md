# バックエンド

バックエンドは `apps/api` にあり、技術スタックは Fastify 5 + Zod + Drizzle ORM + PostgreSQL、言語は TypeScript（strict）です。このページでは、レイヤールール、API 規約、権限チェック、エラー処理、データベースマイグレーション、インポート / エクスポートについて説明します。

新機能は、まず `pnpm scaffold` で骨格を生成し（[AI 駆動開発](/ja/guide/ai-workflow#pnpm-scaffold) を参照）、そのうえでこのページのルールに従ってビジネスロジックを補うことをおすすめします。参考実装は `apps/api/src/modules/admin/users/` です。

## レイヤー構成

```text
db/schema/<domain>/<name>.ts
  → modules/<domain>/<name>/{schema,repository,service,routes}.ts
  → modules/<domain>/router.ts
  → src/router.ts
```

| 層 | ファイル | 役割 | 禁止事項 |
|---|---|---|---|
| model | `db/schema/<domain>/<name>.ts` | Drizzle の `pgTable(...)` によるテーブル定義 + `xxxToDict()` によるシリアライズ | ビジネスロジック |
| schema | `modules/<domain>/<name>/schema.ts` | リクエストスキーマ、インポート / エクスポートのフィールドマッピング `EXPORT_FIELD_MAP` / `IMPORT_HEADER_MAP` | データベース操作 |
| repository | `modules/<domain>/<name>/repository.ts` | 純粋なデータベースの読み書き（Drizzle のクエリ） | ビジネスロジック、HTTP |
| service | `modules/<domain>/<name>/service.ts` | ビジネスロジック。エラー時は `ServiceError` をスロー | `reply`、`session` などの HTTP オブジェクトの使用 |
| routes | `modules/<domain>/<name>/routes.ts` | Fastify のルート + 権限チェック + service の呼び出し | SQL を直接書くこと |
| ドメインの組み立て | `modules/<domain>/router.ts` | `await registerXxxRoutes(app)` | — |
| 第 1 階層の組み立て | `src/router.ts` + `db/schema/index.ts` | 業務ドメインの登録、テーブル定義のエクスポート | — |

パスエイリアス：バックエンドの `@/*` は `apps/api/src/*` を指します（例：`@/common/auth`）。

### テーブル定義

```ts
import { pgTable, serial, varchar } from 'drizzle-orm/pg-core'
import { toIso } from '@/common/serialize'
import { createdAt, updatedAt } from '../columns'

export const customers = pgTable('customers', {
  id: serial().primaryKey().notNull(),
  name: varchar({ length: 100 }).notNull(),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

export type Customer = typeof customers.$inferSelect

export function customerToDict(item: Customer) {
  return {
    id: item.id,
    name: item.name,
    created_at: toIso(item.created_at),
    updated_at: toIso(item.updated_at),
  }
}
```

### 登録

- 既存のドメイン（`admin`、`component_center`）にモジュールを追加する場合は、`pnpm scaffold` が `db/schema/index.ts` と `modules/<domain>/router.ts` に自動で登録します。
- 新しい業務ドメインを追加する場合は、`src/router.ts` でそのドメインの登録関数を呼び出し、`db/schema/index.ts` に `export * from './<domain>/<name>'` を追加する作業を手動で行います。

## API 規約

業務 API はすべて `/api/admin/` の下に置きます。リソース名はハイフン区切りの複数形にします。たとえば `customer_order` は `/api/admin/customer-orders` に対応します。

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/admin/<resource>s` | 一覧。パラメーターは `page`、`per_page`、`search` |
| `POST` | `/api/admin/<resource>s` | 新規作成。201 を返す |
| `GET` | `/api/admin/<resource>s/<id>` | 詳細（必要に応じて） |
| `PUT` | `/api/admin/<resource>s/<id>` | 編集 |
| `DELETE` | `/api/admin/<resource>s/<id>` | 削除 |
| `POST` | `/api/admin/<resource>s/export` | エクスポート |
| `GET` | `/api/admin/<resource>s/template` | インポートテンプレートのダウンロード。パラメーターは `file_type=csv\|xlsx` |
| `POST` | `/api/admin/<resource>s/import` | インポート。`multipart/form-data`、フィールド名は `file` |

### レスポンス形式

- 一覧：`{ items, total, page, per_page }`
- エラー：`{ error: string, ...payload }`
- 5xx はすべて「服务器内部错误，请稍后重试」（日本語 UI では「サーバー内部エラーが発生しました。しばらくしてから再度お試しください。」）を返し、内部情報は漏らしません。スタックトレースはログに書き込みます
- `/api/*` 配下の 404、405、500 はすべて JSON を返し、フロントエンドの `index.html` にフォールバックすることはありません

### リクエスト処理ユーティリティ

| ユーティリティ | インポート元 | 用途 |
|---|---|---|
| `intParam('item_id')` | `@/common/http` | 数字だけにマッチするパスパラメーターを生成 |
| `parseIntParam(value)` | `@/common/http` | パスパラメーターを解析 |
| `jsonBody(request)` | `@/common/http` | リクエストボディを読み取る（オブジェクトでない場合や JSON でない場合は `{}` として扱う） |
| `queryString(request, key)` | `@/common/http` | クエリパラメーターを読み取る |
| `getUploadedFile(request)` | `@/common/http` | アップロードされたファイルを読み取る |
| `parsePagination(query)` | `@/common/pagination` | ページングパラメーター。デフォルトは 20 件、上限は 200 件 |

### 横断的な規約

- **日時**：`timestamp` / `date` 列はテキストとして読み取り、JS の `Date` を経由しません。出力には必ず `toIso()` を使います。形式は `YYYY-MM-DDTHH:mm:ss[.ffffff]` で、`Z` サフィックスは付きませんが、値は UTC です。`Date#toISOString()` の使用は禁止です。
- **数値**：`numeric` 列は文字列のまま出力します（例：`"12.50"`）。`toDict()` の中で数値に変換しないでください。
- **リクエスト検証は緩やかに**：リクエストスキーマはすべてのフィールドを任意とし、余分なフィールドも許可します。正規化と必須チェックは service で行います。
- **操作ログ**：logs モジュールが登録するグローバルな `onResponse` フックが `operation_logs` にまとめて書き込むので、service の中で手書きしないでください。
- **CSRF**：`/api/*` 配下の書き込みリクエストには `X-CSRF-Token` ヘッダーが必要です。フロントエンドの `request.js` が自動で処理し、ログイン API は対象外です。

## 権限チェック

権限関数はすべて `@/common/auth` からインポートします。

```ts
import type { FastifyInstance } from 'fastify'
import { hasMenuPermission, loginRequired } from '@/common/auth'
import { intParam, jsonBody, parseIntParam } from '@/common/http'

export async function registerCustomerRoutes(app: FastifyInstance): Promise<void> {
  const service = new CustomerService(app.db)
  const opts = { preHandler: loginRequired }

  app.post('/api/admin/customers', opts, async (request, reply) => {
    if (!(await hasMenuPermission(request, 'system_customer_add'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return reply.status(201).send(await service.createItem(jsonBody(request)))
  })

  app.put(`/api/admin/customers/${intParam('item_id')}`, opts, async (request, reply) => {
    // Look up the record first (404), then check the permission (403)
    const item = await service.getOr404(parseIntParam((request.params as { item_id: string }).item_id))
    if (!(await hasMenuPermission(request, 'system_customer_edit'))) {
      return reply.status(403).send({ error: '无权限' })
    }
    return service.updateItem(item, jsonBody(request))
  })
}
```

| 関数 | 説明 |
|---|---|
| `loginRequired` | preHandler。未ログインの場合は 401 を返す |
| `hasMenuPermission(request, code)` | あるメニューまたはボタンの権限を持っているか。**非同期**なので必ず `await` する |
| `hasAnyMenuPermission(request, ...codes)` | いずれか 1 つのコードを満たせばよい |
| `menuPermissionRequired(code)` | preHandler 形式：`{ preHandler: [loginRequired, menuPermissionRequired('system_customer')] }` |

::: danger よくある間違い
- `await hasMenuPermission(...)` の `await` を忘れる：Promise は常に truthy なので、権限チェックが機能しなくなります。
- routes ファイルで `hasPermission` 関数を独自に定義する：`pnpm verify` の `no_local_has_permission` でブロックされます。
:::

権限コードのルールとメニューの設定は [権限（RBAC）](/ja/guide/rbac) を参照してください。

## エラー処理

service 層で業務エラーが発生した場合は `ServiceError` をスローします。

```ts
import { ServiceError } from '@/common/errors'

throw new ServiceError('客户名称已存在', 400)
throw new ServiceError('导入失败，存在错误数据', 400, { error_rows, error_count })
```

グローバルのエラーハンドラーがこれを `{ error: message, ...payload }` に変換し、ステータスコードには第 2 引数（デフォルトは 400）を使います。ステータスコードが 500 以上の場合、フロントエンドに返す文言は汎用的なサーバーエラーのメッセージに置き換えられます。

そのほかのエラー：

| 状況 | レスポンス |
|---|---|
| Zod によるリクエスト検証の失敗 | 400。`error` は最初の検証メッセージ |
| 未知の例外 | 500。「服务器内部错误，请稍后重试」（サーバー内部エラーが発生しました。しばらくしてから再度お試しください。） |
| マッチしない `/api/*` への GET リクエスト | 404 の JSON |
| マッチしないその他のメソッド | 405 `{ error: '请求方法不允许' }`（許可されていないリクエストメソッドです） |

エラーメッセージは中国語で書くだけでかまいません。バックエンドがリクエストヘッダー `Accept-Language` に応じて英語または日本語に翻訳します。新しい文言は翻訳を登録する必要があります。[多言語対応](/ja/guide/i18n#backend-error-translation) を参照してください。

### データベース制約エラーのマッピング

scaffold が生成する service（および `docs/templates/backend/service.ts` テンプレート）は、書き込み処理をトランザクションで囲み、データベースエラーを捕捉すると `apps/api/src/common/db-errors.ts` の `dbConstraintError()` を呼び出して、ユーザー入力に起因する制約エラーを 400 に変換します。

| PostgreSQL のエラーコード | 返される文言 |
|---|---|
| `23505` 一意制約 | 数据重复：唯一字段的值已存在（データが重複しています：一意の項目の値が既に存在します） |
| `23502` NOT NULL 制約 | 必填字段不能为空（必須項目は空にできません） |
| `23503` 外部キー制約 | 关联的数据不存在或仍被引用（関連データが存在しないか、まだ参照されています） |
| `23514` CHECK 制約 | 数据不符合约束条件（データが制約条件を満たしていません） |
| `22001` | 字段长度超出限制（項目の長さが上限を超えています） |
| `22003` | 数值超出范围（数値が範囲外です） |
| `22007` | 日期时间格式不正确（日時の形式が正しくありません） |
| `22008` | 日期时间超出范围（日時が範囲外です） |
| `22P02` | 字段格式不正确（項目の形式が正しくありません） |

そのほかのデータベースエラーは 500 として扱われます。つまり、テーブル定義に `.notNull()` や `.unique()` を追加すれば、追加のコードなしで妥当な 400 のメッセージが得られます。フィールド名を含むメッセージ（例：「客户编码已存在」＝顧客コードは既に存在します）が必要な場合は、service で書き込み前に重複チェックを行ってください。

## データベースマイグレーション

テーブル定義は `apps/api/src/db/schema/**` にあり、マイグレーションは drizzle-kit が `apps/api/drizzle/` に生成します。実行履歴はデータベースの `drizzle.__drizzle_migrations` テーブルに保存されます。

### 手順

```bash
# 1. db/schema のテーブル定義を変更したら、マイグレーションを生成する
pnpm db:generate --name add_customer_phone

# 2. apps/api/drizzle/ に新しく生成された SQL をレビューする

# 3. マイグレーションを適用する
pnpm db:migrate

# 4. テーブル構造が実際に DB に反映されたことを確認する（データベース名は apps/api/.env.development の DEV_DATABASE_URL に従う）
psql -d castor_kit -c '\d customers'
```

::: warning pnpm db:generate の後ろに -- を書かないこと
`pnpm db:generate --name <説明>` は引数をそのまま drizzle-kit に渡しますが、drizzle-kit は `--` を認識しません。castor-kit 独自のスクリプト（scaffold、verify、seed:rbac、openapi:generate）では、引数の前の `--` はあってもなくてもかまいません。
:::

### ルール

- マイグレーション SQL を手書きしないでください。journal のチェーンが壊れます（`pnpm verify` の `migration_chain` がチェックします）。
- マイグレーションは必ず実際に実行し、`psql \d` で確認してください。`pnpm verify` の `migration_applied` が journal とデータベースの記録を照合します。
- 新しいテーブルのマイグレーションは scaffold が自動で生成します。その後にテーブル構造を変更する場合は、`pnpm db:generate --name <説明>` で差分のマイグレーションを生成してください。
- ほかの環境にデプロイするときは `pnpm db:migrate && pnpm seed:rbac -- --incremental` を実行します。Docker でデプロイする場合はコンテナの起動時に自動で行われます。[デプロイガイド](/ja/deploy/) を参照してください。

## インポート / エクスポート {#import-export}

インポート / エクスポートは **csv と xlsx** のみに対応しています。`.xls` をアップロードすると 400 が返り、`.xlsx` で保存し直すよう案内されます。

### ユーティリティ関数（`@/common/tabular`）

| 関数 | 説明 |
|---|---|
| `buildTable(headers, rows, baseFilename, fileType)` | 表ファイルのペイロードを構築。csv は BOM 付き |
| `sendTable(reply, table)` | `Content-Type`、`Content-Disposition` を設定して送信 |
| `readTableFile(file)` | アップロードされたファイルを読み取り、`{ fieldnames, rows, fileType }` を返す。上限は 5MB、rows には行番号が付く |
| `normalizeTableFileType(raw, fallback)` | ファイル形式を正規化 |
| `sanitizeFormula()` | 数式インジェクション対策 |

### フィールドマッピング

モジュールの `schema.ts` で定義します。

- `EXPORT_FIELD_MAP`：フィールド → 中国語の列見出し。変換が必要な場合は `[中国語の列見出し, 値を取り出す関数]` の形で書きます。たとえば列挙型のコードを中国語で表示する場合などです。
- `IMPORT_HEADER_MAP`：中国語の列見出し → フィールド。

インポート / エクスポートするファイルの列見出しは中国語のままで、UI の言語によって変わりません。

### インポートのトランザクション

インポートはバッチ全体を 1 つのトランザクションで処理します。エラー行がある場合は `ServiceError('导入失败，存在错误数据', 400, { error_rows, error_count })` をスローし、バッチ全体をロールバックします。フロントエンドのインポートダイアログはエラー行を表示し、ダウンロードすることもできます。

### 権限

エクスポートはボタン権限 `<perm>_export`、インポート用テンプレートのダウンロードとインポートはどちらも `<perm>_import` で判定します。閲覧権限や `_edit` で代用しないでください。フロントエンドのコンポーネントは [フロントエンド](/ja/guide/frontend#import-export) を参照してください。

## OpenAPI

```bash
pnpm openapi:generate              # ドキュメントのないルート + メソッドに骨格を追加し、規約をチェック
pnpm openapi:generate -- --strict  # 規約に合わない API と理由を一覧表示し、あれば 0 以外で終了（--dry-run で書き戻さない）
pnpm openapi:apifox                # Apifox にプッシュ
```

`docs/apifox-full.openapi.json` は API の唯一の説明書で、外部の呼び出し側、Apifox、[AI アシスタント](/ja/guide/assistant) はすべてこれを頼りにします。そのため登録済みの `/api` の API はすべて完全に書く必要があります：中国語の summary、description（必要な権限、データ権限、重要な動作）、タグ 1 つと Apifox フォルダー、パスとクエリのパラメーター、リクエストボディのフィールド（ボディを読まない場合は `"x-no-body": true`）、成功レスポンスの構造と起こりうるエラーコード。規則の全文はリポジトリの `AGENTS.md`「OpenAPI 编写规范」にあり、API テストと `pnpm verify` で強制されます。`openapi:generate` はドキュメントのない API に骨格を追加するだけで、骨格はコードに沿って書き上げるまでチェックを通りません。Apifox へのプッシュには `APIFOX_PROJECT_ID` と `APIFOX_ACCESS_TOKEN` が必要です。[設定](/ja/reference/configuration) を参照してください。

## テスト

バックエンドのテストは Vitest を使い、実際の PostgreSQL テスト用データベースに接続します。ルートのテストは `app.inject()` でリクエストを送り、モジュールごとに 1 つのテストファイル（`admin-*.test.ts`、`cc-*.test.ts`）を用意します。

```bash
pnpm --filter @castor-kit/api test
```

テスト用データベースの準備は、[クイックスタート](/ja/guide/getting-started) の「テストを実行する」の節を参照してください。
