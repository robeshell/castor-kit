# はじめる

::: info castor-kit と AuraStack
castor-kit は AuraStack（Flask 版）の Node.js/TypeScript リライト版です。バックエンドは Fastify + Drizzle に置き換わり、React フロントエンドはルーティングと機能を引き継ぎつつ UI を Semi Design から shadcn/ui + Tailwind CSS v4 に移行し、同じ PostgreSQL スキーマに接続し、互換性のある API 契約を維持しています。
:::

## 環境要件

利用シーンに合わせてセットアップ方法を選択してください：

| 方法 | 要件 |
|---|---|
| **Docker（推奨）** | [Docker Desktop](https://www.docker.com/products/docker-desktop/) をインストールするだけ — 他のツール不要 |
| **ローカル開発** | Node 22+、pnpm（`corepack enable` だけで OK）、PostgreSQL 14+ |

---

## Docker クイックスタート（推奨）

Docker は castor-kit を最速で実行する方法です。セットアップウィザードがすべてを自動で設定します。

### 1. Docker Desktop をインストール

[Docker Desktop](https://www.docker.com/products/docker-desktop/) をダウンロードしてインストール。左下のステータスアイコンが緑色（"Running"）になったら次へ進んでください。

### 2. リポジトリをクローンしてセットアップウィザードを実行

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh
```

対話式ウィザードが管理者パスワード、ポート、AI 機能の設定（任意）を尋ね、`SECRET_KEY`、データベースパスワード、AI SQL 読み取り専用パスワードを生成して `.env.production` に書き込みます。初回起動は全体で約 3〜5 分かかります。

### 3. アプリにアクセス

**http://localhost:5000**（ウィザードで選択したポート、デフォルトは 5000）を開き、以下でログインしてください：

- **ユーザー名：** `admin`
- **パスワード：** セットアップ時に設定したパスワード（デフォルト：`admin123`）

::: tip 手動 Docker 起動（ウィザードなし）
手動で設定したい場合：

```bash
cp .env.example .env.production
# .env.production を編集 — 最低限以下を設定：
#   SECRET_KEY / ADMIN_PASSWORD / POSTGRES_PASSWORD / POSTGRES_RO_PASSWORD
docker compose --env-file .env.production up -d --build
```

`APP_PORT` を設定しない場合、アプリはポート **8080** で公開されます。
:::

---

## ローカル開発環境

ソースコードを変更してリアルタイムで確認したい場合に使用します。castor-kit は pnpm モノレポです——すべてのコマンドはリポジトリのルートで実行してください。

### 1. リポジトリをクローンして依存関係をインストール

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
corepack enable        # package.json で固定された pnpm バージョンを有効化
pnpm install
```

### 2. 環境変数を設定

```bash
cp apps/api/.env.example apps/api/.env.development
```

`apps/api/.env.development` を開き、最低限データベース接続を設定します：

```env
DEV_DATABASE_URL=postgresql://youruser@localhost/aurastack
```

開発環境では `NODE_ENV` のデフォルトは `development` です。`SECRET_KEY` と `ADMIN_PASSWORD` は空のままでも構いません（組み込みの開発用キーと `admin123` が使われます）。

### 3. データベースを初期化

```bash
# データベースを作成
createdb aurastack

# Drizzle マイグレーションを実行（空のデータベースには全テーブルが作成されます）
pnpm db:migrate

# RBAC データをシード（メニュー、スーパー管理者ロール、管理者アカウント）
pnpm seed:rbac
```

::: warning フラグなしの seed:rbac は完全な再構築
フラグなしの `pnpm seed:rbac` はアカウント・ロール・メニューを削除して再作成します——初回の初期化時にのみ使用してください。以降のメニュー変更には `pnpm seed:rbac -- --incremental` を使用してください。
:::

### 4. 開発サーバーを起動

```bash
pnpm dev
```

Fastify バックエンド（ポート 5001、`tsx watch` によるホットリロード）と Vite フロントエンド（ポート 5173、`/api` と `/ws` はバックエンドにプロキシ）が起動します。`pnpm dev:api` と `pnpm dev:web` で 2 つのターミナルに分けて個別に起動することもできます。

**http://localhost:5173** を開き、`admin` / `admin123` でログインしてください。

::: tip macOS のダブルクリック起動
データベースの初期化が済んでいれば、プロジェクトルートの **`启动castor-kit.command`** をダブルクリックするだけで起動できます。`pnpm install`、`pnpm setup-once`、`pnpm dev` が順に実行されます。
:::

---

## AI ツールのセットアップ

castor-kit にはすべての主要 AI コーディングツール向けのコンテキストが事前設定されています。クローン後すぐに作業を始められます——追加設定は不要です。

### Claude Code（推奨）

```bash
# インストール
npm install -g @anthropic-ai/claude-code

# プロジェクトディレクトリで起動
cd castor-kit
claude
```

Claude Code は起動時に `CLAUDE.md` と `AGENTS.md` を自動で読み込みます。内蔵スキルを使用：

```
/new-feature-autopilot
```

### Cursor

1. [Cursor](https://cursor.sh) をダウンロード・インストール
2. Cursor でプロジェクトフォルダを開く
3. `.cursor/rules/` のルールが自動読み込み — チャットパネルで要件を説明するだけ

### GitHub Copilot

1. VS Code に **GitHub Copilot** 拡張機能をインストール
2. VS Code でプロジェクトフォルダを開く
3. `.github/copilot-instructions.md` がプロジェクトコンテキストとして自動注入
4. Copilot Chat（`Ctrl+Shift+I`）で要件を説明

### Windsurf

1. [Windsurf](https://codeium.com/windsurf) をダウンロード・インストール
2. Windsurf でプロジェクトフォルダを開く
3. `.windsurfrules` が自動読み込み — Cascade で要件を説明

### Codex CLI

```bash
# インストール
npm install -g @openai/codex

# プロジェクトディレクトリで実行
cd castor-kit
codex "顧客管理ページを作成。フィールド：氏名、電話、会社名、ステータス"
```

Codex CLI は `AGENTS.md` をネイティブに読み込みます。`CODEX.md` にはコマンドと権限に関する補足があります。

### MCP クライアント（Claude Desktop など）

castor-kit には MCP サーバー（`apps/mcp`）が含まれており、スキャフォールド、検証ゲート、RBAC 同期、マイグレーションを MCP ツールとして公開します。`claude_desktop_config.json` に追加してください：

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

---

## AI 開発ワークフロー

Claude Code を例にした、エンドツーエンドの完全なフロー：

### 1. 要件を説明

```
/new-feature-autopilot

顧客管理ページを作成。フィールド：氏名、電話、会社名、ステータス（有効/無効）
```

### 2. AI が技術仕様を自動推論

AI が `AGENTS.md` と `docs/templates/` を読み込み、以下を推論します：

- テーブルのカラム型（Drizzle の書き方）
- API ルートの命名
- フロントエンドのページパス
- RBAC 権限コードとメニュー ID

**技術的な質問への回答は不要です。**

### 3. ビジネスプレビューを確認

コードに手を付ける前に、AI がわかりやすい言葉でプレビューを表示します：

```
📋 顧客管理

場所：システム管理 → 顧客管理
操作：一覧、新規作成、編集、削除、インポート、エクスポート
フィールド：
  · 氏名（必須）
  · 電話
  · 会社名
  · ステータス

この内容で進めますか？それとも調整が必要ですか？
```

### 4. 完全なモジュールを自動生成

確認後、AI が `pnpm scaffold` を実行し、ビジネスロジックを埋めていきます：

| ファイル | 内容 |
|---|---|
| `apps/api/src/db/schema/admin/customer.ts` | Drizzle テーブル定義 + `toDict` |
| `apps/api/src/modules/admin/customer/schema.ts` | Zod バリデーション、インポート/エクスポートのフィールドマッピング |
| `apps/api/src/modules/admin/customer/repository.ts` | データベースアクセス |
| `apps/api/src/modules/admin/customer/service.ts` | ビジネスロジック |
| `apps/api/src/modules/admin/customer/routes.ts` | Fastify ルート + 権限チェック |
| `apps/web/src/modules/admin/pages/customer/index.jsx` | React リストページ（インポート/エクスポート付き） |
| `apps/api/drizzle/` | Drizzle SQL マイグレーション |
| `apps/api/scripts/seed-rbac.ts` | メニュー + ボタン権限エントリ |

続いて `pnpm seed:rbac -- --incremental` を実行し、`pnpm setup-once` でマイグレーションを適用し、`psql \d` でテーブルの存在を確認します。

### 5. 検証

```bash
pnpm verify -- --module customer
```

すべてのチェックが通れば、機能はリリース可能です。
