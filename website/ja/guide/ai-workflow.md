# AI 駆動開発

castor-kit が目指すのは、業務要件を自然言語で伝えるだけで、AI コーディングツールが技術的な詳細を自ら推測し、プロジェクトの規約に沿った機能モジュール（テーブル、API、画面、権限、マイグレーション）をエンドツーエンドで納品し、検証ゲートを通過させることです。

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

より踏み込んだアーキテクチャの説明は `docs/architecture.md`、フロントエンドの UI 方針は `docs/frontend-redesign-plan.md` にあります。

## 対応している AI ツール

| ツール | 読み込むファイル |
|---|---|
| Claude Code | `CLAUDE.md`。スキルは `.claude/skills/`（`new-feature-autopilot`、`shadcn-ui-skills`） |
| Codex CLI | `AGENTS.md`（自動で読み込み）+ `CODEX.md`。スキルは `.agents/skills/` |
| Cursor | `.cursor/rules/castor-kit-always.mdc`（常に有効）、`.cursor/rules/new-feature-autopilot.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Windsurf | `.windsurfrules` |
| その他のツール | `llms.txt`（エントリーとなる索引） |
| MCP クライアント | `apps/mcp`。後述の [MCP Server](#mcp-server) を参照 |

`.claude/skills/` と `.agents/skills/` の内容は同一に保たれており、バックエンドのテスト `skills-sync.test.ts` が両者の同期をチェックします。

## 新機能の納品フロー

`new-feature-autopilot` スキル（Claude Code で `/new-feature-autopilot` と入力するか、「XX 機能を作って」と直接伝える）は、次の 5 つのステップで進みます。ほかのツールも、それぞれのルールファイルを通じて同じフローに従います。

### 1. コンテキストを読み込む

AI は `AGENTS.md`、`docs/templates/` にあるコード骨格のテンプレート、既存の参考モジュール（バックエンドは `apps/api/src/modules/admin/users/`、フロントエンドは `apps/web/src/modules/admin/pages/users/index.jsx`）、そして `apps/api/scripts/seed-rbac.ts` のメニューツリーを読み込みます。既存モジュールの拡張で要件を満たせる場合は、拡張を優先します。

### 2. 技術仕様を推測する

AI は次の内容を内部で推測し、あなたに質問はしません。

- リソース名と所属ドメイン（`admin` または `component_center`）
- API パス（例：`/api/admin/customer-orders`）
- フィールド名とフィールド型（後述のフィールド型の推測表に基づく）
- 権限コード：`admin` ドメインは `system_<name>`、`component_center` ドメインは `cc_<name>`。ボタン権限には `_add` / `_edit` / `_delete` / `_export` / `_import` を付ける
- フロントエンドのファイルパス、メニュー ID、親メニュー、マイグレーション名

### 3. 業務プレビューを提示する

AI は業務レベルの情報だけを提示し、あなたの確認や修正を待ちます。

```text
顧客管理

場所：システム管理 → 顧客管理
機能：一覧表示、追加、編集、削除、インポート、エクスポート
フィールド：
  · 顧客名（必須）
  · 電話番号
  · ステータス

この内容で進めてよろしいですか？ 調整が必要な点はありますか？
```

AI が追加で質問するのは、データモデルに取り返しのつかない曖昧さがある場合、外部システムの設定が必要な場合、権限の境界がセキュリティに影響する場合に限られます。

### 4. 実装する

1. `pnpm scaffold` で骨格を生成します（先に `--dry-run` でプレビューします）。
2. `db/schema → schema → repository → service → routes` の順に、ビジネスロジック、中国語の列見出し、バリデーションを補います。
3. フロントエンドのページを仕上げます：中国語のラベル、フォームのバリデーション、列挙型フィールド、多言語の翻訳。
4. `seed-rbac.ts` にメニューとボタン権限を追加し、`pnpm seed:rbac -- --incremental` を実行します。
5. 新しく生成されたマイグレーション SQL をレビューしてから `pnpm db:migrate` を実行し、`psql -d <データベース名> -c '\d <テーブル名>'` でテーブルが実際に存在することを確認します。
6. `pnpm openapi:generate` を実行して API ドキュメントを補完します（推奨）。

### 5. 検証ゲート

`pnpm verify -- --module <name>` を実行し、失敗した項目は AI が修正して再検証します。すべて合格したら納品レポートを出力し、レポートにはマイグレーションのバージョン（例：「0001_customer まで適用済み」）を明記します。

::: warning マイグレーションは実際に DB へ適用すること
マイグレーションファイルを生成しただけ、静的チェックに合格しただけでは完了とはみなしません。必ず `pnpm db:migrate` を実行し、`psql \d` で確認したうえで、`pnpm verify` の `migration_applied` チェックに合格する必要があります。
:::

## pnpm scaffold

`pnpm scaffold` はフィールド定義をもとに、バックエンドのモジュール、フロントエンドのページ、API テスト、マイグレーションを一度に生成します。

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
| `--dry-run` | 生成される内容を表示するだけで、ファイルの書き込み、登録、マイグレーションの生成は行わない | オフ |
| `--skip-migration` | drizzle-kit によるマイグレーションの生成を行わない | オフ |
| `--data-scope` | [データ権限](/ja/guide/rbac#データ権限)を組み込む：テーブルに `dept_id` / `created_by` を追加し、一覧・詳細・編集・削除・エクスポートを現在のユーザーのデータ範囲で絞り込み、作成時に作成者と部署を記録し、対応する API テストも生成する | オフ |
| `-h` / `--help` | 使い方を表示する | — |

### 生成される内容

すでに存在するファイルはスキップされ、上書きされません。

| 生成されるファイル | 説明 |
|---|---|
| `apps/api/src/db/schema/<domain-dir>/<name-kebab>.ts` | テーブル定義 + `toDict` |
| `apps/api/src/modules/<domain-dir>/<name-kebab>/{schema,repository,service,routes}.ts` | バックエンドの 4 層 |
| `apps/api/test/<admin\|cc>-<name-kebab>.test.ts` | API の基本テスト（CRUD、検索、404、エクスポート、インポートテンプレート、インポート） |
| `apps/web/src/modules/<module>/api/<name>.js` | フロントエンドの API 呼び出し |
| フロントエンドの一覧ページ `index.jsx` | `admin` ドメインは `pages/<name>/`、`component_center` ドメインは `pages/admin/<name>_page/` |
| ページの `locales/{en-US,ja-JP}.json` | 共通の翻訳でカバーされない中国語がページにある場合のみ生成 |

`<domain-dir>` は `admin` または `component-center`、`<name-kebab>` はリソース名のアンダースコアをハイフンに置き換えたものです。

あわせて次の処理も自動で行われます。

- `apps/api/src/db/schema/index.ts` と `apps/api/src/modules/<domain-dir>/router.ts` への登録
- `drizzle-kit generate --name <name>` の実行によるマイグレーションの生成

scaffold は出力に権限コードのプレフィックス（Perm prefix）、メニューの `component` 値、API パスを表示するので、メニューを追加するときはそのまま使ってください。

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

未知の型は `str` として扱われます。`id`、`created_at`、`updated_at` は自動で追加されます。

### フィールド型の推測

AI は業務上の説明から型を推測するので、あなたが指定する必要はありません。

| 業務上の説明に含まれるキーワード | 型 |
|---|---|
| 名称、タイトル、氏名、メールアドレス | `str` |
| コード、番号 | `str50` |
| 携帯電話、電話、ステータス、種類、色 | `str20` |
| URL、リンク、アドレス（外部） | `str500` |
| 画像、アバター、カバー、写真 | `image` |
| 添付ファイル、ファイル、契約書、スキャン | `file` |
| 説明、備考、概要、内容、本文、タグ（JSON 文字列） | `text` |
| 金額、価格、費用、コスト | `float` |
| 数量、回数、進捗、パーセンテージ、並び順、重み | `int` |
| 日付（時刻なし） | `date` |
| 日時 | `datetime` |
| 〜かどうか、有効、無効、スイッチ | `bool` |

### 既知の制限

- `--fields` では必須、一意、デフォルト値を表現できません。推奨する手順は、まず `--skip-migration` を付けて生成し、次に `db/schema` のテーブル定義を修正（`.notNull()`、`.unique()`、`.$default(...)`）し、最後に `pnpm db:generate --name <name>` を実行することです。こうすると 1 つの新しいテーブルに対してマイグレーションが 1 つだけになります。
- 生成されるタイトルとフィールドのラベルは英語のプレースホルダーなので、中国語に書き換える必要があります。
- 列挙型のフィールドは `str20` として生成され、英語のコードを保存します。画面に中国語で表示するには、マッピングを手で書く必要があります。
- テーブル名はリソース名に `s` を付けたものに固定され、API パスも同様です。リソース名を決めるときは複数形も考慮してください。
- `bool` 列は NULL を許容します。デフォルト値が必要な場合は service で補ってください。
- 業務ルールを追加したら、生成された API テストもあわせてメンテナンスしてください。

スキャフォールドが使えない場合は `docs/templates/` を参考に手で書くこともできます。置き換えのルールは `docs/templates/backend/README.md` を参照してください。

## pnpm verify

`pnpm verify` は納品の検証ゲートで、すべて合格して初めて完了となります。

```bash
pnpm verify -- --module customer                 # すべてのチェック
pnpm verify -- --module customer --skip-build    # フロントエンドのビルドをスキップ（デバッグ時の高速化）
pnpm verify -- --module customer --json          # 構造化 JSON を出力（stdout には JSON のみ）
```

### チェック項目

グローバルチェック（毎回実行）：

| チェック | 内容 |
|---|---|
| `typescript_compile` | `tsc --noEmit`。`apps/api`（scripts、test を含む）と `apps/mcp` が対象 |
| `no_local_has_permission` | routes ファイル内で `hasPermission` を独自に定義していないこと |
| `migration_chain` | drizzle のマイグレーション journal が線形で、スナップショットのチェーンが完全であり、すべてのエントリーに SQL があり、余分な SQL がないこと |
| `migration_applied` | journal とデータベースの `drizzle.__drizzle_migrations` を照合し、モジュールのテーブルが存在することを確認 |
| `openapi_sync` | OpenAPI ドキュメントがルートと同期しているか（警告のみ） |
| `docs_paths` | AI コンテキストのドキュメントで参照しているパスが存在するか（デフォルトは警告のみ。`--strict-docs` 指定時はブロック） |

モジュールチェック（`--module` を指定したときに実行）：

| チェック | 内容 |
|---|---|
| `backend_file` | バックエンドの routes / repository / service ファイルが存在する |
| `data_scope_filter` | `schema.ts` で `DATA_SCOPE` を宣言したモジュールは、repository で `dataScopeWhere` による絞り込みが必要。宣言がなければスキップ |
| `frontend_page` | フロントエンドのページファイルが存在する |
| `frontend_no_legacy_ui` | ページディレクトリで `@douyinfe/*`、`var(--semi-*)` などの廃止済み UI 体系を使っていない |
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
| `scaffold_feature` | `pnpm scaffold` を呼び出す（引数 `name`、`domain`、`fields`、`dry_run`） |
| `run_verify` | `pnpm verify --json` を呼び出して結果を返す（引数 `module`、`skip_build`） |
| `init_rbac` | `pnpm seed:rbac -- --incremental` を呼び出す |
| `run_migration` | `db:generate` + `db:migrate` を実行する（引数 `message` をマイグレーションの説明として使う） |
| `list_templates` | `docs/templates/` にあるテンプレートを一覧表示する |

Claude Desktop の設定例（`claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "castor-kit": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/castor-kit", "-s", "mcp"]
    }
  }
}
```

先にビルドしてから node で直接実行することもできます。

```bash
pnpm --filter @castor-kit/mcp build
node /path/to/castor-kit/apps/mcp/dist/index.js
```

MCP Server はデフォルトで自身の配置場所からリポジトリのルートを推定します。環境変数 `CASTOR_KIT_ROOT` で上書きできます。

## 関連ページ

- [バックエンド](/ja/guide/backend)：レイヤー構成と API 規約
- [フロントエンド](/ja/guide/frontend)：ページ構成と共通コンポーネント
- [権限（RBAC）](/ja/guide/rbac)：メニューとボタン権限
- [コマンド一覧](/ja/reference/commands)
