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
import logger from './utils/logger.js';
import 'dotenv/config';

export class JiraServer {
  private server: Server;
  private storyPointsFieldRef: { current: string | null } = { current: null };

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
    // Setup tool handlers (API instances created per-request now)
    setupToolHandlers(this.server, this.storyPointsFieldRef);
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

    // Add process-level error handlers to prevent unexpected shutdowns
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: String(promise),
      });
      // Don't exit on unhandled rejections - log and continue
    });

    process.on('uncaughtException', error => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      // For uncaught exceptions, we should exit after logging
      process.exit(1);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      await this.server.close();
      process.exit(0);
    });

    logger.info('JiraServer initialization completed');
  }

  /**
   * Start the server
   */
  async run() {
    logger.info('Starting MCP Jira server transport');
    const transport = new StdioServerTransport();

    // Add transport event logging
    transport.onclose = () => {
      logger.warn('MCP transport closed');
    };

    transport.onerror = error => {
      logger.error('MCP transport error', {
        error: error.message,
        stack: error.stack,
      });
    };

    try {
      await this.server.connect(transport);
      logger.info('Jira MCP server running on stdio transport');

      // Log server connection status
      logger.info('Server connection established', {
        serverName: 'jira-server',
        serverVersion: '0.1.0',
      });
    } catch (error: any) {
      logger.error('Failed to connect MCP server transport', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
