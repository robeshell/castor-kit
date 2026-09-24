# castor-kit — Agent Context

> 通用 AI 上下文文档。当前处于**设计→实现的起点**，本文件会随 P4 阶段扩展成完整规范。
> 实现任何东西之前先读 `docs/rewrite-plan.md`（完整方案，14 节）。

## 项目是什么

AuraStack（Flask + React + RBAC 的 AI-First 脚手架）的 Node.js/TypeScript 重写。目标：后端换成 Node，前端不动，数据库不动，API 契约字节级兼容。

## 参考源码

原项目在本机：`/Users/wangwenyu/Documents/Code/AuraStack`（GitHub `robeshell/AuraStack`）。移植任何模块前先读那里的对应 Python 实现和 `AGENTS.md`；行为以现有实现为准。

## 已拍板的决定（不要再问）

- 项目名 `castor-kit`；命名一律小写连字符，不用驼峰、不用 Stack 后缀
- 后端：Node 22 + TypeScript + Fastify 5 + Zod + Drizzle + pg + pino；不用 NestJS
- 前端：React 18 + Vite + Semi Design，从 AuraStack `frontend/` 原样复制到 `apps/web`，不换 UI 库
- 数据库：直连现有 PostgreSQL（同库同表同列），不做数据迁移；`alembic_version` 表保留
- `.xls` 不支持，只支持 csv / xlsx
- 密码哈希必须兼容 werkzeug `pbkdf2:sha256:<iter>$<salt>$<hex>`，并行期新哈希也写此格式
- 会话：`@fastify/secure-session`，cookie 名 `castor_session`，密钥用 HKDF 从 `SECRET_KEY` 派生
- 时间字段不经过 JS `Date`：pg 类型 1114 保留文本，`toIso()` 仅把空格换 `T`
- cron 匹配器从 AuraStack 原样移植（日/周为 AND 语义），不用 `cron-parser`
- 移植期请求 schema `.passthrough()` + 全可选，归一化逻辑在 service 里照搬
- 操作日志用全局 `onResponse` hook 集中写，不散到 service

## 分层

```
db/schema (Drizzle 表定义 + toDict) → modules/<domain>/<name>/{schema.ts, repository.ts, service.ts, routes.ts} → modules/<domain>/router.ts → src/router.ts
```

## 实施顺序

P0 骨架+认证 → P1 admin 域 → P2 component_center CRUD → P3 定时任务/SSE/AI SQL/WebSocket → P4 工具链+文档 → P5 部署/切换。每阶段的验收门禁见 `docs/rewrite-plan.md` §11。

## 开发环境

- 数据库：`postgresql://wangwenyu@localhost/aurastack`（与 AuraStack 共用）
- 端口：api 5001（并行验证期临时用 5002）、web 5173
- 默认账号：`admin` / `admin123`
