# プロジェクト構成

Castor は pnpm monorepo です。`pnpm` コマンドはすべてリポジトリのルートで実行し、ルートの `package.json` のスクリプトが対応するサブパッケージに処理を転送します。

## トップレベルのディレクトリ

```text
castorjs/
├── package.json              # ワークスペースのルートスクリプト（dev / verify / scaffold / db:* ...）
├── pnpm-workspace.yaml
├── apps/
│   ├── api/                  # @castorjs/api：Fastify バックエンド
│   ├── web/                  # @castorjs/web：React フロントエンド
│   └── mcp/                  # @castorjs/mcp：MCP Server
├── docs/
│   ├── architecture.md       # アーキテクチャの説明と設計上の決定
│   ├── frontend-design-system.md  # フロントエンドの UI 体系（shadcn/ui）
│   ├── apifox-full.openapi.json   # OpenAPI ドキュメント
│   ├── spec.schema.json      # モジュール spec（scaffold --spec）の JSON Schema
│   ├── examples/specs/       # 「要件 → spec」の例
│   ├── roadmap.md            # 予定している機能（実装する前に該当する節を読む）
│   └── templates/            # コード骨格のテンプレート（backend/、frontend/）
├── website/                  # このドキュメントサイト（VitePress。独立した npm プロジェクトで、pnpm ワークスペースには含まれない）
├── AGENTS.md                 # すべての AI ツールが共有するプロジェクトコンテキスト
├── CLAUDE.md                 # Claude Code 用の補足
├── .claude/ .agents/ .github/   # AI スキル（.agents は .claude/skills のミラー）。.github には CI、ドキュメントサイトの公開、issue テンプレート
├── scripts/                  # setup.sh（Docker のワンステップセットアップ）、docker-entrypoint.sh（イメージのエントリーポイント）
└── Dockerfile / docker-compose.yml / render.yaml
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
│   ├── common/               # 横断的な機能（主なファイルのみ）
│   │   ├── auth.ts           # loginRequired / hasMenuPermission / hasAnyMenuPermission / menuPermissionRequired
│   │   ├── rbac.ts           # 権限判定の純粋関数
│   │   ├── csrf.ts           # CSRF のダブルサブミット検証
│   │   ├── errors.ts         # ServiceError と共通のエラー処理
│   │   ├── db-errors.ts      # データベースの制約エラー → 400 の業務エラー
│   │   ├── http.ts           # intParam / parseIntParam / notFound / queryString / getUploadedFile
│   │   ├── validation.ts     # field.* / routeBody：リクエストボディの宣言（Zod）
│   │   ├── pagination.ts     # parsePagination（デフォルト 20、上限 200）
│   │   ├── serialize.ts      # toIso() などの日時出力ユーティリティ
│   │   ├── time-zone.ts      # X-Time-Zone リクエストヘッダー、withZoneOffset()
│   │   ├── data-scope.ts     # 行レベルのデータ権限（resolveDataScope / dataScopeWhere）
│   │   ├── api-token.ts      # Bearer の API トークン認証
│   │   ├── tabular.ts        # csv / xlsx の読み書き
│   │   ├── i18n.ts           # Accept-Language に応じてレスポンスの文言を翻訳
│   │   ├── storage/          # ファイルストレージのドライバー（local / s3）
│   │   └── scheduler/        # 定期タスクの runner、cron マッチャー、SSRF 対策
│   ├── i18n/messages.ts      # バックエンドのエラーメッセージの英語 / 日本語訳
│   ├── demo/                 # 公開デモ（DEMO_MODE）のデータとリセット
│   ├── db/
│   │   ├── client.ts         # pg コネクションプール + Drizzle インスタンス
│   │   ├── readonly.ts       # AI データ検索専用の読み取り専用コネクションプール
│   │   ├── migrate.ts        # マイグレーション実行器
│   │   ├── migrate-cli.ts    # pnpm db:migrate のエントリーポイント
│   │   └── schema/           # model 層：Drizzle のテーブル定義。ドメインごとにディレクトリを分け、index.ts でまとめてエクスポート。
│   │                         #   columns.ts に共通の createdAt() / updatedAt() 列
│   └── modules/
│       ├── admin/            # システム管理ドメイン：auth / users / roles / departments / menu / logs / dicts /
│       │                     #   files / settings / sessions / two-factor / password-reset / api-tokens /
│       │                     #   webhooks / scheduled-task / notification / announcement / dashboard / assistant
│       └── component-center/ # コンポーネント例ドメイン：demo-record / ai-chat / ai-prompt / ai-sql /
│                             #   devtools / traffic-flow
├── drizzle/                  # SQL マイグレーションファイル + meta/_journal.json（drizzle-kit が生成）
├── scripts/                  # ツールチェーン：scaffold / verify-feature / seed-rbac / seed-demo / setup-once /
│                             #   init-ro-role / generate-openapi / import-apifox / demo-reset。lib/ は共通コード
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
│   ├── i18n-scan.mjs         # 未翻訳の文言をスキャン
│   └── api-types.mjs         # OpenAPI ドキュメントから src/shared/api/openapi.d.ts を生成
├── test/                     # Vitest（i18n、外観、タブバー、共通コンポーネントなど）
└── src/
    ├── App.tsx               # 動的ルーティング（lib/page-modules.ts でメニューに対応するページを探す）
    ├── index.css             # Tailwind v4 のエントリー + デザイントークン（ライト / ダーク / アクセントカラー）
    ├── i18n/index.ts         # i18next の初期化
    ├── locales/              # 共通文言の翻訳。menus/ はメニュー名の翻訳
    ├── context/              # AuthContext / ThemeContext / TagsViewContext
    ├── components/
    │   ├── ui/               # shadcn/ui のアトミックコンポーネント（ソースはリポジトリ内）
    │   ├── ai-elements/      # AI チャットの部品（会話、メッセージ、入力欄など）
    │   └── app/              # アプリケーションシェル：AppLayout / AppSidebar / TopBar / TopNav / TagsView /
    │                         #   AppearanceMenu / CommandMenu / LanguageSwitcher / ...
    ├── lib/                  # page-modules（import.meta.glob でページを検索）/ cn / toast / format / motion /
    │                         #   chart-theme / menu-icons / appearance / ...
    ├── modules/
    │   ├── auth/pages/{login,reset_password}/  # ログインページとパスワード再設定ページ
    │   ├── admin/{pages,api,components}/       # システム管理のページ、API、ページ用コンポーネント
    │   └── component_center/
    │       ├── pages/{patterns,components,dataviz,ai,editor,devtools}/
    │       ├── showcase/     # components/ の各ページのレイアウト部品（ShowcasePage / Example / PropsTable）
    │       └── api/
    └── shared/
        ├── api/request.ts    # Axios インスタンス（baseURL '/api'。CSRF ヘッダー、Accept-Language、X-Time-Zone を自動付与）
        ├── api/openapi.d.ts  # OpenAPI ドキュメントから生成した API の型
        ├── hooks/            # useCrudList / useDebouncedValue / useIsMobile / useDictOptions / useAppInfo
        ├── utils/file.ts     # downloadBlobFile
        └── components/       # 業務向け共通コンポーネント：PageHeader / DataTable / FormDialog / ...
```

メニューの `component` の値 `<module>/<page_path>` は、ファイル `modules/<module>/pages/<page_path>/index.tsx` に対応します（例：`admin/users` → `modules/admin/pages/users/index.tsx`、`component_center/patterns/kanban_page` → `modules/component_center/pages/patterns/kanban_page/index.tsx`）。それ以外の場所に置いたページは動的ルーティングが見つけられません。詳しくは [フロントエンド](/ja/guide/frontend) を参照してください。

## MCP Server apps/mcp

`apps/mcp/src/index.ts` はツールチェーンを MCP ツールとしてラップし、Claude Desktop などの MCP クライアントから呼び出せるようにします。詳しくは [AI 駆動開発](/ja/guide/ai-workflow#mcp-server) を参照してください。

## 命名規則

| 対象 | ルール | 例 |
|---|---|---|
| プロジェクト名とパッケージ名 | 小文字のハイフン区切り | `castorjs`、`@castorjs/api` |
| バックエンドのディレクトリ名とファイル名 | 小文字のハイフン区切り | `component-center`、`scheduled-task` |
| データベースのテーブル名 | アンダースコア区切り | `scheduled_tasks` |
| フロントエンドのディレクトリ、メニューの `component` フィールド | アンダースコア区切り | `component_center/patterns/card_list_page` |
| API パス | ハイフン区切り、複数形 | `/api/admin/customer-orders` |

セッション cookie 名 `castor_session` は例外で、アンダースコアを使います。
