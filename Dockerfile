# Leadloadz MCP Server Dockerfile
# Multi-stage build for production

# ─── Base Image ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# ─── Dependencies Stage ──────────────────────────────────────────────────────
FROM base AS dependencies

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# ─── Production Stage ────────────────────────────────────────────────────────
FROM base AS production

# Set NODE_ENV
ENV NODE_ENV=production

# Copy production dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy built application files
COPY dist/ ./dist/
COPY package.json ./
COPY LICENSE ./
COPY README.md ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S leadloadz -u 1001

# Change ownership
RUN chown -R leadloadz:nodejs /app
USER leadloadz

# Expose no ports (stdio transport)
# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('health check')" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run the MCP server
CMD ["node", "dist/index.js"]
