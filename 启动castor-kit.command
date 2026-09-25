#!/bin/bash
# Double-click this file to start the castor-kit dev environment locally (api 5001 + web 5173)
# Requires: Node 22+, pnpm, a local PostgreSQL (connection string in apps/api/.env.development).
# setup-once = migrations + incremental RBAC sync + AI SQL read-only account (idempotent, safe to rerun).
# For a one-step Docker deployment, run instead: bash setup.sh
cd "$(dirname "$0")"
pnpm install && pnpm setup-once && pnpm dev
echo ""
read -n 1 -s -r -p "按任意键关闭窗口..."
