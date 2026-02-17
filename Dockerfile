# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config and lockfile first (layer cache)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY shared/ shared/
COPY backend/ backend/
COPY frontend/ frontend/

# Build all packages (shared first, then backend + frontend in parallel)
RUN pnpm --filter @echo-portal/shared build \
    && pnpm --parallel --filter !@echo-portal/shared -r build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config and lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built shared package
COPY --from=builder /app/shared/dist/ shared/dist/

# Copy built backend
COPY --from=builder /app/backend/dist/ backend/dist/

# Copy built frontend (served as static files by backend)
COPY --from=builder /app/frontend/dist/ frontend/dist/

# Copy Drizzle migrations and migration runner
COPY --from=builder /app/backend/drizzle/ backend/drizzle/
COPY --from=builder /app/backend/migrate.mjs backend/

# Create data directory for git repos
RUN mkdir -p /app/data/repo

ENV NODE_ENV=production
ENV PORT=8080
ENV FRONTEND_DIR=./frontend/dist
ENV GIT_REPO_PATH=/app/data/repo

EXPOSE 8080

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Run migrations then start the server
CMD ["/app/start.sh"]
