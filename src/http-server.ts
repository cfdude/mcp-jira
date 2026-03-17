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
    res.end(
      JSON.stringify({
        error: 'Bad Request: first request must be an initialization request',
      })
    );
    return;
  }

  // Create a new session: fresh Server + Transport
  const sessionState = sessionManager.createSession(randomUUID());
  const mcpServer = JiraServer.createMcpServer(sessionState);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionState.sessionId,
    onsessioninitialized: (sid: string) => {
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
    res.end(
      JSON.stringify({
        status: 'ok',
        activeSessions: sessions.size,
        uptime: process.uptime(),
      })
    );
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
