# 开始一个项目

castor-kit 是起点，不是装进项目里的依赖库：你的产品是一个仓库，从某个 castor-kit 版本复制出来，然后在上面继续开发。本页说明如何创建这个仓库、给产品命名、隐藏组件示例中心、上线，以及之后如何合并 castor-kit 的新版本。

## 1. 创建仓库

从某个版本的 tag 开始，并把 castor-kit 保留为第二个远端，之后的新版本就可以直接合并：

```bash
git clone --branch v0.3.0 https://github.com/robeshell/castor-kit.git my-app
cd my-app
git switch -c main
git remote rename origin upstream
git remote add origin git@github.com:your-org/my-app.git
git push -u origin main
```

然后按[快速开始](/zh/guide/getting-started)的「本地开发」安装依赖、创建数据库、启动开发服务。

## 2. 给产品命名

| 内容 | 位置 |
|---|---|
| 前端里的名称：浏览器标签页标题、侧边栏字标、登录页页脚、下载文件名 | `apps/web/src/lib/brand.ts` 里的 `APP_NAME` |
| 应用加载前的页面标题和描述 | `apps/web/index.html` 里的 `<title>` 和 `<meta name="description">` |
| Logo 和 favicon | 替换 `apps/web/src/assets/castor-logo.png`（由 `components/app/BrandMark.tsx` 引入；favicon 链接在 `index.html`） |
| 服务端显示的名称：身份验证器 App 里的发行方、默认发件人、测试邮件、AI 助手的自我介绍、日志 | 环境变量 `APP_NAME`（见[配置](/zh/reference/configuration)） |
| 数据库名 | `DEV_DATABASE_URL` / `TEST_DATABASE_URL` / `DATABASE_URL`；默认是 `castor_kit` 和 `castor_kit_test` |
| 首页内容（快捷入口、技术栈面板） | `apps/web/src/modules/admin/pages/dashboard/index.tsx`，和其他页面一样是示例 |

下面这些虽然带着 castor，但请保持不变：

- 内部包名 `@castor-kit/*`：脚本和 `pnpm --filter` 命令都用到它，用户也看不到。
- 会话 Cookie 名和密钥派生标签（`castor-kit-session`、`castor-kit-secret-box` 等）：改了会让所有人掉线，已保存的密钥（SMTP / S3 / AI）也无法再解密。
- Webhook 请求头 `X-Castor-Event` / `X-Castor-Signature` 等：接收方要靠它们做校验。

## 3. 隐藏组件示例中心

组件示例中心（36 个示例页面）是 AI 助手照着写的参考，AGENTS.md 的「Page patterns (which page to copy)」就指向它。建议保留代码、只对用户隐藏：在 `apps/api/scripts/seed-rbac.ts` 里把根菜单设为停用：

```ts
{ id: 3, name: "组件示例中心", code: "component_center", …, is_visible: true, is_active: false },
```

然后运行 `pnpm seed:rbac -- --incremental`（部署时每次启动都会经 `setup-once` 自动执行）。示例中心会从侧边栏、⌘K 和路由里消失（地址返回 404），首页的示例快捷入口也会隐藏。它的接口仍然注册着，但需要示例中心的权限；除非你把这些权限分给某个角色，否则只有超级管理员有。示例页面只在打开时才加载，不会增加用户的下载量。

目前还不支持直接删除示例中心：框架自己的测试把它的模块当作测试对象在用。

## 4. 上线前

- 生产环境必须设置 `SECRET_KEY` 和 `ADMIN_PASSWORD`（缺了服务会拒绝启动）。`scripts/setup.sh` 会生成 `SECRET_KEY` 并询问管理员密码：请填强密码，留空会回退为 `admin123`。
- `DEMO_MODE` 保持关闭（默认即关闭），它只用于公开演示站。
- 用 Docker Compose 或其他方式部署：见[部署指南](/zh/deploy/)。

## 5. 开发功能

描述一个功能，让 AI 助手运行 `/new-feature-autopilot`；或者自己写 spec，运行 `pnpm scaffold -- --spec`：见 [AI 工作流](/zh/guide/ai-workflow)。不是普通列表的页面，照着组件示例中心里对应的页面模板来写（见[组件示例中心](/zh/guide/components#from-a-pattern)）。

## 6. 合并 castor-kit 的新版本

```bash
git fetch upstream --tags
git merge v0.4.0
```

先读一遍该版本的 CHANGELOG。冲突通常出现在双方都会扩展的文件里，比如 `seed-rbac.ts`（两边的菜单都保留），按常规方式解决即可。

**如果你自上次合并以来加过自己的迁移，迁移需要多一步处理。**这时双方都有一个编号相同的迁移，`apps/api/drizzle/meta/_journal.json` 和一个快照文件会冲突。保留你自己的迁移历史，把新版本的表结构改动变成你自己的一个新迁移：

```bash
# 1. 列出新版本新增的迁移（第 4 步要用）
git diff --name-only --diff-filter=A HEAD MERGE_HEAD -- 'apps/api/drizzle/*.sql'
# 2. 把 apps/api/drizzle 恢复成你的版本（新版本的迁移文件会被去掉）
git restore --source=HEAD --staged --worktree apps/api/drizzle
# 3. 为新版本的表结构改动生成一个迁移（它的 schema 代码已经合并进来）
pnpm db:generate --name upstream_v0_4_0
```

4. 逐个打开第 1 步列出的迁移（`git show MERGE_HEAD:apps/api/drizzle/<file>.sql`），把其中不是表 / 列改动的语句（`INSERT`、`UPDATE`、`DELETE` 等）复制到新迁移的末尾，每条前面加一行 `--> statement-breakpoint`。
5. 提交这次合并，运行 `pnpm db:migrate` 和 `pnpm verify`。

如果自上次合并以来你没有加过自己的迁移，新版本的迁移会干净地合并进来，`pnpm db:migrate` 直接执行即可。
