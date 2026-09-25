# プロジェクト構成

castor-kit は pnpm monorepo です。`pnpm` コマンドはすべてリポジトリのルートで実行し、ルートの `package.json` のスクリプトが対応するサブパッケージに処理を転送します。

## トップレベルのディレクトリ

```text
castor-kit/
├── package.json              # ワークスペースのルートスクリプト（dev / verify / scaffold / db:* ...）
├── pnpm-workspace.yaml
├── apps/
│   ├── api/                  # @castor-kit/api：Fastify バックエンド
│   ├── web/                  # @castor-kit/web：React フロントエンド
│   └── mcp/                  # @castor-kit/mcp：MCP Server
├── docs/
│   ├── architecture.md       # アーキテクチャの説明と設計上の決定
│   ├── frontend-redesign-plan.md  # フロントエンドの UI 体系（shadcn/ui）
│   ├── apifox-full.openapi.json   # OpenAPI ドキュメント
│   └── templates/            # コード骨格のテンプレート（backend/、frontend/）
├── website/                  # このドキュメントサイト（VitePress。独立した npm プロジェクトで、pnpm ワークスペースには含まれない）
├── AGENTS.md                 # すべての AI ツールが共有するプロジェクトコンテキスト
├── CLAUDE.md / CODEX.md / llms.txt / .windsurfrules
├── .claude/ .agents/ .cursor/ .github/   # 各 AI ツールの設定とスキル。.github には CI も含む
├── Dockerfile / docker-compose.yml / docker-entrypoint.sh
└── setup.sh                  # Docker のワンステップセットアップウィザード
```

AI 関連ファイルの用途は [AI 駆動開発](/ja/guide/ai-workflow#対応している-ai-ツール) を参照してください。

## バックエンド apps/api

```text
apps/api/
├── src/
│   ├── main.ts               # web プロセスのエントリーポイント
│   ├── worker.ts             # 独立した定期タスクスケジューラープロセスのエントリーポイント
│   ├── app.ts                # buildApp()：プラグイン、ルート、エラー処理、静的アセット、SPA フォールバック
│   ├── config.ts             # 環境ごとの設定（Zod で検証。本番環境で重要な変数が欠けていると起動を拒否）
│   ├── router.ts             # 第 1 階層のルート組み立て。新しい業務ドメインはここで登録
│   ├── common/               # 横断的な機能
│   │   ├── auth.ts           # loginRequired / hasMenuPermission / hasAnyMenuPermission / menuPermissionRequired
│   │   ├── rbac.ts           # 権限判定の純粋関数
│   │   ├── csrf.ts           # CSRF のダブルサブミット検証
│   │   ├── errors.ts         # ServiceError と共通のエラー処理
│   │   ├── db-errors.ts      # データベースの制約エラー → 400 の業務エラー
│   │   ├── http.ts           # intParam / parseIntParam / jsonBody / queryString / getUploadedFile
│   │   ├── pagination.ts     # parsePagination（デフォルト 20、上限 200）
│   │   ├── serialize.ts      # toIso() などの日時出力ユーティリティ
│   │   ├── tabular.ts        # csv / xlsx の読み書き
│   │   ├── i18n.ts           # Accept-Language に応じてレスポンスの文言を翻訳
│   │   └── scheduler/        # 定期タスクの runner、cron マッチャー、SSRF 対策
│   ├── i18n/messages.ts      # バックエンドのエラーメッセージの英語 / 日本語訳
│   ├── db/
│   │   ├── client.ts         # pg コネクションプール + Drizzle インスタンス
│   │   ├── readonly.ts       # AI データ検索専用の読み取り専用コネクションプール
│   │   ├── migrate.ts        # マイグレーション実行器
│   │   ├── migrate-cli.ts    # pnpm db:migrate のエントリーポイント
│   │   └── schema/           # model 層：Drizzle のテーブル定義。ドメインごとにディレクトリを分け、index.ts でまとめてエクスポート
│   └── modules/
│       ├── admin/            # システム管理ドメイン：auth / users / roles / menu / logs / dicts /
│       │                     #   scheduled-task / notification / announcement / dashboard
│       └── component-center/ # コンポーネント例ドメイン
├── drizzle/                  # SQL マイグレーションファイル + meta/_journal.json（drizzle-kit が生成）
├── scripts/                  # ツールチェーン：scaffold / verify-feature / seed-rbac / setup-once /
│                             #   init-ro-role / generate-openapi / import-apifox
├── test/                     # Vitest。実際の PostgreSQL に接続
└── drizzle.config.ts
```

各機能モジュールは、1 つのテーブル定義ファイルと 1 つのモジュールディレクトリで構成されます。

```text
src/db/schema/<domain>/<name>.ts                 # テーブル定義 + toDict によるシリアライズ
src/modules/<domain>/<name>/schema.ts            # Zod のリクエストスキーマ、インポート / エクスポートのフィールドマッピング
src/modules/<domain>/<name>/repository.ts        # データベースの読み書き
src/modules/<domain>/<name>/service.ts           # ビジネスロジック
src/modules/<domain>/<name>/routes.ts            # ルートと権限チェック
```

テーブル定義を `db/schema/` にまとめているのは、drizzle-kit が単一のスキーマのエントリーポイントを必要とするためです。残りの 4 層は機能ごとに近くに配置しているので、新機能を追加するときは 1 つのディレクトリにファイルを作るだけで済みます。レイヤールールは [バックエンド](/ja/guide/backend) を参照してください。

## フロントエンド apps/web

```text
apps/web/
├── components.json           # shadcn CLI の設定
├── scripts/
│   ├── shadcn-add.sh         # ローカルの中継経由で npx shadcn@latest add を実行
│   └── i18n-scan.mjs         # 未翻訳の文言をスキャン
├── test/                     # Vitest（i18n、外観、タブバー、共通コンポーネントなど）
└── src/
    ├── App.jsx               # 動的ルーティング（import.meta.glob でページをスキャン）
    ├── index.css             # Tailwind v4 のエントリー + デザイントークン（ライト / ダーク / アクセントカラー）
    ├── i18n/index.js         # i18next の初期化
    ├── locales/              # 共通文言の翻訳。menus/ はメニュー名の翻訳
    ├── context/              # AuthContext / ThemeContext / TagsViewContext
    ├── components/
    │   ├── ui/               # shadcn/ui のアトミックコンポーネント（ソースはリポジトリ内）
    │   └── app/              # アプリケーションシェル：AppLayout / AppSidebar / TopBar / TopNav / TagsView /
    │                         #   AppearanceMenu / CommandMenu / LanguageSwitcher / ...
    ├── lib/                  # cn / toast / format / motion / chart-theme / menu-icons / appearance
    ├── modules/
    │   ├── auth/pages/login/         # ログインページ
    │   ├── admin/{pages,api}/        # システム管理のページと API
    │   └── component_center/
    │       ├── pages/{admin,dataviz,creative,ai,editor,devtools}/
    │       └── api/
    └── shared/
        ├── api/request.js    # Axios インスタンス（baseURL '/api'。CSRF ヘッダーと Accept-Language を自動付与）
        ├── hooks/            # useCrudList / useDebouncedValue / useIsMobile
        ├── utils/file.js     # downloadBlobFile
        └── components/       # 業務向け共通コンポーネント：PageHeader / DataTable / FormDialog / ...
```

ページファイルは必ず `modules/<module>/pages/<subdir>/<page>/index.jsx` に置いてください。そうしないと動的ルーティングがページを見つけられません。詳しくは [フロントエンド](/ja/guide/frontend) を参照してください。

## MCP Server apps/mcp

`apps/mcp/src/index.ts` はツールチェーンを MCP ツールとしてラップし、Claude Desktop などの MCP クライアントから呼び出せるようにします。詳しくは [AI 駆動開発](/ja/guide/ai-workflow#mcp-server) を参照してください。

## 命名規則

| 対象 | ルール | 例 |
|---|---|---|
| プロジェクト名とパッケージ名 | 小文字のハイフン区切り | `castor-kit`、`@castor-kit/api` |
| バックエンドのディレクトリ名とファイル名 | 小文字のハイフン区切り | `component-center`、`scheduled-task` |
| データベースのテーブル名 | アンダースコア区切り | `scheduled_tasks` |
| フロントエンドのディレクトリ、メニューの `component` フィールド | アンダースコア区切り | `component_center/admin/list_page` |
| API パス | ハイフン区切り、複数形 | `/api/admin/customer-orders` |

セッション cookie 名 `castor_session` は例外で、アンダースコアを使います。
