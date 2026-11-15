# ==============================================================================
# Skemat SaaS Production Dockerfile
# Multi-stage build for single-container deployment (SPA + Express API)
# Uses pnpm with pnpm-lock.yaml for fast, low-memory builds
# Requires Node >= 22 for native node:sqlite and loadEnvFile support
# ==============================================================================

# --- Stage 1: Build Frontend SPA ---
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Install full dependencies using project lockfile
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build static bundle
COPY . .
RUN pnpm run build

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN corepack enable && corepack prepare pnpm@latest --activate

# Install only production dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy server code and pre-built static dist
COPY server/ ./server/
COPY --from=builder /app/dist ./dist

# Ensure SQLite storage directory exists with proper non-root permissions
RUN mkdir -p /app/server/data && chown -R node:node /app

USER node

EXPOSE 3001

# Healthcheck probe using built-in Node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server/server.js"]
