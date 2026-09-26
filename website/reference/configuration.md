# 配置项

castor-kit 通过环境变量配置。后端变量由 `apps/api/src/config.ts` 用 Zod 校验和解析；Docker 部署时由 `docker-compose.yml` 注入。

## 配置文件

后端启动时按 `NODE_ENV` 加载 `.env.<NODE_ENV>`：

1. `apps/api/.env.<NODE_ENV>`
2. 仓库根目录的 `.env.<NODE_ENV>`

先加载的优先；已经存在的环境变量（例如 shell 或 compose 注入的）不会被文件覆盖。

| 文件 | 用途 | 是否提交 |
|---|---|---|
| `apps/api/.env.example` | 本地开发示例 | 是 |
| `.env.example`（根目录） | 全部变量的说明示例 | 是 |
| `apps/api/.env.development` | 本地开发配置 | 否（gitignore） |
| `.env.production`（根目录） | Docker 部署配置，由 `setup.sh` 生成 | 否（gitignore） |

::: warning 不要提交真实密钥
`.env.development`、`.env.production` 已被 gitignore。不要把真实的 `SECRET_KEY`、数据库密码、API Key 写进示例文件或提交到仓库。
:::

## 后端（API）

### 运行环境与数据库

| 变量 | 作用 | 默认值 |
|---|---|---|
| `NODE_ENV` | 运行环境：`development` / `test` / `production`，其他值按 `development` 处理 | `development` |
| `PORT` | 监听端口 | 开发 `5001`、测试 `5002`、生产 `5000` |
| `DEV_DATABASE_URL` | 开发环境数据库连接 | `postgresql://localhost/castor_kit_dev`（`apps/api/.env.example` 中为 `postgresql://localhost/castor_kit`） |
| `TEST_DATABASE_URL` | 测试环境数据库连接 | `postgresql://localhost/castor_kit_test` |
| `DATABASE_URL` | 生产环境数据库连接 | `postgresql://localhost/castor_kit` |
| `MIGRATIONS_DIR` | 迁移文件目录 | 自动向上查找 `drizzle/` 目录 |

### 安全与会话

| 变量 | 作用 | 默认值 |
|---|---|---|
| `SECRET_KEY` | 会话加密密钥，cookie 密钥由它通过 HKDF 派生 | 开发 / 测试有内置不安全默认值；**生产必填** |
| `ADMIN_PASSWORD` | `admin` 账号的初始密码，仅在账号不存在时使用 | 开发 / 测试为 `admin123`；**生产必填** |
| `SESSION_TTL_HOURS` | 会话有效期（小时）的初始值；之后可以在「系统设置」里修改 | `8` |
| `SESSION_COOKIE_SECURE` | cookie 的 `Secure` 标志：`true` / `false` 强制；留空则按请求协议自动判断（仅 HTTPS 时设置） | 空（自动） |
| `CORS_ORIGINS` | 允许跨域的来源，逗号分隔；也用于 WebSocket 握手的 Origin 白名单 | 空 |
| `LOGIN_MAX_FAILURES` | 登录失败次数上限（按 IP 和用户名分别计数；演示模式下只按 IP 计数） | `10` |
| `LOGIN_LOCKOUT_MINUTES` | 登录失败计数窗口与锁定时长（分钟） | `15` |
| `RATE_LIMIT_ENABLED` | 按 IP 限流；具体额度在「系统设置」里调整，见 [账号安全与系统设置](/guide/security#接口限流) | `true` |
| `MAX_CONTENT_LENGTH` | 请求体大小上限（字节），超出返回 413 | `16777216`（16MB） |

### 路径

| 变量 | 作用 | 默认值 |
|---|---|---|
| `WEB_DIST_DIR` | 前端构建产物目录，后端从这里提供静态文件和 SPA | `apps/web/dist` |
| `INSTANCE_DIR` | 运行时数据目录；`local` 驱动的上传文件默认存在其下的 `uploads/files/` | `apps/api/instance` |

### 文件中心

| 变量 | 作用 | 默认值 |
|---|---|---|
| `STORAGE_DRIVER` | 存储驱动：`local`（服务器上的目录）或 `s3`（任何 S3 兼容服务：AWS S3、MinIO、阿里云 OSS、腾讯云 COS、Cloudflare R2） | `local` |
| `STORAGE_LOCAL_DIR` | `local` 驱动的存储目录 | `<INSTANCE_DIR>/uploads/files` |
| `S3_ENDPOINT` | S3 兼容服务的地址；用 AWS S3 时留空 | 空 |
| `S3_REGION` | 区域；R2 填 `auto` | `us-east-1` |
| `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | 桶与密钥；`STORAGE_DRIVER=s3` 时缺任一项会拒绝启动 | 空 |
| `S3_PUBLIC_URL` | 桶的公开访问地址；设置后下载直接跳到这里，否则跳到约 10 分钟有效的签名地址 | 空 |
| `S3_FORCE_PATH_STYLE` | 用路径风格访问桶（MinIO 等自建服务需要） | 设置了 `S3_ENDPOINT` 时为 `true` |
| `UPLOAD_MAX_SIZE` | 单个文件大小上限（字节），同时受 `MAX_CONTENT_LENGTH` 限制，取两者较小值 | `10485760`（10MB） |
| `UPLOAD_ALLOWED_TYPES` | 允许上传的扩展名，逗号分隔；上传时还会检查文件头与扩展名是否一致 | `jpg,jpeg,png,gif,webp,pdf,txt,csv,doc,docx,xls,xlsx,ppt,pptx,zip` |

`local` 驱动需要持久化磁盘：Docker Compose 已把 `INSTANCE_DIR` 挂载为数据卷；Render 这类重新部署就清空磁盘的平台请改用 `s3`（例如 Cloudflare R2）。没有被任何记录引用的文件会在上传 24 小时后由调度器进程清理，所以 `ENABLE_TASK_SCHEDULER=false` 时也不会清理。

### 邮件

用于发送找回密码邮件。配置 `SMTP_HOST` 和 `APP_BASE_URL` 后，才能在「系统设置」里打开邮件找回密码。

| 变量 | 作用 | 默认值 |
|---|---|---|
| `SMTP_HOST` | SMTP 服务器地址，设置后启用邮件 | 空 |
| `SMTP_PORT` | 端口 | `587` |
| `SMTP_SECURE` | `true` 表示连接一开始就用 TLS（通常是 465 端口）；否则在服务器支持时使用 STARTTLS | `false` |
| `SMTP_USER` / `SMTP_PASSWORD` | 登录账号与密码；服务器不需要认证时留空 | 空 |
| `MAIL_FROM` | 发件人，如 `castor-kit <noreply@example.com>`；留空时用 `SMTP_USER` | 空 |
| `MAIL_DRIVER` | 留空时按 `SMTP_HOST` 自动判断；`log` 表示不发送，把邮件打印到后端日志（本地开发用）；`none` 表示关闭 | 空 |
| `APP_BASE_URL` | 网站的公开地址，邮件中的链接用它拼接（不使用请求里的 Host） | 空 |

### 公开演示

| 变量 | 作用 | 默认值 |
|---|---|---|
| `DEMO_MODE` | 公开演示模式：登录页显示演示账号并可一键登录；除登录、组件示例、上传文件、通知已读外的写操作都返回 403（系统管理只读、不能改密码）；登录锁定只按 IP 计数；示例数据按周期自动恢复 | `false` |
| `DEMO_RESET_HOURS` | 演示数据恢复周期（小时）。服务启动时和运行中每小时检查一次，距上次恢复超过该时长就恢复；也可手动执行 `pnpm demo:reset` | `24` |
| `DEMO_AI_HOURLY_PER_IP` | 演示模式下每个 IP 每小时可调用 AI 的次数（AI 对话、AI 生成 SQL），超出返回 429；未登录的请求不计数 | `20` |
| `DEMO_AI_DAILY` | 演示模式下全站每天可调用 AI 的总次数，用完后当天返回 429 | `300` |
| `DEMO_AI_MAX_INPUT_CHARS` | 演示模式下单次 AI 请求的最大长度（字符），超出返回 400。演示模式还会限制模型回复长度 | `4000` |

演示数据的内容在 `apps/api/src/demo/fixtures.ts`，恢复逻辑在 `apps/api/src/demo/reset.ts`。恢复只涉及组件示例、公告、数据字典、定时任务、通知与日志，不会动账号、角色和菜单。

### 定时任务

| 变量 | 作用 | 默认值 |
|---|---|---|
| `ENABLE_TASK_SCHEDULER` | 是否启用定时任务调度 | `true` |
| `RUN_SCHEDULER_IN_WEB` | 是否在 web 进程内运行调度器；为 `false` 时需要单独运行 worker 进程 | `false` |
| `TASK_SCHEDULER_INTERVAL_SECONDS` | 调度扫描间隔（秒） | `20` |
| `TASK_SCHEDULER_LEASE_SECONDS` | 任务租约时长（秒），用于防止重复执行和回收卡死任务 | `1800` |

布尔值 `1`、`true`、`yes`、`on`（不区分大小写）视为真。

### AI 功能

| 变量 | 作用 | 默认值 |
|---|---|---|
| `AI_API_BASE` | OpenAI 兼容接口的 Base URL，例如 `https://api.openai.com/v1` | 空 |
| `AI_API_KEY` | API Key | 空 |
| `AI_MODEL` | 模型名称 | 空 |
| `AI_SQL_DATABASE_URL` | AI 数据查询使用的只读连接，应指向非超级用户的只读账号 | 开发 / 测试回退到主库连接（仍强制只读）；生产环境未设置时，若设置了 `POSTGRES_RO_PASSWORD`，则由 `DATABASE_URL` 推导（换成 `castor_kit_ro` 账号），否则拒绝启动 |
| `AI_SQL_STATEMENT_TIMEOUT_MS` | AI 数据查询的单条语句超时（毫秒） | `5000` |
| `POSTGRES_RO_PASSWORD` | 只读账号 `castor_kit_ro` 的密码，`setup-once` / `init-ro-role` 用它创建账号；未设置时跳过 | 空 |

AI 对话、AI 提示词工坊、AI 数据查询共用 `AI_API_*` 三个变量。未配置时这些页面提示未配置，其他功能不受影响。

### Apifox（仅 `pnpm openapi:apifox` 使用）

| 变量 | 作用 | 默认值 |
|---|---|---|
| `APIFOX_PROJECT_ID` | Apifox 项目 ID | 空 |
| `APIFOX_ACCESS_TOKEN` | Apifox 访问令牌 | 空 |
| `APIFOX_API_VERSION` | Apifox API 版本 | `2024-03-28` |

### 生产环境必填项

`NODE_ENV=production` 时，缺少以下任一变量服务会拒绝启动：

- `SECRET_KEY`
- `ADMIN_PASSWORD`
- `AI_SQL_DATABASE_URL`，或 `POSTGRES_RO_PASSWORD`（由它和 `DATABASE_URL` 推导出只读连接）

使用 `docker-compose.yml` 部署时，`AI_SQL_DATABASE_URL` 由 compose 自动拼出，不需要手动设置。

## 前端（Web）

前端没有运行时环境变量，开发服务器的行为写在 `apps/web/vite.config.js` 中：

| 项 | 值 |
|---|---|
| 开发端口 | `5173` |
| 代理 | `/api` → `http://localhost:5001`，`/ws` → `ws://localhost:5001` |
| 路径别名 | `@` → `apps/web/src` |

生产环境下前端构建产物由后端直接提供，请求走同源的 `/api`，不需要额外配置。

用户在浏览器中的偏好（主题、外观、语言、标签栏）保存在 `localStorage` / `sessionStorage`，见 [主题与布局](/guide/appearance#偏好存储位置)。

## Docker

### compose 读取的变量

这些变量写在 `.env.production` 中，通过 `docker compose --env-file .env.production ...` 传入：

| 变量 | 作用 | 默认值 |
|---|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL 用户 `castor_kit` 的密码 | **必填** |
| `SECRET_KEY` | 同上文 | **必填** |
| `ADMIN_PASSWORD` | 同上文 | **必填** |
| `POSTGRES_RO_PASSWORD` | AI SQL 只读账号密码 | **必填** |
| `NPM_REGISTRY` | 构建镜像时安装依赖用的 npm 源（构建参数） | `https://registry.npmmirror.com` |
| `APP_PORT` | 映射到宿主机的端口（容器内固定 5000） | `8080`（`setup.sh` 生成的配置默认写 `5000`） |
| `ENABLE_TASK_SCHEDULER` | 同上文 | `true` |
| `RUN_SCHEDULER_IN_WEB` | 同上文。compose 中默认为 `true`，与后端自身的默认值不同 | `true` |
| `SESSION_TTL_HOURS` | 同上文 | `8` |
| `SESSION_COOKIE_SECURE` | 同上文 | 空（自动） |
| `CORS_ORIGINS` | 同上文 | 空 |
| `RATE_LIMIT_ENABLED` | 同上文 | `true` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` / `MAIL_FROM` / `APP_BASE_URL` | 同上文（邮件） | 空 / `587` / `false` |
| `AI_API_KEY` / `AI_API_BASE` / `AI_MODEL` | 同上文 | 空 |
| `COMPOSE_DB_VOLUME` | 数据库数据卷名，可指向已有的卷 | `castor-kit_postgres_data` |
| `COMPOSE_INSTANCE_VOLUME` | 上传文件数据卷名，可指向已有的卷 | `castor-kit_app_instance` |

compose 会根据以上变量自动设置：

| 变量 | 值 |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://castor_kit:<POSTGRES_PASSWORD>@db/castor_kit` |
| `AI_SQL_DATABASE_URL` | `postgresql://castor_kit_ro:<POSTGRES_RO_PASSWORD>@db/castor_kit` |

`.env.production` 里的其他变量（例如 `LOGIN_MAX_FAILURES`）不会自动传入容器；需要时在 `docker-compose.yml` 的 `app.environment` 中添加。

### 镜像内置的变量

`Dockerfile` 中设置，一般不需要修改。构建参数 `NPM_REGISTRY` 默认为 `https://registry.npmjs.org`；通过 compose 构建时默认改用国内镜像，见上表。

| 变量 | 值 |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `WEB_DIST_DIR` | `/app/web` |
| `INSTANCE_DIR` | `/app/instance` |
| `MIGRATIONS_DIR` | `/app/drizzle` |

## 工具链

| 变量 | 作用 |
|---|---|
| `CASTOR_KIT_ROOT` | MCP Server 使用的仓库根目录，默认按自身位置推算 |
