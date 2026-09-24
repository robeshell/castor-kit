import { defineConfig } from "vitepress";

const zhNav = [
  { text: "首页", link: "/" },
  { text: "快速开始", link: "/guide/getting-started" },
  { text: "开发指南", link: "/guide/development" },
  { text: "部署", link: "/deployment/" },
];

const enNav = [
  { text: "Home", link: "/en/" },
  { text: "Getting Started", link: "/en/guide/getting-started" },
  { text: "Development", link: "/en/guide/development" },
  { text: "Deployment", link: "/en/deployment/" },
];

const jaNav = [
  { text: "ホーム", link: "/ja/" },
  { text: "はじめる", link: "/ja/guide/getting-started" },
  { text: "開発ガイド", link: "/ja/guide/development" },
  { text: "デプロイ", link: "/ja/deployment/" },
];

const koNav = [
  { text: "홈", link: "/ko/" },
  { text: "시작하기", link: "/ko/guide/getting-started" },
  { text: "개발 가이드", link: "/ko/guide/development" },
  { text: "배포", link: "/ko/deployment/" },
];

const zhSidebar = {
  "/guide/": [
    {
      text: "入门",
      items: [
        { text: "快速开始", link: "/guide/getting-started" },
        { text: "开发指南", link: "/guide/development" },
      ],
    },
  ],
  "/deployment/": [
    {
      text: "部署",
      items: [{ text: "部署指南", link: "/deployment/" }],
    },
  ],
};

const enSidebar = {
  "/en/guide/": [
    {
      text: "Guide",
      items: [
        { text: "Getting Started", link: "/en/guide/getting-started" },
        { text: "Development Guide", link: "/en/guide/development" },
      ],
    },
  ],
  "/en/deployment/": [
    {
      text: "Deployment",
      items: [{ text: "Deployment", link: "/en/deployment/" }],
    },
  ],
};

const jaSidebar = {
  "/ja/guide/": [
    {
      text: "ガイド",
      items: [
        { text: "はじめる", link: "/ja/guide/getting-started" },
        { text: "開発ガイド", link: "/ja/guide/development" },
      ],
    },
  ],
  "/ja/deployment/": [
    {
      text: "デプロイ",
      items: [{ text: "デプロイガイド", link: "/ja/deployment/" }],
    },
  ],
};

const koSidebar = {
  "/ko/guide/": [
    {
      text: "가이드",
      items: [
        { text: "시작하기", link: "/ko/guide/getting-started" },
        { text: "개발 가이드", link: "/ko/guide/development" },
      ],
    },
  ],
  "/ko/deployment/": [
    {
      text: "배포",
      items: [{ text: "배포 가이드", link: "/ko/deployment/" }],
    },
  ],
};

export default defineConfig({
  title: "castor-kit",
  base: "/castor-kit/",
  ignoreDeadLinks: true,

  locales: {
    root: {
      label: "中文",
      lang: "zh-CN",
      title: "castor-kit 文档",
      description:
        "AI-First 全栈管理脚手架 — Node.js + TypeScript（Fastify · Drizzle）+ React 19 + PostgreSQL + shadcn/ui",
      themeConfig: {
        nav: zhNav,
        sidebar: zhSidebar,
        outline: { label: "本页目录" },
        docFooter: { prev: "上一页", next: "下一页" },
        lastUpdated: { text: "最后更新" },
        darkModeSwitchLabel: "主题",
        sidebarMenuLabel: "菜单",
        returnToTopLabel: "回到顶部",
      },
    },
    en: {
      label: "English",
      lang: "en-US",
      title: "castor-kit Docs",
      description:
        "AI-First Full-Stack Management Scaffold — Node.js + TypeScript (Fastify · Drizzle) + React 19 + PostgreSQL + shadcn/ui",
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
      },
    },
    ja: {
      label: "日本語",
      lang: "ja-JP",
      title: "castor-kit ドキュメント",
      description: "AI-First フルスタック管理スキャフォールド — Node.js + TypeScript + React 19 + shadcn/ui + PostgreSQL",
      themeConfig: {
        nav: jaNav,
        sidebar: jaSidebar,
        outline: { label: "目次" },
        docFooter: { prev: "前のページ", next: "次のページ" },
        lastUpdated: { text: "最終更新" },
        darkModeSwitchLabel: "テーマ",
        sidebarMenuLabel: "メニュー",
        returnToTopLabel: "トップへ戻る",
      },
    },
    ko: {
      label: "한국어",
      lang: "ko-KR",
      title: "castor-kit 문서",
      description: "AI-First 풀스택 관리 스캐폴드 — Node.js + TypeScript + React 19 + shadcn/ui + PostgreSQL",
      themeConfig: {
        nav: koNav,
        sidebar: koSidebar,
        outline: { label: "목차" },
        docFooter: { prev: "이전 페이지", next: "다음 페이지" },
        lastUpdated: { text: "최종 수정" },
        darkModeSwitchLabel: "테마",
        sidebarMenuLabel: "메뉴",
        returnToTopLabel: "맨 위로",
      },
    },
  },

  themeConfig: {
    socialLinks: [
      { icon: "github", link: "https://github.com/robeshell/castor-kit" },
    ],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026-present castor-kit Contributors",
    },
    search: { provider: "local" },
  },
});
