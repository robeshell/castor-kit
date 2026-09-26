---
name: new-feature-autopilot
description: PM gives feature intent in natural language; execute end-to-end implementation for castor-kit (Fastify + Drizzle + React/shadcn-ui) without requiring structured requirement docs.
---

# New Feature Autopilot

使用场景：用户说"做XX功能"、"加一个XX页面"、"新增XX模块"等意图表达时触发。

## 核心原则

**AI 负责所有技术决策，PM 只需确认业务意图。**

- 路由路径、权限编码、字段类型、文件位置、菜单 ID——全部由 AI 根据 AGENTS.md 约定自行推断
- 不向 PM 询问任何技术细节
- 先展示业务预览供确认，再执行实现
- 所有命令在仓库根目录执行（Node 22 + pnpm）
- 开发环境配置在 `apps/api/.env.development`（仓库根目录没有 `.env`）；数据库连接取其中的 `DEV_DATABASE_URL`，本地默认库名 `castor_kit`

---

## 执行步骤

### Step 1 — 读取上下文

```
必须按顺序读取：
1. AGENTS.md（项目约定、命名规则、字段类型推断规则、反模式）
2. docs/templates/backend/（含 README.md 替换规则）和 docs/templates/frontend/（代码骨架模板）
3. 现有相似模块（后端参考 apps/api/src/modules/admin/users/，前端参考 apps/web/src/modules/admin/pages/users/index.jsx）
   + 前端约定：AGENTS.md「前端架构约定」、docs/frontend-redesign-plan.md、.claude/skills/shadcn-ui-skills/
4. apps/api/scripts/seed-rbac.ts（MENUS_DATA：查询当前菜单树，确定 parent_id 与下一个可用 ID）
5. 先扫一遍现有模块：需求能通过扩展已有模块实现的，优先扩展，不要新建重复模块
```

菜单 ID 以 `MENUS_DATA` 实际占用为准，AGENTS.md 的区间表只是指引（区间里夹着历史遗留 ID）：

```bash
grep -oE "id: [0-9]+" apps/api/scripts/seed-rbac.ts | awk '{print $2}' | sort -n | uniq
```

### Step 2 — 生成内部 Spec（不展示给 PM）

根据 PM 的业务描述，自动推断并生成技术规格：

```
推断内容：
- 资源名（snake_case，如 customer_order）与所属域（admin | component_center）
- API 路径（/api/admin/<resource>s，多词用连字符，如 /api/admin/customer-orders）
- 字段名 + scaffold 类型（str/str20/str50/str500/text/int/float/bool/date/datetime/file/image，参考 AGENTS.md 字段类型推断规则；图片、附件用 image / file，存文件中心的文件 ID）
- 权限编码（admin 域 system_<name>，component_center 域 cc_<name>，与 scaffold 输出的 Perm prefix 一致；按钮 _add/_edit/_delete/_export/_import。同级的 `cc_admin_*_page`、`system_list_page` 等是历史编码，新模块不要模仿）
- 前端文件路径（admin 域 modules/admin/pages/<name>/index.jsx；
               component_center 域 modules/component_center/pages/admin/<name>_page/index.jsx）
- 菜单 ID（在 AGENTS.md 的 ID 分配区间里取 `MENUS_DATA` 未占用的 ID；按钮 ID = 菜单 ID × 10 + 序号）
- 菜单路径：admin 域 `/system/<name-kebab>s`（如 `/system/suppliers`）；component_center 域 `/component-center/admin/<name-kebab>`（与同级「管理系统」下的页面一致）
- 菜单排序排在同级最后；图标沿用 `apps/web/src/lib/menu-icons.js` 映射表里已有的名字
- 资源名：scaffold 固定在表名 / 接口路径后加 `s`，选名字时顺带想好复数（`equipment` 会得到 `equipments`，可改用 `device` 等可数名词）
- 枚举字段：库里存英文代码（如 `raw_material`），界面 / 导出显示中文，导入中英文都接受
- parent_id（从菜单树中根据 PM 描述的位置推断）
- 迁移名称（scaffold 默认用 <name>）
```

### Step 3 — 展示业务预览，等待确认

仅向 PM 展示业务层面信息，格式如下：

```
📋 <功能名>

位置：<父菜单> → <功能名>
功能：列表查看、新增、编辑、删除（按需调整）
字段：
  · <中文字段名>（必填）
  · <中文字段名>
  · ...

确认这样做吗？或者需要调整什么？
```

- 如 PM 确认 → 进入 Step 4
- 如 PM 调整 → 更新内部 Spec，重新展示预览

### Step 4 — 执行实现

**4a. 生成骨架（优先使用 scaffold）**

```bash
# 先 dry-run 看将生成哪些文件
pnpm scaffold -- --name <name> --domain <admin|component_center> --fields "<field>:<type>,..." --dry-run
# 确认后正式生成
pnpm scaffold -- --name <name> --domain <admin|component_center> --fields "<field>:<type>,..."
```

scaffold 会：
- 生成 `apps/api/src/db/schema/<domain-dir>/<name-kebab>.ts`（Drizzle 表定义 + toDict）
- 生成 `apps/api/src/modules/<domain-dir>/<name-kebab>/{schema,repository,service,routes}.ts`
- 生成前端 `apps/web/src/modules/<module>/api/<name>.js` + 页面 `index.jsx`（shadcn/ui 体系，结构同 users 页：PageHeader → FilterBar → DataTable → FormDialog → ImportDialog / ExportDialog）
- 生成接口基础测试 `apps/api/test/<admin|cc>-<name-kebab>.test.ts`（增删改查、列表搜索、404、导出、导入模板、导入成功 / 必填列为空回滚）
- 自动注册 `apps/api/src/db/schema/index.ts` 与 `apps/api/src/modules/<domain-dir>/router.ts`
- 自动执行 `drizzle-kit generate --name <name>` 生成迁移 SQL

（`<domain-dir>` 为 `admin` 或 `component-center`，`<name-kebab>` 为下划线换连字符。）

**优先用 `--spec`**：把推断出的规格写成 JSON 文件再生成，中文标题 / 标签、必填、唯一、默认值、固定选项、数据字典和菜单一次到位（格式见 `apps/api/scripts/scaffold.ts` 文件头与 website 的 AI 驱动开发文档「spec 文件」）：

```bash
pnpm scaffold -- --spec /tmp/<name>.spec.json            # 含 "menu": {} 时同时写入 seed-rbac.ts 的「业务管理」目录与菜单译文
```

- `required` → `NOT NULL` + service 报「<标签>不能为空」+ 表单必填；`unique` → `UNIQUE`（只用于文本 / 数字）；`default` → 列默认值，新增留空时使用
- 状态、类型、级别等固定取值用 `enum` + `options`（值英文 snake_case、名称中文）；取值来自数据字典时用 `dict` + 字典编码
- `i18n` 写标题、标签、选项名称的英文 / 日文；缺的用字段名代替
- 生成的接口测试多一条「字段规则」用例；之后再加业务规则要同步维护测试
- 只用 `--fields` 时没有上述能力，标签是英文占位，需要手改（表格列、表单、`EXPORT_FIELD_MAP`、`IMPORT_HEADER_MAP`）；约束违规由 service 转成 400（`apps/api/src/common/db-errors.ts`）
- 权限前缀是单数 `system_<name>` / `cc_<name>`，与路由、verify 保持一致即可，不必改成复数

如 scaffold 不可用，手动临摹 `docs/templates/`（占位符替换规则见 `docs/templates/backend/README.md`），并手动完成上面的注册与 `pnpm db:generate --name <描述>`。

**4b. 补充业务逻辑**

按 db/schema → schema → repository → service → routes 顺序填充实际字段、中文表头（`EXPORT_FIELD_MAP` / `IMPORT_HEADER_MAP`）和业务规则。

- 权限：`import { hasMenuPermission, loginRequired } from '@/common/auth'`，`await hasMenuPermission(request, code)`
- 时间输出用 `toIso()`，numeric 保持字符串，业务错误抛 `ServiceError`
- 若在 scaffold 之后又改了表结构：`pnpm db:generate --name <描述>` 生成增量迁移（**不能写 `--`**，drizzle-kit 不认识）

**4b'. 前端页面**

scaffold 生成的页面已可用，按业务打磨：

- 标题与字段标签改成中文（页面标题下**不写描述**，见设计文档「文案」一条）；`rules` 补必填与格式校验（文案与后端一致）；枚举字段改成 `FormSelect` + 表格列 `StatusBadge`
- **多语言**：界面文字写中文原文，按 AGENTS.md「多语言（i18n）与代码注释」接入翻译——传给公共组件的字符串自动翻译；JSX 里直接写的中文、原生元素属性、带变量的文案用 `t()`；在页面目录建 `locales/en-US.json`、`locales/ja-JP.json` 写译文；`node apps/web/scripts/i18n-scan.mjs <页面目录>` 必须 0 问题
- 后端新增的报错 / 提示文案在 `apps/api/src/i18n/messages.ts` 登记英日译文（带变量的放 `PATTERNS`）
- 代码注释一律英文
- 只用 `@/components/ui/*`、`@/shared/components/*`、`lucide-react` 与 Tailwind 语义色类；禁止 `@douyinfe/*`、`var(--semi-*)`、写死十六进制颜色（verify 的 `frontend_no_legacy_ui` 会拦截）
- 组件用法查 `.claude/skills/shadcn-ui-skills/SKILL.md`；shadcn 组件 API 查官方文档（有 shadcn MCP 时优先用）；缺原子组件时 `apps/web/scripts/shadcn-add.sh <组件>`
- 自检：`cd apps/web && npx eslint <页面文件>` 零错误

**4c. RBAC**

用 `--spec` 且带 `menu` 时菜单与按钮权限已写入（跳过这一步的编辑，只运行下面的同步）；否则在 `apps/api/scripts/seed-rbac.ts` 的 `MENUS_DATA` 中添加菜单条目（`component` 取 scaffold 输出的 Menu component）和按钮权限，然后运行：
```bash
pnpm seed:rbac -- --incremental
```

并在 AGENTS.md「当前菜单树」里补上新菜单这一行。

**4d. 数据库迁移（必须真实落库）**

```bash
# 审查 apps/api/drizzle/ 下新生成的 SQL 后执行
pnpm db:migrate
# 实证：表 / 字段真实存在（库名以 apps/api/.env.development 的 DEV_DATABASE_URL 为准）
psql -d castor_kit -c '\d <name>s'
```

**4e. API 文档（必须，verify 的 openapi_sync 与 API 测试都会拦截）**

```bash
pnpm openapi:generate            # 为新路由补骨架
pnpm openapi:generate -- --strict  # 补全后复查，列出每个不合规接口的具体问题
```

骨架只有占位内容。按 AGENTS.md「OpenAPI 编写规范」照代码补全每个新接口：中文 summary、description（权限、数据权限）、tags 与 x-apifox-folder、路径 / 查询参数、请求体字段、返回结构和错误码。AI 小助手和外部调用方都只靠这份文档，字段不能编。

### Step 5 — 验证门禁（强制，不得跳过）

```bash
pnpm verify -- --module <name>
# 含前端构建、前后端单元测试（后端约 45s）；需要结构化结果时加 --json
# 调试中途可加 --skip-build / --skip-api-tests 提速，交付前必须跑一次完整的
```

- 如有失败项 → 自动修复 → 重新运行验证
- `migration_applied` 项的 detail 形如「已迁移至 0001_<name>（castor_kit）」，写进交付报告
- 全部通过后输出交付报告

---

## 交付报告格式

```
✅ <功能名> 交付完成

变更文件：
  后端：apps/api/src/db/schema/<domain-dir>/<name-kebab>.ts
        apps/api/src/modules/<domain-dir>/<name-kebab>/{schema,repository,service,routes}.ts
        apps/api/src/db/schema/index.ts、apps/api/src/modules/<domain-dir>/router.ts（注册）
        apps/api/test/<admin|cc>-<name-kebab>.test.ts（接口测试）
  前端：apps/web/src/modules/<module>/pages/<subdir>/<page>/index.jsx
        apps/web/src/modules/<module>/api/<name>.js
  RBAC：apps/api/scripts/seed-rbac.ts（已运行 --incremental）
  迁移：已迁移至 <tag>（psql \d <name>s 已确认）
  门禁：pnpm verify -- --module <name> 全部通过（含前后端单元测试）

用户下一步操作：
  1. 刷新页面，在「<父菜单> → <功能名>」找到新功能
  2. （其他环境部署时）pnpm db:migrate && pnpm seed:rbac -- --incremental
```

---

## 默认行为（PM 未指定时）

- 列表页标准功能：搜索 + 新增 + 编辑 + 删除 + **导入 + 导出**（csv / xlsx，不支持 .xls）
- RBAC 按钮权限：`_add` / `_edit` / `_delete` / `_export` / `_import`
- 新路由前缀：`/api/admin/<resource>s`
- 导出/导入路由：`POST /api/admin/<resource>s/export`、`GET /template`、`POST /import`
- 分页：每页 20 条（上限 200）
- 排序：按 id 倒序

---

## 仅在以下情况提问（最多 1-2 个）

- 数据模型存在不可逆的歧义（如关联关系复杂，影响表结构）
- 涉及外部系统集成，需要配置项
- 权限边界有安全影响，需要产品确认

其余所有技术决策，AI 自行做出合理选择并在交付报告中说明假设。
