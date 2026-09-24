#!/usr/bin/env bash
# 通过本地中转执行 `npx shadcn@latest add`（castor-kit 前端新增 shadcn/ui 原子组件用）。
#
# 为什么需要中转：shadcn CLI（node）不走系统代理，本机直连 ui.shadcn.com 会失败；
# 而 CLI 读到 HTTP(S)_PROXY 时又会把 127.0.0.1 的请求也塞给代理。所以这里：
#   1. 起一个 python 本地中转（127.0.0.1 随机端口），把 /r/<path> 用 curl（走系统代理）转发到 https://ui.shadcn.com/r/<path>
#   2. 清掉 HTTP(S)_PROXY / ALL_PROXY 后，用 REGISTRY_URL=http://127.0.0.1:<port>/r 执行 CLI
#      （npx / pnpm 下载依赖仍通过 npm_config_proxy 走原代理）
#   3. 结束后关闭中转
#
# 用法（任意目录执行，组件写入 apps/web/src/components/ui/，配置见 apps/web/components.json）：
#   apps/web/scripts/shadcn-add.sh hover-card
#   apps/web/scripts/shadcn-add.sh badge -o          # 覆盖已有文件（会丢掉本地改动，谨慎）
#   apps/web/scripts/shadcn-add.sh --view badge      # 只看不写：透传给 `shadcn view`
# 环境变量：SHADCN_VERSION（默认 latest）、SHADCN_UPSTREAM（默认 https://ui.shadcn.com/r）
# 注意：CLI 会为组件依赖跑 pnpm add；若误装了 cn 包，本脚本会 pnpm remove cn 撤回（lockfile 还原，dev server 可能重载一次）。
set -euo pipefail

WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM="${SHADCN_UPSTREAM:-https://ui.shadcn.com/r}"
VERSION="${SHADCN_VERSION:-latest}"

if [[ $# -eq 0 ]]; then
  sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 1
fi

SUBCOMMAND=add
if [[ "$1" == "--view" ]]; then
  SUBCOMMAND=view
  shift
fi

TMP_DIR="$(mktemp -d)"
RELAY_PID=""
cleanup() {
  if [[ -n "$RELAY_PID" ]] && kill -0 "$RELAY_PID" 2>/dev/null; then
    kill "$RELAY_PID" 2>/dev/null || true
    wait "$RELAY_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

cat >"$TMP_DIR/relay.py" <<'PY'
import http.server, subprocess, sys, tempfile, os

UPSTREAM = sys.argv[1].rstrip('/')
PORT_FILE = sys.argv[2]

class Relay(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if not path.startswith('/r/'):
            self.send_error(404, 'only /r/* is relayed')
            return
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            body_file = tmp.name
        try:
            # curl 继承调用方的 HTTP(S)_PROXY，负责真正出网
            res = subprocess.run(
                ['curl', '-sS', '-L', '--max-time', '60', '-o', body_file, '-w', '%{http_code}', UPSTREAM + path[2:]],
                capture_output=True, text=True,
            )
            status = int(res.stdout.strip() or 0) if res.returncode == 0 else 502
            with open(body_file, 'rb') as f:
                body = f.read()
        finally:
            os.unlink(body_file)
        if status == 0:
            status, body = 502, (res.stderr or 'relay error').encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json' if path.endswith('.json') else 'application/octet-stream')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        sys.stderr.write(f'[shadcn-relay] {status} {path}\n')

    def log_message(self, *args):
        pass

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Relay)
with open(PORT_FILE, 'w') as f:
    f.write(str(server.server_address[1]))
server.serve_forever()
PY

python3 "$TMP_DIR/relay.py" "$UPSTREAM" "$TMP_DIR/port" &
RELAY_PID=$!
for _ in $(seq 1 50); do
  [[ -s "$TMP_DIR/port" ]] && break
  sleep 0.1
done
if [[ ! -s "$TMP_DIR/port" ]]; then
  echo "❌ 本地中转启动失败" >&2
  exit 1
fi
PORT="$(cat "$TMP_DIR/port")"
echo "→ shadcn registry 中转：http://127.0.0.1:$PORT/r → $UPSTREAM" >&2

# 保留原代理给 npx / pnpm 下载 npm 包用（npm_config_*），shadcn CLI 本身不再看到代理变量
ORIG_PROXY="${HTTPS_PROXY:-${https_proxy:-${HTTP_PROXY:-${http_proxy:-}}}}"
NPM_PROXY_ENV=()
if [[ -n "$ORIG_PROXY" ]]; then
  NPM_PROXY_ENV=("npm_config_proxy=$ORIG_PROXY" "npm_config_https_proxy=$ORIG_PROXY")
fi

cd "$WEB_DIR"
HAD_CN_DEP=0
grep -q '"cn":' package.json && HAD_CN_DEP=1
touch "$TMP_DIR/marker"

env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy \
  ${NPM_PROXY_ENV[@]+"${NPM_PROXY_ENV[@]}"} \
  REGISTRY_URL="http://127.0.0.1:$PORT/r" \
  npx --yes "shadcn@$VERSION" "$SUBCOMMAND" "$@"

[[ "$SUBCOMMAND" == "add" ]] || exit 0

# 当前 registry（new-york-v4）里的源码写的是 `import { cn } from "cn"`，并把 "cn" 列为 npm 依赖；
# CLI 不会把它改写成 components.json 的 utils 别名。这里统一改回 @/lib/utils，并撤掉误装的 cn 包。
OUT_DIRS=(src)
prev=""
for arg in "$@"; do
  if [[ "$prev" == "-p" || "$prev" == "--path" ]]; then OUT_DIRS+=("$arg"); fi
  prev="$arg"
done
while IFS= read -r file; do
  if grep -qE "from ['\"]cn['\"]" "$file"; then
    sed -i.bak -E "s#from ['\"]cn['\"]#from \"@/lib/utils\"#" "$file" && rm -f "$file.bak"
    echo "↺ $file：cn 改为从 @/lib/utils 导入" >&2
  fi
done < <(find "${OUT_DIRS[@]}" -type f \( -name '*.js' -o -name '*.jsx' \) -newer "$TMP_DIR/marker" 2>/dev/null)
if [[ "$HAD_CN_DEP" == "0" ]] && grep -q '"cn":' package.json; then
  echo "↺ 撤销误装的 npm 包 cn" >&2
  pnpm remove cn >/dev/null
fi
