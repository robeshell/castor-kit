# Debian (glibc) base for both stages: native modules such as sodium-native (session encryption) ship prebuilt binaries
# for glibc Linux only, so they fail to load on Alpine (musl).

# ─────────────────────────────────────────────────────────────
# Stage 1: install deps, build the frontend (vite) and backend (tsup), prune to production deps
# ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build

WORKDIR /repo
RUN corepack enable

# npm registry for dependency installs; docker-compose.yml passes a mirror, hosted builders (Render etc.) use the default
ARG NPM_REGISTRY=https://registry.npmjs.org

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mcp/package.json apps/mcp/
RUN pnpm config set registry ${NPM_REGISTRY} && \
    CI=true pnpm install --frozen-lockfile

COPY apps/ apps/
# The API bundles the OpenAPI document (the AI assistant's API catalog)
COPY docs/apifox-full.openapi.json docs/
RUN pnpm --filter @castor-kit/web build && \
    pnpm --filter @castor-kit/api build && \
    CI=true pnpm --filter @castor-kit/api deploy --prod --legacy /out


# ─────────────────────────────────────────────────────────────
# Stage 2: runtime image
# ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
COPY --from=build /repo/apps/web/dist ./web
COPY docker-entrypoint.sh ./

# Required runtime dirs + non-root user (defense in depth: limits privilege escalation inside the container)
RUN chmod +x docker-entrypoint.sh && \
    mkdir -p instance && \
    useradd --uid 10001 --create-home appuser && \
    chown -R appuser:appuser /app/instance

ENV NODE_ENV=production \
    PORT=5000 \
    WEB_DIST_DIR=/app/web \
    INSTANCE_DIR=/app/instance \
    MIGRATIONS_DIR=/app/drizzle

EXPOSE 5000

USER appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
