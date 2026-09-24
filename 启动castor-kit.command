#!/bin/bash
# 双击此文件即可在本机启动 castor-kit 开发环境（api 5001 + web 5173）
# 需要：Node 22+、pnpm、本机 PostgreSQL（连接串见 apps/api/.env.development）。
# setup-once = 迁移 + RBAC 增量同步 + AI SQL 只读账号（幂等，可重复执行）。
# 用 Docker 一键部署请改为运行：bash setup.sh
cd "$(dirname "$0")"
pnpm install && pnpm setup-once && pnpm dev
echo ""
read -n 1 -s -r -p "按任意键关闭窗口..."
