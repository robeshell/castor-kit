# プロジェクトを始める

castor-kit はインストールして使うライブラリではなく、出発点です。あなたの製品は、castor-kit のあるリリースをコピーして始まり、そこから育っていくリポジトリになります。このページでは、リポジトリの作成、製品名の設定、コンポーネント例の非表示、本番公開、そして castor-kit の新しいリリースの取り込み方を説明します。

## 1. リポジトリを作る

リリースのタグから始め、castor-kit を 2 つ目のリモートとして残しておくと、後のリリースをマージできます。

```bash
git clone --branch v0.3.0 https://github.com/robeshell/castor-kit.git my-app
cd my-app
git switch -c main
git remote rename origin upstream
git remote add origin git@github.com:your-org/my-app.git
git push -u origin main
```

続いて[クイックスタート](/ja/guide/getting-started)の「ローカル開発」に沿って、依存関係のインストール、データベースの作成、開発サーバーの起動を行います。

## 2. 製品名を設定する

| 対象 | 場所 |
|---|---|
| Web アプリ内の名前：ブラウザのタブのタイトル、サイドバーのロゴ文字、ログイン画面のフッター、ダウンロードファイル名 | `apps/web/src/lib/brand.ts` の `APP_NAME` |
| アプリの読み込み前に表示されるタイトルと説明 | `apps/web/index.html` の `<title>` と `<meta name="description">` |
| ロゴと favicon | `apps/web/src/assets/castor-logo.png` を差し替え（`components/app/BrandMark.tsx` が読み込み、favicon のリンクは `index.html`） |
| サーバーが表示する名前：認証アプリの発行者、既定の送信者、テストメール、AI アシスタントの自己紹介、ログ | 環境変数 `APP_NAME`（[設定](/ja/reference/configuration)を参照） |
| データベース名 | `DEV_DATABASE_URL` / `TEST_DATABASE_URL` / `DATABASE_URL`。既定は `castor_kit` と `castor_kit_test` |
| ダッシュボードの内容（クイックリンク、技術スタックのパネル） | `apps/web/src/modules/admin/pages/dashboard/index.tsx`。ほかのページと同じくサンプルです |

次のものは「castor」を含んでいても変更しないでください。

- 内部パッケージ名 `@castor-kit/*`：スクリプトや `pnpm --filter` コマンドが使っており、ユーザーには見えません。
- セッション Cookie 名と鍵導出のラベル（`castor-kit-session`、`castor-kit-secret-box` など）：変更すると全員がログアウトされ、保存済みの秘密情報（SMTP / S3 / AI の鍵）が復号できなくなります。
- Webhook のヘッダー `X-Castor-Event` / `X-Castor-Signature` など：受信側がこれで検証しています。

## 3. コンポーネント例を非表示にする

コンポーネント例（36 個のサンプルページ）は、AI エージェントが手本にする参考実装です。AGENTS.md の「Page patterns (which page to copy)」もここを指しています。コードは残し、ユーザーからは隠すのがおすすめです。`apps/api/scripts/seed-rbac.ts` でルートメニューを無効にします。

```ts
{ id: 3, name: "组件示例中心", code: "component_center", …, is_visible: true, is_active: false },
```

その後 `pnpm seed:rbac -- --incremental` を実行します（デプロイ環境では起動のたびに `setup-once` が実行します）。コンポーネント例はサイドバー、⌘K メニュー、ルートから消え（URL は 404 になります）、ダッシュボードのサンプルへのショートカットも表示されなくなります。API は登録されたままですが、コンポーネント例の権限が必要で、ロールに付与しない限りスーパー管理者しか持っていません。ページは開いたときにだけ読み込まれるので、ユーザーのダウンロード量は増えません。

コンポーネント例を完全に削除する手順は、まだサポートしていません。フレームワーク自身のテストが、そのモジュールをテスト対象として使っているためです。

## 4. 本番公開の前に

- 本番では `SECRET_KEY` と `ADMIN_PASSWORD` が必須です（ないとサーバーは起動しません）。`scripts/setup.sh` は `SECRET_KEY` を生成し、管理者パスワードを尋ねます。強いパスワードを入力してください。空のままだと `admin123` になります。
- `DEMO_MODE` はオフのまま（既定）にします。公開デモ専用です。
- Docker Compose などでのデプロイは[デプロイガイド](/ja/deploy/)を参照してください。

## 5. 機能を開発する

機能を説明して AI エージェントに `/new-feature-autopilot` を実行させるか、spec を自分で書いて `pnpm scaffold -- --spec` を実行します。[AI 駆動開発](/ja/guide/ai-workflow)を参照してください。単純な一覧ではないページは、コンポーネント例の対応するページテンプレートに倣って作ります（[コンポーネント例](/ja/guide/components#from-a-pattern)を参照）。

## 6. castor-kit の新しいリリースを取り込む

```bash
git fetch upstream --tags
git merge v0.4.0
```

先にそのリリースの CHANGELOG を読んでください。コンフリクトはふつう `seed-rbac.ts` のように双方が拡張するファイルで起き（両方のメニューを残します）、通常どおり解決できます。

**前回のマージ以降に自分のマイグレーションを追加している場合は、マイグレーションに一手間かかります。**双方に同じ番号のマイグレーションがあるため、`apps/api/drizzle/meta/_journal.json` とスナップショットがコンフリクトします。自分のマイグレーション履歴を残し、リリースのスキーマ変更を自分の新しいマイグレーション 1 つにまとめます。

```bash
# 1. リリースが追加したマイグレーション（手順 4 で使います）
git diff --name-only --diff-filter=A HEAD MERGE_HEAD -- 'apps/api/drizzle/*.sql'
# 2. apps/api/drizzle を自分の版に戻す（リリースのマイグレーションファイルは外れます）
git restore --source=HEAD --staged --worktree apps/api/drizzle
# 3. リリースのスキーマ変更からマイグレーションを 1 つ生成（スキーマのコードはすでにマージ済み）
pnpm db:generate --name upstream_v0_4_0
```

4. 手順 1 のマイグレーションを 1 つずつ開き（`git show MERGE_HEAD:apps/api/drizzle/<file>.sql`）、テーブル / 列の変更ではない文（`INSERT`、`UPDATE`、`DELETE` など）を新しいマイグレーションの末尾にコピーします。各文の前に `--> statement-breakpoint` の行を入れます。
5. マージをコミットし、`pnpm db:migrate` と `pnpm verify` を実行します。

前回のマージ以降に自分のマイグレーションを追加していなければ、リリースのマイグレーションはそのままきれいにマージされ、`pnpm db:migrate` でそのまま適用できます。
