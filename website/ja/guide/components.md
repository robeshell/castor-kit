# コンポーネント例

ログイン後、「コンポーネント例」メニューの下には 28 個のサンプルページがあり、6 つのグループに分かれています。いずれもプロジェクトのフロントエンド規約に従っているので、新しいページの参考や出発点としてそのまま使えます。

ページのソースは `apps/web/src/modules/component_center/pages/<グループのディレクトリ>/<ページ>/index.jsx` にあり、バックエンド API を持つサンプルは `apps/api/src/modules/component-center/` 配下のモジュールに対応しています。

## 管理画面

グループのディレクトリは `admin/` で、すべてバックエンド API とテーブルを備えています。

| ページ | ルート | 説明 |
|---|---|---|
| 一覧ページ | `/component-center/list-page` | 最も機能の揃った CRUD 一覧：フィルター、ページング、追加・編集・削除、インポート / エクスポート、画像とファイルのアップロード |
| 統計付き一覧 | `/component-center/stats-list-page` | 一覧の上に指標カードとカテゴリ分布・公開状態のグラフを配置し、新規作成にはステップ形式のフォームを使用 |
| カード一覧 | `/component-center/card-list-page` | レコードをカードのグリッドで表示し、追加・編集・削除に対応 |
| ツリー一覧 | `/component-center/tree-list-page` | 左にツリー、右に詳細。親ノードの変更に対応し、循環チェック付き |
| 動的フォーム | `/component-center/dynamic-form-page` | 基本情報に加え、行を増減できる動的フィールドのサブテーブル |
| カンバンボード | `/component-center/admin/kanban` | カンバンの列とカードのドラッグによる並べ替え。WIP 制限に対応 |
| 詳細タブ | `/component-center/admin/detail-tabs` | 左にメンバー一覧、右にタブ分けした詳細を表示 |
| ガントチャート | `/component-center/admin/gantt` | プロジェクトタスクのガントチャートによるスケジュール |
| 高度なテーブル | `/component-center/admin/advanced-table` | インライン編集、列の設定、ドラッグによる並べ替え、一括操作、操作列の固定 |

## データ可視化

グループのディレクトリは `dataviz/` です。ECharts をベースにしており、グラフの色は `useChartColors()` によってテーマとアクセントカラーに追従します。

| ページ | ルート | 説明 |
|---|---|---|
| データダッシュボード | `/component-center/dashboard-page` | 複数のグラフとイベントストリームで構成された総合ダッシュボード |
| リアルタイム折れ線グラフ | `/component-center/dataviz/realtime-chart` | 絶えずスクロール更新されるセンサーの曲線（フロントエンドのみ） |
| カレンダーヒートマップ | `/component-center/dataviz/heatmap` | 年間のカレンダーヒートマップと、時間 × 曜日のヒートマップ（フロントエンドのみ） |
| 地図ヒートマップ | `/component-center/dataviz/map-heatmap` | 中国地図の省別ヒートマップと Top 10 ランキング。地図データはリポジトリに同梱 |

## 3D / クリエイティブ

グループのディレクトリは `creative/` で、フロントエンドのみのページです。

| ページ | ルート | 説明 |
|---|---|---|
| パーティクルネットワーク | `/component-center/creative/particle` | Canvas によるパーティクルを線で結ぶエフェクト。デフォルトの配色は現在のアクセントカラーから取得 |
| CSS 3D カード | `/component-center/creative/css-3d` | ホバーで反転、回転する立方体、視差追従など、CSS だけで作る 3D エフェクト |
| Three.js 地球儀 | `/component-center/creative/globe` | Three.js で描画する 3D の地球儀。シーンの配色はアクセントカラーに追従 |
| パーティクルモーフィング | `/component-center/creative/morphing` | WebGL のパーティクルが複数の形状の間で変化 |

## AI アプリ

グループのディレクトリは `ai/` です。OpenAI 互換 API の設定（`AI_API_BASE`、`AI_API_KEY`、`AI_MODEL`）が必要です。[設定](/ja/reference/configuration) を参照してください。

| ページ | ルート | 説明 |
|---|---|---|
| AI チャット | `/component-center/ai/chat` | ストリーミング（SSE）のチャット画面 |
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

コンポーネント例のほかに、「システム管理」の下にはスキャフォールドに標準で付属する業務機能があります。

| ページ | ルート | 説明 |
|---|---|---|
| ユーザー管理 | `/system/users` | ユーザーの追加・編集・削除、ロールの割り当て、有効化・無効化、インポート / エクスポート（標準的な一覧ページの参考実装） |
| ロール権限 | `/system/roles` | ロールの管理、メニュー / ボタンの権限付与とデータ範囲 |
| 部署管理 | `/system/departments` | 部署ツリー：配下の追加、編集、上下移動。ユーザーの所属とデータ権限の基礎 |
| メニュー管理 | `/system/menus` | メニューツリーの管理 |
| ログ管理 | `/system/logs` | 操作ログとログインログ |
| データ辞書 | `/system/dicts` | 辞書データを管理し、ドロップダウンの選択肢のデータソースを提供 |
| 定期タスク | `/system/scheduled-tasks` | cron に従って HTTP アドレスを定期的に呼び出し、実行履歴を確認 |
| 通知 | `/system/notifications` | サイト内通知 |
| お知らせ管理 | `/system/announcements` | お知らせの公開と管理 |

このほかに、ホーム（`/dashboard`）と個人設定ページ（`/profile`：アカウント情報と最終ログインの確認、ニックネーム / メール / 電話番号 / アバターとパスワードの変更）があります。
