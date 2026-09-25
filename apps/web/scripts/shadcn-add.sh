#!/usr/bin/env bash
# Runs `npx shadcn@latest add` through a local relay (used to add shadcn/ui primitives to the castor-kit frontend).
#
# Why a relay: the shadcn CLI (node) ignores the system proxy, and connecting to ui.shadcn.com directly fails on this machine;
# yet when the CLI sees HTTP(S)_PROXY it sends even 127.0.0.1 requests through the proxy. So this script:
#   1. starts a local python relay (127.0.0.1, random port) that forwards /r/<path> to https://ui.shadcn.com/r/<path> via curl (which uses the system proxy)
#   2. clears HTTP(S)_PROXY / ALL_PROXY and runs the CLI with REGISTRY_URL=http://127.0.0.1:<port>/r
#      (npx / pnpm still download dependencies through the original proxy via npm_config_proxy)
#   3. shuts the relay down when done
#
# Usage (run from any directory; components are written to apps/web/src/components/ui/, config in apps/web/components.json):
#   apps/web/scripts/shadcn-add.sh hover-card
#   apps/web/scripts/shadcn-add.sh badge -o          # overwrite existing files (discards local changes, use with care)
#   apps/web/scripts/shadcn-add.sh --view badge      # read-only: passed through to `shadcn view`
# Env vars: SHADCN_VERSION (default latest), SHADCN_UPSTREAM (default https://ui.shadcn.com/r)
# Note: the CLI runs pnpm add for component deps; if it wrongly installs the cn package, this script reverts it with pnpm remove cn (the lockfile is restored; the dev server may reload once).
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
            # curl inherits the caller's HTTP(S)_PROXY and does the actual outbound request
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

# Keep the original proxy for npx / pnpm package downloads (npm_config_*); the shadcn CLI itself no longer sees proxy vars
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

# Sources in the current registry (new-york-v4) use `import { cn } from "cn"` and list "cn" as an npm dependency;
# the CLI doesn't rewrite it to the components.json utils alias. Rewrite it back to @/lib/utils and remove the wrongly installed cn package.
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
