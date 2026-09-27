#!/bin/sh
set -e

echo "============================================"
echo "  castor-kit 启动中"
echo "============================================"

# Wait for the database (the compose healthcheck already guarantees this; this is an extra safeguard)
# Migrations / RBAC / read-only account are all handled by setup-once (an advisory lock keeps concurrent replicas safe)
echo "[1/2] 运行初始化（迁移 + RBAC + AI SQL 只读账号）..."
node dist/setup-once.js

echo "[2/2] 启动 Node 服务..."
exec node dist/main.js
