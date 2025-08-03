import logger from '../utils/logger.js';
import { CrossServerIntegrationConfig } from '../types.js';

export interface JiraHealthInfo {
  serverType: string;
  version: string;
  status: 'ready' | 'starting' | 'error';
  timestamp: number;
  uptime: number;
  crossServerIntegration: {
    enabled: boolean;
    role: 'slave';
    supportedConfluenceServers: string[];
    availableTools: string[];
    allowedIncomingOperations: string[];
    excludedOperations: string[];
  };
  endpoints: {
    healthCheck: string;
    toolDiscovery: string;
  };
  configuration: {
    confluenceMcpPath?: string;
    timeout: number;
    maxRetries: number;
    allowedModes: string[];
  };
}

class JiraHealthCheckManager {
  private status: 'ready' | 'starting' | 'error' = 'starting';
  private startTime = Date.now();
  private crossServerConfig: CrossServerIntegrationConfig | null = null;

  constructor(
    private serverVersion: string = '0.1.0',
    crossServerConfig?: CrossServerIntegrationConfig
  ) {
    this.crossServerConfig = crossServerConfig || null;
  }

  updateCrossServerConfig(config: CrossServerIntegrationConfig) {
    this.crossServerConfig = config;
  }

  setStatus(status: 'ready' | 'starting' | 'error') {
    this.status = status;
  }

  getHealthInfo(): JiraHealthInfo {
    const config = this.crossServerConfig;
    return {
      serverType: 'mcp-jira-v1',
      version: this.serverVersion,
      status: this.status,
      timestamp: Date.now(),
      uptime: this.getUptime(),
      crossServerIntegration: {
        enabled: config?.enabled || false,
        role: 'slave',
        supportedConfluenceServers: config?.supportedConfluenceServers || ['confluence-cloud-mcp'],
        availableTools: this.getAvailableCrossServerTools(),
        allowedIncomingOperations: this.getAllowedIncomingOperations(),
        excludedOperations: this.getExcludedOperations(),
      },
      endpoints: {
        healthCheck: '/health/jira',
        toolDiscovery: '/tools/cross-server',
      },
      configuration: {
        confluenceMcpPath: config?.confluenceMcpPath,
        timeout: config?.timeout || 30000,
        maxRetries: config?.maxRetries || 3,
        allowedModes: config?.allowedIncomingModes || ['read', 'create'],
      },
    };
  }

  private getAvailableCrossServerTools(): string[] {
    return [
      'get_issue',
      'list_issues',
      'add_comment',
      'jira_health_check',
      'confluence_health_check',
      'create_issue_from_confluence',
    ];
  }

  private getAllowedIncomingOperations(): string[] {
    const config = this.crossServerConfig;
    const allowedModes = config?.allowedIncomingModes || ['read', 'create'];
    const operations: string[] = [];

    if (allowedModes.includes('read')) {
      operations.push('get_issue', 'list_issues', 'search_issues_jql');
    }
    if (allowedModes.includes('create')) {
      operations.push('create_issue', 'add_comment');
    }
    if (allowedModes.includes('update')) {
      operations.push('update_issue');
    }

    return operations;
  }

  private getExcludedOperations(): string[] {
    const config = this.crossServerConfig;
    return config?.excludedOperations || ['delete_issue'];
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

// Global health check manager instance
export const jiraHealthCheckManager = new JiraHealthCheckManager('0.1.0');

export async function handleJiraHealthCheck() {
  try {
    const healthInfo = jiraHealthCheckManager.getHealthInfo();

    logger.info('Jira health check requested', {
      status: healthInfo.status,
      uptime: healthInfo.uptime,
      crossServerEnabled: healthInfo.crossServerIntegration.enabled,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              ...healthInfo,
              lastUpdated: new Date().toISOString(),
            },
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
