# デプロイガイド

Docker Compose でのデプロイをおすすめします。compose 構成には PostgreSQL（`db`）と Node アプリケーション（`app`）の 2 つのサービスが含まれます。アプリケーションのプロセスは、バックエンド API とビルド済みのフロントエンドのページを両方とも配信します。

::: info アプリの自動デプロイはありません
アプリケーションは CI による自動デプロイを行いません。`.github/workflows/ci.yml` は push と Pull Request のときに lint、型チェック、テスト、検証ゲート、フロントエンドのビルドを実行するだけです。デプロイはサーバー上で手動で行います。更新の手順は後述します。

ドキュメントサイトは例外です。`website/` の変更が main にマージされると、`.github/workflows/docs.yml` がビルドして GitHub Pages に公開します（リポジトリの Settings → Pages で Source を GitHub Actions に設定してください）。Pull Request ではビルドとリンク切れのチェックのみ行います。
:::

## アーキテクチャの概要

| コンポーネント | 説明 |
|---|---|
| `db` | イメージは `postgres:alpine`。データベース名とユーザー名はどちらも `castor_kit` で、データはボリューム `postgres_data` に保存 |
| `app` | リポジトリのルートにある `Dockerfile` からビルド。コンテナ内では 5000 番ポートで待ち受け、アップロードされたファイルはボリューム `app_instance`（`/app/instance` にマウント）に保存 |

イメージのビルドは 2 段階です。第 1 段階では `node:22-alpine` をベースに依存関係をインストールし、フロントエンド（Vite）とバックエンド（tsup）をビルドしてから、本番用の依存関係だけに絞り込みます。第 2 段階は実行用のイメージで、root 以外のユーザー（uid 10001）で動作し、`/health` を使ったヘルスチェックが設定されています。

コンテナの起動時、`docker-entrypoint.sh` は次の処理を順番に実行します。

1. `node dist/setup-once.js`：PostgreSQL の advisory lock で保護したうえで、データベースのマイグレーション、RBAC の増分同期、AI SQL 用読み取り専用アカウント `castor_kit_ro` の作成または更新を行います。複数のレプリカが同時に起動しても順番に実行されるだけで、結果は冪等です。
2. `node dist/main.js`：サービスを起動します。

::: warning ビルド時に使うレジストリ
`Dockerfile` では npm registry を `https://registry.npmmirror.com` に設定しています。サーバーからこのレジストリへのアクセスが遅い場合は、`Dockerfile` で変更してください。
:::

## 方法 1：セットアップウィザード

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh
```

ウィザードは管理者パスワード、アクセスポート（デフォルトは 5000）、任意の AI 設定を尋ね、`SECRET_KEY`、`POSTGRES_PASSWORD`、`POSTGRES_RO_PASSWORD` をランダムに生成して `.env.production` に書き込みます。そのあとサービスをビルド・起動し、`/health` の準備が整うまで待ちます。

::: warning setup.sh は Docker の設定を変更します
Docker の `daemon.json`（macOS では `~/.docker/daemon.json`、Linux では `/etc/docker/daemon.json`）に `registry-mirrors` がない場合、スクリプトはミラーのアドレスを書き込んで Docker を再起動します（Linux では `sudo systemctl restart docker` を使用）。ほかのコンテナがすでに動いているサーバーでは、方法 2 を使うことをおすすめします。
:::

## 方法 2：手動で設定する

### 1. .env.production を作成する

リポジトリのルートに `.env.production` を作成し、少なくとも次の変数を含めます（どれか 1 つでも欠けていると compose は起動を拒否します）。

```bash
SECRET_KEY=<十分な長さのランダムな文字列>
ADMIN_PASSWORD=<admin アカウントの初期パスワード>
POSTGRES_PASSWORD=<データベースのパスワード>
POSTGRES_RO_PASSWORD=<AI SQL 用読み取り専用アカウントのパスワード>
```

任意の変数：

```bash
APP_PORT=5000          # ホスト側のポート。未設定の場合は 8080
AI_API_BASE=
AI_API_KEY=
AI_MODEL=
```

使用できるすべての変数は [設定](/ja/reference/configuration#docker) を参照してください。ランダムな文字列は `openssl rand -base64 48` で生成できます。

### 2. ビルドして起動する

```bash
docker compose --env-file .env.production up -d --build
```

初回のビルドには数分かかります。その後 `http://<サーバーのアドレス>:<APP_PORT>` にアクセスし、`admin` と `ADMIN_PASSWORD` でログインします。

::: tip compose コマンドには毎回 --env-file を付けること
compose がデフォルトで読み込むのは `.env` だけで、`.env.production` は読み込みません。`--env-file .env.production` を付けないと必須の変数が欠けるため、コマンドはそのままエラーになります。
:::

::: warning ADMIN_PASSWORD が効くのは初回だけ
`admin` アカウントは存在しないときにだけ作成されます。初回起動後に `ADMIN_PASSWORD` を変更しても既存アカウントのパスワードは変わらないので、ログインしてから画面上で変更してください。
:::

## 方法 3：Render + Neon（無料のデモ）

[Render](https://render.com) の無料 Web サービスでアプリを動かし、データは [Neon](https://neon.tech) の無料 PostgreSQL に保存します。公開のオンラインデモに向いています。リポジトリ直下の `render.yaml` に設定が用意されており、[デモモード](/ja/reference/configuration#public-demo)が有効になります。

- ログイン画面にデモアカウント（`admin` / `castor-demo`）が表示され、ワンクリックでログインできます
- システム管理は読み取り専用で、パスワードも変更できません。コンポーネント例のデータは自由に追加・編集・削除できます
- サンプルデータは 24 時間ごとに自動で復元されます

::: warning 無料プランの制限
執筆時点の無料枠です。登録する前に各サービスの公式サイトで確認してください。
- Render の無料インスタンスは 15 分間アクセスがないとスリープし、次のアクセスでは起動に数十秒かかります。スリープ中は定期タスクも実行されません
- Neon の無料データベースはアイドル時にコンピュートを停止し、次の接続で自動的に再開します
:::

### 1. Neon でデータベースを作成する

1. Neon に登録してプロジェクトを作成します。リージョンは Render のサービスに近いもの（例：どちらも米国東部やシンガポール）を選びます
2. プロジェクトのダッシュボードで **Connect** をクリックし、**「Connection pooling」をオフ**にして、直接接続の接続文字列をコピーします。形式は `postgresql://<ユーザー>:<パスワード>@ep-xxx.<リージョン>.aws.neon.tech/neondb?sslmode=require` です

::: tip 直接接続を使う理由
起動時の初期化（マイグレーション、RBAC の同期、デモデータの復元）は、並行実行を防ぐためにセッション単位の advisory lock を使います。トランザクション単位のコネクションプールではこのロックを保持できません。接続文字列の `channel_binding=require` は残しても削除してもかまいません。
:::

### 2. Render にデプロイする

1. GitHub アカウントで Render に登録します。リポジトリが自分のアカウントにない場合は、先に Fork してください
2. Render のダッシュボードで **New → Blueprint** を選び、リポジトリを選択します。Render が `render.yaml` を読み込みます
3. 画面の案内に従って `DATABASE_URL`（前の手順でコピーした接続文字列）を入力します。そのほかの変数は `render.yaml` で設定済みか、自動生成されます
4. **Apply** をクリックします。初回のビルドには 5〜10 分ほどかかります。ステータスが **Live** になったらサービスの URL（`https://<サービス名>.onrender.com`）を開くと、ログイン画面にデモアカウントが表示されます

README の **Deploy to Render** ボタンからでも同じようにデプロイできます。

### 3. その後の運用

- `render.yaml` では自動デプロイを無効にしていません。main に push するたびに Render が再ビルドし、ビルドに失敗するとメールで通知されます。不要な場合はサービスの **Settings → Build & Deploy** で Auto-Deploy をオフにしてください
- デモアカウントのパスワードは `render.yaml` の `ADMIN_PASSWORD` です。アカウントを初めて作成するときにだけ使われるので、変更する場合は最初のデプロイ前に変えてください
- デモデータをすぐに復元するには、Render サービスの **Shell** で `node dist/demo-reset.js` を実行するか、ローカルから同じデータベースに対して `pnpm demo:reset` を実行します

::: details 起動時に読み取り専用アカウントを作成できない
起動時に、AI データ検索で使う読み取り専用アカウント `castor_kit_ro` を作成します。Neon で作成が拒否される場合は、Neon の SQL Editor で次を実行してください。

```sql
CREATE ROLE castor_kit_ro LOGIN PASSWORD '<Render の POSTGRES_RO_PASSWORD の値>';
```

そのあと Render で再デプロイします。初期化の処理が既存のアカウントのパスワードを更新し、権限を付与します。
:::

::: tip Render で本番環境を動かす場合
`DEMO_MODE` を `false` にし、`ADMIN_PASSWORD` を強力なパスワードに変更してください。ただし無料インスタンスはスリープし、定期タスクも時間どおりには実行されません。本番で使う場合は有料インスタンスを選ぶか、方法 1 または方法 2 で自分のサーバーにデプロイすることをおすすめします。
:::

## よく使う運用コマンド

```bash
docker compose --env-file .env.production ps               # サービスの状態を表示
docker compose --env-file .env.production logs -f app      # アプリケーションのログを表示
docker compose --env-file .env.production restart app      # アプリケーションを再起動
docker compose --env-file .env.production down             # サービスを停止（データボリュームは保持）
curl -f http://localhost:<APP_PORT>/health                 # ヘルスチェック
```

`/health` は、データベースが利用可能であれば `{ status: 'healthy', ... }` を返し、そうでなければ 500 を返します。

::: danger down -v を安易に使わないこと
`docker compose down -v` はデータボリュームを削除するため、データベースとアップロードされたファイルがすべて失われます。
:::

## 更新の手順

```bash
git pull
docker compose --env-file .env.production up -d --build
```

compose は最新のコードでイメージを再ビルドし、`app` コンテナを作り直します。コンテナの起動時には新しいデータベースマイグレーションと RBAC の増分同期が自動で実行されます。新しいメニューは自動で表示されてスーパー管理者に付与され、既存のユーザー、ロール、独自のデータが消えることはありません。

更新の前にデータベースをバックアップしておくことをおすすめします。手順は後述します。

## データの永続化とバックアップ

| ボリューム | デフォルトの名前 | 内容 |
|---|---|---|
| `postgres_data` | `castor-kit_postgres_data` | PostgreSQL のデータ |
| `app_instance` | `castor-kit_app_instance` | アップロードされたファイル |

既存のボリュームを再利用したい場合は、`.env.production` の `COMPOSE_DB_VOLUME` / `COMPOSE_INSTANCE_VOLUME` に既存のボリューム名を設定します。

データベースのバックアップ例：

```bash
docker compose --env-file .env.production exec db pg_dump -U castor_kit castor_kit > castor_kit_backup.sql
```

::: tip PostgreSQL のバージョンを固定する
`docker-compose.yml` で `db` が使うイメージタグは `postgres:alpine` なので、新しいマシンで pull すると最新のメジャーバージョンが取得されます。PostgreSQL のデータディレクトリはメジャーバージョンをまたいでそのままは使えないため、本番環境ではタグを特定のメジャーバージョンに固定することをおすすめします。
:::

## リバースプロキシと HTTPS {#reverse-proxy-and-https}

本番環境では、アプリケーションの前段にリバースプロキシ（Nginx など）を置いて TLS を処理することをおすすめします。次の点に注意してください。

- **`Host` とプロトコルのヘッダーを転送する**：アプリケーションはプロキシを 1 段まで信頼し、`X-Forwarded-For` / `X-Forwarded-Proto` からクライアントの IP とプロトコルを取得します。`SESSION_COOKIE_SECURE` が空の場合は、リクエストのプロトコルに応じて cookie に `Secure` フラグを付けるかどうかを自動で決めるため、`X-Forwarded-Proto` を正しく渡す必要があります。
- **WebSocket**：`/ws` パスでは `Upgrade` ヘッダーを転送する必要があります。WebSocket のハンドシェイクでは `Origin` が `Host` と同一オリジンであること（または `CORS_ORIGINS` の許可リストに含まれていること）を検証するため、プロキシは元の `Host` を保持しなければなりません。
- **リクエストボディのサイズ**：アプリケーションが許可するリクエストボディの上限はデフォルトで 16MB（`MAX_CONTENT_LENGTH`）、インポートファイルの上限は 5MB です。Nginx の `client_max_body_size` はデフォルトで 1MB しかないため、それに合わせて大きくする必要があります。
- **ストリーミングレスポンス**：AI チャットは SSE を使います。アプリケーションはレスポンスヘッダーに `X-Accel-Buffering: no` を設定して、Nginx のバッファリングを無効にしています。

Nginx の設定例（`APP_PORT=5000` の場合）：

```nginx
server {
    listen 80;
    server_name example.com;

    client_max_body_size 16m;

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

HTTPS の証明書は Let's Encrypt（Certbot の Nginx プラグインなど）で取得できます。HTTPS を有効にしたら、`.env.production` で `SESSION_COOKIE_SECURE=true` を明示的に設定することもできます。

::: tip プロキシ経由でのみアクセスさせる
リバースプロキシを使う場合は、`docker-compose.yml` のポートマッピングをローカルホストだけにバインドするよう変更する（例：`"127.0.0.1:${APP_PORT:-8080}:5000"`）と、プロキシを経由しない直接アクセスを防げます。
:::

## 複数レプリカと定期タスク

デフォルトでは `app` コンテナは 1 つだけで、定期タスクのスケジューラーは web プロセス内で動作します（compose での `RUN_SCHEDULER_IN_WEB` のデフォルトは `true`）。

アプリケーションのレプリカを複数にする場合：

1. web のレプリカに `RUN_SCHEDULER_IN_WEB=false` を設定します。
2. スケジューラーのプロセスを別途実行します。同じイメージを使い、**entrypoint を上書き**して（`command` ではありません）`node dist/worker.js` にします。

イメージの `ENTRYPOINT` は `docker-entrypoint.sh` で、常に `setup-once` を実行してから `main.js` を起動し、`command` は読み込みません。そのため、`docker-compose.yml` にスケジューラーのサービスを追加するときは次のように書きます。

```yaml
  worker:
    build: .
    restart: unless-stopped
    entrypoint: ["node", "dist/worker.js"]
    environment:
      # Same variables as the app service (DATABASE_URL, SECRET_KEY, ADMIN_PASSWORD, AI_SQL_DATABASE_URL, ...)
    depends_on:
      db:
        condition: service_healthy
```

スケジューラーのサービスは `setup-once` を実行しません。データベースの初期化は引き続き `app` コンテナが行います。

スケジューラーはデータベースのリースに基づいて動作するため、同じタスクを同時に取得できるのは 1 つのプロセスだけです。複数のプロセスが同時にスケジューラーを動かしても、タスクが重複して実行されることはありません。`setup-once` は advisory lock を使うので、複数のレプリカが同時に起動しても安全です。

## Docker を使わずにデプロイする

Node 22+、pnpm、PostgreSQL 14+ が必要です。

```bash
# 1. 依存関係をインストールしてビルドする
corepack enable
pnpm install --frozen-lockfile
pnpm build

# 2. リポジトリのルートまたは apps/api/ に .env.production を作成し、少なくとも次を含める：
#    DATABASE_URL、SECRET_KEY、ADMIN_PASSWORD、AI_SQL_DATABASE_URL、POSTGRES_RO_PASSWORD

# 3. データベースを初期化する（マイグレーション + RBAC の増分同期 + 読み取り専用アカウント）
NODE_ENV=production node apps/api/dist/setup-once.js

# 4. サービスを起動する（デフォルトは 0.0.0.0:5000 で待ち受け。PORT で変更可能）
NODE_ENV=production node apps/api/dist/main.js
```

- `NODE_ENV` は必ずコマンドライン（またはプロセスマネージャー）で設定してください。バックエンドはこれに基づいて `.env.production` を読み込むかどうかを決めます。
- `AI_SQL_DATABASE_URL` は読み取り専用アカウントを指すようにします（例：`postgresql://castor_kit_ro:<POSTGRES_RO_PASSWORD>@<host>/<データベース名>`）。読み取り専用アカウントは手順 3 で `POSTGRES_RO_PASSWORD` をもとに作成されます。
- フロントエンドのビルド成果物は `apps/web/dist/` にあり、バックエンドはデフォルトでここからページを配信します。
- `main.js` は systemd や pm2 などのプロセスマネージャーで管理することをおすすめします。独立したスケジューラーのプロセスは `apps/api/dist/worker.js` です。
- 更新時の手順：`git pull` → `pnpm install --frozen-lockfile` → `pnpm build` → 手順 3 を再度実行 → サービスを再起動。
