# AI 駆動開発

Castor が目指すのは、業務要件を自然言語で伝えるだけで、AI コーディングツールが技術的な詳細を自ら推測し、プロジェクトの規約に沿った機能モジュール（テーブル、API、画面、権限、マイグレーション）をエンドツーエンドで納品し、検証ゲートを通過させることです。

このページでは、この流れを支える 4 つの要素を紹介します。プロジェクトコンテキスト `AGENTS.md`、各 AI ツールの設定、コード骨格ジェネレーター `pnpm scaffold`、検証ゲート `pnpm verify` です。

## AGENTS.md：唯一のプロジェクトコンテキスト

リポジトリのルートにある `AGENTS.md` は AI 向けに書かれた完全なプロジェクト説明で、すべての AI ツールがこれを基準にします。内容は次のとおりです。

- 技術スタック、ディレクトリ構成、命名規則
- バックエンドのレイヤールール、ルーティング規約、権限チェックの書き方、横断的な規約（日時、数値、エラー、CSRF）
- フロントエンドの動的ルーティング、ページ構成、共通コンポーネント、デザイントークン、多言語対応のルール
- インポート / エクスポートの規約、RBAC の規約、メニュー ID の割り当てルールと現在のメニューツリー
- フィールド型の推測表（業務上の説明 → フィールド型）
- アンチパターン一覧と標準の納品フロー

各ツール専用の設定ファイルは補足にとどめ、いずれも `AGENTS.md` を参照するようになっています。プロジェクトの規約を変更するときは、まず `AGENTS.md` を修正してください。

より踏み込んだアーキテクチャの説明は `docs/architecture.md`、フロントエンドの UI 方針は `docs/frontend-design-system.md` にあります。

## 対応している AI ツール

| ツール | 読み込むファイル |
|---|---|
| Claude Code | `CLAUDE.md`。スキルは `.claude/skills/`（`new-feature-autopilot`、`shadcn-ui-skills`） |
| Codex CLI | `AGENTS.md`（自動で読み込み）。スキルは `.agents/skills/` |
| Cursor、Windsurf、GitHub Copilot など | `AGENTS.md`（いずれも自動で読み込み） |
| ドキュメントサイトを読む AI | サイトの `/llms.txt`（エントリーとなる索引。ソースは `website/public/llms.txt`） |
| MCP クライアント | `apps/mcp`。後述の [MCP Server](#mcp-server) を参照 |

`.claude/skills/` と `.agents/skills/` の内容は同一に保たれており、バックエンドのテスト `skills-sync.test.ts` が両者の同期をチェックします。

## 新機能の納品フロー

`new-feature-autopilot` スキル（Claude Code で `/new-feature-autopilot` と入力するか、「XX 機能を作って」と直接伝える）は、次の 5 つのステップで進みます。ほかのツールも、それぞれのルールファイルを通じて同じフローに従います。

### 1. コンテキストを読み込む

AI は `AGENTS.md`、`docs/templates/` にあるコード骨格のテンプレート、既存の参考モジュール（バックエンドは `apps/api/src/modules/admin/users/`、フロントエンドは `apps/web/src/modules/admin/pages/users/index.tsx`）、そして `apps/api/scripts/seed-rbac.ts` のメニューツリーを読み込みます。既存モジュールの拡張で要件を満たせる場合は、拡張を優先します。

### 2. 技術仕様を推測する

AI は次の内容を内部で推測し、あなたに質問はしません。

- リソース名と所属ドメイン（`admin` または `component_center`）
- API パス（例：`/api/admin/customer-orders`）
- フィールド名とフィールド型（後述のフィールド型の推測表に基づく）
- 権限コード：`admin` ドメインは `system_<name>`、`component_center` ドメインは `cc_<name>`。ボタン権限には `_add` / `_edit` / `_delete` / `_export` / `_import` を付ける
- フロントエンドのファイルパス、親メニュー、マイグレーション名、そしてページテンプレート（要件が別の[ページテンプレート](/ja/guide/components#from-a-pattern)を求めない限り、通常の一覧）

推測した内容は [spec ファイル](#spec-ファイル)に書き出し、`pnpm scaffold -- --spec <file> --validate-only` で検証します。検証結果には API パス、権限、テーブル、scaffold が割り当てるメニュー ID も表示されます。

### 3. 業務プレビューを提示する

AI は業務レベルの情報だけを提示し、あなたの確認や修正を待ちます。

```text
顧客管理

場所：業務管理 → 顧客管理
表示形式：一覧
機能：一覧表示、追加、編集、削除、インポート、エクスポート
フィールド：
  · 顧客名（必須）
  · 電話番号
  · ステータス

この内容で進めてよろしいですか？ 調整が必要な点はありますか？
```

AI が追加で質問するのは、データモデルに取り返しのつかない曖昧さがある場合、外部システムの設定が必要な場合、権限の境界がセキュリティに影響する場合に限られます。

### 4. 実装する

1. `pnpm scaffold -- --spec <file>` でモジュールを生成します（先に `--dry-run` で書き込むファイルを確認できます）。
2. `db/schema → schema → repository → service → routes` の順にビジネスロジックを補います。中国語のラベル、必須・一意・デフォルト値のルール、選択肢は spec からすでに生成されています。それ以外（テーブル間の関連、項目をまたぐチェック、計算項目）はここで書きます。
3. フロントエンドのページを仕上げます（ページ固有の文言の翻訳、追加のバリデーション）。または選んだページテンプレートに倣ってページを作り直します。
4. spec に `menu` があれば、メニューとボタン権限は scaffold が `seed-rbac.ts` に書き込み済みです。なければ手で追加します。そのうえで `pnpm seed:rbac -- --incremental` を実行します。
5. 新しく生成されたマイグレーション SQL をレビューしてから `pnpm db:migrate` を実行し、`psql -d <データベース名> -c '\d <テーブル名>'` でテーブルが実際に存在することを確認します。
6. API ドキュメント：`pnpm scaffold` がモジュールの API を `docs/apifox-full.openapi.json` に書き込み済みです。生成されたルート・フィールド・バリデーションを変更したり、ルートを追加したりした場合は、`AGENTS.md` の「OpenAPI writing rules」に沿ってコードから更新します。これは必須で、行わないと `pnpm verify` の `openapi_sync` チェックが失敗します。

### 5. 検証ゲート

`pnpm verify -- --module <name>` を実行し、失敗した項目は AI が修正して再検証します。すべて合格したら納品レポートを出力し、レポートにはマイグレーションのバージョン（例：「0001_customer まで適用済み」）を明記します。

::: warning マイグレーションは実際に DB へ適用すること
マイグレーションファイルを生成しただけ、静的チェックに合格しただけでは完了とはみなしません。必ず `pnpm db:migrate` を実行し、`psql \d` で確認したうえで、`pnpm verify` の `migration_applied` チェックに合格する必要があります。
:::

## pnpm scaffold

`pnpm scaffold` はバックエンドのモジュール、フロントエンドのページ、API テスト、マイグレーションを一度に生成します。通常の入力は [spec ファイル](#spec-ファイル)（中国語のラベル、ルール、選択肢、メニュー）です。

```bash
pnpm scaffold -- --spec device.spec.json --validate-only   # 検証し、API・権限・テーブル・メニューをプレビュー
pnpm scaffold -- --spec device.spec.json --dry-run         # 書き込むファイルを一覧表示（書き込みはしない）
pnpm scaffold -- --spec device.spec.json                   # 生成
```

spec がなくてもフィールド一覧だけで生成できます（ラベルは英語の仮の名前、ルールやメニューはなし）。

```bash
# 生成されるファイルをプレビューする（書き込みはしない）
pnpm scaffold -- --name customer --domain admin --fields "name:str,phone:str20,status:str20" --dry-run

# 実際に生成する
pnpm scaffold -- --name customer --domain admin --fields "name:str,phone:str20,status:str20"
```

### 引数

| 引数 | 説明 | デフォルト値 |
|---|---|---|
| `--name` | リソース名。snake_case（例：`customer_order`） | 必須 |
| `--domain` | 所属ドメイン：`admin` または `component_center` | `admin` |
| `--fields` | フィールドの一覧。形式は `フィールド:型,フィールド:型` | `name:str` |
| `--spec` | `--name` / `--fields` の代わりに JSON ファイルでモジュールを記述。中国語のラベル、必須、一意、デフォルト値、選択肢、メニューを指定できる。下の [spec ファイル](#spec-ファイル) を参照 | — |
| `--dry-run` | 生成される内容を表示するだけで、ファイルの書き込み、登録、マイグレーションの生成は行わない | オフ |
| `--validate-only` | `--spec` と併用：spec を検証し、生成される API・権限・テーブル・メニューを表示するだけでファイルは書かない。問題があれば一覧表示して 1 で終了 | オフ |
| `--write-schema` | スキャフォールドの現在のフィールド型などのルールから `docs/spec.schema.json` を再生成 | オフ |
| `--skip-migration` | drizzle-kit によるマイグレーションの生成を行わない | オフ |
| `--data-scope` | `--fields` と併用時に[データ権限](/ja/guide/rbac#data-scope)を組み込む：テーブルに `dept_id` / `created_by` を追加し、一覧・詳細・編集・削除・エクスポートを現在のユーザーのデータ範囲で絞り込み、作成時に作成者と部署を記録し、対応する API テストも生成する。`--spec` の場合は代わりに spec に `"dataScope": true` を書く（この引数は無視される） | オフ |
| `-h` / `--help` | 使い方を表示する | — |

### 生成される内容

すでに存在するファイルはスキップされ、上書きされません。

| 生成されるファイル | 説明 |
|---|---|
| `apps/api/src/db/schema/<domain-dir>/<name-kebab>.ts` | テーブル定義 + `toDict` |
| `apps/api/src/modules/<domain-dir>/<name-kebab>/{schema,repository,service,routes}.ts` | バックエンドの 4 層 |
| `apps/api/test/<admin\|cc>-<name-kebab>.test.ts` | API の基本テスト（CRUD、検索、404、エクスポート、インポートテンプレート、インポート） |
| `apps/web/src/modules/<module>/api/<name>.ts` | フロントエンドの API 呼び出し。型はモジュールの OpenAPI エントリから（行の型は `ApiItem<'/api/admin/<name-kebab>s'>`） |
| フロントエンドの一覧ページ `index.tsx` | `admin` ドメインは `pages/<name>/`、`component_center` ドメインは `pages/patterns/<name>_page/`。共通コンポーネントの型に沿って書かれます（`FormValues`、`DataTableColumn<Row>[]`） |
| ページの `locales/{en-US,ja-JP}.json` | 共通の翻訳ファイルにまだない翻訳：モジュールの Webhook イベント名（作成 / 更新 / 削除）と、タイトルやラベルなどのページの文言 |

`<domain-dir>` は `admin` または `component-center`、`<name-kebab>` はリソース名のアンダースコアをハイフンに置き換えたものです。

あわせて次の処理も自動で行われます。

- `apps/api/src/db/schema/index.ts` と `apps/api/src/modules/<domain-dir>/router.ts` への登録
- モジュールのエンドポイントを `docs/apifox-full.openapi.json` に書き込み、そこからフロントエンドの API 型（`apps/web/src/shared/api/openapi.d.ts`）を再生成
- spec に `menu` がある場合：メニューとボタン権限を `apps/api/scripts/seed-rbac.ts` に、その英語・日本語名を `apps/web/src/locales/menus/` に追加
- `drizzle-kit generate --name <name>` の実行によるマイグレーションの生成

scaffold は出力に権限コードのプレフィックス（Perm prefix）、メニューの `component` 値、API パスを表示するので、メニューを手で追加するとき（`--fields` を使う場合や、spec に `menu` がない場合）はそのまま使ってください。

### フィールド型

| 型 | Drizzle の列 | フォームコンポーネント | 説明 |
|---|---|---|---|
| `str` | `varchar(100)` | `FormInput` | |
| `str20` | `varchar(20)` | `FormInput` | |
| `str50` | `varchar(50)` | `FormInput` | |
| `str500` | `varchar(500)` | `FormInput` | |
| `text` | `text` | `FormTextarea` | |
| `int` | `integer` | `FormNumber` | |
| `float` | `numeric(10, 2)` | `FormNumber` | API の出力は文字列（例：`"12.50"`） |
| `bool` | `boolean` | `FormSwitch` | |
| `date` | `date`（文字列モード） | `FormDate` | `YYYY-MM-DD` |
| `datetime` | `timestamp`（文字列モード） | `FormDateTime` | |
| `file` | `varchar(36)`。ファイルセンターのファイル ID を保存 | `FormFileUpload` | 一覧に「表示」リンク。保存時に参照を登録 |
| `image` | `varchar(36)`。ファイルセンターのファイル ID を保存 | `FormImageUpload` | 一覧にサムネイル。保存時に参照を登録 |
| `enum` | `varchar(50)`。選択肢の値を保存 | `FormSelect` | 固定の選択肢（`--spec` の `options` のみ）。一覧はこの項目で絞り込めて、選択肢の名前をバッジで表示し（色は選択肢の `tone`）、エクスポートは名前を表示し、インポートは名前・値のどちらも受け付ける |
| `dict` | `varchar(100)`。辞書項目の値を保存 | `FormSelect` | 選択肢は「データ辞書」から（`--spec` の `dict` に辞書コード）。一覧は辞書のラベルを表示 |

`--fields` では未知の型は `str` として扱われ、spec ではエラーになります。`id`、`created_at`、`updated_at` は自動で追加されます。

### フィールド型の推測

AI は業務上の説明から型を推測するので、あなたが指定する必要はありません。

| 業務上の説明に含まれるキーワード | 型 |
|---|---|
| 名称、タイトル、氏名、メールアドレス | `str` |
| コード、番号 | `str50` |
| 携帯電話、電話、色 | `str20` |
| 選択肢が決まっているステータス、種類、レベル | `enum`（spec では `options`。`--fields` だけなら `str20`） |
| 管理者が選択肢を管理する分類、流入元、業種 | `dict`（spec ではデータ辞書のコード） |
| URL、リンク、アドレス（外部） | `str500` |
| 画像、アバター、カバー、写真 | `image` |
| 添付ファイル、ファイル、契約書、スキャン | `file` |
| 説明、備考、概要、内容、本文、タグ（JSON 文字列） | `text` |
| 金額、価格、費用、コスト | `float` |
| 数量、回数、進捗、パーセンテージ、並び順、重み | `int` |
| 日付（時刻なし） | `date` |
| 日時 | `datetime` |
| 〜かどうか、有効、無効、スイッチ | `bool` |

### spec ファイル

`--spec` は JSON ファイルを読み込みます。AI が推定した仕様をこの形式で書いてから生成すると、中国語のラベル、必須・一意・デフォルト値、選択肢、メニューが一度でそろいます。

```json
{
  "name": "device",
  "title": "设备台账",
  "fields": [
    { "name": "code", "type": "str50", "label": "设备编号", "required": true, "unique": true },
    { "name": "name", "type": "str", "label": "设备名称", "required": true },
    { "name": "status", "type": "enum", "label": "状态", "required": true, "default": "idle",
      "options": [{ "value": "idle", "label": "闲置" }, { "value": "in_use", "label": "使用中", "tone": "success" }] },
    { "name": "category", "type": "dict", "label": "分类", "dict": "device_category" },
    { "name": "price", "type": "float", "label": "采购价格" }
  ],
  "menu": {},
  "i18n": { "en-US": { "设备台账": "Devices", "设备编号": "Device no." }, "ja-JP": { "设备台账": "設備台帳" } }
}
```

```bash
pnpm scaffold -- --spec device.spec.json --validate-only   # 先に検証し、何が生成されるか確認
pnpm scaffold -- --spec device.spec.json
```

- `title` と各フィールドの `label` は必須です。綴りを間違えたキー（`requried` など）は黙って無視されず、エラーになります
- 完全な形式は [`docs/spec.schema.json`](https://github.com/robeshell/castorjs/blob/main/docs/spec.schema.json) にあります（JSON に `"$schema": "<相対パス>/docs/spec.schema.json"` を書くとエディターで補完・ヒントが効きます）。「要件 → spec」の例 4 つとフィールドごとの推論理由は [`docs/examples/specs/`](https://github.com/robeshell/castorjs/tree/main/docs/examples/specs) にあります
- `required`：列に `NOT NULL`。追加・編集時に空なら 400「`<ラベル>不能为空`」を返し、フォームでも必須として検証します。`image` / `file` は必須にできません
- `unique`：列に `UNIQUE`。重複すると 400 を返します。テキストと数値の型のみ
- `default`：列のデフォルト値。追加時に空ならこの値を使い、フォームにもあらかじめ入力されます
- `label` / `title`：ページ、見出し、インポート・エクスポート、エラーに使う中国語。`i18n` はその英語・日本語（ないものはフィールド名で代用）
- `menu`：メニューとボタン権限（追加・編集・削除・エクスポート・インポート）も `apps/api/scripts/seed-rbac.ts` に追加します。デフォルトでは最上位の「業務管理」（ID 1000、最初の生成時に作成。モジュールは 1001 から）の下に置きます。`component_center` ドメインのモジュールは「コンポーネント例」の「ページテンプレート」ディレクトリの下に置きます（ID 4301–4399、API は `/api/admin/component-center/` 配下）。`parentId` で別のディレクトリを指定できます。メニュー名の英語・日本語は `apps/web/src/locales/menus/` に書き込みます
- `dataScope`：`true` にするとモジュールが[データ権限](/ja/guide/rbac#data-scope)に従います。`--fields` での `--data-scope` に相当します
- `options[].tone`：一覧でのその選択肢のバッジの色（デフォルトは `neutral`。状態を表す項目では `success` / `warning` / `danger` など）
- 生成される API テストに、必須・選択肢・一意・デフォルト値を確認する「フィールドルール」のケースが加わります

### 既知の制限

- `--fields` だけでは必須・一意・デフォルト値を表現できず、タイトルとラベルは英語のプレースホルダーです。これらが必要なら `--spec` を使ってください。
- テーブル名はリソース名に `s` を付けたものに固定され、API パスも同様です。リソース名を決めるときは複数形も考慮してください。
- 業務ルールを追加したら、生成された API テストもあわせてメンテナンスしてください。
- バックエンドのエラーはフィールドを中国語のラベルで示し、英語・日本語の画面でも中国語のまま表示されます。

スキャフォールドが使えない場合は `docs/templates/` を参考に手で書くこともできます。置き換えのルールは `docs/templates/backend/README.md` を参照してください。

## pnpm verify

`pnpm verify` は納品の検証ゲートで、すべて合格して初めて完了となります。

```bash
pnpm verify -- --module customer                 # すべてのチェック
pnpm verify -- --module customer --skip-build    # フロントエンドのビルドをスキップ（デバッグ時の高速化）
pnpm verify -- --module customer --json          # 構造化 JSON を出力（stdout には JSON のみ）
```

### チェック項目

チェックは 3 グループ、全 16 項目です。対象外のチェック（データ権限のないモジュールでの `data_scope_filter` など）はスキップとして表示されます。

グローバルチェック（毎回実行）：

| チェック | 内容 |
|---|---|
| `typescript_compile` | `tsc --noEmit`。`apps/api`（scripts、test を含む）、`apps/mcp`、`apps/web`（テストを含む）が対象 |
| `no_local_has_permission` | routes ファイル内で `hasPermission` を独自に定義していないこと |
| `migration_chain` | drizzle のマイグレーション journal が線形で、スナップショットのチェーンが完全であり、すべてのエントリーに SQL があり、余分な SQL がないこと |
| `migration_applied` | journal とデータベースの `drizzle.__drizzle_migrations` を照合し、モジュールのテーブルが存在することを確認 |
| `openapi_sync` | 登録されているすべての `/api` ルートが AGENTS.md「OpenAPI writing rules」に沿って `docs/apifox-full.openapi.json` に記載され、リクエストボディもコードと一致していること（`pnpm openapi:generate -- --dry-run --strict` を実行） |
| `docs_paths` | AI コンテキストのドキュメントで参照しているパスが存在するか（デフォルトは警告のみ。`--strict-docs` 指定時はブロック） |

モジュールチェック（`--module` を指定したときに実行）：

| チェック | 内容 |
|---|---|
| `backend_file` | バックエンドの routes / repository / service ファイルが存在する |
| `data_scope_filter` | `schema.ts` で `DATA_SCOPE` を宣言したモジュールは、repository で `dataScopeWhere` による絞り込みが必要。宣言がなければスキップ |
| `frontend_page` | フロントエンドのページファイルが存在する |
| `frontend_api` | フロントエンドの API ファイルが存在する |
| `router_registration` | ルートが `src/router.ts` またはドメインの `router.ts` に登録されている |
| `schema_registration` | テーブル定義が `db/schema/index.ts` に登録されている |
| `rbac_seed` | `seed-rbac.ts` にそのモジュールのメニューまたは権限コードが含まれている |

ビルドとテスト（スキップ可能）：

| チェック | 内容 | スキップ用の引数 |
|---|---|---|
| `frontend_build` | フロントエンドの Vite ビルド | `--skip-build` |
| `frontend_tests` | フロントエンドの Vitest | `--skip-frontend-tests` |
| `api_tests` | バックエンドの Vitest（テスト用データベースが必要） | `--skip-api-tests` |

### その他の引数

| 引数 | 説明 |
|---|---|
| `--skip-db` | `migration_applied` をスキップ（データベースに接続しない） |
| `--run-rbac-sync` | `seed:rbac --incremental` を追加で 1 回実行（チェック項目 `rbac_sync`） |
| `--database-url <url>` | `migration_applied` が使うデータベース接続を指定 |
| `--strict-docs` | `docs_paths` が失敗したときにブロック |

デバッグ中はスキップ用の引数で高速化してもかまいませんが、納品前には必ずフルで 1 回実行してください。

## MCP Server

`apps/mcp` はツールチェーンを MCP ツールとして公開します。MCP クライアント（Claude Desktop など）は、コマンドラインを使わずに開発フロー全体を進められます。

| ツール | 役割 |
|---|---|
| `get_project_context` | `AGENTS.md` の全文と現在のモジュール構成を返す。新機能を実装する前に呼び出す |
| `get_menu_tree` | データベース上のメニューツリーを返す。`parent_id` と空いている ID の決定に使う |
| `get_spec_guide` | spec の JSON Schema と「要件 → spec」の例を返す。spec を書く前に呼び出す |
| `validate_spec` | spec（引数 `spec`）を検証し、何が生成されるかを返す。ファイルは書かない |
| `scaffold_feature` | `pnpm scaffold` を呼び出す：`spec`（推奨）または `name`、`domain`、`fields` を渡す。`dry_run` はプレビューのみ |
| `check_openapi` | API ドキュメントを OpenAPI の規約でチェックし、規約に合わない API を一覧表示 |
| `run_verify` | `pnpm verify --json` を呼び出して結果を返す（引数 `module`、`skip_build`） |
| `init_rbac` | `pnpm seed:rbac -- --incremental` を呼び出す |
| `run_migration` | `db:generate` + `db:migrate` を実行する（引数 `message` をマイグレーションの説明として使う） |
| `list_templates` | `docs/templates/` にあるテンプレートを一覧表示する |

Claude Desktop の設定例（`claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "castor": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/castorjs", "-s", "mcp"]
    }
  }
}
```

先にビルドしてから node で直接実行することもできます。

```bash
pnpm --filter @castorjs/mcp build
node /path/to/castorjs/apps/mcp/dist/index.js
```

MCP Server はデフォルトで自身の配置場所からリポジトリのルートを推定します。環境変数 `CASTOR_KIT_ROOT` で上書きできます。

## 関連ページ

- [バックエンド](/ja/guide/backend)：レイヤー構成と API 規約
- [フロントエンド](/ja/guide/frontend)：ページ構成と共通コンポーネント
- [権限（RBAC）](/ja/guide/rbac)：メニューとボタン権限
- [コマンド一覧](/ja/reference/commands)
