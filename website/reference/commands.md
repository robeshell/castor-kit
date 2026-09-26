# 命令速查

所有 `pnpm` 命令都在仓库根目录执行。

::: tip 关于参数前的 --
castor-kit 自己的脚本（`scaffold`、`verify`、`seed:rbac`、`openapi:*`）参数前的 `--` 可写可不写。**`pnpm db:generate` 后面不能写 `--`**，因为参数会直接交给 drizzle-kit，它不认识 `--`。
:::

## 开发

| 命令 | 说明 |
|---|---|
| `pnpm install` | 安装全部依赖 |
| `pnpm dev` | 同时启动后端（5001）和前端（5173） |
| `pnpm dev:api` | 只启动后端（`tsx watch` 热重载） |
| `pnpm dev:web` | 只启动前端（Vite） |
| `pnpm --filter @castor-kit/api worker` | 启动独立的定时任务调度进程 |
| `pnpm build` | 构建全部应用：前端（Vite）、后端（tsup）、MCP Server |
| `pnpm --filter @castor-kit/web preview` | 预览前端构建产物 |

## 质量检查

| 命令 | 说明 |
|---|---|
| `pnpm typecheck` | TypeScript 类型检查（`apps/api`、`apps/mcp`） |
| `pnpm test` | 运行全部测试（后端需要测试库 `castor_kit_test`） |
| `pnpm --filter @castor-kit/api test` | 只运行后端测试 |
| `pnpm --filter @castor-kit/web test` | 只运行前端测试 |
| `pnpm --filter @castor-kit/web test:watch` | 前端测试监听模式 |
| `pnpm lint` | 后端 ESLint |
| `pnpm --filter @castor-kit/web lint` | 前端 ESLint |
| `node apps/web/scripts/i18n-scan.mjs [目录]` | 扫描未翻译文案，目录相对 `apps/web`，省略时扫描整个 `src` |

## 数据库

| 命令 | 说明 |
|---|---|
| `pnpm db:generate --name <描述>` | 根据表定义生成迁移 SQL 到 `apps/api/drizzle/` |
| `pnpm db:migrate` | 应用迁移 |
| `psql -d <库名> -c '\d <表名>'` | 确认表结构已真实落库 |
| `pnpm setup-once` | 迁移 + RBAC 增量同步 + AI SQL 只读账号，带 advisory lock，可重复执行 |
| `pnpm --filter @castor-kit/api init-ro-role` | 单独创建 AI SQL 只读账号 `castor_kit_ro`（需要 `POSTGRES_RO_PASSWORD`） |

## RBAC

| 命令 | 说明 |
|---|---|
| `pnpm seed:rbac -- --incremental` | 增量同步菜单与权限：按 `code` upsert，不删除 |
| `pnpm seed:rbac` | 全量重建：清空用户、角色、菜单后重写，**仅用于空库初始化** |

## 代码生成与门禁

| 命令 | 说明 |
|---|---|
| `pnpm scaffold -- --name <name> --domain <admin\|component_center> --fields "<字段:类型,...>"` | 生成后端模块、前端页面、接口测试和迁移 |
| `pnpm scaffold -- ... --dry-run` | 只打印将生成的内容，不写文件 |
| `pnpm scaffold -- ... --skip-migration` | 生成代码但不生成迁移 |
| `pnpm scaffold -- ... --data-scope` | 生成的模块按数据权限过滤（加 `dept_id` / `created_by`） |
| `pnpm verify -- --module <name>` | 运行全部门禁检查 |
| `pnpm verify -- --module <name> --skip-build` | 跳过前端构建 |
| `pnpm verify -- --module <name> --json` | 输出结构化 JSON |
| `pnpm verify -- --module <name> --skip-frontend-tests --skip-api-tests` | 跳过前后端测试 |
| `pnpm verify -- --module <name> --skip-db` | 不连接数据库（跳过 `migration_applied`） |
| `pnpm verify -- --module <name> --run-rbac-sync` | 额外执行一次 RBAC 增量同步 |
| `pnpm verify -- --module <name> --strict-docs` | 文档路径检查失败时阻断 |
| `pnpm verify -- --module <name> --database-url <url>` | 指定检查迁移状态所用的数据库 |

`scaffold` 与 `verify` 都支持 `-h` / `--help` 打印用法。参数说明见 [AI 驱动开发](/guide/ai-workflow)。

## OpenAPI

| 命令 | 说明 |
|---|---|
| `pnpm openapi:generate` | 从 Fastify 路由补齐 `docs/apifox-full.openapi.json` |
| `pnpm openapi:generate -- --dry-run` | 只统计覆盖率，不写回 |
| `pnpm openapi:generate -- --strict` | 仍有只含骨架的路径时以非 0 退出 |
| `pnpm openapi:apifox` | 推送到 Apifox（需要 `APIFOX_PROJECT_ID`、`APIFOX_ACCESS_TOKEN`） |

## MCP Server

| 命令 | 说明 |
|---|---|
| `pnpm mcp` | 启动 MCP Server（stdio） |
| `pnpm --filter @castor-kit/mcp build` | 构建到 `apps/mcp/dist/` |

## 前端组件

| 命令 | 说明 |
|---|---|
| `apps/web/scripts/shadcn-add.sh <组件>` | 经本地 registry 中转执行 `npx shadcn@latest add` |
| `apps/web/scripts/shadcn-add.sh --view <组件>` | 只查看 registry 内容，不写文件 |

## Docker

在仓库根目录执行。compose 命令需要带 `--env-file .env.production`。

| 命令 | 说明 |
|---|---|
| `bash setup.sh` | 交互式向导：生成 `.env.production` 并构建启动 |
| `docker compose --env-file .env.production up -d --build` | 构建镜像并启动（代码更新后同样使用） |
| `docker compose --env-file .env.production logs -f app` | 查看应用日志 |
| `docker compose --env-file .env.production ps` | 查看服务状态 |
| `docker compose --env-file .env.production down` | 停止服务，保留数据卷 |

## 文档站

文档站 `website/` 是独立的 npm 项目，不在 pnpm workspace 内：

| 命令 | 说明 |
|---|---|
| `npm --prefix website install` | 安装文档站依赖 |
| `npm --prefix website run dev` | 本地预览文档站 |
| `npm --prefix website run build` | 构建文档站（会检查死链） |
| `npm --prefix website run screenshots` | 从运行中的应用重新截取落地页和 README 的截图（需先 `pnpm dev`，会提示输入 admin 密码） |

合入 main 后，文档站由 `.github/workflows/docs.yml` 自动发布到 GitHub Pages。
