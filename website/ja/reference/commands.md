# コマンド一覧

`pnpm` コマンドはすべてリポジトリのルートで実行します。

::: tip 引数の前の -- について
Castor 独自のスクリプト（`scaffold`、`verify`、`seed:rbac`、`seed:demo`、`openapi:*`）では、引数の前の `--` はあってもなくてもかまいません。**`pnpm db:generate` の後ろには `--` を書かないでください。** 引数がそのまま drizzle-kit に渡されますが、drizzle-kit は `--` を認識しないためです。
:::

## 開発

| コマンド | 説明 |
|---|---|
| `pnpm install` | すべての依存関係をインストール |
| `pnpm dev` | バックエンド（5001）とフロントエンド（5173）を同時に起動 |
| `pnpm dev:api` | バックエンドだけを起動（`tsx watch` によるホットリロード） |
| `pnpm dev:web` | フロントエンドだけを起動（Vite） |
| `pnpm --filter @castorjs/api worker` | 独立した定期タスクのスケジューラープロセスを起動 |
| `pnpm build` | すべてのアプリケーションをビルド：フロントエンド（Vite）、バックエンド（tsup）、MCP Server |
| `pnpm --filter @castorjs/web preview` | フロントエンドのビルド成果物をプレビュー |

## 品質チェック

| コマンド | 説明 |
|---|---|
| `pnpm typecheck` | TypeScript の型チェック（`apps/api`、`apps/mcp`、テストを含む `apps/web`） |
| `pnpm test` | すべてのテストを実行（バックエンドにはテスト用データベース `castor_kit_test` が必要） |
| `pnpm --filter @castorjs/api test` | バックエンドのテストだけを実行 |
| `pnpm --filter @castorjs/web test` | フロントエンドのテストだけを実行 |
| `pnpm --filter @castorjs/web test:watch` | フロントエンドのテストをウォッチモードで実行 |
| `pnpm --filter @castorjs/mcp test` | MCP Server のテストだけを実行 |
| `pnpm lint` | バックエンドとフロントエンドの ESLint |
| `pnpm --filter @castorjs/web lint` | フロントエンドの ESLint だけを実行 |
| `node apps/web/scripts/i18n-scan.mjs [ディレクトリ]` | 未翻訳の文言をスキャン。ディレクトリは `apps/web` からの相対パスで、省略すると `src` 全体をスキャン |

## データベース

| コマンド | 説明 |
|---|---|
| `pnpm db:generate --name <説明>` | テーブル定義からマイグレーション SQL を `apps/api/drizzle/` に生成 |
| `pnpm db:migrate` | マイグレーションを適用 |
| `psql -d <データベース名> -c '\d <テーブル名>'` | テーブル構造が実際に DB に反映されたことを確認 |
| `pnpm setup-once` | マイグレーション + RBAC の増分同期 + AI SQL 用読み取り専用アカウント（`DEMO_MODE` が有効でリセットの時期が来ていれば、デモデータのリセットも）。advisory lock 付きで、繰り返し実行可能。Docker イメージは起動のたびに実行します |
| `pnpm --filter @castorjs/api init-ro-role` | AI SQL 用の読み取り専用アカウント `castor_kit_ro` だけを作成（`POSTGRES_RO_PASSWORD` が必要） |
| `pnpm demo:reset` | 公開デモのデータを今すぐ復元。先にデモデータのテーブルとログをすべて空にするので、データを残したいデータベースでは実行しないでください |

## RBAC

| コマンド | 説明 |
|---|---|
| `pnpm seed:rbac -- --incremental` | メニューと権限の増分同期：`code` で upsert し、削除はしない |
| `pnpm seed:rbac -- --incremental --reset-admin-password` | あわせて `admin` アカウントのパスワードを `ADMIN_PASSWORD` に設定し直す |
| `docker compose --env-file .env.production exec app node dist/reset-admin-password.js` | Docker でのデプロイで `admin` のパスワードを `ADMIN_PASSWORD` に設定し直す（[管理者パスワードのリセット](/ja/deploy/#reset-the-admin-password) を参照） |
| `pnpm seed:rbac` | 全件再構築：ユーザー、ロール、メニューとその関連付けを空にしてから書き込み直す。**空のデータベースの初期化専用** |
| `pnpm seed:demo` | データ権限を試すためのサンプル部署・ロール（部門主管 / 一般社員）・ユーザーを登録。何度実行しても安全。本番環境では `--force` が必要。`--password <パスワード>` でサンプルユーザーのパスワードを指定（デフォルトは `demo123456` または `DEMO_USER_PASSWORD`）、`--reset-passwords` で既存のサンプルユーザーにも適用 |

## コード生成と検証ゲート

| コマンド | 説明 |
|---|---|
| `pnpm scaffold -- --spec <ファイル>` | JSON の spec からモジュールを生成（形式は `docs/spec.schema.json`、例は `docs/examples/specs/`）：バックエンドのモジュール、フロントエンドのページと API ファイル、API テスト、OpenAPI のエントリー、マイグレーション。spec に `menu` があれば、メニューとボタン権限も `seed-rbac.ts` に追加 |
| `pnpm scaffold -- --spec <ファイル> --validate-only` | spec をチェックし、生成される内容を表示するだけ。ファイルは書き込まず、問題があれば 1 で終了 |
| `pnpm scaffold -- --name <name> --domain <admin\|component_center> --fields "<フィールド:型,...>"` | spec なしでモジュールを生成（生成物は同じだが、中国語の表示名、制約、メニューはなし） |
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

`--skip-*` はデバッグ用です。これでチェックを飛ばした実行は、飛ばした項目を表示し「納品可能」とは報告しません（`--json` では `complete: false`）。納品前にはこれらを付けずにもう一度実行してください。

`scaffold` と `verify` はどちらも `-h` / `--help` で使い方を表示できます。引数の説明は [AI 駆動開発](/ja/guide/ai-workflow) を参照してください。

## OpenAPI

| コマンド | 説明 |
|---|---|
| `pnpm openapi:generate` | ドキュメントのないルート + メソッドに骨格を追加（`docs/apifox-full.openapi.json` に書き戻し）し、OpenAPI の規約をチェックして、フロントエンドの API 型 `apps/web/src/shared/api/openapi.d.ts` を再生成 |
| `pnpm openapi:generate -- --dry-run` | チェックのみで、書き戻さない（API 型も再生成しない） |
| `pnpm openapi:generate -- --strict` | 規約に合わない API と理由を一覧表示し、あれば 0 以外で終了 |
| `pnpm openapi:apifox` | Apifox にプッシュ（`APIFOX_PROJECT_ID`、`APIFOX_ACCESS_TOKEN` が必要） |
| `pnpm --filter @castorjs/web api:types` | OpenAPI ドキュメントから `openapi.d.ts` だけを再生成（`--check` を付けると、古い場合に 1 で終了） |

## MCP Server

| コマンド | 説明 |
|---|---|
| `pnpm mcp` | MCP Server を起動（stdio） |
| `pnpm --filter @castorjs/mcp build` | `apps/mcp/dist/` にビルド |

## フロントエンドのコンポーネント

| コマンド | 説明 |
|---|---|
| `apps/web/scripts/shadcn-add.sh <コンポーネント>` | ローカルの registry 中継経由で `npx shadcn@latest add` を実行 |
| `apps/web/scripts/shadcn-add.sh --view <コンポーネント>` | registry の内容を表示するだけで、ファイルは書き込まない |

## Docker

リポジトリのルートで実行します。compose コマンドには `--env-file .env.production` を付ける必要があります。

| コマンド | 説明 |
|---|---|
| `bash scripts/setup.sh` | 対話式のウィザード：`.env.production` を生成し、ビルドして起動 |
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
| `npm --prefix website run og` | ダッシュボードのスクリーンショットからソーシャルプレビュー画像（`website/public/og.png` と `.github/assets/social-preview.png`）を生成 |

main にマージされると、`.github/workflows/docs.yml` がサイトを GitHub Pages に公開します。
