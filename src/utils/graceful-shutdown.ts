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
