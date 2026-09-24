#!/bin/bash
# 集成 shadow-diff：每组模块在其用例设计时所用的测试库上，Flask(production，参考 oracle) vs Node(test)，跑全部用例。
#
# 前置：
#   - AuraStack 在 $AURA（默认 ../../../AuraStack，含 venv）
#   - 测试库：${PREFIX}_test 与 ${PREFIX}_t1..t7（默认 PREFIX=aurastack），由 `createdb -T aurastack_test <库>` 克隆；
#     t4 / t5 / t3 等用例文件头部注明了各自依赖的种子数据，t2（dicts SHADOW_SEED_SQL）与 t6（scheduled-task SEED_SQL）
#     由本脚本自动写入；t1 的菜单/角色夹具在设置 SHADOW_DATABASE_URL 时由用例文件自行重建。
# 用法：bash apps/api/scripts/shadow-all.sh [输出目录]
set -u
API=$(cd "$(dirname "$0")/.." && pwd)
AURA=${AURA:-$(cd "$API/../../../AuraStack" 2>/dev/null && pwd)}
PREFIX=${PREFIX:-aurastack}
PGURL=${PGURL:-postgresql://$(whoami)@localhost}
OUT=${1:-$API/.shadow-all}
mkdir -p "$OUT"
[ -x "$AURA/venv/bin/python" ] || { echo "找不到 AuraStack venv：$AURA/venv/bin/python（用 AURA=... 指定）"; exit 2; }

run_group() {
  local idx=$1 db=$2 mods=$3 extra_env=${4:-}
  local url=$PGURL/$db fp=53${idx}0 np=54${idx}0
  (cd "$AURA" && env $extra_env FLASK_ENV=production DATABASE_URL=$url SECRET_KEY=shadow-secret ADMIN_PASSWORD=admin123 \
    AI_SQL_DATABASE_URL=$url ENABLE_TASK_SCHEDULER=false venv/bin/python app.py $fp > "$OUT/flask-$idx.log" 2>&1 &)
  (cd "$API" && env $extra_env NODE_ENV=test TEST_DATABASE_URL=$url PORT=$np npx tsx src/main.ts > "$OUT/node-$idx.log" 2>&1 &)
  for _ in $(seq 1 30); do curl -sf localhost:$fp/health >/dev/null && curl -sf localhost:$np/health >/dev/null && break; sleep 1; done
  for m in $mods; do
    (cd "$API" && env $extra_env SHADOW_DATABASE_URL=$url npx tsx scripts/shadow-diff.ts \
      --flask http://localhost:$fp --node http://localhost:$np --only "$m:" > "$OUT/diff-$m.log" 2>&1)
    echo "[$db] $m: $(grep -c '^✓' "$OUT/diff-$m.log") ok, $(grep -c '^✗' "$OUT/diff-$m.log") diff"
  done
  lsof -ti tcp:$fp | xargs kill 2>/dev/null; lsof -ti tcp:$np | xargs kill 2>/dev/null; sleep 1
}

psql -q "$PGURL/${PREFIX}_t2" -c "$(cd "$API" && npx tsx -e "import('./scripts/shadow-cases/dicts.ts').then((m) => console.log(m.SHADOW_SEED_SQL))")" > /dev/null
(cd "$API" && npx tsx -e "import('./scripts/shadow-cases/scheduled-task.ts').then((m) => console.log(m.SEED_SQL))") | psql -q "$PGURL/${PREFIX}_t6" > /dev/null
(cd "$API" && npx tsx test/cc-ai-fake-upstream.ts 5178 > "$OUT/fake-ai.log" 2>&1 &)
sleep 2

run_group 0 ${PREFIX}_test "auth users"
run_group 1 ${PREFIX}_t1 "roles menu logs"
run_group 2 ${PREFIX}_t2 "dicts notification announcement dashboard"
run_group 3 ${PREFIX}_t3 "list-page ai-prompt"
run_group 4 ${PREFIX}_t4 "stats-list-page card-list-page tree-list-page dynamic-form-page"
run_group 5 ${PREFIX}_t5 "kanban detail-tabs gantt advanced-table map-heatmap"
run_group 6 ${PREFIX}_t6 "scheduled-task"
run_group 7 ${PREFIX}_t7 "ai-chat ai-sql devtools" "SHADOW_FAKE_AI=1 AI_API_BASE=http://127.0.0.1:5178 AI_API_KEY=fake-key AI_MODEL=fake-model"
lsof -ti tcp:5178 | xargs kill 2>/dev/null

ok=$(cat "$OUT"/diff-*.log | grep -c '^✓'); bad=$(cat "$OUT"/diff-*.log | grep -c '^✗')
echo "合计：$ok 一致，$bad 差异（预期 6 个有意差异：2 个 .xls 回落 + 4 个 Flask 公告 bug，见 docs/rewrite-plan.md §15）"
