#!/bin/sh
set -e

echo "============================================"
echo "  Starting Castor"
echo "============================================"

# Wait for the database (the compose healthcheck already guarantees this; this is an extra safeguard)
# Migrations / RBAC / read-only account are all handled by setup-once (an advisory lock keeps concurrent replicas safe)
echo "[1/2] Running setup (migrations, RBAC, AI SQL read-only account)..."
node dist/setup-once.js

echo "[2/2] Starting the Node server..."
exec node dist/main.js
