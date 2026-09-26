# 快速开始

castor-kit 有两种运行方式：

| 方式 | 适用场景 | 环境要求 |
|---|---|---|
| Docker 一键启动 | 体验、演示、部署 | Docker（含 `docker compose` 插件） |
| 本地开发 | 修改源码、用 AI 开发新功能 | Node 22+、pnpm、PostgreSQL 14+ |

## Docker 一键启动

### 1. 克隆仓库并运行安装向导

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh
```

`setup.sh` 会依次完成：

1. 检查 Docker 与 `docker compose` 是否可用。
2. 询问管理员密码（回车使用 `admin123`）、访问端口（回车使用 `5000`），以及是否配置 AI 功能（OpenAI 兼容接口的 API Key、Base URL、模型名）。
3. 随机生成 `SECRET_KEY`、数据库密码和 AI SQL 只读账号密码，写入仓库根目录的 `.env.production`。如果该文件已存在，会先询问是否重新配置。
4. 执行 `docker compose --env-file .env.production up -d --build` 构建并启动服务。
5. 轮询 `http://localhost:<端口>/health`，直到服务就绪。

首次运行需要下载依赖和构建镜像，通常需要几分钟。

::: warning setup.sh 会修改 Docker 配置
如果 Docker 的 `daemon.json` 里还没有 `registry-mirrors`，脚本会写入一个镜像加速地址并重启 Docker。不需要镜像加速时，可以跳过向导，按 [部署指南](/deploy/) 手动配置并启动。
:::

### 2. 登录

打开 `http://localhost:5000`（或向导中设置的端口），使用以下账号登录：

- 用户名：`admin`
- 密码：向导中设置的密码（默认 `admin123`）

### 3. 常用操作

所有 `docker compose` 命令都要带上 `--env-file .env.production`，否则 compose 读不到必填变量会直接报错：

```bash
docker compose --env-file .env.production logs -f app   # 查看应用日志
docker compose --env-file .env.production down          # 停止服务（保留数据卷）
docker compose --env-file .env.production up -d         # 重新启动
```

更多内容（手动配置、更新、反向代理）见 [部署指南](/deploy/)。

## 本地开发

所有命令都在仓库根目录执行。

### 1. 准备环境

- Node 22 及以上（仓库根目录的 `.nvmrc` 为 `22`）
- pnpm（版本见根目录 `package.json` 的 `packageManager` 字段，可用 `corepack enable` 启用）
- 本机 PostgreSQL 14 及以上，并能用 `createdb` / `psql` 连接

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置数据库连接

```bash
cp apps/api/.env.example apps/api/.env.development
```

`apps/api/.env.development` 已被 gitignore。示例文件中的 `DEV_DATABASE_URL` 为 `postgresql://localhost/castor_kit`，按本机情况修改用户名、密码和库名。其他可选配置见 [配置项](/reference/configuration)。

::: tip 配置文件的加载顺序
后端按 `NODE_ENV`（默认 `development`）加载 `.env.<NODE_ENV>`：先读 `apps/api/`，再读仓库根目录；已经存在的环境变量不会被覆盖。
:::

### 4. 创建数据库并初始化

```bash
createdb castor_kit
pnpm db:migrate      # 执行 Drizzle 迁移，创建所有表
pnpm seed:rbac       # 写入菜单、超级管理员角色和 admin 账号
```

也可以用一条命令完成迁移和 RBAC 同步：

```bash
pnpm setup-once      # 迁移 + RBAC 增量同步 + AI SQL 只读账号（未设置 POSTGRES_RO_PASSWORD 时跳过）
```

::: warning pnpm seed:rbac 是全量重建
不带参数的 `pnpm seed:rbac` 会清空用户、角色、菜单及其关联后重新写入，只适合空库初始化。已有数据的库请使用 `pnpm seed:rbac -- --incremental`，详见 [权限 RBAC](/guide/rbac)。
:::

### 5. 启动开发服务

```bash
pnpm dev
```

这会同时启动：

| 服务 | 地址 | 说明 |
|---|---|---|
| 后端 | `http://localhost:5001` | `tsx watch` 热重载 |
| 前端 | `http://localhost:5173` | Vite 开发服务器，`/api` 和 `/ws` 代理到 5001 |

打开 `http://localhost:5173`，用 `admin` / `admin123` 登录。

也可以分别启动：`pnpm dev:api`、`pnpm dev:web`。

::: tip 默认账号
开发环境未设置 `ADMIN_PASSWORD` 时，初始密码为 `admin123`。`admin` 账号只在不存在时创建，之后修改 `ADMIN_PASSWORD` 不会改变已有账号的密码，请在界面上修改。
:::

### 6. 运行测试（可选）

后端测试连接真实的 PostgreSQL 测试库（默认 `postgresql://localhost/castor_kit_test`，可用 `TEST_DATABASE_URL` 覆盖），测试开始前会自动执行迁移：

```bash
createdb castor_kit_test      # 或者克隆开发库：createdb -T castor_kit castor_kit_test
pnpm test
```

## 可选：AI 功能

组件示例中心的 AI 对话、AI 提示词工坊、AI 数据查询需要一个模型服务：OpenAI 兼容接口（DeepSeek、通义千问、Ollama 等），或直接使用 OpenAI / Anthropic / Google。登录后在「系统管理 → 系统配置 → 系统设置」的「AI」页签选择服务类型，填写接口地址、API Key 和模型，点「测试调用」确认可用，保存后立即生效。

也可以写在 `apps/api/.env.development` 里（这样页面上这几项变成只读）：

```bash
AI_PROVIDER=openai-compatible   # 或 openai / anthropic / google
AI_API_BASE=https://api.openai.com/v1
AI_API_KEY=<你的 API Key>
AI_MODEL=<模型名>
```

未配置时这些页面会提示未配置，其他功能不受影响。

## 可选：本地运行定时任务

开发环境下 web 进程默认不启动定时任务调度器。需要让任务按 cron 执行时，二选一：

- 在 `apps/api/.env.development` 中设置 `RUN_SCHEDULER_IN_WEB=true`
- 另开终端运行独立调度进程：`pnpm --filter @castor-kit/api worker`

## 下一步

- [项目结构](/guide/project-structure)
- [AI 驱动开发](/guide/ai-workflow)：用 AI 交付第一个功能
- [命令速查](/reference/commands)
