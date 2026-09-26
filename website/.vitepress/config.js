import { defineConfig } from 'vitepress'

const REPO = 'https://github.com/robeshell/castor-kit'
// Published by .github/workflows/docs.yml to GitHub Pages
const SITE = 'https://robeshell.github.io/castor-kit'

/**
 * One page tree, three languages. `prefix` is '' for the root (Chinese) locale and '/en' / '/ja' otherwise;
 * `t` maps each page to its title in that language.
 */
function localeTheme(prefix, t) {
  const link = (path) => `${prefix}${path}`
  const sidebar = [
    {
      text: t.start,
      items: [
        { text: t.intro, link: link('/guide/') },
        { text: t.gettingStarted, link: link('/guide/getting-started') },
        { text: t.structure, link: link('/guide/project-structure') },
      ],
    },
    {
      text: t.develop,
      items: [
        { text: t.ai, link: link('/guide/ai-workflow') },
        { text: t.backend, link: link('/guide/backend') },
        { text: t.frontend, link: link('/guide/frontend') },
        { text: t.rbac, link: link('/guide/rbac') },
        { text: t.security, link: link('/guide/security') },
        { text: t.i18n, link: link('/guide/i18n') },
        { text: t.appearance, link: link('/guide/appearance') },
        { text: t.components, link: link('/guide/components') },
      ],
    },
    {
      text: t.reference,
      items: [
        { text: t.commands, link: link('/reference/commands') },
        { text: t.configuration, link: link('/reference/configuration') },
      ],
    },
    { text: t.deploy, items: [{ text: t.deployGuide, link: link('/deploy/') }] },
  ]
  return {
    nav: [
      { text: t.guide, link: link('/guide/'), activeMatch: `^${prefix}/guide/` },
      { text: t.reference, link: link('/reference/commands'), activeMatch: `^${prefix}/reference/` },
      { text: t.deploy, link: link('/deploy/'), activeMatch: `^${prefix}/deploy/` },
    ],
    sidebar: { [link('/guide/')]: sidebar, [link('/reference/')]: sidebar, [link('/deploy/')]: sidebar },
    editLink: { pattern: `${REPO}/edit/main/website/:path`, text: t.edit },
    ...t.ui,
  }
}

const zh = {
  guide: '指南', start: '开始', intro: '介绍', gettingStarted: '快速开始', structure: '项目结构',
  develop: '开发', ai: 'AI 驱动开发', backend: '后端开发', frontend: '前端开发', rbac: '权限 RBAC', security: '账号安全与系统设置',
  i18n: '多语言', appearance: '主题与布局', components: '组件示例',
  reference: '参考', commands: '命令速查', configuration: '配置项', deploy: '部署', deployGuide: '部署指南',
  edit: '在 GitHub 上编辑此页',
  ui: {
    outline: { label: '本页目录', level: [2, 3] },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdated: { text: '最后更新' },
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    langMenuLabel: '语言',
    notFound: { title: '页面不存在', quote: '你访问的页面不存在或已被移动。', linkText: '返回首页' },
  },
}

const en = {
  guide: 'Guide', start: 'Getting started', intro: 'Introduction', gettingStarted: 'Quick start', structure: 'Project structure',
  develop: 'Development', ai: 'AI-driven workflow', backend: 'Backend', frontend: 'Frontend', rbac: 'Permissions (RBAC)', security: 'Account security & settings',
  i18n: 'Internationalization', appearance: 'Theme & layout', components: 'Component gallery',
  reference: 'Reference', commands: 'Commands', configuration: 'Configuration', deploy: 'Deploy', deployGuide: 'Deployment guide',
  edit: 'Edit this page on GitHub',
  ui: { outline: { level: [2, 3] } },
}

const ja = {
  guide: 'ガイド', start: 'はじめに', intro: '概要', gettingStarted: 'クイックスタート', structure: 'プロジェクト構成',
  develop: '開発', ai: 'AI 駆動開発', backend: 'バックエンド', frontend: 'フロントエンド', rbac: '権限（RBAC）', security: 'アカウントセキュリティとシステム設定',
  i18n: '多言語対応', appearance: 'テーマとレイアウト', components: 'コンポーネント例',
  reference: 'リファレンス', commands: 'コマンド一覧', configuration: '設定', deploy: 'デプロイ', deployGuide: 'デプロイガイド',
  edit: 'GitHub でこのページを編集',
  ui: {
    outline: { label: '目次', level: [2, 3] },
    docFooter: { prev: '前のページ', next: '次のページ' },
    lastUpdated: { text: '最終更新' },
    darkModeSwitchLabel: 'テーマ',
    lightModeSwitchTitle: 'ライトモードに切り替え',
    darkModeSwitchTitle: 'ダークモードに切り替え',
    sidebarMenuLabel: 'メニュー',
    returnToTopLabel: 'トップへ戻る',
    langMenuLabel: '言語',
    notFound: { title: 'ページが見つかりません', quote: 'お探しのページは存在しないか、移動されました。', linkText: 'ホームへ戻る' },
  },
}

export default defineConfig({
  title: 'castor-kit',
  base: '/castor-kit/',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/castor-kit/castor-logo.png' }],
    ['meta', { name: 'theme-color', content: '#2563eb' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'castor-kit' }],
    ['meta', { property: 'og:image', content: `${SITE}/og.png` }],
    ['meta', { property: 'og:image:width', content: '1280' }],
    ['meta', { property: 'og:image:height', content: '640' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${SITE}/og.png` }],
  ],

  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'castor-kit',
      description: '开箱即用的管理后台，新功能一句话生成：告诉 AI 你要什么，它生成数据表、接口和页面，并自动检查。',
      themeConfig: localeTheme('', zh),
    },
    en: {
      label: 'English',
      lang: 'en-US',
      title: 'castor-kit',
      description: 'A ready-made admin panel where AI builds new features: describe a page, get the table, API and UI, checked automatically.',
      themeConfig: localeTheme('/en', en),
    },
    ja: {
      label: '日本語',
      lang: 'ja-JP',
      title: 'castor-kit',
      description: 'すぐ使える管理画面。要件を伝えれば、AI がテーブル・API・画面を作り、自動でチェックします。',
      themeConfig: localeTheme('/ja', ja),
    },
  },

  themeConfig: {
    logo: { src: '/castor-logo.png', alt: '' },
    // The wordmark is rendered by the theme (nav-bar-title-after slot) so "kit" can use the brand gradient
    siteTitle: false,
    socialLinks: [{ icon: 'github', link: REPO }],
    search: {
      provider: 'local',
      options: {
        locales: {
          root: { translations: { button: { buttonText: '搜索文档' }, modal: { noResultsText: '没有找到结果', footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' } } } },
          ja: { translations: { button: { buttonText: '検索' }, modal: { noResultsText: '結果が見つかりません', footer: { selectText: '選択', navigateText: '移動', closeText: '閉じる' } } } },
        },
      },
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present castor-kit contributors',
    },
  },
})
