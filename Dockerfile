# Jira MCP Server - Docker image
# Supports both STDIO and HTTP transport modes.

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/build /app/build
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json

# Jira credentials (override at runtime)
ENV JIRA_EMAIL=your-email@example.com
ENV JIRA_API_TOKEN=your-api-token
ENV JIRA_DOMAIN=your-domain

# HTTP transport config (ignored in STDIO mode)
ENV MCP_HTTP_PORT=8107

# Expose HTTP port
EXPOSE 8107

# Default: HTTP mode (override with CMD ["node", "build/index.js"] for STDIO)
CMD ["node", "build/http-server.js"]
