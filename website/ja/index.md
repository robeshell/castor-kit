---
layout: home

hero:
  name: "castor-kit"
  text: "AI-First フルスタックスキャフォールド"
  tagline: Node.js + TypeScript（Fastify · Drizzle）+ React 19 + shadcn/ui + PostgreSQL。自然言語で要件を記述するだけで、AI が機能をエンドツーエンドで実装します。
  actions:
    - theme: brand
      text: はじめる
      link: /ja/guide/getting-started
    - theme: alt
      text: GitHub で見る
      link: https://github.com/robeshell/castor-kit

features:
  - icon: 🤖
    title: AI-First ワークフロー
    details: 要件を書いて、コーヒーを飲んで、戻ったら完成。Claude Code、Cursor、Copilot、Windsurf、Codex CLI、MCP クライアントを事前設定済み。テーブル定義からフロントエンドページまで AI が全て担当、あなたは確認するだけ。

  - icon: 🔐
    title: 完全な RBAC、設定ゼロ
    details: 権限は後付けではなく、最初から組み込まれています。ユーザー・ロール・メニュー・ボタンの4層制御。新機能は自動的に権限体系を継承。何も漏れません。

  - icon: 🧩
    title: 30+ 実用コンポーネント
    details: ドラッグ＆ドロップカンバン、Three.js 地球、リアルタイムチャート、AI チャットなど。全コンポーネントが本番対応ページ——モジュールをコピーしてフィールドを変えるだけで完成。

  - icon: 🚀
    title: 機能デリバリーは分単位
    details: 自然言語一文で、テーブル定義・API・フロントエンド・RBAC エントリ・DB マイグレーションが揃った完全な機能が出来上がる。pnpm scaffold がスケルトンを生成し、pnpm verify が品質ゲートを担当。スニペットではなく、即デプロイできる本物の機能。

  - icon: 🏗️
    title: 初日から本番グレードのアーキテクチャ
    details: db/schema → schema → repository → service → routes の明確な層構成を常に徹底。TypeScript strict + Zod バリデーション、レビュー可能な Drizzle SQL マイグレーション、ルートの自動検出。1000個目の機能も1個目と同じくらい綺麗。

  - icon: 🐳
    title: コマンド一つ、フルスタック起動
    details: bash setup.sh —— それだけ。PostgreSQL、Node サーバー、React フロントエンド、DB マイグレーション、RBAC シードデータ——全て自動処理。ゼロから本番環境まで、これほどスムーズなことはなかった。
---
