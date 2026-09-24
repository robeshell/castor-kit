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
```

### Step 2 — 生成内部 Spec（不展示给 PM）

根据 PM 的业务描述，自动推断并生成技术规格：

```
推断内容：
- 资源名（snake_case，如 customer_order）与所属域（admin | component_center）
- API 路径（/api/admin/<resource>s，多词用连字符，如 /api/admin/customer-orders）
- 字段名 + scaffold 类型（str/str20/str50/str500/text/int/float/bool/date/datetime，参考 AGENTS.md 字段类型推断规则）
- 权限编码（admin 域 system_<name>，component_center 域 cc_<name>；按钮 _add/_edit/_delete/_export/_import）
- 前端文件路径（admin 域 modules/admin/pages/<name>/index.jsx；
               component_center 域 modules/component_center/pages/admin/<name>_page/index.jsx）
- 菜单 ID（按 AGENTS.md 的 ID 分配区间取下一个可用 ID；按钮 ID = 菜单 ID × 10 + 序号）
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
- 自动注册 `apps/api/src/db/schema/index.ts` 与 `apps/api/src/modules/<domain-dir>/router.ts`
- 自动执行 `drizzle-kit generate --name <name>` 生成迁移 SQL

（`<domain-dir>` 为 `admin` 或 `component-center`，`<name-kebab>` 为下划线换连字符。）

如 scaffold 不可用，手动临摹 `docs/templates/`（占位符替换规则见 `docs/templates/backend/README.md`），并手动完成上面的注册与 `pnpm db:generate --name <描述>`。

**4b. 补充业务逻辑**

按 db/schema → schema → repository → service → routes 顺序填充实际字段、中文表头（`EXPORT_FIELD_MAP` / `IMPORT_HEADER_MAP`）和业务规则。

- 权限：`import { hasMenuPermission, loginRequired } from '@/common/auth'`，`await hasMenuPermission(request, code)`
- 时间输出用 `toIso()`，numeric 保持字符串，业务错误抛 `ServiceError`
- 若在 scaffold 之后又改了表结构：`pnpm db:generate --name <描述>` 生成增量迁移（**不能写 `--`**，drizzle-kit 不认识）

**4b'. 前端页面**

scaffold 生成的页面已可用，按业务打磨：

- 标题 / 描述 / 字段标签改成中文；`rules` 补必填与格式校验（文案与后端一致）；枚举字段改成 `FormSelect` + 表格列 `StatusBadge`
- 只用 `@/components/ui/*`、`@/shared/components/*`、`lucide-react` 与 Tailwind 语义色类；禁止 `@douyinfe/*`、`var(--semi-*)`、写死十六进制颜色（verify 的 `frontend_no_legacy_ui` 会拦截）
- 组件用法查 `.claude/skills/shadcn-ui-skills/SKILL.md`；shadcn 组件 API 查官方文档（有 shadcn MCP 时优先用）；缺原子组件时 `apps/web/scripts/shadcn-add.sh <组件>`
- 自检：`cd apps/web && npx eslint <页面文件>` 零错误

**4c. RBAC**

在 `apps/api/scripts/seed-rbac.ts` 的 `MENUS_DATA` 中添加菜单条目（`component` 取 scaffold 输出的 Menu component）和按钮权限，然后运行：
```bash
pnpm seed:rbac -- --incremental
```

**4d. 数据库迁移（必须真实落库）**

```bash
# 审查 apps/api/drizzle/ 下新生成的 SQL 后执行
pnpm db:migrate
# 实证：表 / 字段真实存在
psql -d aurastack -c '\d <name>s'
```

### Step 5 — 验证门禁（强制，不得跳过）

```bash
pnpm verify -- --module <name> --skip-build
# 需要结构化结果时：
pnpm verify -- --module <name> --skip-build --json
```

- 如有失败项 → 自动修复 → 重新运行验证
- `migration_applied` 项的 detail 形如「已迁移至 0001_<name>（aurastack）」，写进交付报告
- 全部通过后输出交付报告

---

## 交付报告格式

```
✅ <功能名> 交付完成

变更文件：
  后端：apps/api/src/db/schema/<domain-dir>/<name-kebab>.ts
        apps/api/src/modules/<domain-dir>/<name-kebab>/{schema,repository,service,routes}.ts
        apps/api/src/db/schema/index.ts、apps/api/src/modules/<domain-dir>/router.ts（注册）
  前端：apps/web/src/modules/<module>/pages/<subdir>/<page>/index.jsx
        apps/web/src/modules/<module>/api/<name>.js
  RBAC：apps/api/scripts/seed-rbac.ts（已运行 --incremental）
  迁移：已迁移至 <tag>（psql \d <name>s 已确认）
  门禁：pnpm verify -- --module <name> --skip-build 全部通过

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
