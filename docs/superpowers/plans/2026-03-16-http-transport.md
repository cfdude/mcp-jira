# HTTP Transport & Cross-Server Deprecation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stateful HTTP transport to mcp-jira so multiple Claude Code projects share one PM2 process instead of each spawning a STDIO instance (~48MB savings), while deprecating unused cross-server integration code.

**Architecture:** Two separate entry points — `index.ts` (STDIO for Claude Desktop) and `http-server.ts` (HTTP for PM2/Claude Code). The HTTP server uses a **server-per-session factory pattern** because the MCP SDK's `Server.connect()` only allows one transport per `Server` instance. A `createMcpServer()` factory creates a fresh `Server` with all tool/resource/prompt handlers for each HTTP session. Cross-server integration is fully removed. PM2 ecosystem manages the HTTP mode. Sessions are stateful with 30-minute timeout and proper cleanup.

**Tech Stack:** Node.js, TypeScript, `@modelcontextprotocol/sdk` (StreamableHTTPServerTransport), PM2

---

## File Map

### Files to Delete
- `src/tools/confluence-health-check.ts` — cross-server Confluence health check (entire file, 47 lines)

### Files to Modify
- `src/types.ts:31-40` — remove `CrossServerIntegrationConfig` interface; `:58` remove `crossServerIntegration` field from `MultiInstanceJiraConfig`
- `src/jira-server.ts` — remove `runDualTransport()`, `initializeCrossServerIntegration()`, entire cross-server config check in `run()` (lines 76-93), commented-out imports (lines 6, 14); refactor to expose `createMcpServer()` factory
- `src/tools/jira-health-check.ts` — remove `CrossServerIntegrationConfig` import, all cross-server fields/methods; simplify to uptime/status/transport/sessions
- `src/tools/index.ts:87` — remove `handleConfluenceHealthCheck` import; remove `confluence_health_check` tool schema (~2265-2272), tool name (~2398), case handler (~2538-2548); update `jira_health_check` description
- `package.json:4` — update description to remove "cross-server capabilities"
- `.gitignore` — add `ecosystem.config.cjs`
- `CLAUDE.md` — update architecture docs for HTTP transport, remove cross-server references

### Files to Create
- `src/http-server.ts` — HTTP entry point with server-per-session factory, handles GET/POST/DELETE on `/mcp`
- `ecosystem.config.cjs.example` — PM2 ecosystem example config
- `src/utils/graceful-shutdown.ts` — shutdown logic (HTTP-only; STDIO relies on Claude's process management)

---

## Stage 1: Cross-Server Deprecation

### Task 1: Remove cross-server types

**Files:**
- Modify: `src/types.ts:31-40` (remove `CrossServerIntegrationConfig`)
- Modify: `src/types.ts:58` (remove `crossServerIntegration` field)

- [ ] **Step 1: Remove `CrossServerIntegrationConfig` interface from types.ts**

Delete lines 31-40 (the entire interface):
```typescript
// DELETE THIS ENTIRE BLOCK:
export interface CrossServerIntegrationConfig {
  enabled: boolean;
  confluenceMcpPath?: string;
  timeout?: number;
  maxRetries?: number;
  allowedIncomingModes?: string[];
  excludedOperations?: string[];
  role?: 'slave' | 'master';
  supportedConfluenceServers?: string[];
}
```

And remove from `MultiInstanceJiraConfig` (line 58):
```typescript
// DELETE THIS LINE:
crossServerIntegration?: CrossServerIntegrationConfig;
```

- [ ] **Step 2: Build to see expected type errors**

Run: `npm run build 2>&1 | head -40`
Expected: Type errors in `jira-health-check.ts`, `confluence-health-check.ts`, `jira-server.ts`, `tools/index.ts` — these are expected and will be fixed in subsequent tasks.

### Task 2: Remove confluence-health-check tool

**Files:**
- Delete: `src/tools/confluence-health-check.ts`
- Modify: `src/tools/index.ts:87` (remove import)
- Modify: `src/tools/index.ts` (remove tool schema ~2265-2272, tool name ~2398, case handler ~2538-2548)

- [ ] **Step 1: Delete confluence-health-check.ts**

```bash
rm src/tools/confluence-health-check.ts
```

- [ ] **Step 2: Remove import from tools/index.ts**

Remove line 87: `import { handleConfluenceHealthCheck } from './confluence-health-check.js';`

- [ ] **Step 3: Remove `confluence_health_check` tool schema from the tools list array**

In the tools list (around line 2265-2272), remove the entire object:
```typescript
// DELETE THIS ENTIRE BLOCK:
{
  name: 'confluence_health_check',
  description: "Check the health and connectivity status with the Confluence MCP server...",
  inputSchema: {
    type: 'object',
    properties: {},
  },
},
```

- [ ] **Step 4: Remove `confluence_health_check` from the tool names array**

In the `toolNames` array (around line 2398), remove `'confluence_health_check'`.

- [ ] **Step 5: Remove the `confluence_health_check` case handler**

Remove the entire case block (around lines 2538-2548):
```typescript
// DELETE THIS ENTIRE BLOCK:
case 'confluence_health_check': {
  try {
    const { loadMultiInstanceConfig } = await import('../config.js');
    const config = await loadMultiInstanceConfig('.');
    return await handleConfluenceHealthCheck(config?.crossServerIntegration);
  } catch (error) {
    console.error('Failed to load config for confluence health check:', error);
    return await handleConfluenceHealthCheck();
  }
}
```

### Task 3: Simplify jira-health-check (remove cross-server)

**Files:**
- Modify: `src/tools/jira-health-check.ts` — full rewrite to remove all cross-server fields

- [ ] **Step 1: Rewrite jira-health-check.ts as a simple health reporter**

Replace the entire file contents with:
```typescript
import logger from '../utils/logger.js';

export interface JiraHealthInfo {
  serverType: string;
  version: string;
  status: 'ready' | 'starting' | 'error';
  timestamp: number;
  uptime: number;
  transport: 'stdio' | 'http';
  activeSessions: number;
}

class JiraHealthCheckManager {
  private status: 'ready' | 'starting' | 'error' = 'starting';
  private startTime = Date.now();
  private transport: 'stdio' | 'http' = 'stdio';
  private getSessionCount: () => number = () => 0;

  constructor(private serverVersion: string = '1.3.0') {}

  setStatus(status: 'ready' | 'starting' | 'error') {
    this.status = status;
  }

  setTransport(transport: 'stdio' | 'http') {
    this.transport = transport;
  }

  setSessionCountProvider(fn: () => number) {
    this.getSessionCount = fn;
  }

  getHealthInfo(): JiraHealthInfo {
    return {
      serverType: 'mcp-jira',
      version: this.serverVersion,
      status: this.status,
      timestamp: Date.now(),
      uptime: this.getUptime(),
      transport: this.transport,
      activeSessions: this.getSessionCount(),
    };
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

export const jiraHealthCheckManager = new JiraHealthCheckManager('1.3.0');

export async function handleJiraHealthCheck() {
  try {
    const healthInfo = jiraHealthCheckManager.getHealthInfo();

    logger.info('Jira health check requested', {
      status: healthInfo.status,
      uptime: healthInfo.uptime,
      transport: healthInfo.transport,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { ...healthInfo, lastUpdated: new Date().toISOString() },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    logger.error('Error getting Jira health info:', error);
    throw new Error(
      `Failed to get health info: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
```

Note: Version set to `1.3.0` to match `package.json`.

- [ ] **Step 2: Update jira_health_check tool description in tools/index.ts**

Change the description (around line 2258-2259) from the cross-server text to:
```
'Get health information for this Jira MCP server including uptime, transport mode, active sessions, and server status.'
```

### Task 4: Clean up jira-server.ts (remove cross-server wiring)

**Files:**
- Modify: `src/jira-server.ts`

- [ ] **Step 1: Remove commented-out imports**

Remove line 6: `// import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';`
Remove line 14: `// import { randomUUID } from 'crypto';`

- [ ] **Step 2: Remove `initializeCrossServerIntegration()` method**

Delete the entire method (lines 241-276) and remove the call to it in the constructor (line 67):
```typescript
// DELETE THIS LINE from constructor:
this.initializeCrossServerIntegration();
```

- [ ] **Step 3: Remove `runDualTransport()` method**

Delete the entire method (lines 164-239).

- [ ] **Step 4: Replace entire `run()` method body**

Replace the full body of `run()` (lines 75-94) — removing the `crossServerEnabled` variable, the dynamic `import('./config.js')`, and the conditional. The entire method becomes:
```typescript
async run() {
  await this.runStdioOnly();
}
```

### Task 5: Update package.json description

**Files:**
- Modify: `package.json:4`

- [ ] **Step 1: Update description**

Change from:
```
"Enterprise-grade Model Context Protocol server for comprehensive Jira integration with automated field detection, multi-instance support, and cross-server capabilities"
```
To:
```
"Model Context Protocol server for Jira integration with automated field detection, multi-instance support, and HTTP/STDIO transport modes"
```

### Task 6: Verify and commit Stage 1

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: Clean build with no errors.

- [ ] **Step 2: Run tests**

Run: `npm run test:coverage`
Expected: All tests pass.

- [ ] **Step 3: Lint and format**

Run: `npm run lint:fix && npm run format`

- [ ] **Step 4: Verify no cross-server remnants**

```bash
rg -i 'confluence' src/ --type ts
rg -i 'cross.server' src/ --type ts
rg 'CrossServerIntegrationConfig' src/ --type ts
```
Expected: All three return zero results.

- [ ] **Step 5: Commit Stage 1**

```bash
git add -A
git commit -S -m "refactor: deprecate cross-server integration

Remove CrossServerIntegrationConfig, confluence-health-check tool,
cross-server fields from jira-health-check, dual-transport scaffolding,
and initializeCrossServerIntegration from JiraServer.

Cross-server communication between Jira and Confluence MCP servers is
unnecessary — Claude orchestrates both servers and can call tools on
either directly.

Health check tool simplified to report uptime, transport mode, and
active session count."
```

---

## Stage 2: HTTP Transport Implementation

### Task 7: Create graceful shutdown utility (HTTP-only)

**Files:**
- Create: `src/utils/graceful-shutdown.ts`

Note: This is for the HTTP entry point only. The STDIO entry point relies on Claude's process management and must NOT install signal handlers (see existing comment at `jira-server.ts:63`).

- [ ] **Step 1: Create graceful-shutdown.ts**

```typescript
import { sessionManager } from '../session-manager.js';
import logger from './logger.js';

/**
 * Set up graceful shutdown for the HTTP server process.
 * NOT for STDIO — Claude manages that process lifecycle.
 */
export function setupGracefulShutdown(cleanup: () => Promise<void>): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`Received ${signal}, shutting down gracefully...`);

    try {
      await cleanup();
      sessionManager.destroy();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
```

### Task 8: Refactor JiraServer to expose a server factory

**Files:**
- Modify: `src/jira-server.ts`

The MCP SDK's `Server.connect()` throws if already connected (`"Already connected to a transport"`). For HTTP multi-session support, we need a factory that creates a fresh `Server` instance with all handlers for each session.

- [ ] **Step 1: Extract tool/resource/prompt handler setup into a reusable method**

Add a static factory method and refactor the constructor so handler registration is reusable:

```typescript
/**
 * Create a fresh MCP Server instance with all handlers registered.
 * Used by http-server.ts to create one Server per HTTP session,
 * since the SDK only allows one transport per Server instance.
 */
static createMcpServer(sessionState?: SessionState): Server {
  const server = new Server(
    {
      name: 'jira-server',
      version: '1.3.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  const storyPointsFieldRef = { current: null as string | null };

  // Setup tool handlers
  setupToolHandlers(server, storyPointsFieldRef, sessionState);

  // Setup resources handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [],
  }));

  // Setup prompts handlers
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [],
  }));

  // Setup error handling
  server.onerror = error => {
    logger.error('MCP Server Error', { error: error.message, stack: error.stack });
  };

  return server;
}
```

- [ ] **Step 2: Refactor the constructor to use the factory internally**

The existing constructor should delegate to `createMcpServer()`:
```typescript
constructor() {
  logger.info('Initializing MCP Jira Server');
  this.server = JiraServer.createMcpServer();
  logger.info('JiraServer initialization completed');
}
```

Remove the now-redundant inline setup code from the constructor (the `new Server()` call, `setupToolHandlers`, `setRequestHandler` calls, and `onerror` handler).

### Task 9: Create HTTP server entry point

**Files:**
- Create: `src/http-server.ts`

Key architectural decisions:
- **Server-per-session**: Each new HTTP session gets its own `Server` instance via `JiraServer.createMcpServer()`
- **GET/POST/DELETE on /mcp**: All three HTTP methods are routed to the transport's `handleRequest()` per the Streamable HTTP spec
- **`isInitializeRequest` validation**: New sessions are only created for proper initialization requests
- **`onsessioninitialized` callback**: Avoids race conditions when storing transports

- [ ] **Step 1: Create http-server.ts**

```typescript
#!/usr/bin/env node
/**
 * HTTP entry point for the Jira MCP server.
 * Run via PM2 for shared access across Claude Code projects.
 *
 * Uses a server-per-session factory pattern because the MCP SDK's
 * Server.connect() only allows one transport per Server instance.
 */
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { JiraServer } from './jira-server.js';
import { sessionManager } from './session-manager.js';
import { jiraHealthCheckManager } from './tools/jira-health-check.js';
import { setupGracefulShutdown } from './utils/graceful-shutdown.js';
import logger from './utils/logger.js';

const DEFAULT_PORT = 8106;
const port = parseInt(process.env.MCP_HTTP_PORT || String(DEFAULT_PORT), 10);

// Map of session ID -> { server, transport } for multi-session support
const sessions = new Map<string, { server: Server; transport: StreamableHTTPServerTransport }>();

// Configure health check manager for HTTP mode
jiraHealthCheckManager.setStatus('ready');
jiraHealthCheckManager.setTransport('http');
jiraHealthCheckManager.setSessionCountProvider(() => sessions.size);

/**
 * Handle incoming MCP requests on /mcp.
 * Routes GET, POST, DELETE to the appropriate session's transport.
 */
async function handleMcpRequest(req: IncomingMessage, res: ServerResponse) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // --- Existing session: route to its transport ---
  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }

  // --- Unknown session ID: reject ---
  if (sessionId && !sessions.has(sessionId)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Session not found. It may have expired.' }));
    return;
  }

  // --- No session ID: must be an initialization request ---
  // Parse the request body to check if it's an init request
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString());

  if (!isInitializeRequest(body)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Bad Request: first request must be an initialization request',
    }));
    return;
  }

  // Create a new session: fresh Server + Transport
  const sessionState = sessionManager.createSession(randomUUID());
  const mcpServer = JiraServer.createMcpServer(sessionState);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionState.sessionId,
    onsessioninitialized: (sid) => {
      sessions.set(sid, { server: mcpServer, transport });
      logger.info('New HTTP session created', {
        sessionId: sid,
        activeSessions: sessions.size,
      });
    },
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      sessions.delete(sid);
      sessionManager.removeSession(sid);
      logger.info('HTTP session closed', { sessionId: sid });
    }
  };

  // Connect this server instance to its transport
  await mcpServer.connect(transport);

  // Handle the initialization request (pass pre-parsed body)
  await transport.handleRequest(req, res, body);
}

// Create HTTP server — route GET, POST, DELETE to MCP handler
const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`);

  if (url.pathname === '/mcp') {
    try {
      await handleMcpRequest(req, res);
    } catch (error) {
      logger.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  } else if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      activeSessions: sessions.size,
      uptime: process.uptime(),
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Graceful shutdown — close all sessions and transports
setupGracefulShutdown(async () => {
  for (const [sid, { server, transport }] of sessions) {
    await transport.close();
    await server.close();
    sessions.delete(sid);
  }
  httpServer.close();
});

// Periodic cleanup of stale sessions (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  for (const [sid, { server, transport }] of sessions) {
    if (!sessionManager.getSession(sid)) {
      transport.close().catch(() => {});
      server.close().catch(() => {});
      sessions.delete(sid);
      logger.info('Cleaned up stale HTTP session', { sessionId: sid });
    }
  }
}, CLEANUP_INTERVAL);
cleanupTimer.unref();

// Start listening
httpServer.listen(port, () => {
  logger.info(`Jira MCP HTTP server listening on port ${port}`);
  logger.info(`MCP endpoint: http://localhost:${port}/mcp`);
  logger.info(`Health check: http://localhost:${port}/health`);
});
```

- [ ] **Step 2: Update build script in package.json for executable permissions**

Change the build script to chmod both entry points:
```json
"build": "tsc && node -e \"const fs=require('fs'); fs.chmodSync('build/index.js','755'); fs.chmodSync('build/http-server.js','755');\"",
```

Also add a convenience script:
```json
"start:http": "node build/http-server.js",
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Clean build. Both `build/index.js` and `build/http-server.js` exist with executable permissions.

- [ ] **Step 4: Smoke test HTTP server locally**

```bash
node build/http-server.js &
sleep 2
curl -s http://localhost:8106/health | jq .
kill %1
```
Expected: `{"status":"ok","activeSessions":0,...}`

- [ ] **Step 5: Commit HTTP transport**

```bash
git add src/http-server.ts src/utils/graceful-shutdown.ts src/jira-server.ts package.json
git commit -S -m "feat: add HTTP transport entry point for shared PM2 deployment

New http-server.ts uses a server-per-session factory pattern — each
HTTP session gets its own MCP Server instance, as required by the SDK.
Handles GET/POST/DELETE on /mcp per the Streamable HTTP spec.
Validates initialization requests before creating sessions.
Includes /health endpoint for PM2 monitoring.
Port 8106 (configurable via MCP_HTTP_PORT)."
```

---

## Stage 3: PM2 Ecosystem & Configuration

### Task 10: Create PM2 ecosystem example and update .gitignore

**Files:**
- Create: `ecosystem.config.cjs.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create ecosystem.config.cjs.example**

```javascript
// PM2 Ecosystem Configuration for Jira MCP Server
// Copy to ecosystem.config.cjs and update paths for your environment.
module.exports = {
  apps: [
    {
      name: 'mcp-jira-http',
      script: 'build/http-server.js',
      cwd: '/path/to/mcp-jira',          // UPDATE: absolute path to mcp-jira
      env: {
        NODE_ENV: 'production',
        MCP_HTTP_PORT: '8106',
        JIRA_CONFIG_PATH: '/path/to/.jira-config.json',  // UPDATE: path to config
      },
      max_memory_restart: '150M',
      exp_backoff_restart_delay: 1000,
      watch: false,
      error_file: '/tmp/mcp-jira-http-error.log',
      out_file: '/tmp/mcp-jira-http-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
```

Note: STDIO is NOT in PM2 — Claude Desktop spawns its own `node build/index.js` on demand.

- [ ] **Step 2: Add ecosystem.config.cjs to .gitignore**

Append to `.gitignore`:
```
# PM2 ecosystem config (contains local paths)
ecosystem.config.cjs
```

- [ ] **Step 3: Commit**

```bash
git add ecosystem.config.cjs.example .gitignore
git commit -S -m "chore: add PM2 ecosystem example and gitignore entry

ecosystem.config.cjs.example provides a template for PM2 deployment.
Actual config is gitignored since it contains local paths."
```

### Task 11: Set up PM2 instance and persist

- [ ] **Step 1: Create actual ecosystem.config.cjs**

```bash
cp ecosystem.config.cjs.example ecosystem.config.cjs
```

Update paths:
- `cwd`: `/Users/robsherman/Servers/mcp-jira`
- `JIRA_CONFIG_PATH`: path to the actual `.jira-config.json`

- [ ] **Step 2: Build the project**

```bash
npm run build
```

- [ ] **Step 3: Start PM2 instance and persist**

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

- [ ] **Step 4: Verify**

```bash
pm2 list
curl -s http://localhost:8106/health | jq .
```

Expected: PM2 shows `mcp-jira-http` as online, health endpoint responds.

### Task 12: Update SERVER_PORTS.md

- [ ] **Step 1: Add mcp-jira-http to SERVER_PORTS.md**

Add to the MCP Servers HTTP/SSE Transport table in `~/SERVER_PORTS.md`:
```
| mcp-jira (HTTP) | `/Users/robsherman/Servers/mcp-jira` | 8106 | MCP (PM2) | ✅ Active | Jira MCP - stateful HTTP transport |
```

Remove/update the old entry that referenced port 3001 for mcp-jira-server.

---

## Stage 4: Documentation & Claude Code Config

### Task 13: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Architecture Overview**

Changes:
- Remove all references to "cross-server integration" and "dual transport"
- Update Server Architecture to mention both STDIO and HTTP modes
- Update "Running the Server" section to document both modes
- Remove the "Concurrency Solution" section about cross-server conflicts
- Remove "Concurrent Usage" section referencing cross-server
- Add HTTP transport documentation:

```markdown
### Transport Modes

The server supports two transport modes via separate entry points:

#### STDIO Mode (Claude Desktop)
```bash
node build/index.js
```
Used by Claude Desktop which spawns the process directly. Each Desktop session gets its own process.

#### HTTP Mode (Claude Code / PM2)
```bash
node build/http-server.js
# Or via PM2:
pm2 start ecosystem.config.cjs
```
Stateful HTTP transport on port 8106 (configurable via MCP_HTTP_PORT env var).
Multiple Claude Code projects share a single server instance.
Each client session gets its own MCP Server instance with isolated state.

Configure in Claude Code (user scope):
```bash
claude mcp add --scope user jira --transport http --url http://localhost:8106/mcp
```
```

- [ ] **Step 2: Commit documentation**

```bash
git add CLAUDE.md
git commit -S -m "docs: update CLAUDE.md for HTTP transport, remove cross-server references"
```

### Task 14: Configure Claude Code user-scoped MCP

This is NOT committed — it's a local configuration step.

- [ ] **Step 1: Add Jira MCP server to Claude Code user scope**

```bash
claude mcp add --scope user jira --transport http --url http://localhost:8106/mcp
```

- [ ] **Step 2: Verify it works**

Start a new Claude Code session and confirm the Jira tools are available.

- [ ] **Step 3: Remove old STDIO-based Jira MCP configs**

Check `~/.claude/settings.json` and any project-level `.mcp.json` files for old STDIO-based Jira MCP entries and remove them, since the user-scoped HTTP config now handles it globally.

---

## Summary of Commits

1. `refactor: deprecate cross-server integration` — Stage 1 (all deprecation)
2. `feat: add HTTP transport entry point for shared PM2 deployment` — Stage 2 (HTTP server + factory refactor)
3. `chore: add PM2 ecosystem example and gitignore entry` — Stage 3 (PM2 config)
4. `docs: update CLAUDE.md for HTTP transport, remove cross-server references` — Stage 4 (docs)

## Post-Implementation Verification

After all stages are complete:
1. `npm run build` — clean build
2. `npm run test:coverage` — all tests pass
3. `npm run lint` — no lint errors
4. `rg -i 'confluence' src/ --type ts` — zero results
5. `rg -i 'cross.server' src/ --type ts` — zero results
6. `rg 'CrossServerIntegrationConfig' src/ --type ts` — zero results
7. `pm2 list` — `mcp-jira-http` online
8. `curl http://localhost:8106/health` — responds with status ok
9. Claude Code session can call Jira tools via HTTP transport
