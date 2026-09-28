# 项目结构

Castor 是 pnpm monorepo。所有 `pnpm` 命令都在仓库根目录执行，根目录 `package.json` 的脚本会转发到对应的子包。

## 顶层目录

```text
castorjs/
├── package.json              # workspace 根脚本（dev / verify / scaffold / db:* ...）
├── pnpm-workspace.yaml
├── apps/
│   ├── api/                  # @castorjs/api：Fastify 后端
│   ├── web/                  # @castorjs/web：React 前端
│   └── mcp/                  # @castorjs/mcp：MCP Server
├── docs/
│   ├── architecture.md       # 架构说明与设计决定
│   ├── frontend-design-system.md  # 前端 UI 体系（shadcn/ui）
│   ├── apifox-full.openapi.json   # OpenAPI 文档
│   ├── spec.schema.json      # 模块规格（scaffold --spec）的 JSON Schema
│   ├── examples/specs/       # 「一句需求 → spec」示例
│   ├── roadmap.md            # 规划中的功能（动手实现前先读对应章节）
│   └── templates/            # 代码骨架模板（backend/、frontend/）
├── website/                  # 本文档站（VitePress，独立 npm 项目，不在 pnpm workspace 内）
├── AGENTS.md                 # 所有 AI 工具共用的项目上下文
├── CLAUDE.md                 # Claude Code 专属补充
├── .claude/ .agents/ .github/   # AI 技能（.agents 是 .claude/skills 的镜像）；.github 含 CI、文档站发布与 issue 模板
├── scripts/                  # setup.sh（Docker 一键安装向导）、docker-entrypoint.sh（镜像入口）
└── Dockerfile / docker-compose.yml / render.yaml
```

AI 相关文件的用途见 [AI 驱动开发](/zh/guide/ai-workflow#支持的-ai-工具)。

## 后端 apps/api

```text
apps/api/
├── src/
│   ├── main.ts               # web 进程入口
│   ├── worker.ts             # 独立定时任务调度进程入口
│   ├── app.ts                # buildApp()：插件、路由、错误处理、静态资源、SPA 回退
│   ├── config.ts             # 多环境配置（Zod 校验，生产环境缺关键变量拒绝启动）
│   ├── router.ts             # 一级路由装配，新增业务域在这里注册
│   ├── common/               # 横切能力（只列主要文件）
│   │   ├── auth.ts           # loginRequired / hasMenuPermission / hasAnyMenuPermission / menuPermissionRequired
│   │   ├── rbac.ts           # 权限判定纯函数
│   │   ├── csrf.ts           # CSRF 双提交校验
│   │   ├── errors.ts         # ServiceError 与统一错误处理
│   │   ├── db-errors.ts      # 数据库约束错误 → 400 业务错误
│   │   ├── http.ts           # intParam / parseIntParam / notFound / queryString / getUploadedFile
│   │   ├── validation.ts     # field.* / routeBody：请求体声明（Zod）
│   │   ├── pagination.ts     # parsePagination（默认 20，上限 200）
│   │   ├── serialize.ts      # toIso() 等时间输出工具
│   │   ├── time-zone.ts      # X-Time-Zone 请求头、withZoneOffset()
│   │   ├── data-scope.ts     # 行级数据权限（resolveDataScope / dataScopeWhere）
│   │   ├── api-token.ts      # Bearer API Token 认证
│   │   ├── tabular.ts        # csv / xlsx 读写
│   │   ├── i18n.ts           # 按 Accept-Language 翻译响应文案
│   │   ├── storage/          # 文件存储驱动（local / s3）
│   │   └── scheduler/        # 定时任务 runner、cron 匹配器、SSRF 防护
│   ├── i18n/messages.ts      # 后端报错的英文 / 日文译文
│   ├── demo/                 # 公开演示（DEMO_MODE）的数据与重置
│   ├── db/
│   │   ├── client.ts         # pg 连接池 + Drizzle 实例
│   │   ├── readonly.ts       # AI 数据查询专用的只读连接池
│   │   ├── migrate.ts        # 迁移执行器
│   │   ├── migrate-cli.ts    # pnpm db:migrate 入口
│   │   └── schema/           # model 层：Drizzle 表定义，按域分目录，index.ts 汇总导出；
│   │                         #   columns.ts 提供公共的 createdAt() / updatedAt() 列
│   └── modules/
│       ├── admin/            # 系统管理域：auth / users / roles / departments / menu / logs / dicts /
│       │                     #   files / settings / sessions / two-factor / password-reset / api-tokens /
│       │                     #   webhooks / scheduled-task / notification / announcement / dashboard / assistant
│       └── component-center/ # 组件示例中心域：demo-record / ai-chat / ai-prompt / ai-sql /
│                             #   devtools / traffic-flow
├── drizzle/                  # SQL 迁移文件 + meta/_journal.json（drizzle-kit 生成）
├── scripts/                  # 工具链：scaffold / verify-feature / seed-rbac / seed-demo / setup-once /
│                             #   init-ro-role / generate-openapi / import-apifox / demo-reset；lib/ 为共用代码
├── test/                     # Vitest，连接真实 PostgreSQL
└── drizzle.config.ts
```

每个功能模块由一个表定义文件和一个模块目录组成：

```text
src/db/schema/<domain>/<name>.ts                 # 表定义 + toDict 序列化
src/modules/<domain>/<name>/schema.ts            # Zod 请求 schema、导入导出字段映射
src/modules/<domain>/<name>/repository.ts        # 数据库读写
src/modules/<domain>/<name>/service.ts           # 业务逻辑
src/modules/<domain>/<name>/routes.ts            # 路由与权限检查
```

表定义集中放在 `db/schema/`，是因为 drizzle-kit 需要一个统一的 schema 入口；其余四层按功能就近放置，新增功能时只需要在一个目录里创建文件。分层规则见 [后端开发](/zh/guide/backend)。

## 前端 apps/web

```text
apps/web/
├── components.json           # shadcn CLI 配置
├── scripts/
│   ├── shadcn-add.sh         # 经本地中转执行 npx shadcn@latest add
│   ├── i18n-scan.mjs         # 未翻译文案扫描
│   └── api-types.mjs         # 根据 OpenAPI 文档生成 src/shared/api/openapi.d.ts
├── test/                     # Vitest（i18n、外观、标签栏、公共组件等）
└── src/
    ├── App.tsx               # 动态路由（通过 lib/page-modules.ts 找到菜单对应的页面）
    ├── index.css             # Tailwind v4 入口 + 设计 tokens（浅色 / 深色 / 强调色）
    ├── i18n/index.ts         # i18next 初始化
    ├── locales/              # 公共文案译文；menus/ 为菜单名译文
    ├── context/              # AuthContext / ThemeContext / TagsViewContext
    ├── components/
    │   ├── ui/               # shadcn/ui 原子组件（源码在仓库内）
    │   ├── ai-elements/      # AI 对话组件（会话、消息、输入框等）
    │   └── app/              # 应用外壳：AppLayout / AppSidebar / TopBar / TopNav / TagsView /
    │                         #   AppearanceMenu / CommandMenu / LanguageSwitcher / ...
    ├── lib/                  # page-modules（import.meta.glob 查找页面）/ cn / toast / format / motion /
    │                         #   chart-theme / menu-icons / appearance / ...
    ├── modules/
    │   ├── auth/pages/{login,reset_password}/  # 登录页与重置密码页
    │   ├── admin/{pages,api,components}/       # 系统管理页面、接口与页面组件
    │   └── component_center/
    │       ├── pages/{patterns,components,dataviz,ai,editor,devtools}/
    │       ├── showcase/     # components/ 各页面的布局组件（ShowcasePage / Example / PropsTable）
    │       └── api/
    └── shared/
        ├── api/request.ts    # Axios 实例（baseURL '/api'，自动带 CSRF 头、Accept-Language 与 X-Time-Zone）
        ├── api/openapi.d.ts  # 根据 OpenAPI 文档生成的接口类型
        ├── hooks/            # useCrudList / useDebouncedValue / useIsMobile / useDictOptions / useAppInfo
        ├── utils/file.ts     # downloadBlobFile
        └── components/       # 业务公共组件：PageHeader / DataTable / FormDialog / ...
```

菜单的 `component` 值 `<module>/<page_path>` 对应文件 `modules/<module>/pages/<page_path>/index.tsx`（例如 `admin/users` → `modules/admin/pages/users/index.tsx`，`component_center/patterns/kanban_page` → `modules/component_center/pages/patterns/kanban_page/index.tsx`），放在别处的页面动态路由找不到。详见 [前端开发](/zh/guide/frontend)。

## MCP Server apps/mcp

`apps/mcp/src/index.ts` 把工具链封装为 MCP 工具，供 Claude Desktop 等 MCP 客户端调用，详见 [AI 驱动开发](/zh/guide/ai-workflow#mcp-server)。

## 命名约定

| 对象 | 规则 | 示例 |
|---|---|---|
| 项目与包名 | 小写连字符 | `castorjs`、`@castorjs/api` |
| 后端目录与文件名 | 小写连字符 | `component-center`、`scheduled-task` |
| 数据库表名 | 下划线 | `scheduled_tasks` |
| 前端目录、菜单 `component` 字段 | 下划线 | `component_center/patterns/card_list_page` |
| 接口路径 | 连字符、复数 | `/api/admin/customer-orders` |

会话 cookie 名 `castor_session` 是例外，使用下划线。
