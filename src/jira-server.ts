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

    this.server = new Server(
      {
        name: 'jira-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    logger.debug('Setting up tool handlers');
    // Setup tool handlers with session support
    setupToolHandlers(this.server, this.storyPointsFieldRef, undefined);
    logger.debug('Tool handlers setup completed');

    // Setup resources handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [], // Return empty resources list
    }));

    // Setup prompts handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [], // Return empty prompts list
    }));

    // Setup error handling
    this.server.onerror = error => {
      logger.error('MCP Server Error', { error: error.message, stack: error.stack });
    };

    // Note: Removed global process error handlers to avoid interfering with Claude's process management
    // Error handling is now done at the server level through this.server.onerror

    // Note: Signal handlers removed to avoid conflicts with Claude's process management
    // Server cleanup is handled by transport close events

    logger.info('JiraServer initialization completed');
  }

  /**
   * Start the server
   */
  async run() {
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

      // Log server connection status
      logger.info('Server connection established', {
        sessionId: this.currentSession.sessionId,
        serverName: 'jira-server',
        serverVersion: '0.1.0',
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
