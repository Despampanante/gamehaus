# ── Stage 1: build SvelteKit frontend ──────────────────────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /build/frontend

COPY frontend/package*.json ./
# Use npm install so the image builds before a lockfile is committed.
# Switch to `npm ci` once package-lock.json is checked in.
RUN npm install

COPY frontend/ ./
COPY shared/ ../shared/
RUN npm run build

# ── Stage 2: install + typecheck backend ────────────────────────────────────
FROM oven/bun:1-alpine AS backend-build
WORKDIR /build/backend

COPY backend/package*.json ./
# Use bun install so the image builds before bun.lockb is committed.
# Switch to `bun install --frozen-lockfile` once bun.lockb is checked in.
RUN bun install

COPY backend/ ./
COPY shared/ ../shared/

# ── Stage 3: runtime ────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runtime
RUN apk add --no-cache nginx

# nginx config
COPY deploy/nginx.conf /etc/nginx/nginx.conf

# Frontend static files served by nginx
COPY --from=frontend-build /build/frontend/build /srv/frontend

# Backend: production deps only + source + shared types
WORKDIR /app/backend
COPY --from=backend-build /build/backend/node_modules ./node_modules
COPY --from=backend-build /build/backend/src          ./src
COPY --from=backend-build /build/backend/package.json ./package.json
COPY --from=backend-build /build/shared               ../shared

# Games directory — real content is volume-mounted at runtime
RUN mkdir -p /app/games /app/data

COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
