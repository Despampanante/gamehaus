# ── Stage 1: build SvelteKit frontend ──────────────────────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
COPY shared/ ../shared/
RUN npm run build

# ── Stage 2: build / typecheck backend ─────────────────────────────────────
FROM oven/bun:1-alpine AS backend-build
WORKDIR /build/backend

COPY backend/package*.json ./
RUN bun install --frozen-lockfile

COPY backend/ ./
COPY shared/ ../shared/

# ── Stage 3: runtime ────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runtime
RUN apk add --no-cache nginx

# nginx config
COPY deploy/nginx.conf /etc/nginx/nginx.conf

# frontend static files
COPY --from=frontend-build /build/frontend/build /srv/frontend

# backend source + deps (bun runs TS directly in prod)
WORKDIR /app/backend
COPY --from=backend-build /build/backend .

# games placeholder (real volume mounts over this at runtime)
RUN mkdir -p /app/games /app/data

COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000 3001
ENTRYPOINT ["/entrypoint.sh"]
