# castor-kit — Claude Code 专属补充

> **主文档**：`AGENTS.md`（已拍板的决定、分层、实施顺序）+ `docs/rewrite-plan.md`（完整方案）。
> 开始任何实现前先读这两个文件。

## 参考源码

原项目 AuraStack 在 `/Users/wangwenyu/Documents/Code/AuraStack`，移植时以那里的 Python 实现为行为基准。

## 规则

- 命名一律小写连字符（`castor-kit`、`@castor-kit/api`），不用驼峰
- Semi Design 组件实现前优先用 `semi-mcp` 读官方文档
- 迁移必须真实落库并用 `psql \d` 验证，静态检查不算完成
