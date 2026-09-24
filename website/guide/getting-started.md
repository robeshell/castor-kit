# 快速开始

::: info castor-kit 与 AuraStack
castor-kit 是 AuraStack（Flask 版）的 Node.js/TypeScript 重写版：后端换成 Fastify + Drizzle，React 前端沿用原有路由与功能、UI 从 Semi Design 迁移到 shadcn/ui + Tailwind CSS v4，直连同一套 PostgreSQL 表结构，API 契约兼容。
:::

## 环境要求

根据你的使用场景选择对应的方式：

| 方式 | 环境要求 |
|---|---|
| **Docker（推荐）** | 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 即可，无需其他依赖 |
| **本地开发** | Node 22+、pnpm（`corepack enable` 即可）、PostgreSQL 14+ |

---

## Docker 一键启动（推荐）

Docker 是运行 castor-kit 最快的方式，安装向导会自动完成所有配置。

### 1. 安装 Docker Desktop

下载并安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)，等待左下角状态图标变为绿色（"Running"）后继续。

### 2. 克隆仓库并运行安装向导

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh
```

向导会引导你设置管理员密码、访问端口，以及可选的 AI 功能配置，并自动生成 `SECRET_KEY`、数据库密码和 AI SQL 只读账号密码，写入 `.env.production`。首次运行大约需要 3–5 分钟。

### 3. 访问应用

打开 **http://localhost:5000**（向导中设置的端口，默认 5000），使用以下账号登录：

- **用户名：** `admin`
- **密码：** 安装时设置的密码（默认：`admin123`）

::: tip 手动 Docker 启动
如果不想使用向导，可以手动配置：

```bash
cp .env.example .env.production
# 编辑 .env.production，至少设置：
#   SECRET_KEY / ADMIN_PASSWORD / POSTGRES_PASSWORD / POSTGRES_RO_PASSWORD
docker compose --env-file .env.production up -d --build
```

未设置 `APP_PORT` 时对外端口为 **8080**。
:::

---

## 本地开发环境

适合需要修改源码、实时查看改动效果的场景。castor-kit 是 pnpm monorepo，所有命令都在仓库根目录执行。

### 1. 克隆仓库并安装依赖

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
corepack enable        # 启用 package.json 中锁定的 pnpm 版本
pnpm install
```

### 2. 配置环境变量

```bash
cp apps/api/.env.example apps/api/.env.development
```

编辑 `apps/api/.env.development`，至少填写数据库连接：

```env
DEV_DATABASE_URL=postgresql://用户名@localhost/aurastack
```

开发环境下 `NODE_ENV` 默认为 `development`，`SECRET_KEY` 与 `ADMIN_PASSWORD` 可以不填（分别使用内置的开发密钥和 `admin123`）。

### 3. 初始化数据库

```bash
# 创建数据库
createdb aurastack

# 执行 Drizzle 迁移（空库会建出全部表）
pnpm db:migrate

# 初始化 RBAC 数据（菜单、超级管理员角色、管理员账号）
pnpm seed:rbac
```

::: warning seed:rbac 只在空库上全量执行
不带参数的 `pnpm seed:rbac` 会清空并重建账号、角色和菜单，只用于首次初始化。之后菜单变更请用 `pnpm seed:rbac -- --incremental`。
:::

### 4. 启动前后端服务

```bash
pnpm dev
```

它会同时启动 Fastify 后端（端口 5001，`tsx watch` 热重载）和 Vite 前端（端口 5173，`/api`、`/ws` 请求自动转发到后端）。也可以分别用 `pnpm dev:api`、`pnpm dev:web` 在两个终端启动。

打开 **http://localhost:5173**，使用 `admin` / `admin123` 登录。

::: tip macOS 双击启动
数据库初始化完成后，也可以直接双击项目根目录下的 **`启动castor-kit.command`**，它会依次执行 `pnpm install`、`pnpm setup-once`、`pnpm dev`。
:::

---

## AI 工具准备

castor-kit 已为所有主流 AI 编码工具预配置上下文，clone 之后开箱即用。选择你习惯的工具即可。

### Claude Code（推荐）

```bash
# 安装
npm install -g @anthropic-ai/claude-code

# 在项目目录启动
cd castor-kit
claude
```

启动后 Claude Code 会自动读取 `CLAUDE.md` 和 `AGENTS.md`，无需额外配置。使用内置技能：

```
/new-feature-autopilot
```

### Cursor

1. 下载安装 [Cursor](https://cursor.sh)
2. 用 Cursor 打开项目目录
3. `.cursor/rules/` 中的规则会自动加载，直接在对话框描述需求即可

### GitHub Copilot

1. 在 VS Code 中安装 **GitHub Copilot** 扩展
2. 用 VS Code 打开项目目录
3. `.github/copilot-instructions.md` 会自动注入项目上下文
4. 使用 Copilot Chat（`Ctrl+Shift+I`）描述需求

### Windsurf

1. 下载安装 [Windsurf](https://codeium.com/windsurf)
2. 用 Windsurf 打开项目目录
3. `.windsurfrules` 自动加载，在 Cascade 中描述需求

### Codex CLI

```bash
# 安装
npm install -g @openai/codex

# 在项目目录使用
cd castor-kit
codex "创建一个客户管理页面，字段：姓名、电话、公司、状态"
```

Codex CLI 原生读取 `AGENTS.md`，`CODEX.md` 提供额外的命令与权限说明。

### MCP 客户端（Claude Desktop 等）

castor-kit 自带 MCP Server（`apps/mcp`），把脚手架、验证门禁、RBAC 同步、迁移等工具暴露给 MCP 客户端。在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "castor-kit": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/castor-kit", "-s", "mcp"]
    }
  }
}
```

---

## AI 开发流程

以 Claude Code 为例，完整流程如下：

### 1. 描述需求

```
/new-feature-autopilot

创建一个客户管理页面，字段：姓名、电话、公司、状态（启用/禁用）
```

### 2. AI 自动推断技术规格

AI 会读取 `AGENTS.md` 和 `docs/templates/`，自动推断：

- 数据表字段类型（Drizzle 写法）
- API 路由命名
- 前端页面路径
- RBAC 权限编码与菜单 ID

**无需你回答任何技术问题。**

### 3. 确认业务预览

AI 展示将要创建的内容供你确认，例如：

```
📋 客户管理

位置：系统管理 → 客户管理
功能：列表查看、新增、编辑、删除、导入、导出
字段：
  · 姓名（必填）
  · 电话
  · 公司
  · 状态

确认这样做吗？或者需要调整什么？
```

### 4. 自动生成完整模块

确认后 AI 运行 `pnpm scaffold` 并补全业务逻辑，依次生成：

| 文件 | 内容 |
|---|---|
| `apps/api/src/db/schema/admin/customer.ts` | Drizzle 表定义 + `toDict` |
| `apps/api/src/modules/admin/customer/schema.ts` | Zod 校验、导入导出字段映射 |
| `apps/api/src/modules/admin/customer/repository.ts` | 数据库读写 |
| `apps/api/src/modules/admin/customer/service.ts` | 业务逻辑 |
| `apps/api/src/modules/admin/customer/routes.ts` | Fastify 路由 + 权限检查 |
| `apps/web/src/modules/admin/pages/customer/index.jsx` | React 列表页（含导入导出） |
| `apps/api/drizzle/` | Drizzle SQL 迁移文件 |
| `apps/api/scripts/seed-rbac.ts` | 菜单 + 按钮权限条目 |

随后执行 `pnpm seed:rbac -- --incremental` 同步权限、`pnpm setup-once` 应用迁移，并用 `psql \d` 确认表已真实落库。

### 5. 验证

```bash
pnpm verify -- --module customer
```

全部通过后，功能即可上线。
