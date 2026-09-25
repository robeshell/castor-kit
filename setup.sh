#!/bin/bash
# castor-kit one-step installer
# Usage: bash setup.sh

set -e

# ── Colors ────────────────────────────────────────────────────
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
RED=$'\033[0;31m'
BOLD=$'\033[1m'
NC=$'\033[0m'

info()    { echo "${GREEN}✓${NC} $1"; }
warn()    { echo "${YELLOW}!${NC} $1"; }
error()   { echo "${RED}✗ 错误：$1${NC}"; exit 1; }
heading() { echo ""; echo "${BOLD}$1${NC}"; }

# ── Welcome ───────────────────────────────────────────────────
clear 2>/dev/null || true
echo "${BOLD}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║        castor-kit 一键安装           ║"
echo "  ╚══════════════════════════════════════╝"
echo "${NC}"
echo "  本脚本将自动完成所有配置并启动应用。"
echo "  全程约 3-5 分钟（取决于网速）。"
echo ""

# ── Check Docker ──────────────────────────────────────────────
heading "第一步：检查运行环境"

if ! command -v docker &>/dev/null; then
    error "未检测到 Docker。\n\n  请先安装 Docker Desktop：\n  https://www.docker.com/products/docker-desktop/\n\n  安装完成后重新运行本脚本。"
fi

if ! docker info &>/dev/null 2>&1; then
    error "Docker 未启动。\n\n  请打开 Docker Desktop，等待它完全启动后重新运行本脚本。"
fi

if ! docker compose version &>/dev/null 2>&1; then
    error "未检测到 docker compose 插件。\n\n  请将 Docker Desktop 升级到最新版本。"
fi

info "Docker 已就绪"

# ── Configuration ─────────────────────────────────────────────
heading "第二步：初始化配置"

# If a config already exists, ask whether to reconfigure
if [ -f ".env.production" ]; then
    echo ""
    read -p "  检测到已有配置文件，是否重新配置？[y/N] " RECONFIG
    RECONFIG=${RECONFIG:-N}
    if [[ ! "$RECONFIG" =~ ^[Yy]$ ]]; then
        info "保留现有配置，跳过配置步骤"
        SKIP_CONFIG=true
    fi
fi

if [ -z "$SKIP_CONFIG" ]; then
    echo ""
    echo "  请设置管理员登录密码（直接回车使用默认密码 admin123）："
    read -s -p "  管理员密码：" ADMIN_PASSWORD
    echo ""
    ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}

    # Ask for the port
    echo ""
    echo "  请设置访问端口（直接回车使用默认端口 5000）："
    read -p "  端口：" APP_PORT
    APP_PORT=${APP_PORT:-5000}

    # Ask about AI features
    echo ""
    echo "  是否配置 AI 功能（AI 对话、AI 提示词工坊）？"
    read -p "  需要配置 AI？[y/N] " SETUP_AI
    SETUP_AI=${SETUP_AI:-N}

    AI_API_KEY=""
    AI_API_BASE=""
    AI_MODEL=""
    if [[ "$SETUP_AI" =~ ^[Yy]$ ]]; then
        echo ""
        echo "  支持任何 OpenAI 兼容接口（OpenAI / Claude / 国产模型等）。"
        read -p "  API Key：" AI_API_KEY
        read -p "  API Base URL：" AI_API_BASE
        read -p "  模型名称（如 gpt-4o）：" AI_MODEL
    fi

    # Generate a random SECRET_KEY and read-only account password
    SECRET_KEY=$(LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*' < /dev/urandom | head -c 64 2>/dev/null || openssl rand -base64 48)
    POSTGRES_RO_PASSWORD=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24 2>/dev/null || openssl rand -base64 18)

    # Write the config file
    cat > .env.production <<EOF
# castor-kit 生产环境配置
# 此文件由 setup.sh 自动生成，请勿手动修改 SECRET_KEY

NODE_ENV=production
SECRET_KEY=${SECRET_KEY}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
APP_PORT=${APP_PORT}
POSTGRES_PASSWORD=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24 2>/dev/null || openssl rand -base64 18)
POSTGRES_RO_PASSWORD=${POSTGRES_RO_PASSWORD}

# AI 功能（可选）
AI_API_KEY=${AI_API_KEY}
AI_API_BASE=${AI_API_BASE}
AI_MODEL=${AI_MODEL}
EOF

    info "配置文件已生成（.env.production）"
fi

# Load the config
set -a
# shellcheck disable=SC1091
source .env.production
set +a
APP_PORT=${APP_PORT:-5000}

# ── Configure registry mirrors (if daemon.json has none) ─────────
configure_mirrors() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        local cfg="$HOME/.docker/daemon.json"
    else
        local cfg="/etc/docker/daemon.json"
    fi

    # Skip if already configured
    if [[ -f "$cfg" ]] && grep -q "registry-mirrors" "$cfg" 2>/dev/null; then
        return 0
    fi

    echo "  配置 Docker 镜像加速..."
    local mirrors='["https://docker.xuanyuan.me"]'
    mkdir -p "$(dirname "$cfg")"

    if [[ -f "$cfg" ]]; then
        # Merge into the existing config
        python3 -c "
import json, sys
with open('$cfg') as f:
    c = json.load(f)
c['registry-mirrors'] = $mirrors
with open('$cfg', 'w') as f:
    json.dump(c, f, indent=2)
" 2>/dev/null || echo "{\"registry-mirrors\": $mirrors}" > "$cfg"
    else
        echo "{\"registry-mirrors\": $mirrors}" > "$cfg"
    fi

    # Restart Docker to apply the config
    if [[ "$OSTYPE" == "darwin"* ]]; then
        osascript -e 'quit app "Docker"' 2>/dev/null || true
        sleep 2
        open -a Docker 2>/dev/null || true
        printf "  等待 Docker 重启"
        for i in $(seq 1 30); do
            docker info &>/dev/null 2>&1 && break
            printf "."; sleep 2
        done
        echo ""
    else
        sudo systemctl restart docker 2>/dev/null || true
    fi
    info "镜像加速已配置（轩辕 / 网易 / dockerproxy）"
}

configure_mirrors

# ── Start ─────────────────────────────────────────────────────
heading "第三步：构建并启动应用"
echo ""
echo "  正在构建镜像并启动服务，请稍候..."
echo "  （首次运行需要下载依赖，约 3-5 分钟）"
echo ""

docker compose --env-file .env.production up -d --build

# ── Wait for health check ──────────────────────────────────────
heading "第四步：等待服务就绪"

echo ""
printf "  等待应用启动"
for i in $(seq 1 30); do
    if curl -sf "http://localhost:${APP_PORT}/health" &>/dev/null; then
        echo ""
        break
    fi
    printf "."
    sleep 3
done
echo ""

if ! curl -sf "http://localhost:${APP_PORT}/health" &>/dev/null; then
    warn "服务尚未响应，可能需要更长时间启动。"
    warn "运行以下命令查看日志：docker compose --env-file .env.production logs -f app"
else
    info "服务已就绪"
fi

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "${BOLD}${GREEN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║          安装完成！                  ║"
echo "  ╚══════════════════════════════════════╝"
echo "${NC}"
echo "  访问地址：${BOLD}http://localhost:${APP_PORT}${NC}"
echo "  账号：    ${BOLD}admin${NC}"
echo "  密码：    ${BOLD}${ADMIN_PASSWORD}${NC}"
echo ""
echo "  常用命令："
echo "    停止服务：  docker compose --env-file .env.production down"
echo "    查看日志：  docker compose --env-file .env.production logs -f app"
echo "    重新启动：  docker compose --env-file .env.production up -d"
echo ""
