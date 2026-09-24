#!/bin/sh
set -e

echo "============================================"
echo "  castor-kit 启动中"
echo "============================================"

# 等待数据库就绪（compose healthcheck 已保证，此处作为额外保险）
# 迁移/RBAC/只读账号由 setup-once 统一执行（advisory lock 保证多副本并发安全）
echo "[1/2] 运行初始化（迁移 + RBAC + AI SQL 只读账号）..."
node dist/setup-once.js

echo "[2/2] 启动 Node 服务..."
exec node dist/main.js
