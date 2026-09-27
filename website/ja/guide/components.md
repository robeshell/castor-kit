# コンポーネント例

ログイン後、「コンポーネント例」メニューの下には 36 個のサンプルページがあり、「ページテンプレート」「コンポーネント」「データ可視化」「AI アプリ」「エディター / ローコード」「開発ツール」の 6 つのグループに分かれています。コンポーネント例は、開発者と AI エージェントがそのまま手本にするためのものです。どのページもプロジェクトのフロントエンド規約に厳密に従っています。ページパターンごとに参考実装となるページが 1 つずつあり、共通コンポーネントのグループごとに使い方を示すページが 1 つずつあります。カード一覧やカンバンを作るときは対応するページテンプレートから始め、`DataTable` やアップロードのフィールドを使うときは[コンポーネント](#components)で調べてください。

ページのソースは `apps/web/src/modules/component_center/pages/<グループのディレクトリ>/<ページ>/index.tsx` にあり、各ページ冒頭のドキュメントコメントに、そのパターンを使う場面と手本にすべき書き方がまとめてあります。バックエンド API を持つサンプルは `apps/api/src/modules/component-center/` 配下のモジュールに対応しています。

## ページテンプレート

グループのディレクトリは `patterns/` です。10 個のページはすべて、1 つの共有 API を通じて同じデモデータを操作します（[後述](#shared-demo-api)）。

| パターン | ルート | 内容 | 参考ディレクトリ |
|---|---|---|---|
| 標準リスト | `/component-center/patterns/standard-list` | 一般的な CRUD リソース：カテゴリ / 状態 / 有効のフィルター、ページングと行選択付きのテーブル、追加 / 編集ダイアログ、削除、インポート / エクスポート（選択した行またはすべて）。`pnpm scaffold` の生成結果にフィルターを加えたもので、構成はユーザー管理ページと同じ | `patterns/demo_record_page` |
| カード一覧 | `/component-center/patterns/card-list` | 標準リストのテーブルをレスポンシブなカードのグリッドに置き換えたもの：カバー画像（ファイルセンターにアップロード。ない場合はプレースホルダー）、カテゴリ / 状態のバッジ、タグ、担当者。読み込み中はスケルトンのカード、データがないときは空の状態を表示 | `patterns/card_list_page` |
| ツリー一覧 | `/component-center/patterns/tree-list` | `parent_id` で入れ子になったレコード：左にツリー全体（サーバー側で検索し、一致した項目の上位を残す）、右に選択したレコードの子をパンくず付きのテーブルで表示。兄弟間での上下移動、自身の子孫を除外する親の選択 | `patterns/tree_list_page` |
| 集計一覧 | `/component-center/patterns/stats-list` | テーブルの上に指標カード（件数、金額、数量、完了率）、カテゴリのドーナツグラフ、状態の積み上げバー。集計とテーブルは同じフィルターを使い、書き込みのたびに両方を再読み込み | `patterns/stats_list_page` |
| 詳細ページ | `/component-center/patterns/detail` | 1 件のレコードの詳細：左でレコードを選び、右に主要な情報と編集 / 削除を載せたヘッダー、その下にタブ（概要、子レコード、タグと拡張フィールド）。表示中のレコードは URL（`?id=`）に入る | `patterns/detail_page` |
| ステップフォーム | `/component-center/patterns/step-form` | ページ全体を使った新規作成ウィザード：全ステップで 1 つのフォームを共有し、「次へ」で現在のステップを検証、最後に確認ステップ（各ステップに戻って修正可能）、送信後に完了状態を表示 | `patterns/step_form_page` |
| 動的フォーム | `/component-center/patterns/dynamic-form` | 固定のフィールドに加え、ユーザーが追加・削除できる拡張フィールド（テキスト / 数値 / 真偽値 / 日付）。レコードの jsonb フィールド `extra` に保存 | `patterns/dynamic_form_page` |
| カンバン | `/component-center/patterns/kanban` | 列は状態の値（未着手 / 進行中 / 完了 / アーカイブ済み）。カードは列内でも列をまたいでもドラッグでき（dnd-kit）、楽観的に更新して並べ替えのリクエストを 1 回だけ送り、失敗したら元に戻す。「アーカイブ済み」の列は細いレールに折りたたまれる | `patterns/kanban_page` |
| ガントチャート | `/component-center/patterns/gantt` | 作業分解の順（`parent_id` の階層、折りたたみ可能）でレコードをタイムラインに配置：日 / 週の目盛り、週末の網掛け、今日の線。親は集約バー、末端は進捗バーで表示し、バーをクリックすると編集 | `patterns/gantt_page` |
| 高度なテーブル | `/component-center/patterns/advanced-table` | テーブル上で直接作業するためのもの：サーバー側の並べ替え、行内編集（元に戻せる）、選択した行の一括更新（状態 / 担当者 / 有効）と一括削除、列の表示設定 | `patterns/advanced_table_page` |

各ページで共有する選択肢（カテゴリと状態の名前、バッジの色調）は `patterns/demo-record-options.ts` にあります。個々の共通コンポーネントの使い方は[コンポーネント](#components)を参照してください。

### 共有のデモ API {#shared-demo-api}

10 個のページテンプレートはそれぞれ専用のバックエンドを持たず、1 つのモジュール `apps/api/src/modules/component-center/demo-record` と 1 つのテーブル `demo_records` を共有します。API のプレフィックスは `/api/admin/component-center/demo-records` です。

| エンドポイント | 使うページ |
|---|---|
| `GET /demo-records`（フィルター、ページング、並べ替え）、`GET /demo-records/{id}` | すべてのページ |
| `POST` / `PUT /{id}` / `DELETE /{id}` | 追加、編集、削除（子のあるレコードは削除できません） |
| `GET /demo-records/tree` | ツリー一覧、親の選択 |
| `GET /demo-records/stats` | 集計一覧：合計と、状態別・カテゴリ別の件数。フィルターは一覧と同じ |
| `POST /demo-records/batch-update`、`POST /demo-records/batch-delete` | 高度なテーブル |
| `PUT /demo-records/reorder` | ツリー一覧（`sort_order`）、カンバン（`board_order` と `status`） |
| `POST /demo-records/export`、`GET /demo-records/template`、`POST /demo-records/import` | 標準リスト |

共通のフィールド（`name`、`code`、`category`、`status`、`owner`、`priority`、`is_active`、`description`）のほかに、パターンごとにいくつかのフィールドを使います：`parent_id` + `sort_order`（ツリー）、`board_order`（カンバンのカードの順序。ツリーの順序とは別）、`amount` + `quantity`（集計）、`start_date` / `end_date` / `progress`（ガントチャート）、`cover` + `tags`（カード）、`extra`（動的フォーム）。`status` の値は `todo` / `in_progress` / `done` / `archived`、`category` の値は `product` / `design` / `engineering` / `marketing` / `operations` です。

権限は個々のページではなく「ページテンプレート」のディレクトリ（メニューコード `cc_patterns`）に属します。ディレクトリのボタン `cc_patterns_add` / `_edit` / `_delete` / `_export` / `_import` が書き込みを制御し、読み取りはディレクトリまたはその配下のいずれかのページの権限があれば許可されます（モジュールの `schema.ts` にある `DEMO_RECORD_VIEW_CODES`）。[権限（RBAC）](/ja/guide/rbac#permission-codes)を参照してください。[デモモード](/ja/reference/configuration#public-demo)でもコンポーネント例には書き込めます。デモのレコードは `apps/api/src/demo/fixtures.ts` から定期的に復元されます。

## コンポーネント {#components}

グループのディレクトリは `components/` です。ページテンプレートがページ全体を示すのに対し、こちらのページは `apps/web/src/shared/components/` の共通コンポーネントそれぞれの使い方を示します。どのサンプルもページ上でそのまま動く実際のコードで、クリック 1 つで正確なソース（シンタックスハイライト付き、コピー可能）を表示でき、コンポーネントの主要なプロパティの表も付いています。共通コンポーネントを使う前に、まずここを確認してください。データはすべてモックで、割り当てるボタン権限もありません。これらのページは専用のバックエンドを持ちません（アップロードのページだけは実際のファイルセンターにファイルを保存します）。

| ページ | ルート | 扱うコンポーネント |
|---|---|---|
| データテーブル | `/component-center/components/data-table` | `DataTable`（列定義、カスタムセル、行選択と一括操作バー、ページング、読み込み中と空の状態）、`RowActions`、`ConfirmAction` |
| フォーム | `/component-center/components/forms` | `FormFields` の react-hook-form 用フィールド（`FormInput`、`FormSelect`、`FormDate`、`FormTreeSelect`、`FormFileUpload`、`FormCustom` など）と `FormGrid`。`FormDialog`、`FormSheet`、読み取り専用の `DetailSheet` / `DescriptionList` |
| フィルター | `/component-center/components/filters` | `FilterBar` と `SearchInput` / `FilterSelect`、`SegmentedTabs` |
| ピッカー | `/component-center/components/pickers` | 単独で使う（制御された `value` + `onChange`）`MultiSelect`、`TagInput`、`DatePicker` / `DateTimePicker`、`TreeSelect` |
| ツリー | `/component-center/components/trees` | `TreeView`（選択、展開、カスタム行、絞り込み）、`CheckableTree`（親子連動のチェック、フォーム内での利用） |
| アップロード | `/component-center/components/uploads` | `FileUpload`、`ImageUpload`、`AvatarUpload`、`FileIdUpload`。ファイルセンターにアップロード |
| インポート / エクスポート | `/component-center/components/import-export` | `ImportDialog`（成功と失敗した行）と `ExportDialog`。モックの処理関数につないである |
| フィードバック | `/component-center/components/feedback` | `StatusBadge`、`EmptyState`、`ConfirmAction`、`toast`（`@/lib/toast`）、`Skeleton` による読み込み中の表示 |
| データ表示 | `/component-center/components/data-display` | `StatCard`（`CountUp` / `Sparkline` 付き）、`Chart`（テーマの配色に従う ECharts）、`Panel`、`PageHeader`、`UserAvatar` |
| Markdown | `/component-center/components/markdown` | `MarkdownView` |
| 条件ビルダー | `/component-center/components/condition-builder` | `ConditionBuilder`：フィールド / 演算子 / 値からなる条件を AND / OR で組み合わせ、条件グループも追加できる。値はプレーンな JSON で、そのまま保存したり API に送ったりできる（サンプル：テーブルのデータの絞り込み、フォームでのクエリ保存、1 階層のみと読み取り専用） |

各ページは `components/<グループ>_page/` にあります。サンプルはそれぞれ `examples/` 配下の独立したファイルで、ページはこれを 2 回インポートします。1 回はライブプレビュー用のコンポーネントとして、もう 1 回は下に表示するソースを取得するために Vite の `?raw` 付きでインポートするので、プレビューとコードが食い違うことはありません。プロパティの表はページの `props.ts` にあります。レイアウト用の部品（`ShowcasePage`、`ShowcaseSection`、`Example`、`PropsTable`、`CodeBlock`）は `apps/web/src/modules/component_center/showcase/` にあります。ページやサンプルを追加するときは、[AGENTS.md](https://github.com/robeshell/castor-kit/blob/main/AGENTS.md) の「Component showcase pages」の節に従ってください。サンプルのファイルが 2 通りの方法でインポートされていないと、テストが失敗します。

## データ可視化

グループのディレクトリは `dataviz/` です。ECharts をベースにしており、グラフの色は `useChartColors()` によってテーマとアクセントカラーに追従します。

| ページ | ルート | 説明 |
|---|---|---|
| データダッシュボード | `/component-center/dashboard-page` | 複数のグラフとイベントストリームで構成された総合ダッシュボード |
| リアルタイム折れ線グラフ | `/component-center/dataviz/realtime-chart` | 絶えずスクロール更新されるセンサーの曲線（フロントエンドのみ） |
| カレンダーヒートマップ | `/component-center/dataviz/heatmap` | 年間のカレンダーヒートマップと、時間 × 曜日のヒートマップ（フロントエンドのみ） |
| トラフィック分析 | `/component-center/dataviz/traffic-flow` | 流入元 → ランディングページ → 結果の流れを示すサンキー図と、訪問から決済までのコンバージョンファネル |

## AI アプリ

グループのディレクトリは `ai/` です。「システム設定」の「AI」タブでモデルサービスを設定する必要があります。[設定](/ja/reference/configuration#ai-model)を参照してください。

| ページ | ルート | 説明 |
|---|---|---|
| AI チャット | `/component-center/ai/chat` | ストリーミングのチャット画面（Vercel AI SDK の `useChat` + AI Elements） |
| AI プロンプト工房 | `/component-center/ai/prompt` | プロンプトテンプレートのライブラリ。テンプレート変数を抽出してリアルタイムにプレビュー |
| AI データ検索 | `/component-center/ai/sql` | 自然言語から SQL を生成し、読み取り専用の接続で実行して結果とグラフを表示 |

::: tip AI データ検索のセキュリティ境界
クエリは独立した読み取り専用の接続で実行され、結果の行数には上限があり、権限やログなどの機密性の高いテーブルは除外されます。本番環境では、読み取り専用アカウントを指す `AI_SQL_DATABASE_URL` を必ず設定してください。[デプロイガイド](/ja/deploy/) を参照してください。
:::

## エディター / ローコード

グループのディレクトリは `editor/` です。

| ページ | ルート | 説明 |
|---|---|---|
| リッチテキストエディター | `/component-center/editor/rich-text` | react-quill-new をベースに構築 |
| コードエディター | `/component-center/editor/code` | Monaco をベースに構築。言語を切り替えられ、テーマはデフォルトでアプリに追従 |
| JSON エディター | `/component-center/editor/json` | JSON の編集とツリー形式のプレビュー |
| Markdown プレビュー | `/component-center/editor/markdown` | 左で編集し、右でリアルタイムにプレビュー |

## 開発ツール

グループのディレクトリは `devtools/` です。

| ページ | ルート | 説明 |
|---|---|---|
| ドラッグレイアウト | `/component-center/devtools/drag-layout` | ドラッグとリサイズが可能なグリッドレイアウト。レイアウトはブラウザのローカルに保存 |
| 仮想スクロール一覧 | `/component-center/devtools/virtual-scroll` | react-window で大量のデータ行を描画 |
| WebSocket 通信 | `/component-center/devtools/websocket` | バックエンドの `/ws/devtools` に接続し、メッセージの送受信とエコーを実演 |
| パフォーマンス監視 | `/component-center/devtools/perf-monitor` | `/ws/devtools` 経由でサーバーの CPU、メモリ、ディスク、ネットワークの指標を毎秒受信 |

::: info WebSocket とリバースプロキシ
WebSocket 通信とパフォーマンス監視のページは `/ws/devtools` に依存しています。リバースプロキシの背後にデプロイする場合は、`/ws` に対して WebSocket の転送を設定する必要があります。[デプロイガイド](/ja/deploy/#reverse-proxy-and-https) を参照してください。
:::

## システム管理

コンポーネント例のほかに、「システム管理」の下にはスキャフォールドに標準で付属する業務機能があり、「組織と権限」（ユーザー・ロール・部門）、「セキュリティと監査」（オンラインユーザー・ログ）、「システム構成」（システム設定・メニュー・辞書・定期タスク）、「コンテンツとメッセージ」（ファイル・通知・お知らせ）の 4 つのグループに分かれています。

| ページ | ルート | 説明 |
|---|---|---|
| ユーザー管理 | `/system/users` | ユーザーの追加・編集・削除、ロールの割り当て、有効化・無効化、インポート / エクスポート（標準的な一覧ページの参考実装） |
| ロール権限 | `/system/roles` | ロールの管理、メニュー / ボタンの権限付与とデータ範囲 |
| 部署管理 | `/system/departments` | 部署ツリー：配下の追加、編集、上下移動。ユーザーの所属とデータ権限の基礎 |
| ファイル管理 | `/system/files` | ファイルセンターのすべてのファイル：プレビュー、ダウンロード、使用状況の確認、未使用ファイルの削除 |
| オンラインユーザー | `/system/sessions` | ログイン中のセッションと強制ログアウト（[アカウントセキュリティとシステム設定](/ja/guide/security)を参照） |
| システム設定 | `/system/settings` | 2段階認証・パスワード再設定のスイッチ、パスワードのルール、セッション有効期間、レート制限 |
| メニュー管理 | `/system/menus` | メニューツリーの管理 |
| ログ管理 | `/system/logs` | 操作ログとログインログ |
| データ辞書 | `/system/dicts` | 辞書データを管理し、ドロップダウンの選択肢のデータソースを提供 |
| 定期タスク | `/system/scheduled-tasks` | cron に従って HTTP アドレスを定期的に呼び出し、実行履歴を確認 |
| 通知 | `/system/notifications` | サイト内通知 |
| お知らせ管理 | `/system/announcements` | お知らせの公開と管理 |

このほかに、ホーム（`/dashboard`）と個人設定ページ（`/profile`：アカウント情報と最終ログインの確認、ニックネーム / メール / 電話番号 / アバターとパスワードの変更）があります。
