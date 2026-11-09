# ==============================================================================
# Formora SaaS Production Dockerfile
# Multi-stage build for single-container deployment (SPA + Express API)
# Requires Node >= 22 for native node:sqlite and loadEnvFile support
# ==============================================================================

# --- Stage 1: Build Frontend SPA ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install full dependencies for Vite build
COPY package*.json ./
RUN npm ci

# Copy source and build static bundle
COPY . .
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server code and pre-built static dist
COPY server/ ./server/
COPY --from=builder /app/dist ./dist

# Ensure SQLite storage directory exists with proper non-root permissions
RUN mkdir -p /app/server/data && chown -R node:node /app

USER node

EXPOSE 3001

# Persistent SQLite database volume mount
VOLUME ["/app/server/data"]

# Healthcheck probe using built-in Node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server/server.js"]

