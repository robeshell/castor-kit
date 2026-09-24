# castor-kit — AuraStack 的 Node.js 重写方案

> 状态：P0–P5 代码与自动化验收完成（2026-09-24）；待人工：浏览器手测前端页面、真实 Docker 镜像构建（本机无法访问 Docker Hub）、线上切换。结果汇总见文末 §15。
> 日期：2026-09-24
> 项目名：**castor-kit**（Castor = 河狸的拉丁属名，"自然界的工程师"；Kit = 脚手架/工具套件）。命名一律小写连字符，不用驼峰。
> 命名空间：GitHub 仓库 `castor-kit`；npm scope `@castor-kit/*`；已核实 npm / PyPI / GitHub 无同名项目。
> 范围：**新建仓库**，后端用 Node.js/TypeScript 重写 + 工具链 + 部署；前端 SPA 从 AuraStack 复制过来不改。AuraStack 仓库保留不动。

---

## 0. 一句话结论

**用 Node 22 + TypeScript + Fastify + Zod + Drizzle 重写后端，直接连接现有 PostgreSQL，API 契约字节级兼容，前端零改动；把 scaffold / verify / seed / OpenAPI / MCP 这套 AI-First 工具链一并迁到 TS。** 分 6 个阶段推进，新旧后端可并行跑在同一个库上，逐域切流。

---

## 1. 范围界定

| 部分 | 现状 | 决策 |
|---|---|---|
| 前端 `frontend/` | React 18 + Vite + Semi Design，已经是 Node 生态 | **不重写**。整体复制到新仓库的 `apps/web`，代码不改（UI 框架维持 Semi Design）；TS 化作为可选后续项 |
| 后端 `backend/` + `app.py` | Flask 3 + SQLAlchemy + Alembic | **重写**为 `apps/api`（Fastify + TS） |
| 数据库 | PostgreSQL，21 个 Alembic 迁移，表结构稳定 | **不动**。同库、同表、同列名，无数据迁移 |
| 工具链 `backend/scripts/*.py`、`mcp_server.py`、`docs/templates/` | Python | **重写**为 TS（这是项目的核心身份，不能丢） |
| 部署 Dockerfile / compose / CI / setup.sh | Python 运行时 + gunicorn | **重写**为 Node 运行时 |
| AI 上下文文档 AGENTS.md / CLAUDE.md / CODEX.md / `.cursor/` / `.windsurfrules` / `.github/copilot-instructions.md` / `.claude/`（`new-feature-autopilot` skill 按名调用 `verify_feature.py`）/ `.agents/` / `llms.txt` / `README*.md` / `website/`（VitePress 指南描述 Flask 安装，改动会触发 `docs.yml`） | 全是 Flask 特定内容 | **重写** |

不做的事：不上 Next.js/SSR（RBAC 后台 + 动态菜单路由，SSR 没有收益只有复杂度）；不做 GraphQL；不改 API 路径。

---

## 2. 硬性兼容契约（验收基线）

这一节是整个方案的约束，所有实现都以它为准。

### 2.1 数据库
- Node 后端连接**同一个** PostgreSQL 实例、同一套表；表名、列名、类型、索引、外键、`ON DELETE CASCADE/SET NULL` 语义全部保持。
- 不做任何数据迁移；`alembic_version` 表保留不动（无害），Drizzle 使用自己的 `__drizzle_migrations` 表。

### 2.2 HTTP 契约
- 路径：现有 **119 条**路由（含 `/ws/devtools`、`/health`、SPA fallback）原样保留，前缀仍为 `/api/admin/...`。
- 响应形状：
  - 列表 `{ items, total, page, per_page }`
  - 错误 `{ error: string, ...payload }`（5xx 一律 `服务器内部错误，请稍后重试`，不透传内部信息）
  - 登录 / `me` 响应携带 `csrf_token`
  - `/api/*` 下 404/405/500 均返回 JSON，不落 SPA
- 时间字段：沿用 Python `isoformat()` 风格 `YYYY-MM-DDTHH:mm:ss[.ffffff]`（**无 `Z` 后缀**，UTC 值；微秒为 0 时不带小数部分，所以是变长格式）。Node 端**不经过 `Date`**：`pg` 的 `timestamp` 类型解析器设为原样返回文本（`types.setTypeParser(1114, v => v)`），`toIso()` 把空格换成 `T`，并把小数秒右补 0 到 6 位（pg 文本输出会去掉末尾 0，如 `.68794`，Python 固定 `.687940`；P0 shadow-diff 实测），解决时区与微秒精度两个问题；禁止直接 `Date#toISOString()`。
- 数值字段：Python 侧 `Numeric` 经 `str(Decimal)` 输出为**字符串**（如 `"12.50"`），`pg` 返回的也是字符串，天然一致——`toDict()` 里**不要** `parseFloat`。`NaN` → `null` 的行为保留。
- 请求宽松度：Flask 处理器是 `request.get_json() or {}` + `data.get(...)`，空 body、多余字段、类型不对都被容忍并在 service 里 `parse_bool/parse_int` 归一化。**移植期请求 schema 一律 `.passthrough()` + 全字段可选**，归一化逻辑原样搬到 service；响应 schema 可以严格（它驱动 OpenAPI）。收紧校验是重写完成之后的独立任务，不在移植期做，否则会在边缘输入上破坏现有前端。
- 验收：`frontend/` 不改一行代码，对着新后端跑通全部页面；`docs/apifox-full.openapi.json` 与新后端生成的 OpenAPI 做 diff，差异为空（或仅为可解释的描述文本差异）。

### 2.3 密码哈希兼容（最容易被忽略、后果最严重的一项）
- 现有 `admin_users.password_hash` 是 werkzeug 格式：`pbkdf2:sha256:<iterations>$<salt>$<hex_digest>`。已核实：所有写入路径都显式传 `method='pbkdf2:sha256'`（无 scrypt 分支），开发库中实际值为 `pbkdf2:sha256:1000000`。
- Node 端必须实现该格式的解析与校验：`crypto.pbkdf2(password, salt, iterations, 32, 'sha256')`（**用异步版**，100 万次迭代同步执行会阻塞事件循环约 0.3–0.5s）+ `timingSafeEqual`。
- **并行运行期间新哈希也写成 werkzeug 格式**（Node 原生 `crypto` 即可，零依赖），保证两个后端互相可验；全量切换后再考虑 argon2id + 登录时懒升级。
- 不做这一条 = 切换当天所有账号登不进。

### 2.4 会话
- Flask 的 itsdangerous 签名 cookie 不可能被 Node 复用。切换时**强制一次重新登录**，明确告知即可。
- 新会话：`@fastify/secure-session`（无状态加密 cookie，运维模型和 Flask 一致：不需要 Redis/session 表）。它要求 32 字节密钥，而 `SECRET_KEY` 是任意长度字符串——用 `crypto.hkdfSync('sha256', SECRET_KEY, '', 'castor-kit-session', 32)` 派生，不要截断。Cookie 名为 `castor_session`（与 Flask 的 `session` 不同名，并行运行期两个后端不会互相覆盖）。Cookie 属性沿用：`HttpOnly`、`SameSite=Lax`、`Secure` 走 auto 策略（配置为空时按 `request.protocol === 'https'` 决定）、TTL `SESSION_TTL_HOURS`（默认 8h）。

---

## 3. 技术选型

### 3.1 推荐栈（一个明确的选择）

| 层 | 选型 | 为什么 |
|---|---|---|
| 运行时 | Node 22 LTS + TypeScript 5（strict） | 类型即文档，AI 生成代码的错误在 `tsc` 阶段就暴露 |
| 包管理 | pnpm workspaces（monorepo） | `apps/api`、`apps/web`、`apps/mcp`、`packages/shared` 共享 lockfile 和脚本 |
| Web 框架 | **Fastify 5** | 显式、无装饰器魔法、插件模型和 Flask Blueprint 一一对应；内置 JSON schema 校验 + OpenAPI 生成；性能好 |
| 校验/序列化 | **Zod** + `fastify-type-provider-zod` | 一份 schema 同时产出：请求校验、TS 类型、OpenAPI 文档（替代 `generate_openapi.py` 手写） |
| ORM | **Drizzle ORM** + drizzle-kit | 表定义即代码（和现在 `build_xxx_models(db)` 的风格最接近）、SQL 透明、`introspect` 可从现库直接反推 schema、迁移是纯 SQL 文件（可审查） |
| DB 驱动 | `pg`（node-postgres）| 成熟；需自定义 `timestamp` 解析（见风险表） |
| 日志 | pino（Fastify 内置） | 结构化 JSON 日志 |
| 会话 | `@fastify/secure-session` | 见 2.4 |
| 其他插件 | `@fastify/cookie`、`@fastify/cors`、`@fastify/compress`、`@fastify/static`、`@fastify/multipart`、`@fastify/websocket`、`@fastify/rate-limit`（可选） | 逐一替代 Flask-CORS / Flask-Compress / send_from_directory / flask-sock。`Flask-Caching` 在 `app.py` 里初始化了但业务代码没有任何使用，**不移植** |
| 定时 | 自研 runner（复刻现有租约模型）+ 移植现有手写 cron 匹配器 | 现有 lease/claim 设计已经是多副本安全的，直接移植；cron 语义非标准（见 5.6），不能换第三方库 |
| 表格 | `csv-parse` / `csv-stringify` + `exceljs`（xlsx） | `.xls` 已决定放弃，见 5.9 |
| 系统指标 | `systeminformation` | psutil 等价 |
| 测试 | Vitest + 真实 PostgreSQL（testcontainers 或本地库） | 现有 `TestingConfig` 用 SQLite 内存库，**不沿用**：AI SQL 只读引擎、序列同步、advisory lock 都是 pg 特有 |
| 代码质量 | ESLint + Prettier + `tsc --noEmit` | 纳入 verify 门禁 |

### 3.2 备选（一行说明为什么没选）
- **NestJS**：模块结构更强制，但装饰器 + DI 魔法多，AI 从模板生成时出错率更高，且启动慢；如果团队更看重"强制分层"可以换，分层映射不变。
- **Hono / Express**：Hono 太轻（生态和 OpenAPI 集成弱），Express 无内置校验和类型支持。
- **Prisma**：DX 好，但 schema DSL 与现库 introspect 后需要大量手工修正（自引用、复合主键中间表、`Numeric`），且查询构造对复杂 `ilike`/动态过滤不如 Drizzle 直接。
- **Kysely**：纯 query builder，没有 schema 迁移工具链。

---

## 4. 仓库结构与分层映射

### 4.1 目标目录

```
castor-kit/
├── package.json                    # pnpm workspaces 根（name: castor-kit）
├── pnpm-workspace.yaml
├── apps/
│   ├── api/                        # @castor-kit/api ← 替代 app.py + backend/
│   │   ├── src/
│   │   │   ├── main.ts             # 启动入口（web 模式）
│   │   │   ├── worker.ts           # 独立调度器进程入口（替代 run_scheduler_worker.py）
│   │   │   ├── app.ts              # buildApp()：注册插件/路由/错误处理/静态资源
│   │   │   ├── config.ts           # 多环境配置（fail-closed 校验，替代 config.py）
│   │   │   ├── common/
│   │   │   │   ├── auth.ts         # loginRequired / hasMenuPermission / menuPermissionRequired
│   │   │   │   ├── rbac.ts         # 纯函数：isSuperAdmin / userHasMenuCode / collectMenuCodes
│   │   │   │   ├── csrf.ts         # 双提交校验 hook
│   │   │   │   ├── pagination.ts   # parsePagination（MAX_PER_PAGE=200）
│   │   │   │   ├── request-meta.ts # clientIp / userAgent / safePayload（脱敏）
│   │   │   │   ├── tabular.ts      # csv/xlsx 读写 + 公式注入防护 + 5MB 上限
│   │   │   │   ├── errors.ts       # ServiceError + 统一错误处理器
│   │   │   │   ├── serialize.ts    # toIso() 等，对齐 Python 输出格式
│   │   │   │   └── scheduler/      # ScheduledTaskRunner（租约模型）
│   │   │   ├── db/
│   │   │   │   ├── client.ts       # pg Pool + drizzle 实例 + 类型解析器
│   │   │   │   ├── readonly.ts     # AI SQL 专用只读 Pool
│   │   │   │   ├── schema/         # ← model 层（Drizzle 表定义，按域分文件）
│   │   │   │   │   ├── admin/{rbac,audit-logs,dicts,scheduled-task,notification,announcement}.ts
│   │   │   │   │   ├── component-center/{list-page,card-list-page,...}.ts
│   │   │   │   │   └── index.ts    # 汇总导出（drizzle-kit 需要）
│   │   │   │   └── migrate.ts      # 迁移执行器（含 baseline 逻辑）
│   │   │   ├── modules/
│   │   │   │   ├── admin/
│   │   │   │   │   ├── router.ts   # 域内路由装配
│   │   │   │   │   └── users/
│   │   │   │   │       ├── schema.ts      # Zod：请求/响应/导入导出字段映射
│   │   │   │   │       ├── repository.ts  # ← crud 层（纯 DB 操作）
│   │   │   │   │       ├── service.ts     # ← service 层（业务逻辑）
│   │   │   │   │       └── routes.ts      # ← api 层（Fastify 路由 + 权限）
│   │   │   │   └── component_center/...
│   │   │   └── router.ts           # 一级装配：registerAdminRoutes + registerComponentCenterRoutes
│   │   ├── drizzle/                # SQL 迁移 + meta/_journal.json
│   │   ├── scripts/                # 工具链（见 §7）
│   │   ├── test/                   # Vitest
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   ├── web/                        # @castor-kit/web ← 原 frontend/，原样复制
│   └── mcp/                        # @castor-kit/mcp ← 原 mcp_server.py
├── packages/
│   └── shared/                     # @castor-kit/shared：前后端共享的 Zod schema / 类型 / 权限编码常量
├── docs/
│   ├── templates/{backend,frontend}/   # TS 模板
│   └── apifox-full.openapi.json        # 由 Zod schema 自动生成
├── Dockerfile / docker-compose.yml / docker-entrypoint.sh / setup.sh
└── AGENTS.md / CLAUDE.md / ...
```

**为什么 model 层集中放在 `db/schema/`，其余三层按功能文件夹放？** Drizzle 需要一个统一的 schema 导出给 drizzle-kit 和 relations；而 repository/service/routes 按功能就近放置，AI 生成一个新功能时只需在一个目录下创建 4 个文件 + 1 个 schema 文件，比按层分散到 5 个目录更不容易漏。

### 4.2 分层映射

| Flask 现状 | Node 目标 | 职责 | 禁止 |
|---|---|---|---|
| `model/entities_*.py`（`build_xxx_models(db)`） | `db/schema/<domain>/<name>.ts`（`pgTable(...)`）+ `toDict()` 序列化函数 | 表结构 + 序列化 | 业务逻辑 |
| `schema/*.py`（marshmallow / 手写 parse） | `modules/.../schema.ts`（Zod + `EXPORT_FIELD_MAP` / `IMPORT_HEADER_MAP`） | 校验、类型、导入导出映射 | DB 操作 |
| `crud/*.py` | `modules/.../repository.ts` | 纯 DB 读写（Drizzle 查询） | 业务逻辑、HTTP |
| `service/*.py` | `modules/.../service.ts` | 业务逻辑，抛 `ServiceError(message, status, payload)` | 直接碰 HTTP 对象 |
| `api/*.py`（`init_xxx_api(bp, db, models)`） | `modules/.../routes.ts`（`export async function registerXxxRoutes(app)`） | 路由 + 权限检查 + 调 service | 直接写 SQL |
| `api/router.py` | `modules/<domain>/router.ts` | 域内注册 | — |
| `backend/app/router.py` + `__init__.py` | `src/router.ts` + `db/schema/index.ts` | 一级装配 | — |
| `backend/common/*` | `src/common/*` | 横切能力 | — |

### 4.3 反模式清单（Node 版）

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

## 5. 横切能力移植清单

每项列出 Node 机制和容易踩的坑。

### 5.1 认证与会话
- `loginRequired` preHandler：`request.session.get('logged_in')` 为空 → `/api/*` 返回 `401 {error:'未授权访问', redirect:'/admin/login'}`。
- `getCurrentAdminUser()`：每请求缓存在 `request.currentUser`，一次查询 join `user_roles → roles → role_menus → menus`（Drizzle relations 或手写 join），避免 N+1。
- 登录防爆破：沿用基于 `login_logs` 的窗口计数（IP 维度 + 用户名维度，`LOGIN_MAX_FAILURES`/`LOGIN_LOCKOUT_MINUTES`），成功后清零窗口内失败记录。
- 密码：见 §2.3。

### 5.2 CSRF
- `onRequest` hook：仅 `/api/*` 的 `POST/PUT/PATCH/DELETE`；`/api/admin/login` 豁免；未登录跳过；`X-CSRF-Token` 与 session 中 token 用 `timingSafeEqual` 比对，失败 `403 {error:'CSRF 校验失败，请刷新页面后重试'}`。
- `ensureCsrfToken()` 在 login / me / csrf-token 三处返回。

### 5.3 RBAC
- `common/rbac.ts` 纯函数原样移植；`super_admin` 短路。
- 菜单 `component` 字段格式 `<module>/<subdir>/<page>` 不变，前端 `App.jsx` 的 glob 解析不受影响。

### 5.4 分页 / 错误 / JSON
- `parsePagination(query)`：page ≥ 1，1 ≤ per_page ≤ 200。
- 统一 `setErrorHandler`：`ServiceError` → `{error, ...payload}`；Zod 校验失败 → 400 `{error: <首条消息>}`（保持单一 `error` 字符串，不引入新形状）；未知异常 → 500 通用文案 + pino 记录堆栈。
- `setNotFoundHandler`：`/api/*` → `404 {error:'资源不存在'}`；其余走 SPA `index.html`。405 需要额外处理（Fastify 默认对方法不匹配返回 404）。~~在 not-found handler 里检查同路径是否有其他方法注册~~——P0 对 Flask 实测：它的 SPA catch-all 路由对任意路径接受 GET，所以规则是**未命中的 GET/HEAD → 404（/api）或 SPA；未命中的其他方法一律 `405 {error:'请求方法不允许'}`**（含未知路径；只注册了 POST 的路径被 GET 是 404）。
- 反代：`trustProxy: true`（或具体 hop 数）替代 `ProxyFix`；`request.ip` 即真实 IP，不手动读 `X-Forwarded-For`。

### 5.5 审计日志
- `OperationLog` 现状是**集中式**写入：`api/logs.py` 里注册了 Blueprint 级 `after_request` 钩子 `auto_record_operation_log`，由 `LogsService.record_operation_from_request(request, response, username)` 根据路径/方法推断 `module/action/target_id` 并落库（异常吞掉不影响响应）。Node 对应为 logs 模块注册一个全局 `onResponse` hook，推断规则原样移植；**不要**散落到各 service。
- `LoginLog` 以及登录/登出两条 `OperationLog` 是显式写在 auth service 里的，保持不变。
- `safePayload()` 脱敏键集合 `{password, old_password, new_password, confirm_password, secret, token, access_token, api_key, authorization}` + 2000 字符截断，原样移植。

### 5.6 定时任务调度器
- 保留 `scheduled_tasks` 的 `next_run_at / last_status / updated_at` 租约语义：
  - claim：`UPDATE scheduled_tasks SET next_run_at=NULL, last_status='running', updated_at=now WHERE id=$1 AND is_active AND next_run_at=$2` → `rowCount===1` 才算抢到。
  - 过期回收：`last_status='running' AND next_run_at IS NULL AND updated_at <= now - lease` → 重置为 `idle` 并 `next_run_at=now`。
  - 执行崩溃：按 cron 算下次时间，`last_status='failed'`。
- 两种运行方式：`RUN_SCHEDULER_IN_WEB=true` 时在 web 进程内启 `setInterval` 循环（默认 20s）；否则用 `node dist/worker.js` 独立进程。
- cron 解析：**不要用 `cron-parser`/`croner`**。现有 `parse_cron_expression` + `compute_next_run_at` 是手写的 5 段匹配器（分 时 日 月 周），"日"与"周"是 **AND** 关系，而 Vixie/标准 cron 在两者都受限时是 OR 关系（如 `0 0 1 * 1` 语义不同）；周字段 Sunday=0。逐分钟向前扫描最多 366 天，UTC。这段逻辑约 60 行，原样移植成 `common/scheduler/cron.ts`，并把现有用例搬成 vitest 快照，保证已有任务的 `next_run_at` 计算结果不变。
- SSRF 防护：移植 `validate_request_url`——只允许 http/https、禁止 localhost/私网/链路本地/元数据地址；执行时用 `undici` 自定义 `connect.lookup` 把解析结果钉死并复检，防 DNS rebinding；`timeout_seconds` 1–120 用 `AbortSignal.timeout`。
- HTTP 执行用 `undici.fetch`，响应体截断后写 `scheduled_task_runs`。

### 5.7 AI 对话（SSE）
- `POST /api/admin/component-center/ai/chat/stream`：`undici.fetch` 上游 OpenAI 兼容接口（`AI_API_BASE/chat/completions`，`stream:true`），逐行解析 `data:`，转发为 `data: {"content": "..."}\n\n`，结束 `data: [DONE]\n\n`。
- 上游非 200 不透传响应体，只给 `AI 服务暂时不可用（<status>）`；超时 60s；异常给通用文案。
- 响应头 `Content-Type: text/event-stream`、`Cache-Control: no-cache`、`X-Accel-Buffering: no`；使用 `reply.raw` 流式写，记得 `hijack()`。
- 系统提示词里的技术栈描述要改成 Node 版。

### 5.8 AI 数据查询（只读引擎）
- 独立 `pg.Pool`，`options: '-c default_transaction_read_only=on -c statement_timeout=<ms>'`；每次查询前再 `SET LOCAL default_transaction_read_only=on; SET LOCAL statement_timeout=...`（抵消池化连接被 `set_config` 污染）。
- SQL 包裹 `SELECT * FROM (<sql>) AS _q LIMIT 200`。
- 生产环境 `AI_SQL_DATABASE_URL` 缺失 → 启动失败（fail-closed）；开发环境回退主库 URL 但仍带只读参数。
- 敏感表过滤 `isVisibleTable()`：`roles/menus/user_roles/role_menus` 精确、`admin_*/audit_*/scheduled_task*` 前缀、`*_logs` 后缀。
- schema 读取改用 `information_schema.columns` 查询（替代 SQLAlchemy inspector）。
- 关键字拦截前先剥离字符串字面量（移植 `_strip_literals`）。
- `init_ai_sql_ro_role` 脚本移植：创建 `aurastack_ro` 并只授业务表 SELECT。

### 5.9 表格导入导出
- csv：`csv-parse`（BOM 处理）/ `csv-stringify`；xlsx：`exceljs`。
- 公式注入防护正则 `^[=@+\t\r]|^-(?![0-9.])` 加 `'` 前缀；导入文件 5MB 上限；`build_table_response` → `sendTable(reply, headers, rows, baseFilename, fileType)`（设置 `Content-Disposition` 含 UTF-8 文件名）。
- **`.xls`（BIFF8）已决定放弃**（2026-09-24 拍板选 A）：只支持 csv / xlsx。`normalizeTableFileType()` 的合法值收窄为 `('csv','xlsx')`；上传 `.xls` 返回 `400 {error:'不支持 .xls 格式，请另存为 .xlsx 后重新上传'}`；导出/模板下载的 `file_type=xls` 参数按默认值 csv 处理。前端 `ImportCsvModal` / `ExportFieldsModal` 里的 xls 选项去掉（这是前端唯一需要改的一处，且是删选项不是改逻辑）。

### 5.10 文件上传
- `list_page` 有 `upload-image` / `upload-file` 两个端点，写入 `instance/uploads/list_page{,_files}/`，通过 `/list-page/image/<filename>`、`/list-page/file/<filename>` 回读（compose 挂载 `app_instance` 卷）。
- Node：`@fastify/multipart`（`limits.fileSize` = 16MB 对齐 `MAX_CONTENT_LENGTH`），文件名做 `path.basename` + 白名单扩展名 + 随机前缀；回读用 `reply.sendFile` 并校验解析后的路径仍在上传目录内（防目录穿越）。
- 目录路径保持 `instance/uploads/...`，卷挂载不变。

### 5.11 WebSocket `/ws/devtools`
- `@fastify/websocket`；握手阶段校验 Origin（同 Host 或 `CORS_ORIGINS` 白名单，无 Origin 放行）、session 已登录、`cc_devtools_perf_monitor` 权限，任一不满足直接 `socket.close()`。
- 每秒推送 `{type:'metric', ...systemSnapshot()}`；收到消息回 `{...payload, type:'echo', server_ts}`；30s 无消息断开。
- 指标用 `systeminformation`（`currentLoad / mem / fsSize / networkStats`），字段名和单位（MB/GB/百分比）与现在一致。注意 `networkStats` 首次调用返回 0，需要预热一次。

### 5.12 静态资源与 SPA
- `@fastify/static` 服务 `apps/web/dist`，`.js/.css/图片/字体` 加 `Cache-Control: public, max-age=604800`；`/api/*` 永远不落到 `index.html`。
- `/health`：`SELECT 1` 成功返回 `{status:'healthy', timestamp, database:'connected'}`，否则 500。

### 5.13 配置
- `config.ts` 用 Zod 校验环境变量；`NODE_ENV=production` 时 `SECRET_KEY`、`ADMIN_PASSWORD`、`AI_SQL_DATABASE_URL` 缺失即抛错退出（对齐现有 fail-closed）。
- 变量名映射：`FLASK_ENV→NODE_ENV`；其余 `DATABASE_URL / DEV_DATABASE_URL / SECRET_KEY / ADMIN_PASSWORD / CORS_ORIGINS / SESSION_TTL_HOURS / LOGIN_* / TASK_SCHEDULER_* / RUN_SCHEDULER_IN_WEB / ENABLE_TASK_SCHEDULER / AI_API_* / AI_SQL_* / MAX_CONTENT_LENGTH / APIFOX_*` 全部保留原名。
- 端口：开发 5001、生产 5000，Vite proxy 配置不动。

---

## 6. 模块清单

| 域 | 模块 | 现有文件 | 目标目录 | 难度 | 备注 |
|---|---|---|---|---|---|
| admin | auth | api/service/crud/schema/auth.py | `modules/admin/auth/` | ★★★ | 密码哈希兼容、防爆破、CSRF、session |
| admin | users | users.py | `modules/admin/users/` | ★ | 标准 CRUD + 导入导出 |
| admin | roles | roles.py | `modules/admin/roles/` | ★★ | `menu_ids` 多对多写入 |
| admin | menu | menu.py | `modules/admin/menu/` | ★★ | 自引用树、`/sort`、`/my-menus` 权限过滤 |
| admin | logs | logs.py | `modules/admin/logs/` | ★ | 登录/操作日志列表 + 导出 |
| admin | dicts | dicts.py | `modules/admin/dicts/` | ★ | 字典组/项、`/options` |
| admin | scheduled_task | scheduled_task.py + common/scheduler.py | `modules/admin/scheduled-task/` + `common/scheduler/` | ★★★ | 租约调度、SSRF、`/run` 手动触发、`/runs` |
| admin | notification | notification.py | `modules/admin/notification/` | ★ | 未读数、已读、全部已读 |
| admin | announcement | announcement.py | `modules/admin/announcement/` | ★ | 发布/撤回、`export-fields` |
| admin | dashboard | dashboard.py | `modules/admin/dashboard/` | ★ | 聚合统计 |
| cc | list_page | list_page.py（最大） | `modules/component_center/list-page/` | ★★★ | 版本历史 + 回滚、run-preview、图片/文件上传与回读、JSON 字段解析 |
| cc | stats_list_page | stats_list_page.py | `.../stats-list-page/` | ★ | `/stats` 聚合 |
| cc | card_list_page | card_list_page.py | `.../card-list-page/` | ★ | 标准 CRUD |
| cc | tree_list_page | tree_list_page.py | `.../tree-list-page/` | ★★ | `/tree` 递归组装 |
| cc | dynamic_form_page | dynamic_form_page.py | `.../dynamic-form-page/` | ★★ | 表单 + 字段子表 |
| cc | kanban_page | kanban_page.py | `.../kanban/` | ★★ | boards/columns/cards、`reorder` 事务 |
| cc | detail_tabs_page | detail_tabs_page.py | `.../detail-tabs/` | ★ | members 子资源 |
| cc | gantt_page | gantt_page.py | `.../gantt/` | ★ | tasks |
| cc | advanced_table_page | advanced_table_page.py | `.../advanced-table/` | ★★ | batch-update/delete、reorder、stats |
| cc | map_heatmap | map_heatmap.py | `.../map-heatmap/` | ★ | 只读数据 |
| cc | ai_chat | ai_chat.py | `.../ai-chat/` | ★★ | SSE 流 |
| cc | ai_prompt | ai_prompt.py + entities_ai_prompt.py | `.../ai-prompt/` | ★ | 模板 CRUD + preview |
| cc | ai_sql | ai_sql.py + ai_sql_engine.py | `.../ai-sql/` + `db/readonly.ts` | ★★★ | 只读引擎、schema 暴露过滤、关键字拦截 |
| cc | devtools | devtools.py | `.../devtools/` | ★★ | perf-stats + WebSocket |

纯前端页面（creative/*、websocket_page、perf_monitor_page 的 UI 部分、heatmap、realtime_chart）无后端工作。

---

## 7. 工具链（AI-First 的核心，必须同步重写）

| 现有 | 目标 | 说明 |
|---|---|---|
| `scaffold.py` | `apps/api/scripts/scaffold.ts`（`pnpm scaffold --name customer --domain admin --fields "name:str,phone:str"`） | 生成 `db/schema/<domain>/<name>.ts`、`modules/<domain>/<name>/{schema,repository,service,routes}.ts`、前端 `api/<name>.js` + 页面；字段类型映射表移植（`str→varchar(100)`, `text→text`, `int→integer`, `float→numeric(10,2)`, `bool→boolean`, `date→date`, `datetime→timestamp`） |
| `verify_feature.py` | `apps/api/scripts/verify-feature.ts`（`pnpm verify --module <name> [--skip-build] [--json]`） | 检查项：① `tsc --noEmit` ② routes/repository/service 文件存在 ③ 前端页面 + api 文件存在 ④ `router.ts` 与 `db/schema/index.ts` 注册 ⑤ `seed-rbac.ts` 含权限编码 ⑥ drizzle journal 线性且每条有 SQL 文件 ⑦ OpenAPI 与生成结果一致（告警）⑧ `vite build`（可选）⑨ vitest（可选）⑩ ESLint |
| `init_rbac_data.py --incremental` | `scripts/seed-rbac.ts --incremental` | 菜单树数据结构原样搬（**ID 一个都不能改**，含历史遗留 31/33/34/35/36/37/100002/100003）；插入后 `setval(pg_get_serial_sequence(...))` 同步序列；`--incremental` 只 upsert 不删除 |
| `init_ai_sql_ro_role.py` | `scripts/init-ro-role.ts` | 创建只读账号并按 `isVisibleTable` 授权 |
| `run_setup_once.py` | `scripts/setup-once.ts` | `pg_advisory_lock(0x41555341)` → migrate → seed-rbac → init-ro-role |
| `run_scheduler_worker.py` | `src/worker.ts` | 独立调度进程 |
| `generate_openapi.py` | `scripts/generate-openapi.ts` | 从 Fastify + Zod 路由 schema 自动生成（`@fastify/swagger`），写入 `docs/apifox-full.openapi.json`——这是重写最直接的收益之一：文档不再靠手写维护 |
| `import_openapi_to_apifox.py` | `scripts/import-apifox.ts` | HTTP 推送，逻辑不变 |
| `mcp_server.py` | `apps/mcp/src/index.ts`（`@modelcontextprotocol/sdk`） | 工具集不变：`get_project_context / get_menu_tree / scaffold_feature / run_verify / init_rbac / run_migration / list_templates`，内部改为调用上面的 TS 脚本 |
| `docs/templates/backend/*.py` | `docs/templates/backend/{schema,repository,service,routes}.ts` | 占位符 `<Resource>/<resource>/<domain>/<domain_resource>` 约定不变 |
| `docs/templates/frontend/*` | 不变 | — |
| Alembic `backend/migrations/` | `apps/api/drizzle/` | 见 §8 |

---

## 8. 数据库 schema 与迁移策略

1. `drizzle-kit introspect` 对着现库生成初版 `db/schema/**`，然后**手工整理**为按域分文件、加 relations、加 `toDict()`。重点核对：
   - `menus.parent_id` 自引用 + `ON DELETE CASCADE`
   - `user_roles` / `role_menus` 复合主键中间表
   - `Numeric(10,2)`、`Text` 存 JSON 字符串的字段
   - 现有 `lazy='dynamic'` 关系（`children`、`runs`、`roles.users`）在 Drizzle 里全部显式查询，不做隐式加载
2. 生成 `drizzle/0000_baseline.sql`（等价于当前 Alembic head 的全量 DDL）。
3. `migrate.ts` 启动逻辑：若库中存在 `alembic_version` 且 `__drizzle_migrations` 为空 → 把 baseline 标记为已应用（只写记录不执行 DDL）；全新库 → 正常执行 baseline。
4. 之后所有 schema 变更走 `drizzle-kit generate` → 审查 SQL → `pnpm db:migrate`；交付报告仍必须注明「已迁移至 <tag>」并用 `psql \d` 实证（沿用现有"迁移必须落库"规则）。
5. `alembic_version` 表保留到切换完成后再删。

---

## 9. 测试移植

| 现有 pytest | Vitest 目标 | 备注 |
|---|---|---|
| test_csrf.py | `test/csrf.test.ts` | 用 `app.inject()` |
| test_pagination.py | `test/pagination.test.ts` | 纯函数 |
| test_tabular.py | `test/tabular.test.ts` | 公式注入、类型识别、5MB |
| test_safe_payload.py | `test/request-meta.test.ts` | 脱敏 |
| test_ai_sql_safety.py | `test/ai-sql.test.ts` | 需真实 pg：只读、LIMIT 包裹、敏感表、字面量剥离 |
| test_scheduled_task_ssrf.py | `test/scheduler-ssrf.test.ts` | 私网/localhost/元数据地址拦截 |
| test_migration_chain.py | `test/migration-chain.test.ts` | 校验 `drizzle/meta/_journal.json` |
| test_openapi_doc.py | `test/openapi.test.ts` | 生成结果与 docs 文件一致 |
| （新增） | `test/password-hash.test.ts` | werkzeug 格式解析/校验/生成往返 |
| （新增） | `test/contract.test.ts` | 对 2.2 的响应形状做快照断言（items/total/page/per_page、error、csrf_token、时间格式） |

测试库：本地 `aurastack_test` 或 testcontainers 起 postgres；CI 用 `services: postgres`。

---

## 10. 部署与环境

- **Dockerfile**：三阶段——`node:22-alpine` 构建 web（`vite build`）→ 构建 api（`tsc` 或 `tsup`，`pnpm deploy --prod` 精简依赖）→ 运行镜像 `node:22-alpine`，非 root `uid 10001`，`HEALTHCHECK curl /health`，`ENTRYPOINT ./docker-entrypoint.sh`（`node scripts/setup-once.js && node dist/main.js`）。
- **docker-compose.yml**：`FLASK_ENV: production` → `NODE_ENV: production`，其余环境变量同名保留；`app_instance` 卷不变。
- **进程模型**：默认单进程（Node 事件循环足够）；需要多核时用 `node --cluster` 或多副本 + `RUN_SCHEDULER_IN_WEB=false` + 单独 worker 服务，避免多副本重复调度（现有租约模型本身也能容忍）。
- **CI**（`.github/workflows/ci.yml`）：`pnpm install` → `pnpm -r lint` → `tsc` → vitest（带 pg service）→ `pnpm verify --skip-build` → `vite build`。
- **deploy.yml**：不变（`git pull && docker compose up -d --build`）。
- **setup.sh**：把 `FLASK_ENV` 改 `NODE_ENV`，其余文案微调。
- **启动AuraStack.command**：改为 `pnpm dev`。

---

## 11. 分阶段实施与验收门禁

新旧后端可以**同时**跑：Flask 5001、Node 5002（临时），同一个数据库。

**注意：不能按路径前缀在 Vite proxy 里切流。** 前端只登录一次、只持有一个会话 cookie，Node 读不懂 Flask 的签名 cookie（§2.4），任何被单独代理到 Node 的鉴权接口都会 401。正确做法：
1. P0 的 auth 模块验收通过后，把 **整个 `/api`**（含 `/ws`）代理切到 Node；前端从此只对 Node 说话。
2. Flask 留作**参考 oracle**：写一个 `scripts/shadow-diff.ts`，分别登录两个后端，对同一批请求（GET 列表/详情、导出等只读接口，以及在事务里回滚的写接口）取响应做 JSON diff，输出差异报告。这比"前端看起来正常"强得多，也是 §2.2 契约的直接验证手段。
3. 每个阶段以 shadow-diff 无差异 + 前端页面手测通过作为门禁；P5 之后删除 Flask。

| 阶段 | 内容 | 验收 |
|---|---|---|
| **P0 骨架** | monorepo、`apps/api` 骨架、config、db client、Drizzle schema（introspect + 整理）、baseline 迁移、session、CSRF、RBAC、错误处理、静态/SPA、`/health`、auth 模块（登录/登出/me/改密/csrf-token）、密码兼容 | 前端指向 Node 能登录、能拿到 `my-menus`、侧边栏正常；`contract.test` 通过 |
| **P1 admin 域** | users / roles / menu / logs / dicts / notification / announcement / dashboard | 系统管理 8 个页面全部可用；导入导出一致 |
| **P2 component_center CRUD** | 9 个管理类页面 + map_heatmap + ai_prompt（含 list_page 上传/版本） | 对应页面全部可用；OpenAPI diff 为空 |
| **P3 流式/实时/特殊** | scheduled_task + runner、ai_chat SSE、ai_sql 只读引擎、devtools WS + perf | 定时任务能按 cron 触发并记录 runs；AI 对话流式输出；AI SQL 拒绝写操作；WS 每秒推指标 |
| **P4 工具链 + 文档** | scaffold / verify / seed-rbac / setup-once / generate-openapi / apifox / mcp / templates；重写 AGENTS.md、CLAUDE.md、CODEX.md、.cursor、.windsurfrules、copilot-instructions | 用 scaffold 生成一个示例模块 → verify 全绿 → 能在菜单中打开 |
| **P5 部署 + 切换** | Dockerfile / compose / entrypoint / CI / setup.sh；线上部署从 AuraStack 镜像切到 castor-kit 镜像（同一个数据库卷）；`alembic_version` 清理；AuraStack 仓库归档 | `bash setup.sh` 从零起一套能用；CI 全绿；线上切换后强制重登一次 |

---

## 12. 风险表

| 风险 | 影响 | 对策 |
|---|---|---|
| werkzeug 密码哈希不兼容 | 切换后全员无法登录 | §2.3；P0 就写 `password-hash.test.ts`，用现库真实哈希验证 |
| `pg` 驱动默认把 `timestamp without time zone` 按本地时区解析成 `Date`，且 `Date` 只有毫秒精度 | 时间偏移 8 小时；微秒被截断，无法复现 Python `isoformat()` | `types.setTypeParser(1114, v => v)` 保留文本，`toIso()` 替换空格为 `T` 并补齐 6 位小数秒（§2.2）；`contract.test` 比较**解析后的值**而不是定宽字符串（微秒为 0 时 Python 不输出小数部分） |
| `Numeric` 列类型表现 | — | 已核实两侧都是字符串（Python `str(Decimal)`），无风险；`toDict()` 保持字符串即可 |
| Drizzle introspect 对自引用/复合主键/`onDelete` 还原不完整 | 迁移或级联行为偏差 | introspect 后人工比对 `\d` 输出；baseline 用 `pg_dump --schema-only` 交叉校验 |
| 历史遗留菜单 ID（31/33–37/100002/100003）被重排 | `role_menus` 引用断裂、用户丢权限 | seed 脚本以 ID 为主键 upsert，明文注释禁止改动；测试断言这些 ID 存在 |
| 显式 ID 插入后序列未同步 | 新建菜单主键冲突 | seed 后 `setval`；已有逻辑原样移植 |
| `.xls` 支持缺口 | 用户上传 xls 失败 | 已决定放弃，返回明确的 400 提示（§5.9） |
| 时间格式（`isoformat` vs `toISOString`）不一致 | OpenAPI diff 不为空、前端解析差异 | 统一 `toIso()`，ESLint 规则禁用 `toISOString` |
| Fastify 默认无 405 | 契约细节偏差 | not-found handler 中按 Flask catch-all 语义补 405（§5.4） |
| SSE 在 Fastify 需 `hijack` 并手动管理流 | 连接不关闭 / 内存泄漏 | 监听 `request.raw.on('close')` 中止上游 fetch |
| 多副本 + web 内调度器 | 任务重复执行 | 租约模型已防重；生产建议 `RUN_SCHEDULER_IN_WEB=false` + 单 worker |
| AI SQL 只读引擎在开发环境回退主库 | 本地误操作 | 连接参数仍强制只读；生产 fail-closed |
| 并行运行期两个后端同时写 `login_logs`/`operation_logs` | 无冲突（追加写） | 无需处理；但 session 互不认，测试时分浏览器 |
| 前端 `frontend/` → `apps/web` 后，从 AuraStack 复制来的 AI 上下文文档路径全部失效 | AI 上下文错误 | 新仓库不复制旧的 AGENTS.md/CLAUDE.md，P4 按 §14 重写；`verify-feature` 增加"文档中引用路径存在"检查 |

---

## 13. 已拍板的事项（2026-09-24）

1. **项目名**：`castor-kit`，小写连字符，不用 Stack 后缀、不用驼峰。
2. **`.xls` 支持**：A，放弃，只保留 csv / xlsx（见 §5.9）。
3. **后端框架**：Fastify（不用 NestJS，理由见 §3.2）。
4. **前端 UI 框架**：维持 Semi Design 不换；TS 化不在本次范围，重写完成后作为独立任务。
5. **并行运行期**：每个阶段验收后即切，P0→P5 不保留 Flask 长期共存。

---

## 14. 重写后 AGENTS.md 的关键变化预览

- 技术栈表：Fastify 5 / TypeScript / Zod / Drizzle / pg / pino
- 分层：`db/schema → schema(zod) → repository → service → routes → modules/<domain>/router.ts`
- 权限：`import { hasMenuPermission, loginRequired } from '@/common/auth'`
- 常用命令：
  ```bash
  pnpm dev                 # api(5001) + web(5173)
  pnpm db:generate --name <描述>   # drizzle-kit generate（drizzle-kit 不接受 `--`）
  pnpm db:migrate
  pnpm seed:rbac -- --incremental
  pnpm verify -- --module <name>
  pnpm scaffold -- --name <name> --domain <domain> --fields "..."
  pnpm openapi:generate && pnpm openapi:apifox
  ```
- 字段类型推断表：DB 类型列改为 Drizzle 写法（`varchar({length:100})`、`text()`、`numeric({precision:10,scale:2})`、`boolean()`、`date()`、`timestamp()`）
- 菜单树、ID 分配区间、交付流程、反模式清单：语义不变，命令替换

---

## 15. 实施结果（2026-09-24）

| 阶段 | 结果 |
|---|---|
| P0 骨架+认证 | 完成；baseline DDL 与 Alembic head 的 `pg_dump` 逐字节一致；`aurastack` 已迁移至 `0000_baseline`（仅写标记） |
| P1 admin 域 | users / roles / menu / logs / dicts / notification / announcement / dashboard 全部移植 |
| P2 component_center | list_page（含上传/版本）、stats / card / tree / dynamic_form / kanban / detail_tabs / gantt / advanced_table / map_heatmap / ai_prompt |
| P3 流式/实时 | scheduled_task + 租约调度器 + 独立 worker、ai_chat SSE、ai_sql 只读引擎、devtools perf + `/ws/devtools` |
| P4 工具链+文档 | scaffold / verify / seed-rbac / setup-once / init-ro-role / generate-openapi / import-apifox / MCP / 模板；AI 上下文文档与 4 语言文档站重写 |
| P5 部署 | Dockerfile / compose / entrypoint / setup.sh / CI / deploy / docs workflow |

验收证据：
- 路由：Node 收集到 114 条 `/api` 路由，与 Flask 完全一致（另有 `/ws/devtools`、`/health`、`/admin/login`、SPA fallback）。
- shadow-diff（Flask production 模式作 oracle，24 个用例文件 847 个用例，`apps/api/scripts/shadow-all.sh` 可复跑）：841 一致；6 个为有意差异——2 个 `.xls` 导出回落 csv（§5.9），4 个是 Flask 公告模块的 bug（`AnnouncementServiceError` 缺 `payload` 属性，所有 4xx 变成 500；Node 按原意返回 400）。
- vitest：api 430 条（428 通过 + 2 条 60s 调度端到端需 `SCHEDULER_E2E=1`，已单独跑通）、web 7、mcp 6；在“空库 + setup-once”的 CI 同构环境下全绿。
- 工具链：在仓库副本里 scaffold 示例模块 → seed → 迁移（`psql \d` 实证）→ `pnpm verify` 14/14 → CRUD、my-menus 出现新菜单。
- 生产布局：按 Dockerfile 的产物布局在本机模拟（`pnpm deploy --prod` + dist + drizzle + web），空库 `setup-once` → 服务启动 → 登录 / 菜单 / SPA 正常。

前端品牌（2026-09-25 用户决定）：站点标题、登录页、侧边栏品牌、首页横幅与技术栈标签、示例页（AI 对话提示词、Markdown / JSON / 代码编辑器示例、CSS 3D、WebSocket、性能监控文案）改为 castor-kit 与 Node 技术栈；只改文案，不涉及接口与路由。拖拽布局的 localStorage 键 `aurastack_drag_layout_v1` 保留，避免丢失已保存的布局。

与方案/Flask 有意不同（均有测试覆盖）：
- 404/405 按 Flask catch-all 实测语义（§5.4 已更正）；`toIso()` 补齐 6 位微秒（§2.2 已更正）。
- 请求原子性：Flask 在 400 时会因操作日志的 after_request commit 把半截修改写库；Node 每个请求一个事务，出错整体回滚。
- SSRF：Node 额外拦截 IPv4-mapped IPv6 等地址，并在连接阶段复检（防 DNS rebinding / 重定向到内网）。
- `setup-once` 用增量模式同步 RBAC（Python 版每次容器启动全量重建、会删用户，视为 bug 未照搬）。
- AI SQL：Flask 经 psycopg2 执行时单个 `%` 会报错（`LIKE '%x%'` 全部失败），Node 原样执行。
- `jsonBody`：非对象 JSON 体 / 非 JSON Content-Type 统一按 `{}` 处理（Flask 分别是 500 / 415 HTML），前端不会发这类请求。
- OpenAPI：`generate-openapi` 与 Python 同口径（保留文档详细定义、补骨架），未做 Zod 全量生成；详细覆盖率约 53%（按路由去重）。

遗留（需人工决定/操作）：
- Docker 镜像未在本机真实构建（Docker Hub 不可达；setup.sh 会写 `~/.docker/daemon.json` 镜像加速，需用户自行决定）。
- 线上切换（P5 最后一步）与 AuraStack 仓库归档、`alembic_version` 清理。
