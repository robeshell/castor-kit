# コマンド一覧

`pnpm` コマンドはすべてリポジトリのルートで実行します。

::: tip 引数の前の -- について
castor-kit 独自のスクリプト（`scaffold`、`verify`、`seed:rbac`、`openapi:*`）では、引数の前の `--` はあってもなくてもかまいません。**`pnpm db:generate` の後ろには `--` を書かないでください。** 引数がそのまま drizzle-kit に渡されますが、drizzle-kit は `--` を認識しないためです。
:::

## 開発

| コマンド | 説明 |
|---|---|
| `pnpm install` | すべての依存関係をインストール |
| `pnpm dev` | バックエンド（5001）とフロントエンド（5173）を同時に起動 |
| `pnpm dev:api` | バックエンドだけを起動（`tsx watch` によるホットリロード） |
| `pnpm dev:web` | フロントエンドだけを起動（Vite） |
| `pnpm --filter @castor-kit/api worker` | 独立した定期タスクのスケジューラープロセスを起動 |
| `pnpm build` | すべてのアプリケーションをビルド：フロントエンド（Vite）、バックエンド（tsup）、MCP Server |
| `pnpm --filter @castor-kit/web preview` | フロントエンドのビルド成果物をプレビュー |

## 品質チェック

| コマンド | 説明 |
|---|---|
| `pnpm typecheck` | TypeScript の型チェック（`apps/api`、`apps/mcp`） |
| `pnpm test` | すべてのテストを実行（バックエンドにはテスト用データベース `castor_kit_test` が必要） |
| `pnpm --filter @castor-kit/api test` | バックエンドのテストだけを実行 |
| `pnpm --filter @castor-kit/web test` | フロントエンドのテストだけを実行 |
| `pnpm --filter @castor-kit/web test:watch` | フロントエンドのテストをウォッチモードで実行 |
| `pnpm lint` | バックエンドの ESLint |
| `pnpm --filter @castor-kit/web lint` | フロントエンドの ESLint |
| `node apps/web/scripts/i18n-scan.mjs [ディレクトリ]` | 未翻訳の文言をスキャン。ディレクトリは `apps/web` からの相対パスで、省略すると `src` 全体をスキャン |

## データベース

| コマンド | 説明 |
|---|---|
| `pnpm db:generate --name <説明>` | テーブル定義からマイグレーション SQL を `apps/api/drizzle/` に生成 |
| `pnpm db:migrate` | マイグレーションを適用 |
| `psql -d <データベース名> -c '\d <テーブル名>'` | テーブル構造が実際に DB に反映されたことを確認 |
| `pnpm setup-once` | マイグレーション + RBAC の増分同期 + AI SQL 用読み取り専用アカウント。advisory lock 付きで、繰り返し実行可能 |
| `pnpm --filter @castor-kit/api init-ro-role` | AI SQL 用の読み取り専用アカウント `castor_kit_ro` だけを作成（`POSTGRES_RO_PASSWORD` が必要） |

## RBAC

| コマンド | 説明 |
|---|---|
| `pnpm seed:rbac -- --incremental` | メニューと権限の増分同期：`code` で upsert し、削除はしない |
| `pnpm seed:rbac` | 全件再構築：ユーザー、ロール、メニューを空にしてから書き込み直す。**空のデータベースの初期化専用** |

## コード生成と検証ゲート

| コマンド | 説明 |
|---|---|
| `pnpm scaffold -- --name <name> --domain <admin\|component_center> --fields "<フィールド:型,...>"` | バックエンドのモジュール、フロントエンドのページ、API テスト、マイグレーションを生成 |
| `pnpm scaffold -- ... --dry-run` | 生成される内容を表示するだけで、ファイルは書き込まない |
| `pnpm scaffold -- ... --skip-migration` | コードは生成するが、マイグレーションは生成しない |
| `pnpm scaffold -- ... --data-scope` | 生成したモジュールをデータ権限で絞り込む（`dept_id` / `created_by` を追加） |
| `pnpm verify -- --module <name>` | すべての検証ゲートのチェックを実行 |
| `pnpm verify -- --module <name> --skip-build` | フロントエンドのビルドをスキップ |
| `pnpm verify -- --module <name> --json` | 構造化 JSON を出力 |
| `pnpm verify -- --module <name> --skip-frontend-tests --skip-api-tests` | フロントエンドとバックエンドのテストをスキップ |
| `pnpm verify -- --module <name> --skip-db` | データベースに接続しない（`migration_applied` をスキップ） |
| `pnpm verify -- --module <name> --run-rbac-sync` | RBAC の増分同期を追加で 1 回実行 |
| `pnpm verify -- --module <name> --strict-docs` | ドキュメントのパスチェックが失敗したときにブロック |
| `pnpm verify -- --module <name> --database-url <url>` | マイグレーションの状態チェックに使うデータベースを指定 |

`scaffold` と `verify` はどちらも `-h` / `--help` で使い方を表示できます。引数の説明は [AI 駆動開発](/ja/guide/ai-workflow) を参照してください。

## OpenAPI

| コマンド | 説明 |
|---|---|
| `pnpm openapi:generate` | Fastify のルートから `docs/apifox-full.openapi.json` を補完 |
| `pnpm openapi:generate -- --dry-run` | カバー率を集計するだけで、書き戻さない |
| `pnpm openapi:generate -- --strict` | 骨格だけのパスが残っている場合は 0 以外で終了 |
| `pnpm openapi:apifox` | Apifox にプッシュ（`APIFOX_PROJECT_ID`、`APIFOX_ACCESS_TOKEN` が必要） |

## MCP Server

| コマンド | 説明 |
|---|---|
| `pnpm mcp` | MCP Server を起動（stdio） |
| `pnpm --filter @castor-kit/mcp build` | `apps/mcp/dist/` にビルド |

## フロントエンドのコンポーネント

| コマンド | 説明 |
|---|---|
| `apps/web/scripts/shadcn-add.sh <コンポーネント>` | ローカルの registry 中継経由で `npx shadcn@latest add` を実行 |
| `apps/web/scripts/shadcn-add.sh --view <コンポーネント>` | registry の内容を表示するだけで、ファイルは書き込まない |

## Docker

リポジトリのルートで実行します。compose コマンドには `--env-file .env.production` を付ける必要があります。

| コマンド | 説明 |
|---|---|
| `bash setup.sh` | 対話式のウィザード：`.env.production` を生成し、ビルドして起動 |
| `docker compose --env-file .env.production up -d --build` | イメージをビルドして起動（コードの更新後も同じコマンドを使う） |
| `docker compose --env-file .env.production logs -f app` | アプリケーションのログを表示 |
| `docker compose --env-file .env.production ps` | サービスの状態を表示 |
| `docker compose --env-file .env.production down` | サービスを停止し、データボリュームは保持 |

## ドキュメントサイト

ドキュメントサイト `website/` は独立した npm プロジェクトで、pnpm ワークスペースには含まれていません。

| コマンド | 説明 |
|---|---|
| `npm --prefix website install` | ドキュメントサイトの依存関係をインストール |
| `npm --prefix website run dev` | ドキュメントサイトをローカルでプレビュー |
| `npm --prefix website run build` | ドキュメントサイトをビルド（リンク切れがあると失敗） |
| `npm --prefix website run screenshots` | 起動中のアプリからランディングページと README のスクリーンショットを撮り直す（先に `pnpm dev` を実行。admin のパスワードを尋ねられます） |

main にマージされると、`.github/workflows/docs.yml` がサイトを GitHub Pages に公開します。
