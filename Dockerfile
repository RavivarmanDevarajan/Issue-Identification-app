# Multi-Stage Build Dockerfile for Fullstack React + Node.js Application

# ==========================================
# Stage 1: Build Frontend (Vite + TS)
# ==========================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install compilation toolchain required for better-sqlite3 native bindings
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY . .

# Build production assets into /app/dist
RUN npm run build

# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV DB_PATH=/app/data/database.db

# Install compilation toolchain required for better-sqlite3 native bindings
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package manifests and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled frontend build from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend server code
COPY src/Backend ./src/Backend

# Create data directory for persistent SQLite database storage
RUN mkdir -p /app/data

EXPOSE 5000

# Health check to ensure service is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/datasets').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "src/Backend/server.js"]
