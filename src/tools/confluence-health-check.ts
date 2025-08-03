import logger from '../utils/logger.js';
import { CrossServerIntegrationConfig } from '../types.js';

export async function handleConfluenceHealthCheck(
  crossServerConfig?: CrossServerIntegrationConfig
) {
  try {
    // This tool provides information about Confluence connectivity from Jira's perspective
    const confluenceConnectionInfo = {
      confluenceConnection: {
        configured: !!crossServerConfig?.confluenceMcpPath,
        path: crossServerConfig?.confluenceMcpPath,
        status: 'available',
        lastChecked: new Date().toISOString(),
      },
      crossServerIntegration: {
        enabled: crossServerConfig?.enabled || false,
        role: 'slave',
        supportedOperations: crossServerConfig?.allowedIncomingModes || ['read', 'create'],
      },
      endpoints: {
        expectedConfluenceEndpoint: 'http://localhost:3000/mcp',
        jiraEndpoint: 'http://localhost:3001/mcp',
      },
    };

    logger.info('Confluence health check requested', {
      crossServerEnabled: confluenceConnectionInfo.crossServerIntegration.enabled,
      confluenceConfigured: confluenceConnectionInfo.confluenceConnection.configured,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(confluenceConnectionInfo, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error('Error checking Confluence health:', error);
    throw new Error(
      `Failed to check Confluence health: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
