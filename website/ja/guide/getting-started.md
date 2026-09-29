# クイックスタート

Castor の実行方法は 2 通りあります。

| 方法 | 用途 | 必要な環境 |
|---|---|---|
| Docker でワンステップ起動 | お試し、デモ、デプロイ | Docker（`docker compose` プラグインを含む） |
| ローカル開発 | ソースコードの変更、AI による新機能の開発 | Node 22+、pnpm、PostgreSQL 14+ |

## Docker でワンステップ起動

### 1. リポジトリをクローンしてセットアップウィザードを実行する

```bash
git clone https://github.com/robeshell/castorjs.git
cd castorjs
bash scripts/setup.sh
```

`setup.sh` は次の処理を順番に行います。

1. Docker がインストールされて動作していること、`docker compose` プラグインが使えることを確認します。
2. リポジトリのルートに `.env.production` がすでにある場合は、設定し直すかどうかを尋ねます。「いいえ」と答えるとファイルをそのまま使い、手順 4 に進みます。
3. 管理者パスワード（Enter で `admin123`）、アクセスポート（Enter で `5000`）、AI 機能をいま設定するかどうか（OpenAI 互換 API の API Key、Base URL、モデル名）を尋ねます。続いて `SECRET_KEY`、データベースのパスワード、AI SQL 用の読み取り専用アカウントのパスワードをランダムに生成し、すべて `.env.production` に書き込みます。ここで入力した AI の値はその設定を固定するため、「システム設定」ページでは読み取り専用になります。
4. `docker compose --env-file .env.production up -d --build` を実行してサービスをビルド・起動します。
5. サービスの準備ができるまで `http://localhost:<ポート>/health` をポーリングします（約 90 秒まで。それでも応答がない場合はログを確認するコマンドを表示します）。

初回は依存関係のダウンロードとイメージのビルドが必要なため、通常数分かかります。

::: tip ダウンロードに失敗する場合
スクリプトは Docker の設定を変更しません。イメージの取得や依存関係のインストールで止まる場合は、ネットワークから Docker Hub や npm レジストリに届いていない可能性があります。Docker Desktop でレジストリミラーを設定し（Settings → Docker Engine → `registry-mirrors`）、必要なら `.env.production` で `NPM_REGISTRY` を設定して（[デプロイガイド](/ja/deploy/) を参照）、スクリプトをもう一度実行してください。
:::

### 2. ログインする

`http://localhost:5000`（またはウィザードで設定したポート）を開き、次のアカウントでログインします。

- ユーザー名：`admin`
- パスワード：ウィザードで設定したパスワード（デフォルトは `admin123`）

パスワードを忘れた場合は [管理者パスワードのリセット](/ja/deploy/#reset-the-admin-password) を参照してください。

### 3. よく使う操作

`docker compose` コマンドにはすべて `--env-file .env.production` を付けてください。付けないと compose が必須の変数を読み込めず、そのままエラーになります。

```bash
docker compose --env-file .env.production logs -f app   # アプリケーションのログを表示
docker compose --env-file .env.production down          # サービスを停止（データボリュームは保持）
docker compose --env-file .env.production up -d         # 再起動
```

そのほかの内容（手動設定、アップデート、リバースプロキシ）は [デプロイガイド](/ja/deploy/) を参照してください。

## ローカル開発

コマンドはすべてリポジトリのルートで実行します。

### 1. 環境を用意する

- Node 22 以上（リポジトリのルートにある `.nvmrc` は `22`）
- pnpm（バージョンはルートの `package.json` の `packageManager` フィールドを参照。`corepack enable` で有効化できます。Node 25 以降は corepack が同梱されないため `npm i -g pnpm@11` を使います）
- ローカルの PostgreSQL 14 以上。`createdb` / `psql` で接続できること

### 2. 依存関係をインストールする

```bash
pnpm install
```

### 3. データベース接続を設定する

```bash
cp apps/api/.env.example apps/api/.env.development
```

`apps/api/.env.development` は gitignore 済みです。サンプルファイルの `DEV_DATABASE_URL` は `postgresql://localhost/castor_kit` になっているので、ユーザー名、パスワード、データベース名を環境に合わせて変更してください。そのほかの任意の設定は [設定](/ja/reference/configuration) を参照してください。

::: tip 設定ファイルの読み込み順
バックエンドは `NODE_ENV`（デフォルトは `development`）に応じて `.env.<NODE_ENV>` を読み込みます。まず `apps/api/`、次にリポジトリのルートの順で読み込み、すでに存在する環境変数は上書きしません。
:::

### 4. データベースを作成して初期化する

```bash
createdb castor_kit
pnpm db:migrate      # Drizzle のマイグレーションを実行し、すべてのテーブルを作成
pnpm seed:rbac       # メニュー、スーパー管理者ロール、admin アカウントを書き込む
```

マイグレーションと RBAC 同期を 1 つのコマンドで行うこともできます。

```bash
pnpm setup-once      # マイグレーション + RBAC の増分同期 + AI SQL 用読み取り専用アカウント（POSTGRES_RO_PASSWORD が未設定ならスキップ）
```

::: warning pnpm seed:rbac は全件再構築です
引数なしの `pnpm seed:rbac` は、ユーザー、ロール、メニューとその関連データをすべて削除してから書き込み直すため、空のデータベースの初期化にしか使えません。データが入っているデータベースでは `pnpm seed:rbac -- --incremental` を使ってください。詳しくは [権限（RBAC）](/ja/guide/rbac) を参照してください。
:::

### 5. 開発サーバーを起動する

```bash
pnpm dev
```

次のサービスが同時に起動します。

| サービス | アドレス | 説明 |
|---|---|---|
| バックエンド | `http://localhost:5001` | `tsx watch` によるホットリロード |
| フロントエンド | `http://localhost:5173` | Vite 開発サーバー。`/api` と `/ws` は 5001 にプロキシ |

`http://localhost:5173` を開き、`admin` / `admin123` でログインします。

`pnpm dev:api`、`pnpm dev:web` で個別に起動することもできます。

::: tip デフォルトアカウント
開発環境で `ADMIN_PASSWORD` を設定していない場合、初期パスワードは `admin123` です。`admin` アカウントは存在しないときにだけ作成されるため、後から `ADMIN_PASSWORD` を変更しても既存アカウントのパスワードは変わりません。パスワードは画面上で変更するか、`pnpm seed:rbac -- --incremental --reset-admin-password` を実行して現在の `ADMIN_PASSWORD` に設定し直してください。
:::

### 6. テストを実行する（任意）

`pnpm test` はバックエンドとフロントエンドのテストを実行します。バックエンドのテストは実際の PostgreSQL テスト用データベース（デフォルトは `postgresql://localhost/castor_kit_test`。シェルまたは `apps/api/.env.test` の `TEST_DATABASE_URL` で上書き可能。`.env.development` の値は使われません）に接続し、テスト開始前にそのデータベースへマイグレーションと RBAC の増分同期を自動で実行します。

```bash
createdb castor_kit_test      # または開発用データベースを複製：createdb -T castor_kit castor_kit_test
pnpm test
```

## 任意：AI 機能

コンポーネント例の AI チャット、AI プロンプト工房、AI データ検索にはモデルサービスが必要です。OpenAI 互換 API（DeepSeek、Qwen、Ollama など）のほか、OpenAI / Anthropic / Google を直接使うこともできます。ログイン後、「システム管理 → システム構成 → システム設定」の「AI」タブでサービスの種類を選び、API の URL、API キー、モデルを入力し、「テスト呼び出し」で確認して保存すると、すぐに反映されます。

`apps/api/.env.development` に書くこともできます（その場合、ページでは読み取り専用になります）。

```bash
AI_PROVIDER=openai-compatible   # または openai / anthropic / google
AI_API_BASE=https://api.openai.com/v1
AI_API_KEY=<あなたの API Key>
AI_MODEL=<モデル名>
```

未設定の場合、これらのページには未設定である旨が表示されますが、ほかの機能には影響しません。

## 任意：ローカルで定期タスクを実行する

開発環境では、web プロセスはデフォルトで定期タスクのスケジューラーを起動しません。タスクを cron どおりに実行させたい場合は、次のどちらかを選びます。

- `apps/api/.env.development` に `RUN_SCHEDULER_IN_WEB=true` を設定する
- 別のターミナルで独立したスケジューラープロセスを実行する：`pnpm --filter @castorjs/api worker`

## 次のステップ

- [プロジェクト構成](/ja/guide/project-structure)
- [AI 駆動開発](/ja/guide/ai-workflow)：AI で最初の機能を納品する
- [コマンド一覧](/ja/reference/commands)
