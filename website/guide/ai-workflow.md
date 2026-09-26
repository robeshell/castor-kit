# AI 驱动开发

castor-kit 的目标是：你用自然语言描述业务需求，AI 编程工具自行推断技术细节，端到端交付符合项目规范的功能模块（数据表、接口、页面、权限、迁移），并通过验证门禁。

本页介绍这套流程依赖的四样东西：项目上下文 `AGENTS.md`、各 AI 工具的配置、代码骨架生成器 `pnpm scaffold` 和验证门禁 `pnpm verify`。

## AGENTS.md：唯一的项目上下文

仓库根目录的 `AGENTS.md` 是写给 AI 的完整项目说明，所有 AI 工具都以它为准。内容包括：

- 技术栈、目录结构和命名规则
- 后端分层规则、路由规范、权限检查写法、横切约定（时间、数值、错误、CSRF）
- 前端动态路由、页面结构、公共组件、设计 tokens、多语言规则
- 导入导出规范、RBAC 约定、菜单 ID 分配规则和当前菜单树
- 字段类型推断表（业务描述 → 字段类型）
- 反模式清单和标准交付流程

各工具的专属配置文件只做补充，并都指回 `AGENTS.md`。修改项目约定时，应当先改 `AGENTS.md`。

更深入的架构说明在 `docs/architecture.md`，前端 UI 方案在 `docs/frontend-redesign-plan.md`。

## 支持的 AI 工具

| 工具 | 读取的文件 |
|---|---|
| Claude Code | `CLAUDE.md`；技能在 `.claude/skills/`（`new-feature-autopilot`、`shadcn-ui-skills`） |
| Codex CLI | `AGENTS.md`（自动读取）+ `CODEX.md`；技能在 `.agents/skills/` |
| Cursor | `.cursor/rules/castor-kit-always.mdc`（始终生效）、`.cursor/rules/new-feature-autopilot.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Windsurf | `.windsurfrules` |
| 其他工具 | `llms.txt`（入口索引） |
| MCP 客户端 | `apps/mcp`，见下文 [MCP Server](#mcp-server) |

`.claude/skills/` 与 `.agents/skills/` 的内容保持一致，后端测试 `skills-sync.test.ts` 会检查两者是否同步。

## 新功能交付流程

`new-feature-autopilot` 技能（Claude Code 中输入 `/new-feature-autopilot`，或直接说“做一个 XX 功能”）按以下五步执行。其他工具通过各自的规则文件遵循同样的流程。

### 1. 读取上下文

AI 读取 `AGENTS.md`、`docs/templates/` 下的代码骨架模板、现有的参考模块（后端 `apps/api/src/modules/admin/users/`，前端 `apps/web/src/modules/admin/pages/users/index.jsx`），以及 `apps/api/scripts/seed-rbac.ts` 中的菜单树。如果需求可以通过扩展已有模块实现，会优先扩展。

### 2. 推断技术规格

AI 在内部推断以下内容，不向你询问：

- 资源名和所属域（`admin` 或 `component_center`）
- 接口路径，例如 `/api/admin/customer-orders`
- 字段名与字段类型（依据下方的字段类型推断表）
- 权限编码：`admin` 域为 `system_<name>`，`component_center` 域为 `cc_<name>`，按钮权限加 `_add` / `_edit` / `_delete` / `_export` / `_import`
- 前端文件路径、菜单 ID、父菜单、迁移名称

### 3. 展示业务预览

AI 只展示业务层面的信息，等你确认或调整：

```text
客户管理

位置：系统管理 → 客户管理
功能：列表查看、新增、编辑、删除、导入、导出
字段：
  · 客户名称（必填）
  · 联系电话
  · 状态

确认这样做吗？或者需要调整什么？
```

只有在数据模型存在不可逆的歧义、需要外部系统配置、或权限边界有安全影响时，AI 才会额外提问。

### 4. 实现

1. `pnpm scaffold` 生成骨架（先 `--dry-run` 预览）。
2. 按 `db/schema → schema → repository → service → routes` 顺序补充业务逻辑、中文表头和校验。
3. 打磨前端页面：中文标签、表单校验、枚举字段、多语言译文。
4. 在 `seed-rbac.ts` 添加菜单和按钮权限，运行 `pnpm seed:rbac -- --incremental`。
5. 审查新生成的迁移 SQL，运行 `pnpm db:migrate`，并用 `psql -d <库名> -c '\d <表名>'` 确认表真实存在。
6. 运行 `pnpm openapi:generate` 为新接口补骨架，再按 `AGENTS.md`「OpenAPI 编写规范」照代码补全（必须，`pnpm verify` 会检查）。

### 5. 验证门禁

运行 `pnpm verify -- --module <name>`，失败项由 AI 修复后重新验证。全部通过后输出交付报告，报告中注明迁移版本（如“已迁移至 0001_customer”）。

::: warning 迁移必须真实落库
只生成迁移文件、只通过静态检查都不算完成。必须执行 `pnpm db:migrate`，用 `psql \d` 确认，并且 `pnpm verify` 的 `migration_applied` 检查通过。
:::

## pnpm scaffold

`pnpm scaffold` 根据字段定义一次生成后端模块、前端页面、接口测试和迁移。

```bash
# 预览将生成的文件，不写入
pnpm scaffold -- --name customer --domain admin --fields "name:str,phone:str20,status:str20" --dry-run

# 正式生成
pnpm scaffold -- --name customer --domain admin --fields "name:str,phone:str20,status:str20"
```

### 参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--name` | 资源名，snake_case，如 `customer_order` | 必填 |
| `--domain` | 所属域：`admin` 或 `component_center` | `admin` |
| `--fields` | 字段列表，格式 `字段:类型,字段:类型` | `name:str` |
| `--dry-run` | 只打印将要生成的内容，不写文件、不注册、不生成迁移 | 关闭 |
| `--skip-migration` | 不调用 drizzle-kit 生成迁移 | 关闭 |
| `--data-scope` | 接入[数据权限](/guide/rbac#数据权限)：表上加 `dept_id` / `created_by`，列表、详情、修改、删除、导出按当前用户的数据范围过滤，新建时写入创建人与部门，并生成对应的接口测试 | 关闭 |
| `-h` / `--help` | 打印用法 | — |

### 生成内容

已存在的文件会被跳过，不会覆盖。

| 生成文件 | 说明 |
|---|---|
| `apps/api/src/db/schema/<domain-dir>/<name-kebab>.ts` | 表定义 + `toDict` |
| `apps/api/src/modules/<domain-dir>/<name-kebab>/{schema,repository,service,routes}.ts` | 后端四层 |
| `apps/api/test/<admin\|cc>-<name-kebab>.test.ts` | 接口基础测试（增删改查、搜索、404、导出、导入模板、导入） |
| `apps/web/src/modules/<module>/api/<name>.js` | 前端 API 调用 |
| 前端列表页 `index.jsx` | `admin` 域在 `pages/<name>/`，`component_center` 域在 `pages/admin/<name>_page/` |
| 页面 `locales/{en-US,ja-JP}.json` | 仅当页面有公共译文没覆盖的中文时生成 |

`<domain-dir>` 为 `admin` 或 `component-center`，`<name-kebab>` 是把下划线换成连字符后的资源名。

同时自动完成：

- 在 `apps/api/src/db/schema/index.ts` 和 `apps/api/src/modules/<domain-dir>/router.ts` 注册
- 执行 `drizzle-kit generate --name <name>` 生成迁移

scaffold 会在输出中打印权限编码前缀（Perm prefix）、菜单 `component` 值和接口路径，添加菜单时直接使用。

### 字段类型

| 类型 | Drizzle 列 | 表单组件 | 说明 |
|---|---|---|---|
| `str` | `varchar(100)` | `FormInput` | |
| `str20` | `varchar(20)` | `FormInput` | |
| `str50` | `varchar(50)` | `FormInput` | |
| `str500` | `varchar(500)` | `FormInput` | |
| `text` | `text` | `FormTextarea` | |
| `int` | `integer` | `FormNumber` | |
| `float` | `numeric(10, 2)` | `FormNumber` | 接口输出为字符串，如 `"12.50"` |
| `bool` | `boolean` | `FormSwitch` | |
| `date` | `date`（字符串模式） | `FormDate` | `YYYY-MM-DD` |
| `datetime` | `timestamp`（字符串模式） | `FormDateTime` | |
| `file` | `varchar(36)`，存文件中心的文件 ID | `FormFileUpload` | 列表显示「查看」链接；保存时自动登记引用 |
| `image` | `varchar(36)`，存文件中心的文件 ID | `FormImageUpload` | 列表显示缩略图；保存时自动登记引用 |

未知类型按 `str` 处理。`id`、`created_at`、`updated_at` 会自动添加。

### 字段类型推断

AI 根据业务描述推断类型，你不需要指定：

| 业务描述关键词 | 类型 |
|---|---|
| 名称、标题、姓名、邮箱 | `str` |
| 编码、代码、编号 | `str50` |
| 手机、电话、状态、类型、颜色 | `str20` |
| URL、链接、地址（外部地址） | `str500` |
| 图片、头像、封面、照片 | `image` |
| 附件、文件、合同、扫描件 | `file` |
| 描述、备注、简介、内容、正文、标签（JSON 字符串） | `text` |
| 金额、价格、费用、成本 | `float` |
| 数量、次数、进度、百分比、排序、权重 | `int` |
| 日期（无时间） | `date` |
| 时间 | `datetime` |
| 是否、启用、禁用、开关 | `bool` |

### 已知限制

- `--fields` 表达不了必填、唯一和默认值。推荐流程：先加 `--skip-migration` 生成，再修改 `db/schema` 中的表定义（`.notNull()`、`.unique()`、`.$default(...)`），最后 `pnpm db:generate --name <name>`，这样一张新表只产生一个迁移。
- 生成的标题和字段标签是英文占位，需要改成中文。
- 枚举字段按 `str20` 生成，存英文代码；界面显示中文需要手写映射。
- 表名固定为资源名加 `s`，接口路径同理。选资源名时要考虑复数形式。
- `bool` 列可为空，需要默认值时在 service 里补。
- 加了业务规则后，要同步维护生成的接口测试。

脚手架不可用时，可以照 `docs/templates/` 手写，替换规则见 `docs/templates/backend/README.md`。

## pnpm verify

`pnpm verify` 是交付门禁，全部通过才算完成。

```bash
pnpm verify -- --module customer                 # 全部检查
pnpm verify -- --module customer --skip-build    # 跳过前端构建（调试时提速）
pnpm verify -- --module customer --json          # 输出结构化 JSON（stdout 只有 JSON）
```

### 检查项

全局检查（每次都执行）：

| 检查 | 内容 |
|---|---|
| `typescript_compile` | `tsc --noEmit`，覆盖 `apps/api`（含 scripts、test）与 `apps/mcp` |
| `no_local_has_permission` | routes 文件中不得自定义 `hasPermission` |
| `migration_chain` | drizzle 迁移 journal 线性、快照链完整、每条记录都有 SQL、没有多余 SQL |
| `migration_applied` | 对比 journal 与数据库中的 `drizzle.__drizzle_migrations`，并确认模块表存在 |
| `openapi_sync` | OpenAPI 文档是否与路由同步（只警告） |
| `docs_paths` | AI 上下文文档中引用的路径是否存在（默认只警告，`--strict-docs` 时阻断） |

模块检查（传入 `--module` 时执行）：

| 检查 | 内容 |
|---|---|
| `backend_file` | 后端 routes / repository / service 文件存在 |
| `data_scope_filter` | `schema.ts` 声明了 `DATA_SCOPE` 的模块，repository 必须用 `dataScopeWhere` 过滤；未声明时跳过 |
| `frontend_page` | 前端页面文件存在 |
| `frontend_no_legacy_ui` | 页面目录不使用 `@douyinfe/*`、`var(--semi-*)` 等已下线的 UI 体系 |
| `frontend_api` | 前端 API 文件存在 |
| `router_registration` | 路由已在 `src/router.ts` 或域 `router.ts` 注册 |
| `schema_registration` | 表定义已在 `db/schema/index.ts` 注册 |
| `rbac_seed` | `seed-rbac.ts` 中包含该模块的菜单或权限编码 |

构建与测试（可跳过）：

| 检查 | 内容 | 跳过参数 |
|---|---|---|
| `frontend_build` | 前端 Vite 构建 | `--skip-build` |
| `frontend_tests` | 前端 Vitest | `--skip-frontend-tests` |
| `api_tests` | 后端 Vitest（需要测试库） | `--skip-api-tests` |

### 其他参数

| 参数 | 说明 |
|---|---|
| `--skip-db` | 跳过 `migration_applied`（不连接数据库） |
| `--run-rbac-sync` | 额外执行一次 `seed:rbac --incremental`（检查项 `rbac_sync`） |
| `--database-url <url>` | 指定 `migration_applied` 使用的数据库连接 |
| `--strict-docs` | `docs_paths` 失败时阻断 |

调试过程中可以用跳过参数提速，交付前必须完整跑一次。

## MCP Server

`apps/mcp` 把工具链暴露为 MCP 工具，MCP 客户端（如 Claude Desktop）不需要命令行也能走完整的开发流程。

| 工具 | 作用 |
|---|---|
| `get_project_context` | 返回 `AGENTS.md` 全文和当前模块结构，实现新功能前调用 |
| `get_menu_tree` | 返回数据库中的菜单树，用于确定 `parent_id` 和可用 ID |
| `scaffold_feature` | 调用 `pnpm scaffold`（参数 `name`、`domain`、`fields`、`dry_run`） |
| `run_verify` | 调用 `pnpm verify --json` 并返回结果（参数 `module`、`skip_build`） |
| `init_rbac` | 调用 `pnpm seed:rbac -- --incremental` |
| `run_migration` | 执行 `db:generate` + `db:migrate`（参数 `message` 作为迁移描述） |
| `list_templates` | 列出 `docs/templates/` 下的模板 |

Claude Desktop 配置示例（`claude_desktop_config.json`）：

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

也可以先构建再用 node 直接运行：

```bash
pnpm --filter @castor-kit/mcp build
node /path/to/castor-kit/apps/mcp/dist/index.js
```

MCP Server 默认以自身所在位置推算仓库根目录，可用环境变量 `CASTOR_KIT_ROOT` 覆盖。

## 相关页面

- [后端开发](/guide/backend)：分层与接口规范
- [前端开发](/guide/frontend)：页面结构与公共组件
- [权限 RBAC](/guide/rbac)：菜单与按钮权限
- [命令速查](/reference/commands)
