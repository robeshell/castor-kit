# 設定

castor-kit の設定は 2 種類です。

- **環境変数**：サーバーがデータベースに接続する前に必要なもの（データベース URL、`SECRET_KEY`、ポートなど）。`apps/api/src/config.ts` が Zod で検証し、Docker では `docker-compose.yml` が注入します。本ページの「バックエンド（API）」を参照
- **システム設定**：メール、ファイル保存、アップロード制限、AI モデル、サイトの URL、ログインのロック、2段階認証などのセキュリティ設定。ログイン後に「システム管理 → システム構成 → システム設定」で変更でき、再起動なしで数秒以内に反映されます。環境変数で固定することもできます。[システム設定で行う設定](#settings-page)を参照

## 設定ファイル

バックエンドは起動時に `NODE_ENV` に応じて `.env.<NODE_ENV>` を読み込みます。

1. `apps/api/.env.<NODE_ENV>`
2. リポジトリのルートの `.env.<NODE_ENV>`

先に読み込んだものが優先されます。すでに存在する環境変数（シェルや compose から注入されたものなど）は、ファイルによって上書きされません。

| ファイル | 用途 | コミットするか |
|---|---|---|
| `apps/api/.env.example` | ローカル開発用のサンプル | はい |
| `.env.example`（ルート） | すべての変数を説明したサンプル | はい |
| `apps/api/.env.development` | ローカル開発用の設定 | いいえ（gitignore） |
| `.env.production`（ルート） | Docker デプロイ用の設定。`setup.sh` が生成 | いいえ（gitignore） |

::: warning 本物のシークレットをコミットしないこと
`.env.development`、`.env.production` は gitignore 済みです。本物の `SECRET_KEY`、データベースのパスワード、API Key をサンプルファイルに書いたり、リポジトリにコミットしたりしないでください。
:::

## バックエンド（API）

### 実行環境とデータベース

| 変数 | 役割 | デフォルト値 |
|---|---|---|
| `NODE_ENV` | 実行環境：`development` / `test` / `production`。それ以外の値は `development` として扱う | `development` |
| `PORT` | 待ち受けポート | 開発 `5001`、テスト `5002`、本番 `5000` |
| `DEV_DATABASE_URL` | 開発環境のデータベース接続 | `postgresql://localhost/castor_kit_dev`（`apps/api/.env.example` では `postgresql://localhost/castor_kit`） |
| `TEST_DATABASE_URL` | テスト環境のデータベース接続 | `postgresql://localhost/castor_kit_test` |
| `DATABASE_URL` | 本番環境のデータベース接続 | `postgresql://localhost/castor_kit` |
| `MIGRATIONS_DIR` | マイグレーションファイルのディレクトリ | `drizzle/` ディレクトリを上位に向かって自動で探索 |

### セキュリティとセッション

| 変数 | 役割 | デフォルト値 |
|---|---|---|
| `SECRET_KEY` | セッションの暗号化キー。cookie のキーはここから HKDF で派生 | 開発 / テストでは安全でない組み込みのデフォルト値あり。**本番では必須** |
| `ADMIN_PASSWORD` | `admin` アカウントの初期パスワード。アカウントが存在しない場合にだけ使用 | 開発 / テストでは `admin123`。**本番では必須** |
| `SESSION_TTL_HOURS` | セッションの有効期間（時間）の初期値。後から「システム設定」で変更できます | `8` |
| `SESSION_COOKIE_SECURE` | cookie の `Secure` フラグ：`true` / `false` で強制。空にするとリクエストのプロトコルから自動判定（HTTPS の場合のみ付与） | 空（自動） |
| `CORS_ORIGINS` | クロスオリジンを許可するオリジン。カンマ区切り。WebSocket ハンドシェイクの Origin 許可リストにも使用 | 空 |
| `RATE_LIMIT_ENABLED` | IP ごとのレート制限。上限値は「システム設定」で調整します（[アカウントセキュリティとシステム設定](/ja/guide/security#rate-limits)） | `true` |
| `MAX_CONTENT_LENGTH` | リクエストボディのサイズ上限（バイト）。超えると 413 を返す | `16777216`（16MB） |

### パス

| 変数 | 役割 | デフォルト値 |
|---|---|---|
| `WEB_DIST_DIR` | フロントエンドのビルド成果物のディレクトリ。バックエンドはここから静的ファイルと SPA を配信 | `apps/web/dist` |
| `INSTANCE_DIR` | 実行時データのディレクトリ。`local` ドライバーのアップロードは既定でその下の `uploads/files/` に保存 | `apps/api/instance` |

### ファイル保存先ディレクトリとメールの開発モード

| 変数 | 役割 | デフォルト値 |
|---|---|---|
| `STORAGE_LOCAL_DIR` | 「ローカルディスク」保存のディレクトリ | `<INSTANCE_DIR>/uploads/files` |
| `MAIL_DRIVER` | 空ならシステム設定の SMTP で送信。`log` は送信せずバックエンドのログに出力（ローカル開発用）。`none` は送信しない | 空 |

ローカルディスク保存には永続ディスクが必要です。Docker Compose は `INSTANCE_DIR` をボリュームとしてマウントします。Render のように再デプロイでディスクが消えるプラットフォームでは、システム設定で S3 互換ストレージ（Cloudflare R2 など）に切り替えてください。どのレコードからも参照されていないファイルは、アップロードから 24 時間後にスケジューラープロセスが削除します。そのため `ENABLE_TASK_SCHEDULER=false` の場合は削除されません。

### 公開デモ {#public-demo}

| 変数 | 役割 | デフォルト値 |
|---|---|---|
| `DEMO_MODE` | 公開デモモード。ログイン画面にデモアカウントを表示し、ワンクリックでログインできます。ログイン、コンポーネント例、ファイルのアップロード、通知の既読化以外の書き込みはすべて 403 を返します（システム管理は読み取り専用で、パスワードも変更できません）。ログインのロックは IP のみでカウントし、サンプルデータは定期的に復元されます | `false` |
| `DEMO_RESET_HOURS` | デモデータを復元する間隔（時間）。起動時と、その後 1 時間ごとに確認し、前回の復元からこの時間を過ぎていれば復元します。すぐに復元するには `pnpm demo:reset` を実行します | `24` |
| `DEMO_AI_HOURLY_PER_IP` | デモモードで IP ごとに 1 時間あたり AI を呼び出せる回数（AI チャット、AI による SQL 生成）。超えると 429 を返します。未ログインのリクエストはカウントしません | `20` |
| `DEMO_AI_DAILY` | デモモードでサイト全体が 1 日に AI を呼び出せる回数。使い切ると、その日は 429 を返します | `300` |
| `DEMO_AI_MAX_INPUT_CHARS` | デモモードでの 1 回の AI リクエストの最大文字数。超えると 400 を返します。デモモードではモデルの返答の長さも制限します | `4000` |

デモデータの内容は `apps/api/src/demo/fixtures.ts`、復元の処理は `apps/api/src/demo/reset.ts` にあります。復元の対象はコンポーネント例、お知らせ、データ辞書、定期タスク、通知、ログだけで、アカウント・ロール・メニューには触れません。

### 定期タスク

| 変数 | 役割 | デフォルト値 |
|---|---|---|
| `ENABLE_TASK_SCHEDULER` | 定期タスクのスケジューリングを有効にするか | `true` |
| `RUN_SCHEDULER_IN_WEB` | web プロセス内でスケジューラーを動かすか。`false` の場合は worker プロセスを別途実行する必要がある | `false` |
| `TASK_SCHEDULER_INTERVAL_SECONDS` | スケジューラーのスキャン間隔（秒） | `20` |
| `TASK_SCHEDULER_LEASE_SECONDS` | タスクのリース期間（秒）。重複実行の防止と、停止したタスクの回収に使用 | `1800` |

真偽値は `1`、`true`、`yes`、`on`（大文字小文字を区別しない）が真とみなされます。

### AI データ検索

AI モデル（API の URL、キー、モデル名）はシステム設定で設定します（後述）。ここには AI データ検索が使う読み取り専用のデータベース接続だけがあります。

| 変数 | 役割 | デフォルト値 |
|---|---|---|
| `AI_SQL_DATABASE_URL` | AI データ検索で使う読み取り専用の接続。スーパーユーザーではない読み取り専用アカウントを指すこと | 開発 / テストではメインのデータベース接続にフォールバック（読み取り専用は引き続き強制）。本番で未設定の場合、`POSTGRES_RO_PASSWORD` が設定されていれば `DATABASE_URL` から導出（`castor_kit_ro` アカウントに置き換え）し、どちらもなければ起動を拒否 |
| `AI_SQL_STATEMENT_TIMEOUT_MS` | AI データ検索の 1 文あたりのタイムアウト（ミリ秒） | `5000` |
| `POSTGRES_RO_PASSWORD` | 読み取り専用アカウント `castor_kit_ro` のパスワード。`setup-once` / `init-ro-role` がこれを使ってアカウントを作成する。未設定の場合はスキップ | 空 |

### Apifox（`pnpm openapi:apifox` でのみ使用）

| 変数 | 役割 | デフォルト値 |
|---|---|---|
| `APIFOX_PROJECT_ID` | Apifox のプロジェクト ID | 空 |
| `APIFOX_ACCESS_TOKEN` | Apifox のアクセストークン | 空 |
| `APIFOX_API_VERSION` | Apifox API のバージョン | `2024-03-28` |

### 本番環境の必須項目

`NODE_ENV=production` の場合、次のいずれかの変数が欠けているとサービスは起動を拒否します。

- `SECRET_KEY`
- `ADMIN_PASSWORD`
- `AI_SQL_DATABASE_URL`、または `POSTGRES_RO_PASSWORD`（これと `DATABASE_URL` から読み取り専用の接続を導出）

`docker-compose.yml` でデプロイする場合、`AI_SQL_DATABASE_URL` は compose が自動で組み立てるため、手動で設定する必要はありません。

## システム設定で行う設定 {#settings-page}

以下は「システム設定」ページで変更します（表示には `system_settings`、保存には `system_settings_edit` が必要）。保存後数秒以内に反映されます。メール・ファイル保存・AI のタブには、未保存の値で試せるテストボタンがあります。

- パスワード、シークレットキー、API キーは `SECRET_KEY` から導出した鍵で暗号化して保存し、ページには「設定済み」とだけ表示されます。`SECRET_KEY` を変えた場合は入力し直してください
- **対応する環境変数が設定されている（空でない）場合はそちらが優先され**、ページでは読み取り専用になり変数名が表示されます。すべて環境変数で管理するデプロイ向けです。設定しなければページで管理します
- Docker で環境変数により固定する場合は、`.env.production` に加えて `docker-compose.yml` の `app.environment` にも追加してください

### メール {#mail}

| システム設定 | 環境変数 | デフォルト値 |
|---|---|---|
| サイトの URL（メール内のリンクに使用。リクエストの Host は使いません） | `APP_BASE_URL` | 空 |
| SMTP サーバー | `SMTP_HOST` | 空（メールを送らない） |
| ポート | `SMTP_PORT` | `587` |
| 暗号化方式：自動 / SSL/TLS / STARTTLS（自動 = 465 番ポートは SSL/TLS） | `SMTP_SECURE`（`true` = SSL/TLS、`false` = STARTTLS） | 自動 |
| アカウント / パスワード | `SMTP_USER` / `SMTP_PASSWORD` | 空 |
| 差出人（例：`castor-kit <noreply@example.com>`） | `MAIL_FROM` | アカウント |

メールによるパスワード再設定は、SMTP サーバーとサイトの URL を設定してから有効にできます。[アカウントセキュリティとシステム設定](/ja/guide/security#password-reset)を参照してください。

### ファイル保存とアップロード {#storage}

| システム設定 | 環境変数 | デフォルト値 |
|---|---|---|
| 保存先：ローカルディスク / S3 互換ストレージ（AWS S3、MinIO、Alibaba Cloud OSS、Tencent COS、Cloudflare R2） | `STORAGE_DRIVER`（`local` / `s3`） | ローカルディスク |
| S3 エンドポイント（AWS S3 は空欄） | `S3_ENDPOINT` | 空 |
| リージョン（R2 は `auto`） | `S3_REGION` | `us-east-1` |
| バケット / アクセスキー / シークレットキー（S3 では必須） | `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | 空 |
| 公開 URL（設定するとダウンロードはここへ。未設定なら約 10 分有効な署名付き URL） | `S3_PUBLIC_URL` | 空 |
| アクセス方式：自動 / パス形式 / 仮想ホスト形式（自動 = エンドポイントがあればパス形式） | `S3_FORCE_PATH_STYLE`（`true` / `false`） | 自動 |
| ファイルサイズの上限（`MAX_CONTENT_LENGTH` にも制限される） | `UPLOAD_MAX_SIZE`（バイト） | 10MB |
| 許可するファイル形式。アップロード時にはファイル先頭と拡張子の一致も確認 | `UPLOAD_ALLOWED_TYPES`（カンマ区切り） | `jpg,jpeg,png,gif,webp,pdf,txt,csv,doc,docx,xls,xlsx,ppt,pptx,zip` |

保存先の切り替えは今後のアップロードにのみ影響します。既存のファイルは保存場所（バケットを含む）を記録しており、引き続きそこから読み込みます。S3 のエンドポイントやキーを変えて元のバケットにアクセスできなくなると、そこにあるファイルは読み込めなくなります。影響するファイル数はページに表示されます。

### AI モデル {#ai-model}

| システム設定 | 環境変数 | デフォルト値 |
|---|---|---|
| API の URL（OpenAI 互換。例：`https://api.openai.com/v1`） | `AI_API_BASE` | 空 |
| API キー | `AI_API_KEY` | 空 |
| モデル | `AI_MODEL` | 空 |

AI チャット、AI プロンプト工房、AI データ検索はこの設定を共有します。未設定の場合、これらのページには未設定である旨が表示されますが、ほかの機能には影響しません。

### ログインのロック {#login-lockout}

| システム設定 | 環境変数 | デフォルト値 |
|---|---|---|
| ロックまでの失敗回数（IP とユーザー名でそれぞれカウント。デモモードでは IP のみ） | `LOGIN_MAX_FAILURES` | `10` |
| ロック時間（分）。失敗回数を数える期間でもあります | `LOGIN_LOCKOUT_MINUTES` | `15` |

そのほかのセキュリティ設定（2段階認証、パスワード再設定、パスワードのルール、ログインの有効期間、レート制限）はページでのみ変更できます。[アカウントセキュリティとシステム設定](/ja/guide/security)を参照してください。

## フロントエンド（Web）

フロントエンドには実行時の環境変数はありません。開発サーバーの挙動は `apps/web/vite.config.js` に書かれています。

| 項目 | 値 |
|---|---|
| 開発ポート | `5173` |
| プロキシ | `/api` → `http://localhost:5001`、`/ws` → `ws://localhost:5001` |
| パスエイリアス | `@` → `apps/web/src` |

本番環境では、フロントエンドのビルド成果物をバックエンドが直接配信し、リクエストは同一オリジンの `/api` に送られるため、追加の設定は不要です。

ブラウザ上のユーザーの設定（テーマ、外観、言語、タブバー）は `localStorage` / `sessionStorage` に保存されます。[テーマとレイアウト](/ja/guide/appearance#設定の保存先) を参照してください。

## Docker

### compose が読み込む変数

これらの変数は `.env.production` に書き、`docker compose --env-file .env.production ...` で渡します。

| 変数 | 役割 | デフォルト値 |
|---|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL ユーザー `castor_kit` のパスワード | **必須** |
| `SECRET_KEY` | 前述のとおり | **必須** |
| `ADMIN_PASSWORD` | 前述のとおり | **必須** |
| `POSTGRES_RO_PASSWORD` | AI SQL 用読み取り専用アカウントのパスワード | **必須** |
| `NPM_REGISTRY` | イメージのビルド時に依存関係をインストールする npm レジストリ（ビルド引数） | `https://registry.npmmirror.com` |
| `APP_PORT` | ホストにマッピングするポート（コンテナ内は 5000 で固定） | `8080`（`setup.sh` が生成する設定ではデフォルトで `5000`） |
| `ENABLE_TASK_SCHEDULER` | 前述のとおり | `true` |
| `RUN_SCHEDULER_IN_WEB` | 前述のとおり。compose でのデフォルトは `true` で、バックエンド自体のデフォルト値とは異なる | `true` |
| `SESSION_TTL_HOURS` | 前述のとおり | `8` |
| `SESSION_COOKIE_SECURE` | 前述のとおり | 空（自動） |
| `CORS_ORIGINS` | 前述のとおり | 空 |
| `RATE_LIMIT_ENABLED` | 前述のとおり | `true` |
| `AI_API_KEY` / `AI_API_BASE` / `AI_MODEL` | 任意。AI モデルの設定を固定します（[AI モデル](#ai-model)を参照）。空ならシステム設定で設定 | 空 |
| `COMPOSE_DB_VOLUME` | データベースのデータボリューム名。既存のボリュームを指定可能 | `castor-kit_postgres_data` |
| `COMPOSE_INSTANCE_VOLUME` | アップロードファイルのデータボリューム名。既存のボリュームを指定可能 | `castor-kit_app_instance` |

compose は上記の変数をもとに、次の変数を自動で設定します。

| 変数 | 値 |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://castor_kit:<POSTGRES_PASSWORD>@db/castor_kit` |
| `AI_SQL_DATABASE_URL` | `postgresql://castor_kit_ro:<POSTGRES_RO_PASSWORD>@db/castor_kit` |

`.env.production` に書いたそのほかの変数（`LOGIN_MAX_FAILURES` など）は、コンテナに自動では渡されません。必要な場合は `docker-compose.yml` の `app.environment` に追加してください。

### イメージに組み込まれた変数

`Dockerfile` で設定されており、通常は変更する必要はありません。ビルド引数 `NPM_REGISTRY` のデフォルトは `https://registry.npmjs.org` です。compose でビルドする場合は、デフォルトで中国本土のミラーを使います（上の表を参照）。

| 変数 | 値 |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `WEB_DIST_DIR` | `/app/web` |
| `INSTANCE_DIR` | `/app/instance` |
| `MIGRATIONS_DIR` | `/app/drizzle` |

## ツールチェーン

| 変数 | 役割 |
|---|---|
| `CASTOR_KIT_ROOT` | MCP Server が使うリポジトリのルート。デフォルトでは自身の配置場所から推定 |
