/**
 * Main JiraServer class
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { setupToolHandlers } from './tools/index.js';
import { sessionManager, SessionState } from './session-manager.js';
import { randomBytes } from 'crypto';
import logger from './utils/logger.js';
import 'dotenv/config';

export class JiraServer {
  private server: Server;
  private storyPointsFieldRef: { current: string | null } = { current: null };
  private currentSession: SessionState | null = null;

  constructor() {
    logger.info('Initializing MCP Jira Server');
    this.server = JiraServer.createMcpServer();
    logger.info('JiraServer initialization completed');
  }

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

  /**
   * Start the server with STDIO transport (for Claude Desktop / direct invocation)
   */
  async run() {
    await this.runStdioOnly();
  }

  /**
   * Run stdio transport only
   */
  private async runStdioOnly() {
    logger.info('Starting MCP Jira server transport');
    const transport = new StdioServerTransport();

    // Create a session for this STDIO connection with cryptographically secure random ID
    const randomSuffix = randomBytes(8).toString('hex');
    const sessionId = `stdio-${Date.now()}-${randomSuffix}`;
    this.currentSession = sessionManager.createSession(sessionId);

    logger.info('Created session for STDIO connection', {
      sessionId: this.currentSession.sessionId,
      totalSessions: sessionManager.getActiveSessionCount(),
    });

    // Add transport event logging with session context
    // Note: Signal handlers not installed — Claude manages STDIO process lifecycle
    transport.onclose = () => {
      logger.warn('MCP transport closed', { sessionId: this.currentSession?.sessionId });
      if (this.currentSession) {
        sessionManager.removeSession(this.currentSession.sessionId);
        logger.info('Session cleaned up on transport close', {
          sessionId: this.currentSession.sessionId,
        });
      }
    };

    transport.onerror = error => {
      logger.error('MCP transport error', {
        sessionId: this.currentSession?.sessionId,
        error: error.message,
        stack: error.stack,
      });
    };

    // Update tool handlers to use the current session
    setupToolHandlers(this.server, this.storyPointsFieldRef, this.currentSession);

    try {
      await this.server.connect(transport);
      logger.info('Jira MCP server running on stdio transport', {
        sessionId: this.currentSession.sessionId,
        activeSessions: sessionManager.getActiveSessionCount(),
      });
    } catch (error: any) {
      logger.error('Failed to connect MCP server transport', {
        sessionId: this.currentSession?.sessionId,
        error: error.message,
        stack: error.stack,
      });

      // Clean up session on connection failure
      if (this.currentSession) {
        sessionManager.removeSession(this.currentSession.sessionId);
      }

      throw error;
    }
  }
}
