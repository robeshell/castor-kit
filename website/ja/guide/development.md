# 開発ガイド

## プロジェクト構成

castor-kit は pnpm モノレポで、バックエンド、フロントエンド、MCP サーバーはそれぞれ独立したワークスペースパッケージです：

```
castor-kit/
├── package.json                    # ワークスペースルートのスクリプト（pnpm dev / verify / scaffold ...）
├── pnpm-workspace.yaml
├── AGENTS.md                       # AI コンテキスト（すべての AI ツールが読み込む）
├── apps/
│   ├── api/                        # @castor-kit/api — Fastify + TypeScript バックエンド
│   │   ├── src/
│   │   │   ├── main.ts             # Web プロセスのエントリ
│   │   │   ├── worker.ts           # 独立スケジューラープロセスのエントリ
│   │   │   ├── app.ts              # プラグイン / ルート / エラー処理 / 静的アセット
│   │   │   ├── config.ts           # 複数環境の設定（Zod で検証）
│   │   │   ├── router.ts           # トップレベルのルート組み立て
│   │   │   ├── common/             # auth / csrf / tabular / pagination / serialize / scheduler ...
│   │   │   ├── db/schema/          # Drizzle テーブル定義（admin/、component-center/、index.ts）
│   │   │   └── modules/
│   │   │       ├── admin/          # システムドメイン：users、roles、menu、logs、dicts、scheduled-task ...
│   │   │       │   └── users/      # schema.ts / repository.ts / service.ts / routes.ts
│   │   │       └── component-center/   # サンプルドメイン：list-page、kanban、gantt、ai-chat ...
│   │   ├── drizzle/                # Drizzle SQL マイグレーション + meta/_journal.json
│   │   ├── scripts/
│   │   │   ├── scaffold.ts         # コードスケルトン生成
│   │   │   ├── verify-feature.ts   # 機能検証ゲート
│   │   │   ├── seed-rbac.ts        # RBAC シードデータ（メニューツリーの唯一の情報源）
│   │   │   ├── setup-once.ts       # マイグレーション + RBAC + 読み取り専用ロール（コンテナ起動時に実行）
│   │   │   └── generate-openapi.ts / import-apifox.ts
│   │   └── test/                   # Vitest（実際の PostgreSQL に対して実行）
│   ├── web/                        # @castor-kit/web — React + Vite フロントエンド
│   │   └── src/
│   │       ├── App.jsx             # 動的ルーティング（import.meta.glob）
│   │       ├── context/AuthContext.jsx
│   │       ├── components/Layout/  # サイドバー + PrivateRoute
│   │       ├── modules/
│   │       │   ├── admin/          # システム管理ページ
│   │       │   └── component_center/   # コンポーネントサンプルページ
│   │       └── shared/
│   │           ├── api/request.js  # Axios インスタンス（baseURL='/api'）
│   │           └── components/     # 共有 UI（インポート/エクスポートのモーダルなど）
│   └── mcp/                        # @castor-kit/mcp — MCP サーバー
└── docs/
    └── templates/                  # AI 用コードスケルトンテンプレート（backend/*.ts、frontend/*）
```

バックエンドの層構成：`db/schema → schema (Zod) → repository → service → routes`。各機能モジュールは `modules/<domain>/<module>/` 配下の 4 ファイルで構成され、テーブル定義は `db/schema/<domain>/<module>.ts` に置かれます。

---

## AI で機能を生成する

castor-kit は AI 駆動開発のために設計されています。最速の方法は Claude Code の `/new-feature-autopilot` スキルです。

**プロンプト例：**

```
顧客管理ページを作成。フィールド：氏名、電話、会社名、ステータス
```

AI は自動的に：
1. `AGENTS.md` と `docs/templates/` を読み込み、プロジェクトの規約を理解
2. すべての技術的詳細を推論 — 確認のための質問は不要
3. 確認用の**ビジネスプレビュー**を表示
4. 完全なモジュールを生成：テーブル定義 → Zod スキーマ → repository → service → routes → フロントエンドページ → RBAC エントリ → DB マイグレーション
5. `pnpm verify` 品質ゲートを実行

---

## 手動スキャフォールド

手動でスキャフォールドしたい場合：

```bash
# 生成されるファイルをプレビュー
pnpm scaffold -- --name customer --domain admin \
  --fields "name:str,phone:str20,company:str,status:str20" --dry-run

# 実際に生成
pnpm scaffold -- --name customer --domain admin \
  --fields "name:str,phone:str20,company:str,status:str20"
```

スキャフォールダーは以下を行います：

- テーブル定義 `db/schema/admin/customer.ts` とモジュール `modules/admin/customer/{schema,repository,service,routes}.ts` を書き出す
- フロントエンドの API ファイルとリストページ（検索、作成/編集/削除、インポート/エクスポート）を書き出す
- `db/schema/index.ts` とドメインルーター `modules/admin/router.ts` に登録する
- `drizzle-kit generate` を実行してマイグレーション SQL を生成する

`--domain` は `admin` または `component_center` です。フィールド型：`str`（100）、`str20`、`str50`、`str500`、`text`、`int`、`float`（numeric 10,2）、`bool`、`date`、`datetime`。

---

## RBAC とメニュー管理

すべてのメニュー項目とボタン権限は `apps/api/scripts/seed-rbac.ts` の `MENUS_DATA` に定義されています（唯一の情報源）。メニューを追加した後は以下を実行します：

```bash
pnpm seed:rbac -- --incremental
```

`--incremental` は `code` をキーに upsert し、既存データを削除することはなく、新しいメニューをスーパー管理者ロールに付与します。

**メニューエントリの形式（`seed-rbac.ts` 内）：**

```ts
{ id: 26, name: "Customers", code: "system_customer", icon: "IconUser", path: "/system/customer",
  component: "admin/customer", parent_id: 2, sort_order: 10, menu_type: "menu", is_visible: true, is_active: true },
// ボタン権限：ID = メニュー ID × 10 + n
{ id: 261, name: "Create", code: "system_customer_add",    icon: null, path: null, component: null, parent_id: 26, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
{ id: 262, name: "Edit",   code: "system_customer_edit",   icon: null, path: null, component: null, parent_id: 26, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
{ id: 263, name: "Delete", code: "system_customer_delete", icon: null, path: null, component: null, parent_id: 26, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
{ id: 264, name: "Export", code: "system_customer_export", icon: null, path: null, component: null, parent_id: 26, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
{ id: 265, name: "Import", code: "system_customer_import", icon: null, path: null, component: null, parent_id: 26, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
```

::: tip component フィールドの形式
`component` フィールドは `apps/web/src/modules/<module>/pages/<subdir>/<page>/index.jsx` に対応します（`admin/customer` → `modules/admin/pages/customer/index.jsx`）。
コンポーネントセンターのページはサブディレクトリパスを使用します（例：`component_center/admin/kanban_page`）。
:::

メニュー ID の範囲は `AGENTS.md` に記載されています（システム 21–39、コンポーネントセンター 40–499、新しいビジネスドメインは 1000 から）。

---

## データベースマイグレーション

castor-kit はマイグレーションに Drizzle を使用し、マイグレーションファイルはレビュー可能なプレーン SQL です（`apps/api/drizzle/`）。テーブル定義を変更した後、マイグレーションを生成して適用します：

```bash
# マイグレーションファイルを生成（注意：db:generate の後に -- は付けない）
pnpm db:generate --name add_customer_table

# 適用
pnpm db:migrate

# テーブルが実際に存在することを確認
psql -d aurastack -c '\d customers'
```

::: warning マイグレーションは必ず実際に適用すること
マイグレーションファイルを生成するだけでは不十分です。`pnpm db:migrate` を実行し、`psql \d` でテーブル/カラムの存在を確認してください。`pnpm verify` の `migration_applied` チェックもデータベース内のマイグレーション記録と照合します。
:::

::: info AuraStack のデータベースを引き継ぐ場合
既存の AuraStack データベースに対して `pnpm db:migrate` を実行すると、ベースラインマイグレーションは適用済みとしてマークされるだけで（`drizzle.__drizzle_migrations` に記録）、DDL は実行されません。既存の `alembic_version` テーブルには手を加えません。
:::

---

## 機能の検証

機能を実装した後、検証ゲートを実行します：

```bash
pnpm verify -- --module customer --skip-build
```

TypeScript の型、層構成ルール（ローカルの権限ヘルパー禁止）、マイグレーションチェーンの整合性と適用状況、OpenAPI の同期、AI ドキュメントが参照するパス、バックエンド/フロントエンドのファイルと登録、RBAC シードをチェックします。CI では `--skip-build` を外すと本番フロントエンドビルドも検証されます。`--json` を付けると AI が読める構造化出力になります。

---

## よく使うコマンド

```bash
pnpm dev                       # api (5001) + web (5173)
pnpm typecheck                 # TypeScript 型チェック
pnpm test                      # Vitest（aurastack_test データベースが必要）
pnpm build                     # web + api + mcp をビルド
pnpm db:generate --name <desc> # マイグレーションを生成
pnpm db:migrate                # マイグレーションを適用
pnpm seed:rbac -- --incremental
pnpm verify -- --module <name>
pnpm openapi:generate          # ルートから docs/apifox-full.openapi.json を補完
pnpm openapi:apifox            # Apifox にプッシュ（APIFOX_PROJECT_ID / APIFOX_ACCESS_TOKEN が必要）
pnpm mcp                       # MCP サーバーを起動
```

テストデータベース：`createdb -T aurastack aurastack_test`（開発データベースを複製）または `createdb aurastack_test`（空。テストが自動的にマイグレーションを実行）。

---

## AI ツール統合

castor-kit にはすべての主要 AI コーディングツール向けのコンテキストファイルが事前設定されています：

| ツール | 設定ファイル | 機能 |
|---|---|---|
| Claude Code | `CLAUDE.md` + `.claude/skills/` | `/new-feature-autopilot` エンドツーエンドスキル |
| Cursor | `.cursor/rules/` | Autopilot ワークフローを自動トリガー |
| GitHub Copilot | `.github/copilot-instructions.md` | プロジェクト規約をグローバルに注入 |
| Windsurf | `.windsurfrules` | プロジェクト規約をグローバルに注入 |
| Codex CLI | `CODEX.md` | `AGENTS.md` をネイティブに読み込み |
| MCP クライアント | `apps/mcp` | scaffold / verify / RBAC / マイグレーションツール |

すべてのツールは `AGENTS.md` のコアコンテキストを共有しており、プロジェクト全体のアーキテクチャ、命名規則、アンチパターン、デリバリーワークフローを網羅しています。

---

## 環境変数

### 開発環境（`apps/api/.env.development`）

| 変数 | デフォルト値 | 説明 |
|---|---|---|
| `NODE_ENV` | `development` | 実行環境：`development` / `production` / `test` |
| `DEV_DATABASE_URL` | `postgresql://localhost/aurastack_dev` | ローカル PostgreSQL の接続文字列 |
| `TEST_DATABASE_URL` | `postgresql://localhost/aurastack_test` | `pnpm test` が使用するテストデータベース |
| `SECRET_KEY` | 組み込みの開発用キー | セッション暗号化キー（開発環境では任意） |
| `ADMIN_PASSWORD` | `admin123` | `pnpm seed:rbac` が admin アカウントに使用するパスワード |
| `PORT` | `5001` | バックエンドのポート（Vite プロキシの転送先は 5001） |
| `AI_API_KEY` | — | AI 機能の API キー（開発環境では任意） |
| `AI_API_BASE` | — | OpenAI 互換エンドポイント（例：`https://api.openai.com/v1`） |
| `AI_MODEL` | — | モデル名 |
| `RUN_SCHEDULER_IN_WEB` | `false` | 定期タスクスケジューラーを Web プロセス内で実行する |

### 本番環境（`.env.production`）

本番環境の変数は[デプロイガイド](/ja/deployment/#環境変数リファレンス)を参照してください。

::: warning 本番環境のシークレットキー
本番環境では必ず強力でランダムな `SECRET_KEY` を設定してください。セッションキーはこの値から導出されるため、変更するとすべてのアクティブなユーザーセッションが無効になります。
:::
