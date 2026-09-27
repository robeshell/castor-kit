#!/usr/bin/env bash
# Runs `npx shadcn@latest add` through a local relay (used to add shadcn/ui primitives to the castor-kit frontend).
#
# Why a relay: the shadcn CLI (node) ignores the system proxy, and connecting to ui.shadcn.com directly fails on this machine;
# yet when the CLI sees HTTP(S)_PROXY it sends even 127.0.0.1 requests through the proxy. So this script:
#   1. starts a local Node relay (127.0.0.1, random port) that forwards /r/<path> to https://ui.shadcn.com/r/<path> via curl (which uses the system proxy)
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

cat >"$TMP_DIR/relay.mjs" <<'JS'
import { execFile } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

const upstream = process.argv[2].replace(/\/+$/, '')
const portFile = process.argv[3]

const server = createServer((req, res) => {
  const path = (req.url ?? '').split('?', 1)[0]
  if (req.method !== 'GET' || !path.startsWith('/r/')) {
    res.writeHead(404).end('only GET /r/* is relayed')
    return
  }
  // curl inherits the caller's HTTP(S)_PROXY and does the actual outbound request; the status code follows the body
  const args = ['-sS', '-L', '--max-time', '60', '-w', '\n%{http_code}', upstream + path.slice(2)]
  execFile('curl', args, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
    const split = stdout.lastIndexOf(0x0a)
    const status = error ? 0 : Number(stdout.subarray(split + 1).toString()) || 0
    const body = status ? stdout.subarray(0, split) : Buffer.from(stderr.toString() || 'relay error')
    const code = status || 502
    res.writeHead(code, {
      'Content-Type': path.endsWith('.json') ? 'application/json' : 'application/octet-stream',
      'Content-Length': body.length,
    })
    res.end(body)
    process.stderr.write(`[shadcn-relay] ${code} ${path}\n`)
  })
})

server.listen(0, '127.0.0.1', () => writeFileSync(portFile, String(server.address().port)))
JS

node "$TMP_DIR/relay.mjs" "$UPSTREAM" "$TMP_DIR/port" &
RELAY_PID=$!
for _ in $(seq 1 50); do
  [[ -s "$TMP_DIR/port" ]] && break
  sleep 0.1
done
if [[ ! -s "$TMP_DIR/port" ]]; then
  echo "❌ Failed to start the local relay" >&2
  exit 1
fi
PORT="$(cat "$TMP_DIR/port")"
echo "→ shadcn registry relay: http://127.0.0.1:$PORT/r → $UPSTREAM" >&2

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
    echo "↺ $file: cn now imported from @/lib/utils" >&2
  fi
done < <(find "${OUT_DIRS[@]}" -type f \( -name '*.js' -o -name '*.jsx' \) -newer "$TMP_DIR/marker" 2>/dev/null)
if [[ "$HAD_CN_DEP" == "0" ]] && grep -q '"cn":' package.json; then
  echo "↺ Removing the wrongly installed npm package cn" >&2
  pnpm remove cn >/dev/null
fi
