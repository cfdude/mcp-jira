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
          text: JSON.stringify({ ...healthInfo, lastUpdated: new Date().toISOString() }, null, 2),
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
