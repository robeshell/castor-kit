# castor-kit 功能路线图

> 本文档是后续新功能的开发计划：每一项写清目标、范围、数据模型、接口、界面、权限与验收标准，开发时照此执行。
> 状态随进度更新；方案有调整时先改本文档，再写代码。架构与约定以 `AGENTS.md`、`docs/architecture.md` 为准。

## 总览

| 阶段 | 功能 | 优先级 | 依赖 | 状态 |
|---|---|---|---|---|
| 0 | [用户资料扩展](#0-用户资料扩展) | 必须先做 | — | 已完成 |
| 1 | [部门与数据权限](#1-部门与数据权限) | 高 | 0 | 已完成 |
| 1 | [文件中心](#2-文件中心) | 高 | 0（头像） | 已完成 |
| 2 | [账号安全](#3-账号安全) | 中 | 0 | 已完成（含系统设置） |
| 2 | [开放接口：API Token 与 Webhook](#4-开放接口api-token-与-webhook) | 中 | — | 未开始 |
| 2 | [第三方登录（OAuth / OIDC）](#5-第三方登录oauth--oidc) | 中 | 0、3（会话） | 未开始 |
| 3 | [在线可视化建模与 AI 助手](#6-在线可视化建模与-ai-助手) | 中 | 1、2 | 未开始（含 AI 调用层迁移到 Vercel AI SDK） |
| 3 | [审批流](#7-审批流) | 低 | 1 | 未开始 |
| 3 | [多租户](#8-多租户) | 低 | 1、2、4 | 未开始 |
| — | 公开演示模式与 Render + Neon 部署（计划外，按需加入） | — | — | 已完成 |

建议顺序：0 → 1（部门与数据权限、文件中心可并行）→ 2 → 3。第 3 阶段中「在线可视化建模」价值最高，「多租户」改动面最大、放最后。

## 通用交付要求

每一项都作为独立的 PR 交付，并满足：

- 后端按分层规则实现（`db/schema` → `schema` → `repository` → `service` → `routes`），迁移真实落库并用 `psql \d` 验证
- 新菜单与按钮权限写入 `apps/api/scripts/seed-rbac.ts`（ID 按 `AGENTS.md`「菜单 ID 分配规则」取实际未占用的值），`pnpm seed:rbac -- --incremental` 同步
- 界面文案 `t('中文原文')`，补齐 en-US / ja-JP 译文；后端新报错登记到 `apps/api/src/i18n/messages.ts`；代码注释用英文
- 新增接口有 API 测试，前端公共组件有单元测试；`pnpm verify` 全绿
- 同一个 PR 更新三语文档（`website/`）、`CHANGELOG.md` 的 `[Unreleased]`；如涉及新的环境变量，同步 `apps/api/.env.example` 与配置文档
- 已有数据平滑迁移：新增列给默认值或允许为空，不破坏现有部署

---

## 0. 用户资料扩展

**为什么先做**：`admin_users` 目前只有 `username`、`password_hash`、`created_at`。部门、找回密码（需要邮箱）、头像（需要文件中心）、账号停用都依赖用户资料字段。

**范围**

- `admin_users` 新增：`nickname`、`email`（唯一，可空）、`phone`、`avatar`（文件 ID 或 URL，先存 URL，文件中心上线后改为文件 ID）、`status`（`active` / `disabled`，默认 `active`）、`dept_id`（可空，阶段 1 使用）、`last_login_at`、`last_login_ip`、`updated_at`
- 登录时写入 `last_login_at` / `last_login_ip`；`status = disabled` 的账号禁止登录，并使已有会话失效
- 用户管理页：列表展示昵称、邮箱、状态、最后登录；表单编辑上述字段；支持启用 / 停用（新增按钮权限）
- 个人设置页：本人可修改昵称、邮箱、手机、头像
- 导入导出同步新增字段

**不做**：邮箱验证（随阶段 2「找回密码」一起做）。

**验收**：旧数据迁移后可正常登录；停用账号无法登录且已登录会话下一次请求返回 401；个人设置可修改资料。

**实现说明**（迁移 `0002_user_profile`）：

- 启用 / 停用走独立接口 `PUT /api/admin/users/:id/status`（按钮权限 `system_users_status`，ID 216）；编辑接口忽略 `status`，编辑权限不能绕过它
- 个人资料接口 `PUT /api/admin/profile`：只接受昵称、邮箱、手机、头像
- `loginRequired` 每次请求确认账号存在且启用，否则清会话返回 401（已删除账号的会话也一样）
- 不能停用自己，不能停用或删除最后一个启用中的超级管理员；导入的「状态」列需要 `system_users_status` 权限，受同样限制
- 头像暂存 URL（`http(s)://` 或 `/` 开头），文件中心上线后改为文件 ID 并提供上传

---

## 1. 部门与数据权限

**目标**：在"能看到哪些菜单和按钮"之外，控制"能看到哪些数据"。

**数据模型**

- `departments`：`id`、`parent_id`、`name`、`code`（唯一）、`leader_id`（用户）、`sort_order`、`status`、`created_at`、`updated_at`；树形结构，复用 `common/tree.ts` 的成环校验
- `admin_users.dept_id`（阶段 0 已加）
- `roles.data_scope`：`all`（全部）/ `dept_and_children`（本部门及下级）/ `dept`（本部门）/ `self`（仅本人）/ `custom`（自定义部门），默认 `all` 以兼容现有角色
- `role_depts`：`role_id`、`dept_id`，用于 `custom`
- 需要数据权限的业务表增加 `dept_id`、`created_by`（创建时自动写入当前用户及其部门）

**后端**

- 新增 `common/data-scope.ts`，拆成两步，repository 不接触 `request`：
  - `resolveDataScope(request)`：在 routes 里调用，按请求缓存，得到当前用户的范围（全部，或「部门 ID 列表 + 是否含本人」）；用户有多个角色时取各角色范围的并集；`super_admin` 或任一角色为 `all` 时不限制
  - `dataScopeWhere(scope, { deptColumn, ownerColumn })`：纯函数，在 repository 里返回 Drizzle `SQL` 条件；范围受限但算出来为空（如 `dept` 角色的用户没有部门）时返回恒假条件，不能退化成不过滤
  - `currentActor(request)`：新建数据时写入 `created_by` / `dept_id` 用
- 部门子树查询用递归 CTE（`common/tree.ts`），结果按请求缓存；停用的部门仍算在子树内
- 部门本身不做数据权限：有部门、用户或角色菜单权限的人都能看到完整部门树
- 列表、详情、导出、更新、删除都必须带上数据范围条件（更新 / 删除越权返回 404，不泄露数据存在与否）
- `scaffold` 新增 `--data-scope` 参数：自动加 `dept_id` / `created_by` 列、在 repository 中接入 `dataScopeWhere`、生成对应的测试
- `pnpm verify` 新增检查：声明了数据权限的模块（`schema.ts` 导出 `DATA_SCOPE`），repository 必须使用 `dataScopeWhere`
- 用户管理本身接入数据权限（部门列 `admin_users.dept_id`，本人列 `admin_users.id`）；范围受限时只能把用户分配到范围内的部门

**前端**

- 部门管理页（树形表格，新增 / 编辑 / 删除 / 排序）
- 用户管理：部门选择（树形下拉），按部门筛选
- 角色管理：数据范围选择，`custom` 时勾选部门树

**权限菜单**：系统管理下新增「部门管理」，按钮：新增、编辑、删除。

**验收**：同一张表，`self` 角色只看到自己创建的数据，`dept` 只看到本部门，`dept_and_children` 包含下级；越权访问详情 / 修改 / 删除返回 404；导出结果同样受限。

---

## 2. 文件中心

**目标**：统一的上传、存储与访问，业务模块直接用组件，不再各写各的。

**数据模型**：`files`：`id`（UUID）、`storage`（驱动名）、`bucket`、`object_key`、`original_name`、`mime_type`、`size`、`sha256`、`uploader_id`、`ref_count` 或引用表、`created_at`。

**存储驱动**

- `local`（默认，存到数据卷目录）与 `s3`（S3 兼容协议，覆盖 AWS S3、MinIO、阿里云 OSS、腾讯云 COS、Cloudflare R2）
- 环境变量：`STORAGE_DRIVER`、`STORAGE_LOCAL_DIR`、`S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_ACCESS_KEY`、`S3_SECRET_KEY`、`S3_PUBLIC_URL`、`UPLOAD_MAX_SIZE`、`UPLOAD_ALLOWED_TYPES`
- Docker Compose 中 `local` 驱动的目录挂载为数据卷

**接口**

- `POST /api/admin/files`：上传（复用已注册的 `@fastify/multipart`），校验大小、MIME 与文件头，同内容按 `sha256` 去重
- `GET /api/admin/files/:id`：下载 / 预览；`s3` 驱动返回短期签名地址，`local` 驱动由服务端流式返回
- `GET /api/admin/files`：文件列表（管理页用）；`DELETE /api/admin/files/:id`
- 定时任务：清理超过 24 小时仍未被引用的孤儿文件

**前端组件**（`apps/web/src/shared/components/upload/`）：`FileUpload`（多文件、拖拽、进度）、`ImageUpload`（预览、裁剪可选）、`AvatarUpload`；接入 `FormFields`。

**脚手架**：`--fields` 新增类型 `file`、`image`（存文件 ID），自动生成对应的表单控件与列表展示。

**权限菜单**：系统管理下新增「文件管理」，按钮：删除。

**验收**：两种驱动都能上传 / 预览 / 下载；超限或类型不符被拒绝；用户头像改用文件中心；孤儿文件被定时清理。

**方案细化**（动手前确定，与上文不一致处以此为准）：

- **上传 / 读取不设按钮权限**：头像和业务表单都要上传，所以 `POST /api/admin/files`、`GET /api/admin/files/:id` 只要求登录（文件 ID 是 UUID，不可猜）；文件列表需要「文件管理」菜单权限，删除需要「删除」按钮权限。原计划的「上传」按钮权限在接口层无法生效，取消
- **去重**：每次上传一条 `files` 记录（各自的 ID、原文件名、上传人），相同内容共用一个存储对象（`object_key` 按 `sha256` 生成）；最后一条指向它的记录删除时才删对象
- **引用关系**：用引用表 `file_references(file_id, ref_table, ref_id, ref_field)`，不用 `ref_count`；业务模块保存时调用 `syncFileRefs` 同步。孤儿 = 没有引用且上传超过 24 小时；被引用的文件不能在文件管理里删除
- **头像仍存 URL**：`admin_users.avatar` 不改列类型，上传的头像写成 `/api/admin/files/<id>`，并登记引用；以前填的外部地址继续可用
- **访问安全**：只有 png / jpeg / gif / webp 图片内联预览，其余一律作为附件下载并加 `nosniff`；默认允许的类型不含 svg / html；`s3` 驱动 302 到约 10 分钟有效的签名地址（配置了 `S3_PUBLIC_URL` 时直接给公开地址）
- **大小上限**：实际上限取 `UPLOAD_MAX_SIZE` 与 `MAX_CONTENT_LENGTH` 中较小的一个
- **清理任务**：不能用「定时任务」模块（它只调外部 HTTP 地址），改为调度器进程内置的每小时任务，用 advisory lock 保证多副本只跑一份；`ENABLE_TASK_SCHEDULER=false` 时也不清理
- `s3` 驱动缺少 bucket / 密钥时，生产环境拒绝启动；`local` 驱动需要持久化磁盘（Render 等临时磁盘平台请用 `s3` / R2）
- 组件示例列表页的图片 / 附件也改走文件中心，旧文件保留只读回读；上传限制经 `app-info` 下发给前端；演示模式放行上传
- 已用本机 MinIO 实测 `s3` 驱动（`test/files-s3-live.test.ts`，设置 `S3_TEST_ENDPOINT` 时运行）

---

## 3. 账号安全

**范围**

1. **服务端会话**（其余几项的前提）：当前会话是 `@fastify/secure-session` 加密 cookie，服务端不保存状态，无法列出或强制下线。改为 `sessions` 表（`id`、`user_id`、`ip`、`user_agent`、`created_at`、`last_seen_at`、`expires_at`、`revoked_at`），cookie 只存会话 ID；保留现有的滑动过期与 CSRF 行为
2. **在线用户**：列表显示当前在线会话，管理员可强制下线；个人设置里可查看并退出自己的其他设备
3. **两步验证（TOTP）**：用户在个人设置中绑定（二维码 + 验证码确认），生成一次性恢复码；登录变为「密码 → 验证码」两步；管理员可重置某用户的两步验证；可配置为某些角色强制开启
4. **找回密码**：邮件发送重置链接（令牌只存哈希、限时、单次有效）；SMTP 配置用环境变量（`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`MAIL_FROM`）；未配置 SMTP 时隐藏入口
5. **接口限流**：`@fastify/rate-limit`，全局默认值 + 登录、找回密码等接口更严格的限制；与现有的登录失败锁定（`LOGIN_LOCKOUT_MINUTES`）并存
6. **密码策略**：最小长度、复杂度可配置；修改密码后使该用户其他会话失效

**验收**：强制下线后对方下一次请求返回 401；开启两步验证的账号不输入验证码无法登录；重置链接过期或用过后失效；超出限流返回 429 且报错已翻译。

**方案细化**（动手前确定，与上文不一致处以此为准）：

- **系统设置**（新增，系统管理 → 系统设置）：功能开关与业务参数存 `system_settings` 表（代码里有带类型、默认值、校验的注册表，未知键拒绝），管理员修改后立即生效（进程内缓存数秒）；密钥与基础设施配置（SMTP、S3 等）仍只用环境变量（后来调整为也在系统设置里配置、环境变量可锁定，见变更记录）。默认关闭：两步验证、找回密码；默认值与当前行为一致：密码最短 6 位、不要求复杂度、会话有效期 = `SESSION_TTL_HOURS`。公开的部分（密码策略、两步验证 / 找回密码是否开启）经 `app-info` 下发
- **不做成开关**的安全底线：服务端会话、强制下线、接口限流、登录失败锁定、最低密码规则
- **会话**：cookie（仍由 `@fastify/secure-session` 加密）只存会话 ID 和 CSRF token，登录状态、用户都以 `sessions` 表为准；每个请求校验一次，`last_seen_at` / 过期时间每分钟最多写一次；过期与已撤销的会话由调度器的维护任务清理。上线后已有的登录都会失效，需要重新登录一次
- **撤销时机**：退出（当前会话）、改密码（本人其他会话）、管理员重置密码 / 停用 / 删除用户（该用户全部会话）、强制下线（指定会话）
- **两步验证**：`otpauth` 实现 TOTP；密钥用由 `SECRET_KEY` 派生的密钥 AES-256-GCM 加密存储；恢复码只存哈希、单次有效；同一时间步的验证码不能重复使用；验证码输错计入现有的登录失败锁定。关闭开关 = 登录不再要求验证码，已有绑定保留，重新打开后恢复生效
- **找回密码**：令牌 32 字节随机数、只存 sha256、30 分钟、单次有效，新申请使旧令牌失效；申请接口无论账号是否存在都返回同样的提示；重置链接用 `APP_BASE_URL` 拼接（不信任请求的 Host）；需要 `SMTP_*` 与 `APP_BASE_URL` 都配置才能在系统设置里打开；演示模式下不可用
- **限流**：计数在进程内存里，多副本时各自计数；`/health` 不限流
- **菜单**：在线用户 ID 28（按钮 281 强制下线），系统设置 ID 29（按钮 291 编辑）

**实现时的补充**：

- 邮件驱动：`MAIL_DRIVER=log` 时邮件打印到服务端日志（本地开发用），配置 `SMTP_HOST` 时走 SMTP；两者都没有时找回密码不能打开
- 限流：登录、两步验证码、找回密码共用一个更严格的每 IP 额度；两个额度都在系统设置里调；`RATE_LIMIT_ENABLED=false` 可整体关闭（测试环境默认关闭）
- 两步验证与找回密码在演示模式下都不能打开（演示账号是共享的）
- 等待两步验证的会话（`mfa_state`）不算登录，只能调用第二步的接口；验证通过后换发新会话 ID；「登录成功」的日志和最近登录时间在第二步通过后才记录
- 修改密码后当前设备保持登录，只有其他设备下线（原计划是全部重新登录）
- 管理员重置两步验证放在「编辑用户」弹窗底部，行操作不再加按钮

---

## 4. 开放接口：API Token 与 Webhook

**API Token**

- `api_tokens`：`id`、`name`、`token_prefix`（展示用）、`token_hash`、`scopes`（菜单 / 按钮权限编码列表）、`expires_at`、`last_used_at`、`created_by`、`revoked_at`
- 明文只在创建时显示一次；请求用 `Authorization: Bearer <token>`
- 实际权限 = token 的 scopes 与创建人当前权限的交集（创建人被停用或降权后自动收紧）；Bearer 请求不走 CSRF 校验，不创建会话
- 数据权限（阶段 1）按创建人计算
- 个人设置里管理自己的 token；管理员可查看和吊销全部 token
- OpenAPI 文档补充 Bearer 认证说明

**Webhook**

- `webhooks`：`id`、`name`、`url`、`events`（订阅的事件列表）、`secret`、`is_active`；`webhook_deliveries`：`id`、`webhook_id`、`event`、`payload`、`status`、`attempts`、`response_code`、`response_body`（截断）、`next_retry_at`
- 服务层在数据增删改后发出领域事件（如 `user.created`、`<module>.updated`）；投递由现有定时任务调度器执行，失败按指数退避重试
- 请求头带 `X-Castor-Signature`（HMAC-SHA256）与事件 ID，便于对方校验与去重
- 管理页：配置 Webhook、查看投递记录、手动重发、发送测试事件
- 目标地址拒绝内网地址（防 SSRF），可用环境变量放开

**验收**：用 token 调用接口的权限不超过创建人；吊销后立即失效；Webhook 签名可被校验，失败会重试并记录。

---

## 5. 第三方登录（OAuth / OIDC）

- 基于标准 OIDC 授权码流程（带 PKCE），首批：GitHub、Google、企业微信、钉钉、飞书（后三者按各平台 OAuth 规范适配）
- 提供方配置用环境变量或系统设置页；`user_identities`：`provider`、`subject`、`user_id`、`created_at`
- 登录页显示已启用的提供方按钮；个人设置中绑定 / 解绑
- 首次登录可选：拒绝（只允许已绑定账号）或自动创建账号并赋默认角色（可配置）
- 与两步验证的关系：第三方登录视为已完成强认证，是否仍需 TOTP 可配置

**验收**：已绑定用户可一键登录；未绑定用户按配置处理；解绑后无法再用该方式登录。

---

## 6. 在线可视化建模与 AI 助手

**目标**：把「AI / 脚手架生成完整模块」从命令行工具变成产品功能，不会命令行的人也能用。

**范围**

- **建模器页面**：填写模块名、所属域，逐行添加字段（名称、类型、必填、唯一、默认值、字典），实时预览生成的表单与列表
- **AI 辅助**：输入一句需求（如「做一个设备台账：名称、编号、状态、采购日期」），调用已配置的 AI 接口（`AI_API_KEY`）按 `AGENTS.md` 的字段类型推断规则生成字段清单，填入建模器供修改
- **生成**：后端依次执行 `scaffold` → `db:migrate` → `seed:rbac --incremental` → `verify --module`，通过 WebSocket（已注册 `@fastify/websocket`）实时推送日志；失败时展示错误并可回滚未提交的生成文件
- 顺带解决 `scaffold` 的已知限制：必填 / 唯一 / 默认值直接由建模器表达，不再需要手改 `db/schema`

**AI 调用层迁移到 Vercel AI SDK**：现在 AI 对话、AI 数据查询各自手写 OpenAI 兼容请求与 SSE 解析。随本项一起迁移到 Vercel AI SDK（`ai` 包）：各家模型（Gemini、Claude、OpenAI 等）原生接入；建模器的「AI 生成字段清单」用结构化输出（schema 校验）；前端对话改用 `useChat`。迁移后保持现有接口路径与演示模式的 AI 限流不变。

**安全边界**：生成代码会写入仓库文件并执行迁移，**只在开发环境（`NODE_ENV=development`）且仅超级管理员可用**，生产环境不注册相关路由。

**验收**：从一句话需求到页面可用、`verify` 全绿，全程不离开浏览器；生成的代码与命令行脚手架产物一致。

---

## 7. 审批流

**范围（第一版）**

- 流程定义：节点包括开始、审批（指定人 / 角色 / 部门负责人 / 发起人上级部门负责人）、条件分支（按表单字段）、结束；第一版不做并行会签
- `workflow_definitions`（含版本）、`workflow_instances`、`workflow_tasks`、`workflow_histories`
- 设计器：基于画布的节点编排（可用 React Flow 一类组件，引入前评估体积）
- 「我的待办 / 我的已办 / 我发起的」页面；审批通过、驳回、转交、撤回
- 业务模块接入：模块声明可发起审批，记录 `workflow_instance_id`，审批结果回写业务状态
- 通知：复用现有消息通知模块，待办到达时通知审批人

**验收**：一个示例业务（如请假或采购申请）走完发起 → 条件分支 → 审批 → 结果回写；历史可追溯。

---

## 8. 多租户

**目标**：让 castor-kit 可以作为 SaaS 底座，一套部署服务多个租户，数据相互隔离。

**方案要点**

- `tenants` 表；所有业务表与用户、角色、部门、文件等增加 `tenant_id`
- 租户识别：子域名或请求头，登录时确定并写入会话
- 隔离：优先使用 PostgreSQL 行级安全（RLS）作为兜底，应用层同时带 `tenant_id` 条件；超级管理员拆分为平台管理员与租户管理员
- 菜单与功能按租户套餐开关；文件存储按租户分目录 / 前缀
- 脚手架与 `verify`：新表默认带 `tenant_id`，门禁检查查询是否带租户条件

**风险**：几乎触及所有表与查询，迁移成本最高；需要单独的迁移与回滚方案，并在阶段 1、2 稳定后再开始。

**验收**：两个租户的数据、用户、文件完全隔离；跨租户访问一律 404；单租户部署不受影响（默认租户）。

---

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-09-25 | 创建路线图，列出阶段 0–3 共 9 项功能 |
| 2026-09-25 | 新增并完成「公开演示模式与 Render + Neon 部署」 |
| 2026-09-26 | 完成「0. 用户资料扩展」 |
| 2026-09-26 | 完成「2. 文件中心」（迁移 `0004_file_center`）；方案细化见该节：上传 / 读取只要求登录，引用表代替 `ref_count`，头像仍存 URL，清理改为调度器内置任务 |
| 2026-09-26 | 系统设置扩展为配置中心：邮件、文件存储、上传限制、AI 模型、网站地址、登录锁定改在页面上配置（密钥加密存储、可测试），环境变量改为可选的锁定手段；只有启动前需要的配置留在环境变量。系统管理菜单分为四组 |
| 2026-09-26 | 完成「3. 账号安全」（迁移 `0005_account_security`），新增「系统设置」：功能开关与安全参数存数据库，两步验证、找回密码默认关闭；实现补充见该节 |
| 2026-09-26 | 完成「1. 部门与数据权限」（迁移 `0003_departments_data_scope`）；方案调整：`dataScopeWhere` 拆成 `resolveDataScope`（routes）+ 纯函数 `dataScopeWhere`（repository），用户管理本身接入数据权限 |
