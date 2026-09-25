# 部署指南

## Docker 部署（推荐）

Docker 是官方推荐的部署方式，一条命令即可启动 PostgreSQL + Node 服务（Fastify 后端同时提供构建好的 React 前端），并在容器启动时自动完成 Drizzle 迁移、RBAC 同步和 AI SQL 只读账号初始化。

### 1. 使用安装向导（最简单）

```bash
bash setup.sh
```

向导会生成 `.env.production`（随机 `SECRET_KEY`、数据库密码、只读账号密码），然后执行构建并启动。默认端口为 5000。

### 2. 或者手动配置环境变量

```bash
cp .env.example .env.production
```

编辑 `.env.production`，至少设置以下四项（`docker-compose.yml` 中缺任何一项都会拒绝启动）：

```env
SECRET_KEY=64位以上的随机字符串     # 必填 — 会话加密密钥
ADMIN_PASSWORD=你的管理员密码       # 必填 — 初始管理员密码
POSTGRES_PASSWORD=数据库密码        # 必填 — PostgreSQL 密码
POSTGRES_RO_PASSWORD=只读账号密码   # 必填 — AI SQL 只读账号 castor_kit_ro 的密码
```

然后构建并启动：

```bash
docker compose --env-file .env.production up -d --build
```

首次运行需要 2–5 分钟（拉取镜像 + 安装依赖 + 构建前后端）。后续启动很快。

### 3. 访问应用

打开 **http://localhost:8080**（或 `APP_PORT` 中配置的端口；使用向导时默认 5000），使用 `admin` / `<ADMIN_PASSWORD>` 登录。

### 容器启动时发生了什么

镜像基于 `node:22-alpine`，以非 root 用户运行。入口脚本 `docker-entrypoint.sh` 依次执行：

1. `node dist/setup-once.js`：在 PostgreSQL advisory lock 保护下执行迁移 → RBAC 增量同步 → 创建 / 更新 AI SQL 只读账号（多副本同时启动也只会有一个实例执行）
2. `node dist/main.js`：启动服务，监听容器内 5000 端口，`/health` 用于健康检查

---

## 环境变量参考

| 变量 | 默认值 | 说明 |
|---|---|---|
| `SECRET_KEY` | _（必填）_ | 会话加密密钥（castor-kit 用 HKDF 从它派生 cookie 密钥）。 |
| `ADMIN_PASSWORD` | _（必填）_ | `admin` 账号的初始密码。 |
| `POSTGRES_PASSWORD` | _（必填）_ | PostgreSQL 服务密码。 |
| `POSTGRES_RO_PASSWORD` | _（必填）_ | AI SQL 只读账号密码；compose 会自动拼出 `AI_SQL_DATABASE_URL`。 |
| `APP_PORT` | `8080` | 映射到 app 容器的主机端口（向导默认写入 5000）。 |
| `AI_API_KEY` | _（空）_ | AI 功能 API Key，留空则 AI 页面不可用。 |
| `AI_API_BASE` | _（空）_ | OpenAI 兼容接口地址（如 `https://api.openai.com/v1`、Azure OpenAI、本地代理）。 |
| `AI_MODEL` | _（空）_ | 模型名称，如 `gpt-4o`。 |
| `ENABLE_TASK_SCHEDULER` | `true` | 是否启用定时任务调度。 |
| `RUN_SCHEDULER_IN_WEB` | `true` | 是否在 web 进程内运行调度器（多副本部署建议 `false` 并单独运行 worker）。 |
| `SESSION_TTL_HOURS` | `8` | 会话有效期（小时）。 |
| `SESSION_COOKIE_SECURE` | _（空 = auto）_ | 空值时仅在 HTTPS 请求下给 cookie 打 `Secure` 标志。 |
| `CORS_ORIGINS` | _（空）_ | 允许跨域的来源列表，逗号分隔。 |
| `COMPOSE_DB_VOLUME` / `COMPOSE_INSTANCE_VOLUME` | `castor-kit_postgres_data` / `castor-kit_app_instance` | 数据库与上传文件的数据卷名。 |

::: warning
生产环境（`NODE_ENV=production`）缺少 `SECRET_KEY`、`ADMIN_PASSWORD` 或 `AI_SQL_DATABASE_URL` 时服务会拒绝启动。若未设置 `AI_API_KEY`，AI 对话和 AI 提示词工坊页面将报错，其他功能正常运行。
:::

---

## 常用命令

```bash
# 实时查看应用日志
docker compose logs -f app

# 停止所有容器（保留数据库数据）
docker compose down

# 停止所有容器并删除数据库 volume
docker compose down -v

# 代码更新后重新构建
docker compose --env-file .env.production up -d --build
```

---

## 手动服务器部署

适合在没有 Docker 的 VPS 或裸机服务器上部署。需要 Node 22+、pnpm 和 PostgreSQL 14+。

### 1. 安装依赖并构建

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

前端产物在 `apps/web/dist/`，后端产物在 `apps/api/dist/`；Node 服务在生产模式下会直接提供前端静态文件。

### 2. 配置环境变量

```bash
cp .env.example .env.production
```

编辑 `.env.production`（放在仓库根目录或 `apps/api/` 下均可）：

```env
SECRET_KEY=你的强随机密钥
DATABASE_URL=postgresql://用户:密码@localhost/castor_kit
ADMIN_PASSWORD=你的管理员密码
POSTGRES_RO_PASSWORD=只读账号密码
AI_SQL_DATABASE_URL=postgresql://castor_kit_ro:只读账号密码@localhost/castor_kit
```

### 3. 初始化数据库

```bash
NODE_ENV=production node apps/api/dist/setup-once.js
```

它会执行迁移、同步 RBAC 数据，并按 `POSTGRES_RO_PASSWORD` 创建只读账号 `castor_kit_ro`。

### 4. 启动服务

```bash
NODE_ENV=production node apps/api/dist/main.js
```

默认监听 `0.0.0.0:5000`，可用 `PORT` 环境变量修改。建议用 systemd 或 pm2 托管进程。

::: tip 独立调度进程
多实例部署时，给 web 进程设置 `RUN_SCHEDULER_IN_WEB=false`，再单独运行一个调度进程：
```bash
NODE_ENV=production node apps/api/dist/worker.js
```
:::

---

## Nginx 反向代理

在 Node 服务前面加上 Nginx 处理 TLS、压缩和静态文件缓存。

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # WebSocket 支持（组件示例中心的 WebSocket / 性能监控页面）
    location /ws {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
    }
}
```

::: tip TLS / HTTPS
使用 [Certbot](https://certbot.eff.org/) 的 Nginx 插件申请并自动续期免费的 Let's Encrypt 证书：
```bash
certbot --nginx -d your-domain.com
```
:::

---

## 版本更新

### Docker

```bash
git pull
docker compose --env-file .env.production up -d --build
```

Compose 会用最新代码重新构建镜像，容器启动时自动执行迁移与 RBAC 同步，无需任何手动操作。

### 手动部署

```bash
git pull
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production node apps/api/dist/setup-once.js
# 重启 Node 服务（例如通过 systemd）
sudo systemctl restart castor-kit
```
