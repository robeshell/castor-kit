<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/wordmark-dark.svg">
  <img src=".github/assets/wordmark-light.svg" alt="castor-kit" height="110">
</picture>

### すぐ使える管理画面。新機能は AI におまかせ。

ユーザー、ロール、権限、メニュー、ログなどの基本機能は実装済み。<br>
新しい画面は要件を伝えるだけで、AI がテーブル・API・画面を作り、動作まで自動でチェックします。

[![CI](https://github.com/robeshell/castor-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/robeshell/castor-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb)](LICENSE)
![Node ≥ 22](https://img.shields.io/badge/node-%E2%89%A5%2022-0284c7)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-2563eb)
![i18n](https://img.shields.io/badge/i18n-zh%20%C2%B7%20en%20%C2%B7%20ja-0284c7)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-22d3ee)](CONTRIBUTING.md)

[English](README.md) · [简体中文](README_CN.md) · **日本語**

[ドキュメント](website/ja/guide/index.md) · [クイックスタート](#クイックスタート) · [AI で機能を作る](#ai-で機能を作る) · [コントリビュート](CONTRIBUTING.md)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/screenshot-ja-dark.webp">
  <img src=".github/assets/screenshot-ja-light.webp" alt="castor-kit 管理画面" width="900">
</picture>

</div>

## castor-kit とは？

castor-kit はオープンソースの管理画面です。今日そのまま使えて、明日からは AI で機能を増やせます。

- **すぐに使える**：ログイン、ユーザー、ロール、ボタン単位の権限、メニュー、ログ、データ辞書、定期タスク、通知、お知らせを実装済み。洗練された UI で、ライト / ダークに対応。
- **AI で拡張する前提の設計**：開発ルールを AI コーディングツール（Claude Code、Cursor、Copilot、Codex CLI など）がそのまま従える形で記述。要件を一文で伝えれば、テーブル・API・画面・権限ができあがり、自動チェックを通って完成します。

## 機能

<table>
  <tr>
    <td width="33%"><b>権限管理</b><br>ユーザー、ロール、メニュー、ボタン単位まで。</td>
    <td width="33%"><b>AI 対応</b><br>一文からテーブル、API、画面、権限を生成。</td>
    <td width="33%"><b>自動チェック</b><br>型、マイグレーション、ルート、権限、テスト、ビルドの 15 項目。</td>
  </tr>
  <tr>
    <td><b>テーマとレイアウト</b><br>6 色のテーマ、3 種類のレイアウト、ライト / ダーク、タブバー。</td>
    <td><b>3 言語対応</b><br>画面もエラーメッセージも中・英・日で表示。</td>
    <td><b>インポート / エクスポート</b><br>すべての表で Excel と CSV に対応、行単位で検証。</td>
  </tr>
  <tr>
    <td><b>25 以上のサンプル画面</b><br>ダッシュボード、チャート、カンバン、3D、AI チャット、エディターなど。</td>
    <td><b>きれいな構成</b><br>明確なレイヤー、strict な TypeScript、レビューできる SQL マイグレーション。</td>
    <td><b>コマンド 1 つでデプロイ</b><br>Docker Compose でデータベースからアプリまで起動。</td>
  </tr>
</table>

## クイックスタート

**Docker を使う**（推奨、必要なのは Docker だけ）：

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh
```

セットアップウィザードで管理者パスワードとポート（既定は `5000`）を設定します。完了したら `http://localhost:5000` を開き、`admin` でサインインしてください。

<details>
<summary><b>ローカル開発</b>（Node.js 22 以上、pnpm、PostgreSQL 14 以上）</summary>

```bash
pnpm install
cp apps/api/.env.example apps/api/.env.development   # DEV_DATABASE_URL を設定
createdb castor_kit
pnpm db:migrate
pnpm seed:rbac
pnpm dev                                              # API :5001 · Web :5173
```

</details>

## AI で機能を作る

1. **AI に伝える**：「設備台帳を作って。名称、コード、状態、購入日、担当者。」
2. **プレビューを確認**：AI がフィールド型、テーブル、メニュー、権限を判断し、業務の言葉でまとめたプレビューを見せます。
3. **生成とチェック**：AI がスキャフォールド、マイグレーション、権限の同期を実行し、最後に納品チェックを走らせます。

```text
$ pnpm scaffold -- --name equipment --domain admin --fields "name:str,code:str50,status:str20,purchase_date:date,owner:str"
$ pnpm db:migrate
$ pnpm seed:rbac -- --incremental
$ pnpm verify -- --module equipment
✓ typescript_compile  ✓ migration_chain  ✓ router_registration  ✓ rbac_sync
✓ api_tests  ✓ frontend_tests  ✓ frontend_build
```

AI が従うルールは [`AGENTS.md`](AGENTS.md) にあります。詳しくは [AI 駆動開発](website/ja/guide/ai-workflow.md) を参照してください。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| **バックエンド** | Node.js 22 · TypeScript · Fastify 5 · Zod 4 · Drizzle ORM · PostgreSQL |
| **フロントエンド** | React 19 · Vite · React Router 7 · shadcn/ui · Tailwind CSS v4 · Motion · i18next |
| **データとチャート** | TanStack Table · react-hook-form · ECharts 6 · Three.js |
| **ツール** | pnpm workspaces · Vitest · ESLint · MCP サーバー · Docker Compose |

<details>
<summary><b>ディレクトリ構成</b></summary>

```text
apps/
  api/        Fastify API：db/schema → modules/<domain>/<name>/{schema,repository,service,routes}.ts
  web/        React アプリ：modules/<module>/pages/**、共通コンポーネント、翻訳ファイル
  mcp/        scaffold / verify / seed / マイグレーションを提供する MCP サーバー
docs/         アーキテクチャ資料とスキャフォールドのテンプレート
website/      ドキュメントとランディングサイト（VitePress）
AGENTS.md     人と AI ツールが共有する開発ルール
```

</details>

## ドキュメント

| カテゴリ | ページ |
|---|---|
| はじめに | [概要](website/ja/guide/index.md) · [クイックスタート](website/ja/guide/getting-started.md) · [プロジェクト構成](website/ja/guide/project-structure.md) |
| 開発 | [AI 駆動開発](website/ja/guide/ai-workflow.md) · [バックエンド](website/ja/guide/backend.md) · [フロントエンド](website/ja/guide/frontend.md) |
| トピック | [権限](website/ja/guide/rbac.md) · [多言語対応](website/ja/guide/i18n.md) · [テーマとレイアウト](website/ja/guide/appearance.md) |
| リファレンス | [コマンド一覧](website/ja/reference/commands.md) · [設定](website/ja/reference/configuration.md) · [デプロイ](website/ja/deploy/index.md) |

ドキュメントサイトをローカルで見るには：`npm --prefix website install && npm --prefix website run dev`。

## コントリビュート

Issue と Pull Request を歓迎します。まず[コントリビューションガイド](CONTRIBUTING.md)と[行動規範](CODE_OF_CONDUCT.md)をお読みください。セキュリティ上の問題は [SECURITY.md](SECURITY.md) の手順で非公開に報告してください。主な変更は[変更履歴](CHANGELOG.md)に記録しています。

## ライセンス

[MIT](LICENSE) © castor-kit contributors

<div align="center">
<br>
<sub><i>Castor</i> はビーバーのラテン名。ビーバーは自然界のエンジニアで、丸太を一本ずつ積み上げてダムを築きます。</sub>
</div>
