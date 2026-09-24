# castor-kit — Codex CLI 专属补充

> **主文档**：见 `AGENTS.md`（工具无关的完整项目上下文，Codex CLI 会自动读取）。
> 本文件仅包含 Codex CLI 专属的补充内容。

---

## 使用前必读

**`AGENTS.md` 是主文档**，包含：项目架构、分层约定、命名规则、字段类型推断、反模式清单、交付流程、完整菜单树。

---

## Codex CLI 专属补充

### 执行环境

所有命令在仓库根目录执行（Node 22 + pnpm）。

```bash
# 启动（api 5001 + web 5173）
pnpm dev

# 数据库迁移（Drizzle）
pnpm db:generate --name <描述>        # 注意：db:generate 后面不能写 --
pnpm db:migrate
psql -d aurastack -c '\d <table>'     # 实证落库

# RBAC 同步（菜单变更后必跑）
pnpm seed:rbac -- --incremental

# 代码骨架生成
pnpm scaffold -- --name <name> --domain admin --fields "name:str,status:str20"

# 功能验证门禁
pnpm verify -- --module <name> --skip-build
```

### 新功能开发流程

说“做 XX 功能”时，按以下顺序执行：

```
1. 读取 AGENTS.md + docs/templates/（代码骨架模板）
2. 自动推断技术规格，不向用户询问技术细节
3. 展示业务预览供确认（功能名/位置/字段/操作）
4. pnpm scaffold -- --name <name> --domain <admin|component_center> --fields "..."
   （自动注册 router.ts + db/schema/index.ts，并生成 Drizzle 迁移）
5. 按 db/schema → schema → repository → service → routes 补充业务逻辑（含导入导出）
6. 在 apps/api/scripts/seed-rbac.ts 添加菜单 + 按钮权限，运行 pnpm seed:rbac -- --incremental
7. 审查 apps/api/drizzle/ 新 SQL → pnpm db:migrate → psql -d aurastack -c '\d <table>' 确认落库
8. pnpm verify -- --module <name> --skip-build（必须通过；交付报告注明「已迁移至 <tag>」）
```

### 前端约定（apps/web）

UI 为 shadcn/ui + Tailwind CSS v4 + motion + lucide-react（JSX），已从 Semi Design 迁移，方案见 `docs/frontend-redesign-plan.md`：

- 列表页照 `apps/web/src/modules/admin/pages/users/index.jsx`（PageHeader → FilterBar → DataTable → FormDialog → ImportDialog / ExportDialog），公共组件在 `apps/web/src/shared/components/`
- 颜色只用 Tailwind 语义类；禁止 `@douyinfe/*`、`var(--semi-*)`、写死十六进制颜色（`pnpm verify` 的 `frontend_no_legacy_ui` 会拦截页面里的 Semi 残留）
- 新增 shadcn 原子组件：`apps/web/scripts/shadcn-add.sh <组件>`（本机 CLI 直连 ui.shadcn.com 会失败，脚本经本地中转 + `REGISTRY_URL` 执行 `npx shadcn@latest add`）

### Shell 命令执行权限

Codex CLI 在 `full-auto` 模式下可直接执行以下命令，无需确认：

- `pnpm scaffold ...`
- `pnpm verify ...`
- `pnpm seed:rbac -- --incremental`
- `pnpm db:generate ...` / `pnpm db:migrate`
- `pnpm typecheck` / `pnpm test`
- `apps/web/scripts/shadcn-add.sh <组件>`（新增组件；带 `-o` 覆盖已有文件时需确认）
- `psql -d <db> -c '\d <table>'`（只读查询）

以下命令**需要用户确认后再执行**：

- `pnpm seed:rbac`（不带 `--incremental` 是全量重建，会清空账号 / 角色 / 菜单）
- 删除或手改 `apps/api/drizzle/` 下已应用的迁移文件（破坏 journal 链）
- `DELETE FROM ...` / `DROP ...`（直接删除数据或对象）
- `git push` / `git reset --hard`
