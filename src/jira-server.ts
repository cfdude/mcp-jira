/**
 * Main JiraServer class
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { setupToolHandlers } from './tools/index.js';
import { sessionManager, SessionState } from './session-manager.js';
import { randomBytes } from 'crypto';
// import { randomUUID } from 'crypto';
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

    // Add after existing initialization code
    this.initializeCrossServerIntegration();

    logger.info('JiraServer initialization completed');
  }

  /**
   * Start the server with appropriate transport based on environment
   */
  async run() {
    // Determine if dual transport is needed based on cross-server integration
    let crossServerEnabled = false;
    try {
      // Load configuration to get cross-server settings
      const { loadMultiInstanceConfig } = await import('./config.js');
      const config = await loadMultiInstanceConfig('.');
      crossServerEnabled = config?.crossServerIntegration?.enabled || false;
    } catch (error) {
      logger.warn('Could not load cross-server configuration, using stdio-only mode', error);
    }

    if (crossServerEnabled) {
      // Dual transport: stdio for Claude Desktop/Code + HTTP for server-to-server
      await this.runDualTransport();
    } else {
      // Standard stdio transport only for Claude Desktop/Code
      await this.runStdioOnly();
    }
  }

  /**
   * Run stdio transport only (current behavior)
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

  /**
   * Run dual transport: stdio + HTTP for server-to-server communication
   */
  private async runDualTransport() {
    // Start stdio transport for Claude Desktop/Code
    const stdioTransport = new StdioServerTransport();

    // Start HTTP transport for server-to-server communication
    // Use port 3001 for Jira server (Confluence uses 3000)
    // TODO: Set up HTTP transport when implementing full HTTP server
    // const httpTransport = new StreamableHTTPServerTransport({
    //   sessionIdGenerator: () => randomUUID(),
    // });

    // Create session for stdio connection
    const randomSuffix = randomBytes(8).toString('hex');
    const sessionId = `stdio-${Date.now()}-${randomSuffix}`;
    this.currentSession = sessionManager.createSession(sessionId);

    logger.info('Created session for dual transport connection', {
      sessionId: this.currentSession.sessionId,
      totalSessions: sessionManager.getActiveSessionCount(),
    });

    // Add transport event logging
    stdioTransport.onclose = () => {
      logger.warn('MCP stdio transport closed', { sessionId: this.currentSession?.sessionId });
      if (this.currentSession) {
        sessionManager.removeSession(this.currentSession.sessionId);
        logger.info('Session cleaned up on transport close', {
          sessionId: this.currentSession.sessionId,
        });
      }
    };

    stdioTransport.onerror = error => {
      logger.error('MCP stdio transport error', {
        sessionId: this.currentSession?.sessionId,
        error: error.message,
        stack: error.stack,
      });
    };

    // Update tool handlers to use the current session
    setupToolHandlers(this.server, this.storyPointsFieldRef, this.currentSession);

    try {
      // Connect stdio transport first
      await this.server.connect(stdioTransport);

      // TODO: Set up HTTP server (Express/Node.js HTTP) to handle HTTP transport
      // This requires setting up routes to handle MCP requests over HTTP

      logger.info('Jira MCP server running on dual transport:', {
        sessionId: this.currentSession.sessionId,
        activeSessions: sessionManager.getActiveSessionCount(),
      });
      logger.info('  - stdio: for Claude Desktop/Code connection');
      logger.info(
        '  - HTTP: preparing for server-to-server communication (requires HTTP server setup)'
      );
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

  private async initializeCrossServerIntegration() {
    try {
      logger.info('Initializing cross-server integration...');

      // Load configuration to get cross-server settings
      const { loadMultiInstanceConfig } = await import('./config.js');
      const config = await loadMultiInstanceConfig('.');
      const crossServerConfig = config?.crossServerIntegration;

      if (!crossServerConfig?.enabled) {
        logger.info(
          'Cross-server integration disabled. Set crossServerIntegration.enabled=true in .jira-config.json to enable.'
        );
        return;
      }

      // Import and initialize health check manager with config
      const { jiraHealthCheckManager } = await import('./tools/jira-health-check.js');
      jiraHealthCheckManager.updateCrossServerConfig(crossServerConfig);
      jiraHealthCheckManager.setStatus('ready');

      logger.info('Cross-server integration initialized successfully', {
        confluencePath: crossServerConfig.confluenceMcpPath,
        allowedModes: crossServerConfig.allowedIncomingModes,
        excludedOps: crossServerConfig.excludedOperations,
      });
    } catch (error) {
      logger.error('Failed to initialize cross-server integration:', error);
      // Don't fail the entire server startup if cross-server integration fails
    }
  }
}
