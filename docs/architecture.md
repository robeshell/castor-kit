# castor-kit 架构说明

> castor-kit（Castor = 河狸的拉丁属名，"自然界的工程师"；Kit = 脚手架/工具套件）是一个 Node.js/TypeScript + React + RBAC 的 AI-First 管理后台脚手架。命名一律小写连字符，不用驼峰；GitHub 仓库 `castor-kit`，npm scope `@castor-kit/*`。
>
> 本文说明整体架构、横切约定与关键设计决定。日常开发约定（字段类型推断、交付流程、菜单树）见 `AGENTS.md`；前端 UI 体系见 `docs/frontend-redesign-plan.md`。

---

## 1. 技术栈

| 层 | 选型 | 为什么 |
|---|---|---|
| 运行时 | Node 22 LTS + TypeScript（strict） | 类型即文档，AI 生成代码的错误在 `tsc` 阶段就暴露 |
| 包管理 | pnpm workspaces（monorepo） | `apps/api`、`apps/web`、`apps/mcp` 共享 lockfile 和脚本 |
| Web 框架 | **Fastify 5** | 显式、无装饰器魔法、插件模型清晰；内置 JSON schema 校验与 OpenAPI 生成；性能好 |
| 校验/序列化 | **Zod** + `fastify-type-provider-zod` | 一份 schema 同时产出请求校验、TS 类型与 OpenAPI 文档 |
| ORM | **Drizzle ORM** + drizzle-kit | 表定义即代码、SQL 透明、迁移是可审查的纯 SQL 文件 |
| DB 驱动 | `pg`（node-postgres） | 成熟；自定义 `timestamp` / `date` 解析（见 §4.2） |
| 日志 | pino（Fastify 内置） | 结构化 JSON 日志 |
| 会话 | `sessions` 表 + `@fastify/secure-session` | 服务端会话（可列出、可强制下线）；加密 cookie 只装会话 ID 与 CSRF token，不需要 Redis |
| 其他插件 | `@fastify/cookie`、`@fastify/cors`、`@fastify/compress`、`@fastify/static`、`@fastify/multipart`、`@fastify/websocket`、`@fastify/swagger` | — |
| 定时 | 自研 runner（租约模型）+ 自研 cron 匹配器 | 多副本安全；cron 语义见 §4.9 |
| 表格 | `csv-parse` / `csv-stringify` + `exceljs` | 只支持 csv / xlsx |
| 系统指标 | `systeminformation` | 性能监控页 / WebSocket 推送 |
| 测试 | Vitest + 真实 PostgreSQL | AI SQL 只读引擎、序列同步、advisory lock 都是 pg 特有，不用内存库替身 |
| 代码质量 | ESLint + `tsc --noEmit` | 纳入 verify 门禁 |
| 前端 | React 19 + Vite + shadcn/ui + Tailwind CSS v4 + motion + lucide-react（JSX） | 见 `docs/frontend-redesign-plan.md` |
| MCP | `@modelcontextprotocol/sdk` | 把工具链暴露给 MCP Client |

不做的事：不上 Next.js/SSR（RBAC 后台 + 动态菜单路由，SSR 没有收益只有复杂度）；不做 GraphQL。

备选（为什么没选）：
- **NestJS**：模块结构更强制，但装饰器 + DI 魔法多，AI 从模板生成时出错率更高，且启动慢。
- **Hono / Express**：Hono 生态和 OpenAPI 集成弱；Express 无内置校验和类型支持。
- **Prisma**：schema DSL 对自引用、复合主键中间表、`numeric` 需要大量手工修正，动态过滤查询不如 Drizzle 直接。
- **Kysely**：纯 query builder，没有 schema 迁移工具链。

---

## 2. 仓库结构

```
castor-kit/
├── package.json                    # pnpm workspaces 根（所有 pnpm 命令在根目录执行）
├── pnpm-workspace.yaml
├── apps/
│   ├── api/                        # @castor-kit/api —— Fastify 后端
│   │   ├── src/
│   │   │   ├── main.ts             # web 进程入口
│   │   │   ├── worker.ts           # 独立调度器进程入口
│   │   │   ├── app.ts              # buildApp()：插件 / 路由 / 错误处理 / 静态资源 / SPA
│   │   │   ├── config.ts           # 多环境配置（Zod 校验，生产 fail-closed）
│   │   │   ├── router.ts           # 一级装配：注册各业务域
│   │   │   ├── common/             # 横切能力：auth / rbac / csrf / errors / http / pagination /
│   │   │   │                       #   serialize / tabular / request-meta / password / tree / scheduler/
│   │   │   ├── db/
│   │   │   │   ├── client.ts       # pg Pool + drizzle 实例 + 类型解析器
│   │   │   │   ├── readonly.ts     # AI SQL 专用只读 Pool
│   │   │   │   ├── migrate.ts      # 迁移执行器（drizzle-orm migrator）
│   │   │   │   ├── migrate-cli.ts  # pnpm db:migrate 入口
│   │   │   │   └── schema/         # ← model 层（Drizzle 表定义，按域分文件，index.ts 汇总导出）
│   │   │   └── modules/
│   │   │       ├── admin/          # 系统管理域：router.ts + users/ roles/ menu/ auth/ …
│   │   │       └── component-center/  # 组件示例中心域
│   │   ├── drizzle/                # SQL 迁移 + meta/_journal.json
│   │   ├── scripts/                # 工具链（见 §7）
│   │   ├── test/                   # Vitest（真实 PostgreSQL）
│   │   └── drizzle.config.ts
│   ├── web/                        # @castor-kit/web —— React 19 + shadcn/ui + Tailwind v4（JSX）
│   └── mcp/                        # @castor-kit/mcp —— MCP Server
├── docs/
│   ├── architecture.md             # 本文
│   ├── frontend-redesign-plan.md   # 前端 UI 体系
│   ├── templates/{backend,frontend}/   # 代码骨架模板（AI 临摹用）
│   └── apifox-full.openapi.json        # OpenAPI 文档
├── website/                        # VitePress 文档站（独立 npm 项目）
├── Dockerfile / docker-compose.yml / docker-entrypoint.sh / setup.sh
└── AGENTS.md / CLAUDE.md / CODEX.md / llms.txt / …   # AI 上下文文档
```

**为什么 model 层集中放在 `db/schema/`，其余三层按功能文件夹放？** Drizzle 需要一个统一的 schema 导出给 drizzle-kit；而 repository / service / routes 按功能就近放置，AI 生成一个新功能时只需在一个目录下创建 4 个文件 + 1 个 schema 文件，比按层分散到 5 个目录更不容易漏。

命名：后端目录与文件名一律小写连字符（`component-center`、`scheduled-task`）；表名、前端目录、菜单 `component` 保持下划线（`component_center/admin/list_page`）。

---

## 3. 后端分层

| 层 | 位置 | 职责 | 禁止 |
|---|---|---|---|
| model | `db/schema/<domain>/<name>.ts`（`pgTable(...)`）+ `xxxToDict()` | 表结构 + 序列化 | 业务逻辑 |
| schema | `modules/<domain>/<name>/schema.ts`（Zod + `EXPORT_FIELD_MAP` / `IMPORT_HEADER_MAP`） | 校验、类型、导入导出映射 | DB 操作 |
| repository | `modules/<domain>/<name>/repository.ts` | 纯 DB 读写（Drizzle 查询） | 业务逻辑、HTTP |
| service | `modules/<domain>/<name>/service.ts` | 业务逻辑，抛 `ServiceError(message, status, payload)` | 直接碰 HTTP 对象 |
| routes | `modules/<domain>/<name>/routes.ts`（`registerXxxRoutes(app)`） | 路由 + 权限检查 + 调 service | 直接写 SQL |
| 域装配 | `modules/<domain>/router.ts` | 域内注册 | — |
| 一级装配 | `src/router.ts` + `db/schema/index.ts` | 注册域 / 导出表 | — |

### 反模式清单

```
❌ routes.ts 内自定义 hasPermission()（必须 import 自 common/auth）
❌ routes.ts 内直接调用 db.select()/sql``（必须经 repository）
❌ db/schema 内写业务逻辑（只放 pgTable + toDict）
❌ 直接 Date#toISOString() 输出时间（必须用 common/serialize.toIso）
❌ 用 fetch/XMLHttpRequest 写前端请求（必须用 @/shared/api/request）
❌ 新增域不在 src/router.ts + db/schema/index.ts 注册
❌ 迁移 SQL 手写而不经 drizzle-kit generate（破坏 journal 链）
❌ 跳过 verify-feature 门禁直接声明完成
❌ 硬编码菜单 ID（先查菜单树取下一个可用 ID）
❌ 向 PM 询问路由/权限编码/字段类型（AI 自行推断）
```

---

## 4. 横切约定

### 4.1 响应格式与错误处理
- 路由前缀 `/api/admin/...`；另有 `/ws/devtools`、`/health` 与 SPA fallback。
- 列表响应 `{ items, total, page, per_page }`；登录 / `me` / `csrf-token` 响应携带 `csrf_token`。
- 错误响应 `{ error: string, ...payload }`：统一 `setErrorHandler` 把 `ServiceError` 转成该形状；Zod 校验失败 → 400 `{error: <首条消息>}`；未知异常 → 500「服务器内部错误，请稍后重试」，不透传内部信息，pino 记录堆栈。
- `/api/*` 下 404 / 405 / 500 均返回 JSON，永远不落到 SPA `index.html`。405 规则见 §9。
- 输出 UTF-8 紧凑 JSON。
- 反代：`trustProxy` 取一跳，`request.ip` 即真实 IP，不手动读 `X-Forwarded-For`。

### 4.2 时间与数值输出
- 时间字段格式 `YYYY-MM-DDTHH:mm:ss[.ffffff]`（**无 `Z` 后缀**，值为 UTC；整秒时不带小数部分）。`pg` 的 `timestamp`（1114）/ `date`（1082）解析器设为原样返回文本，**不经过 JS `Date`**——`Date` 会按本地时区解析造成偏移，且只有毫秒精度。`toIso()` 把空格换成 `T` 并把小数秒右补 0 到 6 位（见 §9）。禁止 `Date#toISOString()`。
- `created_at` / `updated_at` 在库里没有 DB DEFAULT，由应用侧默认值写入：`db/schema/columns.ts` 的 `createdAt()` / `updatedAt()`（`timezone('utc', now())`）。
- `numeric` 列保持字符串输出（如 `"12.50"`），`toDict()` 里**不要** `parseFloat`；`NaN` → `null`。

### 4.3 请求宽松度
- 请求 schema 宽松：`.passthrough()` / `z.record(...)` + 全字段可选；空 body、多余字段、类型不对都被容忍，归一化（`parseBool` / `parseInt` 等）在 service 里做。响应 schema 可以严格（它驱动 OpenAPI）。收紧请求校验是独立任务，一次改一个模块，避免在边缘输入上破坏现有前端。
- 请求体统一用 `jsonBody(request)` 读取（见 §9）。

### 4.4 认证、密码与会话
- `loginRequired` preHandler：未登录 → `401 {error:'未授权访问', redirect:'/admin/login'}`。除了会话标记，它还会加载当前用户（按请求缓存，后续权限检查不再查库）：账号已删除或 `status = 'disabled'` 时清掉会话并同样返回 401，停用因此在下一次请求就生效。停用账号在 `getCurrentAdminUser` 里视为未登录，所有权限检查都失败。
- 当前用户每请求缓存在 `request` 上，一次查询 join `user_roles → roles → role_menus → menus`，避免 N+1。
- 登录防爆破：基于 `login_logs` 的窗口计数（IP 维度 + 用户名维度，阈值与窗口来自系统设置 `security.login_max_failures` / `login_lockout_minutes`，可由 `LOGIN_MAX_FAILURES` / `LOGIN_LOCKOUT_MINUTES` 锁定），成功后清零窗口内失败记录。
- 密码哈希格式 `pbkdf2:sha256:<iterations>$<salt>$<hex_digest>`（默认 100 万次迭代，16 位字母数字 salt），`common/password.ts` 负责生成与校验；一律用**异步** `crypto.pbkdf2` + `timingSafeEqual`，同步执行会阻塞事件循环约 0.3–0.5s。
- 会话：`sessions` 表是唯一事实源（`common/session.ts`）。cookie `castor_session`（`@fastify/secure-session` 加密）只装 `{ sid, csrf_token }`；`onRequest` 钩子按 sid 加载未撤销、未过期的行到 `request.authSession`，无效则清 cookie。有效期来自系统设置 `security.session_ttl_hours`（初值 `SESSION_TTL_HOURS`），`last_seen_at` / `expires_at` 每分钟最多写一次实现滑动续期。cookie 密钥用 `hkdfSync('sha256', SECRET_KEY, '', 'castor-kit-session', 32)` 派生；属性 `HttpOnly`、`SameSite=Lax`、`Secure` 走 auto 策略。
- 撤销：退出（当前会话）、改密码（本人其他会话）、管理员改密码 / 停用 / 删除、邮件重置密码（该用户全部会话）、强制下线（指定会话）；调度器维护任务每小时删除过期或撤销超过一天的会话与重置令牌。
- 两步验证（`modules/admin/two-factor`）：登录密码正确后，已绑定或所在角色被要求的用户得到 `mfa_state = 'verify' | 'setup'` 的待定会话（5 分钟），`isSignedIn` 不认它；`POST /api/admin/login/two-factor` 通过后撤销待定会话、换发新会话，才记录登录成功。TOTP 密钥用 `common/secret-box.ts`（HKDF 派生、独立 info 的 AES-256-GCM）加密；`totp_last_step` 防重放；恢复码存 sha256；错误验证码写入 `login_logs` 失败记录，与密码错误共用锁定。
- 找回密码（`modules/admin/password-reset`）：申请接口不区分邮箱是否存在，邮件在后台发送；令牌 32 字节只存 sha256、30 分钟、单次，新申请作废旧令牌；链接用系统设置里的网站地址（`general.app_base_url`）拼接；邮件由 `common/mailer.ts` 的 `MailerProvider` 按当前 SMTP 设置构建（`MAIL_DRIVER=log` 打印到日志、`none` 不发送）。
- 系统设置（`common/settings.ts` + `system_settings` 表）：带分组、类型、默认值、范围、锁定环境变量与「不可用原因」的注册表。生效值 = 环境变量（`config.settingsEnv`，只收集非空的 `SETTING_ENV_NAMES`，启动时校验，非法即拒绝启动）> 表中的值 > 默认值；`type: 'secret'` 的值用 `secret-box` 加密存储，`describe()` 只返回 `has_value`。`SettingsStore` 进程内缓存 5 秒，`peek()` 供热路径同步读取；`preview(changes)` 在不写库的情况下套用草稿，供保存前的跨项校验（如选 S3 必须有 bucket / 密钥、打开找回密码需要 SMTP 与网站地址）和「测试」接口（`POST /api/admin/settings/test/{mail,storage,ai}`，走 `authRateLimit`）使用；公开子集（安全开关、密码规则、上传限制）经 `app-info` 下发。
- 按设置重建的客户端：`StorageProvider`（web 进程与独立 worker 各自持有一个 `SettingsStore`，保证清理任务和上传看到同一存储配置）、`MailerProvider`、AI 服务每次调用时读取 `settings.ai`；缓存键是相关设置的 JSON，设置变了才重建。
- 设置的防护：保存与测试接口要求近期验证身份（`sessions.verified_at`，登录时写入；`POST /api/admin/reauth` 校验密码与两步验证码后刷新；`requireRecentAuth` 窗口 10 分钟，失败计入登录锁定），前端 `useReauth` 捕获 `reauth_required` 后弹窗并重试；每次保存给所有启用的超级管理员发个人通知（标题写明谁改了哪些项，密钥只写已更新 / 已清除）；SMTP 主机、S3 接口地址、AI 接口地址经 `common/outbound.ts` 检查（`169.254/16`、`fe80::/10`、组播等始终拒绝，内网按 `SETTINGS_ALLOW_PRIVATE_NETWORK`，环境变量锁定的值不检查），AI 请求用 `createOutboundAgent` 在连接时复查实际 IP 防 DNS 重绑定。
- 操作日志脱敏：`request-meta.ts` 的 `isSensitiveKey` 除精确字段名外，还按复合键的末段匹配（`mail.smtp_password`、`storage.s3_secret_key`、`ai.api_key` → `***`）。
- 限流（`common/rate-limit.ts`）：`@fastify/rate-limit` 全局按 IP 限 `/api`、`/ws`；登录、两步验证、找回密码共用一个 `createRateLimit` 限流器（插件的按路由配置在内存存储下各路由计数独立，做不到共享）；额度来自系统设置，计数在进程内。

### 4.5 CSRF
- 双提交校验：仅 `/api/*` 的 `POST/PUT/PATCH/DELETE`；`/api/admin/login` 豁免；没有会话时跳过（等待两步验证的会话也要校验，登录响应会带上 `csrf_token`）；`X-CSRF-Token` 与 session 中 token 用 `timingSafeEqual` 比对，失败 `403 {error:'CSRF 校验失败，请刷新页面后重试'}`。
- 挂在 `preValidation`：被拒请求的请求体仍会进操作日志；未命中路由的已登录写请求也先 403。
- 前端 `shared/api/request.js` 自动带 CSRF 头。

### 4.6 权限（RBAC）
- `common/rbac.ts` 是纯函数（`isSuperAdmin` / 菜单编码收集）；`common/auth.ts` 提供 `hasMenuPermission` / `hasAnyMenuPermission` / `menuPermissionRequired`。
- `super_admin` 角色短路放行；唯一例外是 `GET /api/admin/my-menus`，它按角色实际授予的菜单返回。
- 防锁死：`super_admin` 角色不能删除、改编码、改数据范围或减少菜单（只能改名称 / 描述）；授予 / 移除这个角色、操作超级管理员账号都只允许超级管理员；不能移除自己的角色；最后一个启用中的超级管理员不能被停用 / 删除 / 移除角色（这条在 HTTP 上已被前几条覆盖，保留为兜底）。
- `my-menus` 的叶子节点没有 `children` 键；`menu_codes` 与角色顺序不保证，比较时按集合。
- 菜单 `component` 字段格式 `<module>/<subdir>/<page>`，前端 `App.jsx` 用 `import.meta.glob` 解析。
- 菜单与权限的唯一事实源是 `apps/api/scripts/seed-rbac.ts`；菜单 ID 不重排（`role_menus` 以 ID 引用）。
- **数据权限**（`common/data-scope.ts`）：`roles.data_scope` 为 `all` / `dept_and_children` / `dept` / `self` / `custom`（`custom` 的部门在 `role_depts`），默认 `all`。`resolveDataScope(request)` 按请求缓存，多角色取并集，`super_admin` 或任一 `all` 不限制；部门子树用递归 CTE（`common/tree.ts` 的 `descendantIds`）。`dataScopeWhere(scope, { deptColumn, ownerColumn })` 是纯函数：不限制时返回 `undefined`，受限但为空时返回恒假条件（失败即关闭，不能退化成不过滤）。超出范围的记录在详情 / 修改 / 删除时按 404 处理。部门表本身不做数据权限。

### 4.7 分页
- `parsePagination(query)`：page ≥ 1，1 ≤ per_page ≤ 200，默认 20。

### 4.8 操作日志
- **集中式**写入：logs 模块注册全局 `onResponse` hook，按路径 / 方法推断 `module / action / target_id` 后写 `operation_logs`（异常吞掉不影响响应）。**不要**散落到各 service。
- `LoginLog` 以及登录 / 登出两条操作日志显式写在 auth service 里。
- `safePayload()` 脱敏键 `{password, old_password, new_password, confirm_password, secret, token, access_token, api_key, authorization}` + 2000 字符截断。

### 4.9 定时任务调度器
- `scheduled_tasks` 的 `next_run_at / last_status / updated_at` 实现租约：
  - claim：`UPDATE ... SET next_run_at=NULL, last_status='running', updated_at=now WHERE id=$1 AND is_active AND next_run_at=$2`，`rowCount===1` 才算抢到。
  - 过期回收：`last_status='running' AND next_run_at IS NULL AND updated_at <= now - lease` → 重置为 `idle` 并 `next_run_at=now`。
  - 执行崩溃：按 cron 算下次时间，`last_status='failed'`。
- 两种运行方式：`RUN_SCHEDULER_IN_WEB=true` 时在 web 进程内循环（默认 20s）；否则用 `node dist/worker.js` 独立进程。多副本部署建议 `RUN_SCHEDULER_IN_WEB=false` + 单 worker（租约模型本身也能防重）。
- cron：`common/scheduler/cron.ts` 是自研 5 段匹配器（分 时 日 月 周），"日"与"周"是 **AND** 关系（标准 cron 在两者都受限时是 OR），周字段 Sunday=0，逐分钟向前扫描最多 366 天，UTC。**不要**换成 `cron-parser` / `croner`，否则已有任务的 `next_run_at` 会变。
- SSRF 防护：只允许 http/https，禁止 localhost / 私网 / 链路本地 / 元数据地址；执行时用 `undici` 自定义 `connect.lookup` 把解析结果钉死并复检（见 §9）；`timeout_seconds` 1–120。响应体截断后写 `scheduled_task_runs`。

### 4.10 AI 对话（SSE）
- `POST /api/admin/component-center/ai/chat/stream`：`undici.fetch` 上游 OpenAI 兼容接口（`AI_API_BASE/chat/completions`，`stream:true`），逐行解析 `data:`，转发为 `data: {"content": "..."}\n\n`，结束 `data: [DONE]\n\n`。
- 上游非 200 不透传响应体，只给 `AI 服务暂时不可用（<status>）`；超时 60s。
- 响应头 `Content-Type: text/event-stream`、`Cache-Control: no-cache`、`X-Accel-Buffering: no`；用 `reply.hijack()` + `reply.raw` 流式写，监听连接关闭中止上游请求。

### 4.11 AI 数据查询（只读引擎）
- 独立 `pg.Pool`（`db/readonly.ts`），连接参数 `-c default_transaction_read_only=on -c statement_timeout=<ms>`；每次查询前再 `SET LOCAL` 一遍（抵消池化连接被污染）。
- SQL 包裹 `SELECT * FROM (<sql>) AS _q LIMIT 200`；关键字拦截前先剥离字符串字面量。
- 生产环境 `AI_SQL_DATABASE_URL` 缺失 → 启动失败（fail-closed）；开发环境回退主库 URL 但仍带只读参数。
- 敏感表过滤：`roles/menus/user_roles/role_menus` 精确、`admin_*/audit_*/scheduled_task*` 前缀、`*_logs` 后缀；schema 读取走 `information_schema.columns`。
- `init-ro-role` 脚本创建只读账号 `castor_kit_ro`，只授业务表 SELECT。

### 4.12 文件上传
- **文件中心**（`modules/admin/files` + `common/storage/`）：`POST /api/admin/files` 上传（只需登录），`GET /api/admin/files/:id` 预览 / 下载（只需登录，ID 是 UUID），列表需要 `system_files`、删除需要 `system_files_delete`。
  - 校验顺序：大小（系统设置 `upload.max_size` 与 `MAX_CONTENT_LENGTH` 取小，超限 413）→ 扩展名白名单 → `file-type` 读文件头，与扩展名不一致即拒绝（txt / csv 等纯文本要求检测不到二进制签名）。原文件名只取最后一段并去掉控制字符。
  - 去重：每次上传一条 `files` 记录；对象键按 sha256 生成（`ab/<sha256>`），相同内容共用一个对象，最后一条记录删除时才删对象。
  - 驱动：`local`（先写临时文件再 rename）与 `s3`（`@aws-sdk/client-s3`，校验和改为「仅在必需时」以兼容各家 S3 兼容服务）。读取时按记录上的 `storage` 选驱动、按记录上的 `bucket` 取对象，切换存储或改 Bucket 不影响旧文件（旧驱动仍需配置、凭证要能访问原桶）。存储配置在系统设置里，保存时选 S3 必须填齐 bucket / 密钥；环境变量锁定的配置不完整时，上传报「未配置」错误。
  - 返回：只有 png / jpeg / gif / webp 内联预览，其余一律 `attachment` + `nosniff`；`ETag` 为 sha256（命中返回 304）；`s3` 驱动 302 到 10 分钟有效的签名地址（设置了公开访问地址时跳公开地址）。
  - 引用：业务写入时在同一事务里调用 `common/file-refs.ts` 的 `syncFileRefs` / `clearFileRefs`，记录在 `file_references`；被引用的文件不能删除。头像仍存 URL（`/api/admin/files/<id>`），外部地址照常可用。
  - 清理：调度器循环里的内置维护任务（`MaintenanceJob`，不是用户定义的定时任务）每小时删除上传超过 24 小时且没有引用的文件，`pg_try_advisory_xact_lock` 保证多副本只跑一份，删除时再次确认没有引用。
- 组件示例中心 `list_page` 的图片 / 附件也走文件中心（`image_urls` / `file_urls` 存文件地址，repository 写入时登记引用）；文件中心之前上传的旧文件仍可经 `/list-page/image/<filename>`、`/list-page/file/<filename>` 回读，不再接受新上传。
- 上传限制经公开的 `GET /api/admin/app-info` 下发（`upload.max_size` / `upload.allowed_types`），前端上传组件据此先在本地检查；超过 `MAX_CONTENT_LENGTH` 被 multipart 拦下的文件同样返回「文件过大，最大支持 N MB」。
- 公开演示模式放行 `POST /api/admin/files`（组件示例的上传要用），删除与列表仍按原规则。
- `@fastify/multipart`，上限 `MAX_CONTENT_LENGTH`（默认 16MB，超限 413）；文件名 `path.basename` + 白名单扩展名 + 随机前缀；回读时校验解析后的路径仍在上传目录内（防目录穿越）。

### 4.13 WebSocket `/ws/devtools`
- 握手阶段校验 Origin（同 Host 或 `CORS_ORIGINS` 白名单，无 Origin 放行）、已登录、`cc_devtools_perf_monitor` 权限，任一不满足直接关闭。
- 每秒推送 `{type:'metric', ...systemSnapshot()}`；收到消息回 `{...payload, type:'echo', server_ts}`；30s 无消息断开。`networkStats` 首次调用返回 0，需要预热一次。

### 4.14 静态资源与 SPA
- `@fastify/static` 服务 `apps/web/dist`（镜像内 `WEB_DIST_DIR`），`.js/.css/图片/字体` 加 `Cache-Control: public, max-age=604800`。
- `/health`：`SELECT 1` 成功返回 `{status:'healthy', timestamp, database:'connected'}`，否则 500。

### 4.15 配置
- `config.ts` 用 Zod 校验环境变量，运行环境由 `NODE_ENV` 决定（development / test / production）；启动时加载 `.env.<NODE_ENV>`（`apps/api/` 优先，其次仓库根目录；已有环境变量不覆盖）。
- 生产环境缺 `SECRET_KEY` / `ADMIN_PASSWORD` / `AI_SQL_DATABASE_URL` 即抛错退出（fail-closed）。
- 其余变量：`DATABASE_URL / DEV_DATABASE_URL / CORS_ORIGINS / SESSION_* / LOGIN_* / TASK_SCHEDULER_* / RUN_SCHEDULER_IN_WEB / ENABLE_TASK_SCHEDULER / AI_API_* / AI_SQL_* / MAX_CONTENT_LENGTH / APIFOX_*`，示例见 `.env.example`。
- 端口：开发 5001、测试 5002、生产 5000；Vite dev server 5173，把 `/api`、`/ws` 代理到 5001。

### 4.16 开放接口（API Token 与 Webhook）
- **API Token**（`common/api-token.ts`、`modules/admin/api-tokens`）：`ck_` + 32 字节 base64url，只存 sha256，列表显示前 11 位。`registerApiTokenResolver` 在会话解析之前运行：带 Bearer 的 `/api/` 请求只按 token 认证（开关 `security.api_tokens_enabled` 关闭 → 401「API Token 未开启」；无效 / 吊销 / 过期 / 创建人停用 → 401；命中 `API_TOKEN_DENIED` → 403「该接口不支持 API Token」），通过后设置 `request.apiToken`，会话解析与 CSRF 跳过。`isSignedIn` 把 token 视为已登录，`getCurrentAdminUser` 取创建人；`hasMenuPermission` 第一步检查 `apiToken.scopes`，之后才走超级管理员短路，因此权限 = scopes ∩ 创建人当前权限，数据权限按创建人。`last_used_at / last_used_ip` 每分钟最多写一次；操作日志记录 `api_token_id`。创建需要近期验证身份，scopes 只能是创建人拥有的编码。
- **Webhook**（`common/webhooks.ts`、`modules/admin/webhooks`）：模块用 `declareEvents` 登记事件；`app.events`（`EventBus`）的 `emit` 在业务事务提交后调用，为每个订阅匹配（精确名、`*`、`prefix.*`）且启用的 Webhook 写一行 `webhook_deliveries`，随后 `setImmediate` 在后台发送，自身从不抛错。`WebhookDispatcher.deliver` 用一条 `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING` 认领到期行（`pending` 且到了 `next_retry_at`，或 `delivering` 超过 5 分钟），web 进程与 worker 不会重复发送；调度器内置任务 `webhook-retry` 每 30 秒补发。失败重试间隔 1 分钟 / 5 分钟 / 30 分钟 / 2 小时 / 6 小时，第 6 次仍失败记为 `failed`；3xx 不跟随、算失败；超时 10 秒；响应体截断 2000 字符。签名 `X-Castor-Signature: sha256=HMAC-SHA256(secret, "<X-Castor-Timestamp>.<body>")`，`X-Castor-Delivery` 为事件 ID（手动重发沿用）。密钥 `whsec_…` 用 `secret-box` 加密；目标地址保存时经 `outboundHostReason` 检查，发送时 `createOutboundAgent` 在连接层复查实际 IP。

---

## 5. 数据库迁移

- 表定义在 `apps/api/src/db/schema/**`，迁移由 drizzle-kit 生成到 `apps/api/drizzle/`（`0000_baseline.sql` 为初始全量 DDL），执行记录在 `drizzle.__drizzle_migrations`。
- 所有 schema 变更：`pnpm db:generate --name <描述>`（drizzle-kit 不接受 `--`）→ 审查 SQL → `pnpm db:migrate` → `psql -d <库> -c '\d <table>'` 实证。
- **迁移必须真实落库**：静态检查（verify 的 `migration_chain`）不算完成；`migration_applied` 会比对 journal 与 `drizzle.__drizzle_migrations`，并用 `to_regclass` 确认模块表存在。交付报告注明「已迁移至 <tag>」。
- 不手写迁移 SQL（破坏 journal 链）；表结构上的关系（`menus.parent_id` 自引用 + `ON DELETE CASCADE`、`user_roles` / `role_menus` 复合主键中间表）在 Drizzle 里都显式查询，不做隐式加载。
- 插入显式 ID 后必须 `setval(pg_get_serial_sequence(...))` 同步序列（`seed-rbac` 已处理），否则后续新增会撞主键。

---

## 6. 导入导出

- 只支持 **csv / xlsx**：`SUPPORTED_TABLE_FILE_TYPES = ['csv', 'xlsx']`。上传 `.xls` 返回 `400 {error:'不支持 .xls 格式，请另存为 .xlsx 后重新上传'}`；导出 / 模板的 `file_type=xls` 按默认值 csv 处理。
- `common/tabular.ts`：`buildTable(headers, rows, baseFilename, fileType)` + `sendTable(reply, table)`（`Content-Disposition` 含 UTF-8 文件名，csv 带 BOM）；`readTableFile(file)`（5MB 上限、csv 去 BOM、rows 带行号）；`normalizeTableFileType()`；`sanitizeFormula()` 做公式注入防护（`^[=@+\t\r]|^-(?![0-9.])` 加 `'` 前缀）。
- 字段映射放在模块 `schema.ts` 的 `EXPORT_FIELD_MAP` / `IMPORT_HEADER_MAP`。
- 导入整批一个事务：有错误行时抛 `ServiceError('导入失败，存在错误数据', 400, { error_rows, error_count })` 整体回滚。
- 前端复用 `@/shared/components/data-transfer/ImportDialog` / `ExportDialog`。

---

## 7. 工具链（AI-First 的核心）

| 脚本 | 命令 | 说明 |
|---|---|---|
| `scripts/scaffold.ts` | `pnpm scaffold -- --name <name> --domain <admin\|component_center> --fields "..."` | 生成 `db/schema` + `modules/.../{schema,repository,service,routes}.ts` + 前端 api / 页面，自动注册并调用 drizzle-kit 生成迁移；字段类型映射见 `FIELD_TYPE_MAP`；`--data-scope` 接入数据权限 |
| `scripts/verify-feature.ts` | `pnpm verify -- --module <name> [--skip-build] [--json]` | 门禁：`typescript_compile`、`no_local_has_permission`、`migration_chain`、`migration_applied`、`docs_paths`（AI 文档引用路径存在）、`backend_file`、`data_scope_filter`（声明 `DATA_SCOPE` 的模块必须用 `dataScopeWhere`）、`frontend_page`、`frontend_api`、`router_registration`、`rbac_seed`、`frontend_build`、`frontend_tests`、`api_tests` 等 |
| `scripts/seed-rbac.ts` | `pnpm seed:rbac -- --incremental` | 菜单树唯一事实源；`--incremental` 按 code upsert 不删除，同步序列并刷新超级管理员权限；不带参数是全量重建（仅空库） |
| （内置）文件孤儿清理 | 调度器进程每小时一次 | 见 §4.12；`ENABLE_TASK_SCHEDULER=false` 时不运行 |
| `scripts/seed-demo.ts` | `pnpm seed:demo` | 示例部门树、两个受限角色（`dept_manager` 本部门及下级、`staff` 仅本人）和 6 个示例用户；按编码 / 用户名幂等更新，不删除、不改已有密码；`NODE_ENV=production` 需 `--force` |
| `scripts/init-ro-role.ts` | `pnpm --filter @castor-kit/api init-ro-role` | 创建 AI SQL 只读账号并按敏感表规则授权 |
| `scripts/setup-once.ts` | `pnpm setup-once` | `pg_advisory_lock` → migrate → seed-rbac（增量）→ init-ro-role，多副本并发安全 |
| `src/worker.ts` | `pnpm --filter @castor-kit/api worker` | 独立调度进程 |
| `scripts/generate-openapi.ts` | `pnpm openapi:generate` | 从 Fastify 路由补齐 `docs/apifox-full.openapi.json`：保留文档里已有的详细定义，只为缺失的路由补骨架（未做 Zod 全量生成） |
| `scripts/import-apifox.ts` | `pnpm openapi:apifox` | 推送到 Apifox |
| `apps/mcp/src/index.ts` | `pnpm mcp` | 工具：`get_project_context / get_menu_tree / scaffold_feature / run_verify / init_rbac / run_migration / list_templates`，内部调用上面的脚本 |
| `docs/templates/` | — | 后端 `db-schema / schema / repository / service / routes` 模板 + 前端 `list_page / detail_page`；占位符 `<Resource>/<resource>/<domain>/<domain_resource>` |

---

## 8. 部署与测试

### 8.1 部署
- **Dockerfile**：两阶段——`node:22-alpine` 构建 web（vite）与 api（tsup），`pnpm deploy --prod` 裁剪生产依赖 → 运行镜像 `node:22-alpine`，非 root `uid 10001`，`HEALTHCHECK curl /health`。
- **docker-entrypoint.sh**：`node dist/setup-once.js`（迁移 + RBAC 增量 + 只读账号）→ `node dist/main.js`。
- **docker-compose.yml**：`db`（postgres）+ `app`；`NODE_ENV=production`；`postgres_data` / `app_instance` 两个卷，卷名可用 `COMPOSE_DB_VOLUME` / `COMPOSE_INSTANCE_VOLUME` 覆盖以复用已有卷。
- **进程模型**：默认单进程；需要多核时用多副本 + `RUN_SCHEDULER_IN_WEB=false` + 单独 worker 服务。
- **setup.sh**：生成 `.env.production`（随机密钥）并用 compose 启动。
- **CI**（`.github/workflows/ci.yml`）：`pnpm install` → lint → typecheck → 空库 `setup-once` → api vitest（pg service）→ `pnpm verify --skip-build` → web 单测 → `vite build`。不做自动部署（部署在服务器上手动 `git pull && docker compose --env-file .env.production up -d --build`）；文档站（`website/`）由 `.github/workflows/docs.yml` 构建，合入 main 后发布到 GitHub Pages。

### 8.2 测试策略
- Vitest + 真实 PostgreSQL（本地 `castor_kit_test`，CI 用 `services: postgres`）；`test/global-setup.ts` 在测试库上执行迁移。
- 路由级测试用 `app.inject()`，按模块一个文件（`admin-*.test.ts`、`cc-*.test.ts`）。
- 契约测试 `contract.test.ts`：响应形状快照（`items/total/page/per_page`、`error`、`csrf_token`、时间格式）。
- 横切能力：`serialize` / `pagination` / `errors` / `tabular` / `request-meta` / `password-hash` / `scheduler-cron` / `scheduler-runner` / `scheduler-ssrf`；`scheduler-e2e.test.ts` 跑真实 60s 调度，需 `SCHEDULER_E2E=1`。
- 工具链：`scaffold` / `verify-feature` / `seed-rbac` / `setup-once` / `migration-chain`（journal 线性且每条有 SQL）/ `openapi`（生成结果与 docs 文件一致）/ `skills-sync`（`.claude/skills` 与 `.agents/skills` 一致）。
- web 与 mcp 各有自己的 Vitest 用例；`pnpm test` 全部运行。

---

## 9. 设计决定

以下行为均有测试覆盖，修改前先确认理由已不成立。

- **404 / 405**：未命中路由的 GET/HEAD → `/api/*` 返回 404 JSON，其余路径落 SPA；未命中的其他方法一律 `405 {error:'请求方法不允许'}`（含未知路径；只注册了 POST 的路径被 GET 是 404）。原因：SPA 需要对任意路径接受 GET，而写方法打到不存在的地址应明确告诉调用方方法不被接受。
- **`toIso()` 补齐 6 位微秒**：pg 的文本输出会去掉小数秒末尾的 0（如 `.68794`）；有小数部分时一律补到 6 位，保证同一时刻的输出稳定（整秒时不带小数部分，契约测试比较解析后的值）。
- **写操作整体回滚**：service 的写操作包在一个事务里，出错整体回滚；操作日志在 `onResponse` 里独立写入，不会把半截修改带进库。
- **SSRF 连接阶段复检**：除了保存时校验地址，执行时在 `connect.lookup` 阶段再检查一次解析结果（含 IPv4-mapped IPv6 等变体），防 DNS rebinding 和重定向到内网。
- **`setup-once` 用增量模式同步 RBAC**：容器每次启动都会跑 setup-once，全量重建会清空账号与角色，所以只 upsert 不删除。
- **AI SQL 原样执行**：用户 SQL 不走参数占位符，直接交给只读连接执行，所以 `LIKE '%x%'` 这类含 `%` 的语句可以正常运行；安全边界由只读连接、关键字拦截和敏感表过滤保证（§4.11）。
- **`jsonBody` 宽松**：非对象 JSON 体、非 JSON Content-Type 一律按 `{}` 处理，后续由 service 的必填校验返回 400，不产生 415 / 500。
- **定时任务地址校验返回 400 + 具体原因**：校验顺序在名称 / 编码 / Cron 之后；地址格式错误新增、编辑都返回 400「请求地址格式不合法」；域名解析到禁止网段时文案附带解析结果（如「不允许访问内网地址（localhost 解析为 127.0.0.1）」），方便用户自查。
- **成环校验**：菜单与树形列表修改父级时，不能改成自身或自己的子孙（400）；导入同样按最终父子关系检查，成环的行记为错误行、整批回滚。否则树接口会无限递归。
- **菜单树形搜索**：保留匹配节点及其祖先路径，匹配节点的子树完整返回，搜子菜单也能在树里定位到。
- **`.xls` 不支持**：只保留 csv / xlsx，减少一个老旧二进制格式的解析依赖；上传时给出明确提示（§6）。
- **cron 日/周 AND 语义**：见 §4.9，保证已有任务的下次执行时间计算稳定。
