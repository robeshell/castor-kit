# 部署指南

推荐使用 Docker Compose 部署。一套 compose 包含两个服务：PostgreSQL（`db`）和 Node 应用（`app`）。应用进程同时提供后端接口和构建好的前端页面。

::: info 应用不做自动部署
应用不做 CI 自动部署。`.github/workflows/ci.yml` 只在推送和 Pull Request 时运行 lint、类型检查、测试、门禁和前端构建。部署在服务器上手动完成，更新流程见下文。

文档站是例外：`.github/workflows/docs.yml` 在 `website/` 有改动合入 main 时自动构建并发布到 GitHub Pages（需在仓库 Settings → Pages 中把 Source 设为 GitHub Actions），Pull Request 只构建、检查死链。
:::

## 架构概览

| 组件 | 说明 |
|---|---|
| `db` | 镜像 `postgres:alpine`，库名和用户名均为 `castor_kit`，数据存放在卷 `postgres_data` |
| `app` | 由仓库根目录的 `Dockerfile` 构建，容器内监听 5000 端口，上传文件存放在卷 `app_instance`（挂载到 `/app/instance`） |

镜像构建分两个阶段：两个阶段都基于 `node:22-bookworm-slim`（glibc；`sodium-native` 等原生模块只提供 glibc 版预编译文件，不能用 Alpine）。第一阶段安装依赖并构建前端（Vite）和后端（tsup），再裁剪为生产依赖；第二阶段是运行镜像，以非 root 用户（uid 10001）运行，并配置了基于 `/health` 的健康检查。

容器启动时，`docker-entrypoint.sh` 依次执行：

1. `node dist/setup-once.js`：在 PostgreSQL advisory lock 保护下执行数据库迁移、RBAC 增量同步、创建或更新 AI SQL 只读账号 `castor_kit_ro`。多个副本同时启动时也只会依次执行，结果幂等。
2. `node dist/main.js`：启动服务。

::: warning 构建时使用的镜像源
`Dockerfile` 中把 npm registry 设置为 `https://registry.npmmirror.com`。如果服务器访问该源较慢，可以在 `Dockerfile` 中修改。
:::

## 方式一：安装向导

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh
```

向导会询问管理员密码、访问端口（默认 5000）以及可选的 AI 配置，随机生成 `SECRET_KEY`、`POSTGRES_PASSWORD`、`POSTGRES_RO_PASSWORD`，写入 `.env.production`，然后构建并启动服务，等待 `/health` 就绪。

::: warning setup.sh 会修改 Docker 配置
如果 Docker 的 `daemon.json`（macOS 为 `~/.docker/daemon.json`，Linux 为 `/etc/docker/daemon.json`）里没有 `registry-mirrors`，脚本会写入一个镜像加速地址并重启 Docker（Linux 上通过 `sudo systemctl restart docker`）。在已有其他容器运行的服务器上，建议使用方式二。
:::

## 方式二：手动配置

### 1. 创建 .env.production

在仓库根目录创建 `.env.production`，至少包含以下变量（compose 缺少任何一项都会拒绝启动）：

```bash
SECRET_KEY=<足够长的随机字符串>
ADMIN_PASSWORD=<admin 账号的初始密码>
POSTGRES_PASSWORD=<数据库密码>
POSTGRES_RO_PASSWORD=<AI SQL 只读账号密码>
```

可选变量：

```bash
APP_PORT=5000          # 宿主机端口，不设置时为 8080
AI_API_BASE=
AI_API_KEY=
AI_MODEL=
```

全部可用变量见 [配置项](/reference/configuration#docker)。随机字符串可以用 `openssl rand -base64 48` 生成。

### 2. 构建并启动

```bash
docker compose --env-file .env.production up -d --build
```

首次构建需要几分钟。之后访问 `http://<服务器地址>:<APP_PORT>`，使用 `admin` 和 `ADMIN_PASSWORD` 登录。

::: tip 每条 compose 命令都要带 --env-file
compose 默认只读取 `.env`，不会读取 `.env.production`。不带 `--env-file .env.production` 时，必填变量缺失，命令会直接报错。
:::

::: warning ADMIN_PASSWORD 只在首次生效
`admin` 账号只在不存在时创建。首次启动后再修改 `ADMIN_PASSWORD` 不会改变已有账号的密码，请登录后在界面上修改。
:::

## 方式三：Render + Neon（免费演示）

用 [Render](https://render.com) 的免费 Web 服务运行应用、[Neon](https://neon.tech) 的免费 PostgreSQL 存数据，适合搭一个公开的在线演示。仓库根目录的 `render.yaml` 已写好配置，默认开启[演示模式](/reference/configuration#公开演示)：

- 登录页显示演示账号（`admin` / `castor-demo`），可以一键登录
- 系统管理只读，不能改密码；组件示例可以随意增删改
- 示例数据每 24 小时自动恢复

::: warning 免费套餐的限制
以下是撰写时两家平台的免费额度，开通前请以官网为准：
- Render 免费实例 15 分钟无人访问会休眠，再次访问需要等待几十秒启动；休眠期间定时任务不运行
- Neon 免费数据库空闲时会暂停计算，下次连接时自动唤醒
:::

### 1. 创建 Neon 数据库

1. 注册 Neon，新建一个项目。区域选 **AWS US East 2 (Ohio)**，与 `render.yaml` 里 Render 服务的 `region: ohio` 一致；若改用其他区域，两边保持一致
2. 在项目首页点 **Connect**，**关闭「Connection pooling」**，复制直连的连接串，形如 `postgresql://<用户>:<密码>@ep-xxx.<区域>.aws.neon.tech/neondb?sslmode=require`

::: tip 为什么要直连
启动时的初始化（迁移、RBAC 同步、演示数据恢复）使用会话级的 advisory lock 防止并发，连接池模式下拿不到这把锁。连接串里的 `channel_binding=require` 可以保留，也可以去掉。
:::

### 2. 在 Render 上部署

1. 用 GitHub 账号注册 Render。如果仓库不在你的账号下，先 Fork 一份
2. 在 Render 控制台选择 **New → Blueprint**，选中仓库，Render 会读取 `render.yaml`
3. 按提示填入 `DATABASE_URL`（上一步复制的连接串），其余变量已在 `render.yaml` 中设置或自动生成
4. 点 **Apply**。首次构建大约需要 5–10 分钟，状态变成 **Live** 后打开服务地址（`https://<服务名>.onrender.com`），登录页就能看到演示账号

也可以直接点击 README 中的 **Deploy to Render** 按钮，效果相同。

### 3. 之后的维护

- `render.yaml` 没有关闭自动部署：推送到 main 后 Render 会自动重新构建，构建失败会发邮件通知。不需要时可以在服务的 **Settings → Build & Deploy** 里关闭 Auto-Deploy
- 演示账号的密码是 `render.yaml` 里的 `ADMIN_PASSWORD`，只在首次初始化、账号还不存在时生效，要改请在第一次部署前修改
- 手动立即恢复演示数据：在 Render 服务的 **Shell** 中执行 `node dist/demo-reset.js`，或在本地对同一个数据库执行 `pnpm demo:reset`

### 4. 接入 AI（可选）

演示站可以接入 Google Gemini 的免费额度来演示 AI 对话和 AI 数据查询：

1. 在 [Google AI Studio](https://aistudio.google.com) 用 Google 账号创建 API Key
2. 在 Render 服务的 **Environment** 中设置 `AI_API_KEY`（上一步的 key）和 `AI_MODEL`（推荐 `gemini-3.5-flash`）；`AI_API_BASE` 已在 `render.yaml` 中设为 Gemini 的 OpenAI 兼容地址。保存后服务会自动重启

::: tip 模型选择
最新发布的 Flash 模型在免费档上经常因为负载过高返回 503（例如写作本文时的 `gemini-3.8-flash`）。演示环境建议用发布较早的稳定版，如 `gemini-3.5-flash` 或 `gemini-3.5-flash-lite`。遇到报错时，在 Render 的 **Logs** 中搜索「AI 上游返回错误」可以看到上游返回的原因。
:::

演示模式会限制 AI 调用：每个 IP 每小时 20 次、全站每天 300 次、单次输入最多 4000 字符，并限制回复长度，可用 `DEMO_AI_*` 变量调整（见[配置项](/reference/configuration#公开演示)）。免费档的请求数据可能被服务商用于改进产品，演示环境不要输入敏感信息。

::: details 启动时报错无法创建只读账号
启动时会创建 AI 数据查询用的只读账号 `castor_kit_ro`。如果 Neon 拒绝创建，在 Neon 的 SQL Editor 中手动执行：

```sql
CREATE ROLE castor_kit_ro LOGIN PASSWORD '<Render 中 POSTGRES_RO_PASSWORD 的值>';
```

然后在 Render 中重新部署。初始化会为已存在的账号更新密码并授权。
:::

::: tip 用 Render 部署正式环境
把 `DEMO_MODE` 改为 `false`，并把 `ADMIN_PASSWORD` 换成强密码即可。但免费实例会休眠、定时任务不会按时运行，正式使用建议选择付费实例，或用方式一、方式二部署到自己的服务器。
:::

## 常用运维命令

```bash
docker compose --env-file .env.production ps               # 查看服务状态
docker compose --env-file .env.production logs -f app      # 查看应用日志
docker compose --env-file .env.production restart app      # 重启应用
docker compose --env-file .env.production down             # 停止服务，保留数据卷
curl -f http://localhost:<APP_PORT>/health                 # 健康检查
```

`/health` 在数据库可用时返回 `{ status: 'healthy', ... }`，否则返回 500。

::: danger 不要随意使用 down -v
`docker compose down -v` 会删除数据卷，数据库和上传文件都会丢失。
:::

## 更新流程

```bash
git pull
docker compose --env-file .env.production up -d --build
```

compose 会用最新代码重新构建镜像并重建 `app` 容器。容器启动时自动执行新的数据库迁移和 RBAC 增量同步：新菜单自动出现并授予超级管理员，已有的用户、角色和自定义数据不会被清除。

建议在更新前备份数据库，见下文。

## 数据持久化与备份

| 卷 | 默认名称 | 内容 |
|---|---|---|
| `postgres_data` | `castor-kit_postgres_data` | PostgreSQL 数据 |
| `app_instance` | `castor-kit_app_instance` | 上传文件 |

需要复用已有的卷时，在 `.env.production` 中设置 `COMPOSE_DB_VOLUME` / `COMPOSE_INSTANCE_VOLUME` 为已有卷名。

备份数据库示例：

```bash
docker compose --env-file .env.production exec db pg_dump -U castor_kit castor_kit > castor_kit_backup.sql
```

::: tip 固定 PostgreSQL 版本
`docker-compose.yml` 中 `db` 使用的镜像标签是 `postgres:alpine`，在新机器上拉取时会得到最新的主版本。PostgreSQL 的数据目录不能跨主版本直接使用，生产环境建议把标签改为固定的主版本。
:::

## 反向代理与 HTTPS

生产环境建议在应用前面放一层反向代理（如 Nginx）处理 TLS。需要注意：

- **转发 `Host` 和协议头**：应用信任一跳代理，会从 `X-Forwarded-For` / `X-Forwarded-Proto` 获取客户端 IP 和协议。`SESSION_COOKIE_SECURE` 留空时，按请求协议自动决定是否给 cookie 加 `Secure` 标志，所以要正确传递 `X-Forwarded-Proto`。
- **WebSocket**：`/ws` 路径需要转发 `Upgrade` 头。WebSocket 握手会校验 `Origin` 与 `Host` 同源（或在 `CORS_ORIGINS` 白名单中），因此代理必须保留原始 `Host`。
- **请求体大小**：应用允许的请求体上限默认为 16MB（`MAX_CONTENT_LENGTH`），导入文件上限为 5MB。Nginx 的 `client_max_body_size` 默认只有 1MB，需要相应调大。
- **流式响应**：AI 对话使用 SSE，应用已在响应头中设置 `X-Accel-Buffering: no` 关闭 Nginx 缓冲。

Nginx 配置示例（假设 `APP_PORT=5000`）：

```nginx
server {
    listen 80;
    server_name example.com;

    client_max_body_size 16m;

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

HTTPS 证书可以使用 Let's Encrypt（例如 Certbot 的 Nginx 插件）申请。启用 HTTPS 后，也可以在 `.env.production` 中显式设置 `SESSION_COOKIE_SECURE=true`。

::: tip 只通过代理访问
使用反向代理时，可以把 `docker-compose.yml` 中的端口映射改为只绑定本机（如 `"127.0.0.1:${APP_PORT:-8080}:5000"`），避免绕过代理直接访问。
:::

## 多副本与定时任务

默认是单个 `app` 容器，定时任务调度器在 web 进程内运行（compose 中 `RUN_SCHEDULER_IN_WEB` 默认为 `true`）。

需要多个应用副本时：

1. 给 web 副本设置 `RUN_SCHEDULER_IN_WEB=false`。
2. 另外运行一个调度进程：使用同一镜像，**覆盖 entrypoint**（而不是 `command`）为 `node dist/worker.js`。

镜像的 `ENTRYPOINT` 是 `docker-entrypoint.sh`，它总是执行 `setup-once` 后启动 `main.js`，不会读取 `command`。因此在 `docker-compose.yml` 中添加调度服务时写成：

```yaml
  worker:
    build: .
    restart: unless-stopped
    entrypoint: ["node", "dist/worker.js"]
    environment:
      # Same variables as the app service (DATABASE_URL, SECRET_KEY, ADMIN_PASSWORD, AI_SQL_DATABASE_URL, ...)
    depends_on:
      db:
        condition: service_healthy
```

调度服务不执行 `setup-once`，数据库初始化仍由 `app` 容器完成。

调度器基于数据库租约，同一个任务同一时间只会被一个进程领取，即使多个进程同时运行调度也不会重复执行。`setup-once` 使用 advisory lock，多个副本同时启动也是安全的。

## 不使用 Docker 部署

需要 Node 22+、pnpm 和 PostgreSQL 14+。

```bash
# 1. 安装依赖并构建
corepack enable
pnpm install --frozen-lockfile
pnpm build

# 2. 在仓库根目录或 apps/api/ 下创建 .env.production，至少包含：
#    DATABASE_URL、SECRET_KEY、ADMIN_PASSWORD、AI_SQL_DATABASE_URL、POSTGRES_RO_PASSWORD

# 3. 初始化数据库（迁移 + RBAC 增量同步 + 只读账号）
NODE_ENV=production node apps/api/dist/setup-once.js

# 4. 启动服务（默认监听 0.0.0.0:5000，可用 PORT 修改）
NODE_ENV=production node apps/api/dist/main.js
```

- `NODE_ENV` 必须在命令行（或进程管理工具）中设置，后端据此决定加载 `.env.production`。
- `AI_SQL_DATABASE_URL` 应指向只读账号，例如 `postgresql://castor_kit_ro:<POSTGRES_RO_PASSWORD>@<host>/<库名>`。只读账号由第 3 步按 `POSTGRES_RO_PASSWORD` 创建。
- 前端构建产物在 `apps/web/dist/`，后端默认从这里提供页面。
- 建议用 systemd、pm2 等进程管理工具托管 `main.js`；独立调度进程为 `apps/api/dist/worker.js`。
- 更新时：`git pull` → `pnpm install --frozen-lockfile` → `pnpm build` → 再次执行第 3 步 → 重启服务。
