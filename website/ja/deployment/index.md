# デプロイガイド

## Docker デプロイ（推奨）

Docker は公式に推奨されるデプロイ方法です。コマンド一つで PostgreSQL と Node サーバー（Fastify バックエンドがビルド済みの React フロントエンドも配信）が起動し、コンテナは起動時に Drizzle マイグレーション、RBAC 同期、AI SQL 読み取り専用ロールの設定を実行します。

### 1. セットアップウィザードを使う（最も簡単）

```bash
bash setup.sh
```

ウィザードが `.env.production`（ランダムな `SECRET_KEY`、データベースパスワード、読み取り専用パスワード）を書き出し、スタックをビルドして起動します。デフォルトのポートは 5000 です。

### 2. または環境変数を手動で設定

```bash
cp .env.example .env.production
```

`.env.production` を編集し、最低限以下の 4 項目を設定します（いずれかが欠けていると `docker-compose.yml` は起動を拒否します）：

```env
SECRET_KEY=a-random-string-of-64-or-more-characters   # 必須 — セッション暗号化キー
ADMIN_PASSWORD=your-admin-password                   # 必須 — 管理者の初期パスワード
POSTGRES_PASSWORD=your-db-password                   # 必須 — PostgreSQL のパスワード
POSTGRES_RO_PASSWORD=your-readonly-password          # 必須 — AI SQL 読み取り専用ロール castor_kit_ro のパスワード
```

その後、ビルドして起動します：

```bash
docker compose --env-file .env.production up -d --build
```

初回起動は 2〜5 分かかります（イメージの取得 + 依存関係のインストール + フロントエンドとバックエンドのビルド）。2 回目以降の起動は高速です。

### 3. アクセス

**http://localhost:8080**（または `APP_PORT` で設定したポート。ウィザードのデフォルトは 5000）を開き、`admin` / `<ADMIN_PASSWORD>` でログインしてください。

### コンテナ起動時の処理

イメージは `node:22-alpine` をベースとし、非 root ユーザーで実行されます。エントリポイント `docker-entrypoint.sh` は以下を実行します：

1. `node dist/setup-once.js` — PostgreSQL のアドバイザリーロックの下で：マイグレーション → RBAC の増分同期 → AI SQL 読み取り専用ロールの作成/更新（複数のレプリカが同時に起動しても、処理を行うのは 1 つだけ）
2. `node dist/main.js` — コンテナ内のポート 5000 でサーバーを起動。ヘルスチェックには `/health` を使用

---

## 環境変数リファレンス

| 変数 | デフォルト値 | 説明 |
|---|---|---|
| `SECRET_KEY` | _（必須）_ | セッション暗号化キー（castor-kit はここから HKDF で Cookie キーを導出）。 |
| `ADMIN_PASSWORD` | _（必須）_ | `admin` アカウントの初期パスワード。 |
| `POSTGRES_PASSWORD` | _（必須）_ | PostgreSQL サービスのパスワード。 |
| `POSTGRES_RO_PASSWORD` | _（必須）_ | AI SQL 読み取り専用ロールのパスワード。compose はこれを使って `AI_SQL_DATABASE_URL` を組み立てます。 |
| `APP_PORT` | `8080` | アプリコンテナにマップするホストポート（ウィザードは 5000 を書き込みます）。 |
| `AI_API_KEY` | _（空）_ | AI 機能の API キー。空のままにすると AI ページが無効になります。 |
| `AI_API_BASE` | _（空）_ | OpenAI 互換エンドポイント（例：`https://api.openai.com/v1`、Azure OpenAI、ローカルプロキシ）。 |
| `AI_MODEL` | _（空）_ | モデル名（例：`gpt-4o`）。 |
| `ENABLE_TASK_SCHEDULER` | `true` | 定期タスクスケジューラーを有効にする。 |
| `RUN_SCHEDULER_IN_WEB` | `true` | スケジューラーを Web プロセス内で実行する（複数レプリカの場合は `false` にして別の worker を実行）。 |
| `SESSION_TTL_HOURS` | `8` | セッションの有効期間（時間）。 |
| `SESSION_COOKIE_SECURE` | _（空 = 自動）_ | 空の場合、HTTPS リクエストのときだけ Cookie に `Secure` フラグが付きます。 |
| `CORS_ORIGINS` | _（空）_ | 許可するクロスオリジンのカンマ区切りリスト。 |
| `COMPOSE_DB_VOLUME` / `COMPOSE_INSTANCE_VOLUME` | `castor-kit_postgres_data` / `castor-kit_app_instance` | データベースとアップロードファイル用のボリューム名。 |

::: warning
本番環境（`NODE_ENV=production`）では、`SECRET_KEY`、`ADMIN_PASSWORD`、`AI_SQL_DATABASE_URL` のいずれかが欠けているとサーバーは起動を拒否します。`AI_API_KEY` が設定されていない場合、AI チャットと AI プロンプトワークショップページはエラーを返します。他のすべての機能は正常に動作します。
:::

---

## よく使うコマンド

```bash
# アプリケーションログをリアルタイムで確認
docker compose logs -f app

# すべてのコンテナを停止（データベースデータは保持）
docker compose down

# すべてのコンテナを停止してデータベース volume を削除
docker compose down -v

# コード更新後に再ビルド
docker compose --env-file .env.production up -d --build
```

---

## 手動サーバーデプロイ

Docker を使わない VPS やベアメタルサーバー向けです。Node 22+、pnpm、PostgreSQL 14+ が必要です。

### 1. 依存関係をインストールしてビルド

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

フロントエンドは `apps/web/dist/` に、バックエンドは `apps/api/dist/` にビルドされます。本番環境では Node サーバー自身がフロントエンドの静的ファイルを配信します。

### 2. 環境変数を設定

```bash
cp .env.example .env.production
```

`.env.production` を編集します（リポジトリのルートと `apps/api/` のどちらに置いても構いません）：

```env
SECRET_KEY=your-strong-random-secret
DATABASE_URL=postgresql://user:password@localhost/castor_kit
ADMIN_PASSWORD=your-admin-password
POSTGRES_RO_PASSWORD=your-readonly-password
AI_SQL_DATABASE_URL=postgresql://castor_kit_ro:your-readonly-password@localhost/castor_kit
```

### 3. データベースを初期化

```bash
NODE_ENV=production node apps/api/dist/setup-once.js
```

マイグレーションを実行し、RBAC データを同期し、`POSTGRES_RO_PASSWORD` を使って読み取り専用ロール `castor_kit_ro` を作成します。

### 4. サーバーを起動

```bash
NODE_ENV=production node apps/api/dist/main.js
```

デフォルトでは `0.0.0.0:5000` にバインドされます。`PORT` 環境変数で変更できます。プロセスの常駐には systemd または pm2 を使用してください。

::: tip 独立したスケジューラープロセス
マルチインスタンス構成では、Web プロセスに `RUN_SCHEDULER_IN_WEB=false` を設定し、スケジューラープロセスを 1 つだけ実行します：
```bash
NODE_ENV=production node apps/api/dist/worker.js
```
:::

---

## Nginx リバースプロキシ

Node サーバーの前段に Nginx を置き、TLS 終端、圧縮、静的ファイルのキャッシュを担当させます。

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # WebSocket サポート（コンポーネントセンターの WebSocket / パフォーマンスモニターページ）
    location /ws {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
    }
}
```

::: tip TLS / HTTPS
[Certbot](https://certbot.eff.org/) と Nginx プラグインを使えば、無料の Let's Encrypt 証明書を取得して自動更新できます：
```bash
certbot --nginx -d your-domain.com
```
:::

---

## アップデート

### Docker

```bash
git pull
docker compose --env-file .env.production up -d --build
```

Compose が最新のコードでイメージを再ビルドし、マイグレーションと RBAC 同期はコンテナ起動時に自動で実行されます。手動の作業は不要です。

### 手動デプロイ

```bash
git pull
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production node apps/api/dist/setup-once.js
# Node サーバーを再起動（例：systemd 経由）
sudo systemctl restart castor-kit
```
