# castor-kit — Claude Code 专属补充

> **主文档**：`AGENTS.md`（工具无关的完整项目上下文：架构、分层、命名、字段类型推断、反模式、交付流程、菜单树）+ `docs/rewrite-plan.md`（完整重写方案与兼容契约）。
> 开始任何实现前先读这两个文件；涉及前端 UI 时再读 `docs/frontend-redesign-plan.md`（shadcn/ui 体系）。本文件只放 Claude Code 专属的补充内容。

## 参考源码

原项目 AuraStack 在 `/Users/wangwenyu/Documents/Code/AuraStack`，移植时以那里的 Python 实现为行为基准。

## 规则

- 命名一律小写连字符（`castor-kit`、`@castor-kit/api`），不用驼峰
- shadcn/ui 组件实现前优先查阅 shadcn 官方文档 / registry（可用 shadcn MCP）；新增原子组件用 `npx shadcn@latest add`（本机需经 REGISTRY_URL 中转，直接跑 `apps/web/scripts/shadcn-add.sh <组件>`，见 AGENTS.md「新增 shadcn 原子组件」）
- 迁移必须真实落库并用 `psql \d` 验证，静态检查不算完成

---

## Claude Code 专属补充

### Skills

- `/new-feature-autopilot`（`.claude/skills/new-feature-autopilot/SKILL.md`）：PM 说“做 XX 功能 / 加一个 XX 页面”时使用，流程：
  1. 读取 AGENTS.md + docs/templates/
  2. 自动推断技术规格（不向用户询问技术细节）
  3. 展示**业务预览**供确认
  4. `pnpm scaffold` → 填业务 → `seed-rbac` 增量 → `pnpm db:migrate` → `psql \d` 实证
  5. `pnpm verify -- --module <name>` 门禁全绿（含前后端单元测试）后输出交付报告（注明「已迁移至 <tag>」）
- `shadcn-ui-skills`（`.claude/skills/shadcn-ui-skills/SKILL.md`）：shadcn/ui 组件清单、castor-kit 公共组件用法、设计 tokens、动效规范、常见模式与禁止事项

### 文档优先规则

- 实现 shadcn/ui 组件前，先查官方文档（https://ui.shadcn.com/docs/components ）或 registry（`apps/web/scripts/shadcn-add.sh --view <组件>`），有 shadcn MCP 时优先用它
- 如文档与现有实现冲突，以仓库现有实现为准（`apps/web/src/components/ui/` 已按本项目 tokens 调整过）

### 本地预览

`.claude/launch.json` 已配置 `api`（`pnpm --filter @castor-kit/api dev`，5001）与 `web`（`pnpm --filter @castor-kit/web dev`，5173）两个 dev server，浏览器验证页面时直接用它们启动。

---

## 关键约定速查（详见 AGENTS.md）

### 后端（apps/api）
- **分层**：`db/schema/<domain>/<name>.ts` → `modules/<domain>/<name>/{schema,repository,service,routes}.ts` → `modules/<domain>/router.ts` → `src/router.ts`
- **API 路由前缀**：`/api/admin/...`；列表响应 `{ items, total, page, per_page }`，错误响应 `{ error, ...payload }`
- **权限检查**：`import { hasMenuPermission, loginRequired } from '@/common/auth'`，`await hasMenuPermission(request, 'system_xxx')`；也有 `hasAnyMenuPermission` / `menuPermissionRequired(code)`
  - 不允许在 routes 文件内自定义 `hasPermission`
- **model 层**：Drizzle `pgTable` + `xxxToDict()`；时间列 `createdAt()/updatedAt()`，输出 `toIso()`，numeric 保持字符串
- **新增域**：需在 `src/router.ts` + `db/schema/index.ts` 中注册（已有域内新增模块由 scaffold 自动注册）
- **导入导出**：`common/tabular.ts`（`buildTable` / `sendTable` / `readTableFile`），只支持 csv / xlsx

### 前端（apps/web，shadcn/ui + Tailwind CSS v4 + motion + lucide-react，JSX）
- **动态路由**：`App.jsx` 用 `import.meta.glob('./modules/**/pages/**/index.jsx')` 扫描；`menu.component` 值格式 `<module>/<subdir>/<page>`（如 `component_center/admin/kanban_page`）
- **API client**：`apps/web/src/shared/api/request.js`（拦截 401 自动跳登录页、自动带 CSRF 头、响应已 unwrap）
- **页面结构**：照 `apps/web/src/modules/admin/pages/users/index.jsx`——PageHeader → FilterBar → DataTable → FormDialog（react-hook-form + FormFields）→ ImportDialog / ExportDialog，删除用 ConfirmAction，反馈用 `@/lib/toast`
- **导入导出**：复用 `@/shared/components/data-transfer/ImportDialog` + `@/shared/components/data-transfer/ExportDialog`
- **样式**：只用 Tailwind 语义色类（`bg-card` / `text-muted-foreground` / `bg-brand-soft` …），Ocean 渐变只做点缀，禁止 `@douyinfe/*`、`var(--semi-*)`、写死十六进制颜色
- **纯前端页面**（无后端 CRUD API）：creative/、devtools/websocket_page、devtools/perf_monitor_page、dataviz/heatmap_page、dataviz/realtime_chart_page

### RBAC
- 菜单结构：`menus` 表，`menu_type = 'menu'|'button'`；`role_menus` / `user_roles` 多对多
- **超级管理员**：code=`super_admin`，权限判定直接放行（`my-menus` 除外）
- 唯一事实源：`apps/api/scripts/seed-rbac.ts`；每次菜单/权限变更后必须运行 `pnpm seed:rbac -- --incremental`

---

## 常用命令

```bash
pnpm dev                                   # api(5001) + web(5173)
pnpm db:generate --name <描述>              # 生成迁移（注意：这里不能写 --）
pnpm db:migrate                            # 应用迁移
psql -d aurastack -c '\d <table>'          # 实证落库（库名取 apps/api/.env.development 的 DEV_DATABASE_URL）
pnpm seed:rbac -- --incremental            # RBAC 增量同步
pnpm scaffold -- --name <name> --domain admin --fields "name:str,status:str20"
pnpm verify -- --module <name>             # 功能验证门禁（--skip-build 跳过前端构建，--json 结构化输出）
pnpm typecheck && pnpm test
pnpm openapi:generate && pnpm openapi:apifox
```

---

## 新功能开发 Checklist

1. [ ] 阅读相关现有模块（参考 `apps/api/src/modules/admin/users/`、`apps/web/src/modules/admin/pages/users/index.jsx`）
2. [ ] `pnpm scaffold -- --name <name> --domain <admin|component_center> --fields "..."`
3. [ ] 后端：`db/schema` → `schema.ts` → `repository.ts` → `service.ts` → `routes.ts` 填充业务
4. [ ] 前端：`pages/<subdir>/<page>/index.jsx` + `api/<page>.js`（纯前端页面无需 api 文件）
5. [ ] RBAC：在 `seed-rbac.ts` 中添加菜单 + 按钮权限条目，运行 `pnpm seed:rbac -- --incremental`
6. [ ] 迁移：审查 `apps/api/drizzle/` 新 SQL → `pnpm db:migrate` → `psql \d` 确认
7. [ ] OpenAPI：`pnpm openapi:generate`，补充 `docs/apifox-full.openapi.json` 中的 schema
8. [ ] 门禁：`pnpm verify -- --module <name>` 全部通过（含前后端单元测试）
