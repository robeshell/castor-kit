/**
 * Landing page copy per locale. Keys match the sections in Landing.vue.
 * The terminal script mirrors the real flow (autopilot → scaffold → migrate → seed:rbac → verify gate names).
 */

const SCAFFOLD = 'pnpm scaffold -- --name equipment --domain admin --fields "name:str,code:str50,status:str20,purchase_date:date,owner:str"'

export const CONTENT = {
  'zh-CN': {
    prefix: '',
    hero: {
      eyebrow: '开源免费 · MIT 协议',
      title: ['开箱即用的管理后台', '新功能，一句话生成'],
      lead: '用户、角色、权限、菜单、日志这些后台必备功能已经做好。要加新页面，告诉 AI 你要什么，它会生成数据表、接口和页面，并自动检查能否正常运行。',
      primary: '快速开始',
      secondary: 'GitHub',
      copy: '复制',
      copied: '已复制',
    },
    stats: [
      ['25+', '示例页面'],
      ['15', '项自动检查'],
      ['3', '种界面语言'],
      ['1', '条命令部署'],
    ],
    showcase: {
      kicker: '界面',
      title: '一套现成的后台界面',
      lead: '以下都是真实截图。主题色、导航布局、深浅色都能在「外观设置」里一键切换。',
      views: { dashboard: '工作台', list: '列表页', appearance: '外观设置', 'top-nav': '顶部导航', login: '登录页' },
      accentsTitle: '六种主题色',
      accents: { ocean: '海洋蓝', violet: '紫罗兰', emerald: '翡翠绿', rose: '玫瑰红', amber: '琥珀橙', slate: '石墨灰' },
    },
    ai: {
      kicker: 'AI 写代码',
      title: '说出需求，AI 写好代码',
      lead: '项目的开发规范已经写成 AI 能读懂的文档，Claude Code、Cursor 等工具都按同一套规则写代码。',
      points: [
        ['你描述需求', '比如：做一个设备台账，有名称、编号、状态。'],
        ['AI 生成代码', '数据表、后端接口、前端页面、权限一次到位。'],
        ['自动检查', '类型检查、测试、构建全部通过，才算完成。'],
      ],
      more: '了解详情',
      prompt: '做一个「设备台账」：名称、编号、状态、采购日期、负责人',
      script: [
        ['info', '理解需求：新建表 equipments，5 个字段，加一个「设备台账」菜单'],
        ['cmd', SCAFFOLD],
        ['ok', '已生成数据表、后端接口、前端页面和测试'],
        ['cmd', 'pnpm db:migrate'],
        ['ok', '数据库已更新'],
        ['cmd', 'pnpm seed:rbac -- --incremental'],
        ['ok', '菜单和按钮权限已添加'],
        ['cmd', 'pnpm verify -- --module equipment'],
        ['gate', 'typescript_compile · migration_chain · router_registration · rbac_sync · api_tests · frontend_tests · frontend_build'],
        ['done', '全部检查通过，可以上线'],
      ],
    },
    features: {
      kicker: '功能',
      title: '后台该有的，都有了',
      items: [
        ['shield', '权限管理', '用户、角色、菜单，细到每个按钮。'],
        ['layers', '规范的代码', '前后端分层清晰，全程 TypeScript 类型检查。'],
        ['languages', '中英日三语', '界面和报错信息都能切换语言。'],
        ['palette', '主题与布局', '六种主题色、三种布局、深浅色模式。'],
        ['table', '导入导出', '表格数据一键导入导出 Excel、CSV。'],
        ['container', '一条命令部署', 'Docker 一键启动数据库和整个系统。'],
      ],
    },
    stack: { kicker: '技术栈' },
    cta: {
      title: '几分钟就能跑起来',
      lead: '克隆仓库，运行安装脚本，就能登录后台。',
      primary: '快速开始',
      secondary: '看看示例页面',
    },
  },

  'en-US': {
    prefix: '/en',
    hero: {
      eyebrow: 'Open source · MIT',
      title: ['A ready-made admin panel.', 'New features? Just ask.'],
      lead: 'Users, roles, permissions, menus and logs are already built. Need a new page? Describe it, and AI generates the table, API and UI — then checks that it all works.',
      primary: 'Get started',
      secondary: 'GitHub',
      copy: 'Copy',
      copied: 'Copied',
    },
    stats: [
      ['25+', 'example pages'],
      ['15', 'automated checks'],
      ['3', 'UI languages'],
      ['1', 'command to deploy'],
    ],
    showcase: {
      kicker: 'The UI',
      title: 'An admin UI, ready to use',
      lead: 'These are real screenshots. Colors, layouts and light or dark mode are one click away in the Appearance menu.',
      views: { dashboard: 'Dashboard', list: 'List page', appearance: 'Appearance', 'top-nav': 'Top navigation', login: 'Sign-in' },
      accentsTitle: 'Six accent colors',
      accents: { ocean: 'Ocean', violet: 'Violet', emerald: 'Emerald', rose: 'Rose', amber: 'Amber', slate: 'Slate' },
    },
    ai: {
      kicker: 'Built with AI',
      title: 'Describe it. AI writes the code.',
      lead: 'The project’s conventions are written for AI, so Claude Code, Cursor and other tools all follow the same rules.',
      points: [
        ['You describe it', 'For example: an equipment list with name, code and status.'],
        ['AI builds it', 'Table, API, page and permissions — all in one go.'],
        ['Checked for you', 'Type checks, tests and the build must pass before it’s done.'],
      ],
      more: 'Learn more',
      prompt: 'Build an "Equipment" registry: name, code, status, purchase date, owner',
      script: [
        ['info', 'Got it: new table equipments, 5 fields, an "Equipment" menu'],
        ['cmd', SCAFFOLD],
        ['ok', 'Generated the table, API, page and tests'],
        ['cmd', 'pnpm db:migrate'],
        ['ok', 'Database updated'],
        ['cmd', 'pnpm seed:rbac -- --incremental'],
        ['ok', 'Menu and button permissions added'],
        ['cmd', 'pnpm verify -- --module equipment'],
        ['gate', 'typescript_compile · migration_chain · router_registration · rbac_sync · api_tests · frontend_tests · frontend_build'],
        ['done', 'All checks passed, ready to ship'],
      ],
    },
    features: {
      kicker: 'Features',
      title: 'Everything an admin panel needs',
      items: [
        ['shield', 'Permissions', 'Users, roles and menus, down to each button.'],
        ['layers', 'Clean code', 'Clear frontend and backend layers, fully typed.'],
        ['languages', 'Three languages', 'Chinese, English and Japanese UI and messages.'],
        ['palette', 'Themes & layouts', 'Six colors, three layouts, light and dark.'],
        ['table', 'Import & export', 'Excel and CSV import and export for tables.'],
        ['container', 'One-command deploy', 'Docker starts the database and the whole app.'],
      ],
    },
    stack: { kicker: 'Tech stack' },
    cta: {
      title: 'Up and running in minutes',
      lead: 'Clone the repo, run the setup script, and sign in.',
      primary: 'Get started',
      secondary: 'See example pages',
    },
  },

  'ja-JP': {
    prefix: '/ja',
    hero: {
      eyebrow: 'オープンソース · MIT',
      title: ['すぐ使える管理画面。', '新機能は AI におまかせ。'],
      lead: 'ユーザー、ロール、権限、メニュー、ログなどの基本機能は実装済み。新しい画面は要件を伝えるだけで、AI がテーブル・API・画面を作り、動作まで自動でチェックします。',
      primary: 'はじめる',
      secondary: 'GitHub',
      copy: 'コピー',
      copied: 'コピーしました',
    },
    stats: [
      ['25+', 'サンプル画面'],
      ['15', '項目の自動チェック'],
      ['3', 'つの UI 言語'],
      ['1', 'コマンドでデプロイ'],
    ],
    showcase: {
      kicker: '画面',
      title: 'すぐに使える管理画面',
      lead: 'すべて実際のスクリーンショットです。テーマカラー、レイアウト、ライト / ダークは外観設定からワンクリックで切り替えられます。',
      views: { dashboard: 'ダッシュボード', list: '一覧画面', appearance: '外観設定', 'top-nav': 'トップナビ', login: 'ログイン' },
      accentsTitle: '6 色のテーマカラー',
      accents: { ocean: 'オーシャン', violet: 'バイオレット', emerald: 'エメラルド', rose: 'ローズ', amber: 'アンバー', slate: 'スレート' },
    },
    ai: {
      kicker: 'AI で開発',
      title: '要件を伝えれば、AI がコードを書く',
      lead: '開発ルールは AI が読める形で書かれているので、Claude Code や Cursor などのツールが同じルールでコードを書きます。',
      points: [
        ['要件を伝える', '例：名称・コード・状態を持つ設備台帳を作って。'],
        ['AI がコードを生成', 'テーブル、API、画面、権限をまとめて作成。'],
        ['自動でチェック', '型チェック、テスト、ビルドがすべて通って完成。'],
      ],
      more: '詳しく見る',
      prompt: '「設備台帳」を作って：名称、コード、状態、購入日、担当者',
      script: [
        ['info', '了解：テーブル equipments（5 フィールド）と「設備台帳」メニューを追加'],
        ['cmd', SCAFFOLD],
        ['ok', 'テーブル、API、画面、テストを生成'],
        ['cmd', 'pnpm db:migrate'],
        ['ok', 'データベースを更新'],
        ['cmd', 'pnpm seed:rbac -- --incremental'],
        ['ok', 'メニューとボタン権限を追加'],
        ['cmd', 'pnpm verify -- --module equipment'],
        ['gate', 'typescript_compile · migration_chain · router_registration · rbac_sync · api_tests · frontend_tests · frontend_build'],
        ['done', 'すべてのチェックに合格、リリース可能'],
      ],
    },
    features: {
      kicker: '機能',
      title: '管理画面に必要なものは、ぜんぶ入り',
      items: [
        ['shield', '権限管理', 'ユーザー、ロール、メニュー、ボタン単位まで。'],
        ['layers', 'きれいなコード', 'フロントとバックエンドを明確に分け、すべて型付き。'],
        ['languages', '3 言語対応', '画面もエラーメッセージも中・英・日で表示。'],
        ['palette', 'テーマとレイアウト', '6 色のテーマ、3 種類のレイアウト、ライト / ダーク。'],
        ['table', 'インポート / エクスポート', '表のデータを Excel や CSV で入出力。'],
        ['container', 'コマンド 1 つでデプロイ', 'Docker でデータベースからアプリまで起動。'],
      ],
    },
    stack: { kicker: '技術スタック' },
    cta: {
      title: '数分で動かせます',
      lead: 'リポジトリをクローンしてセットアップスクリプトを実行するだけ。',
      primary: 'はじめる',
      secondary: 'サンプル画面を見る',
    },
  },
}

export const STACK = ['Node.js 22', 'TypeScript', 'Fastify 5', 'Drizzle ORM', 'PostgreSQL', 'Zod', 'React 19', 'shadcn/ui', 'Tailwind CSS v4', 'Motion', 'i18next', 'Vite', 'Vitest', 'Docker', 'MCP']

export const INSTALL = 'git clone https://github.com/robeshell/castor-kit.git && cd castor-kit && bash setup.sh'
