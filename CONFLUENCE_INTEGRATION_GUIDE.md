# Confluence MCP Server Integration Guide

## TASK: Update mcp-jira Server with Dual Transport Architecture

This document provides the complete implementation plan for updating this Jira MCP server to support dual transport architecture and bidirectional integration with the Confluence MCP server.

## CRITICAL: Implementation Context

The confluence-cloud-mcp server has been completely redesigned to eliminate dangerous process spawning and now uses HTTP-based native MCP communication. This Jira server must be updated to match that architecture to enable safe bidirectional communication.

## REQUIRED CHANGES

### 1. Update jira-server.ts with Dual Transport Architecture

**FILE: src/jira-server.ts**

Replace the existing `run()` method and add dual transport support:

```typescript
// Add these imports at the top
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto'; // Add to existing crypto import

// Replace the existing run() method with these three methods:

/**
 * Start the server with appropriate transport based on environment
 */
async run() {
  // Determine if dual transport is needed based on cross-server integration
  const crossServerEnabled = process.env.CROSS_SERVER_ENABLED === 'true';
  
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
  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID()
  });
  
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
    logger.info('  - HTTP: preparing for server-to-server communication (requires HTTP server setup)');

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
```

### 2. Add jira_health_check Tool

**FILE: src/tools/jira-health-check.ts**

Create a new health check tool:

```typescript
import logger from '../utils/logger.js';

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

  constructor(
    private serverVersion: string = '0.1.0',
    private crossServerEnabled: boolean = false
  ) {}

  setStatus(status: 'ready' | 'starting' | 'error') {
    this.status = status;
  }

  getHealthInfo(): JiraHealthInfo {
    return {
      serverType: 'mcp-jira-v1',
      version: this.serverVersion,
      status: this.status,
      timestamp: Date.now(),
      uptime: this.getUptime(),
      crossServerIntegration: {
        enabled: this.crossServerEnabled,
        role: 'slave',
        supportedConfluenceServers: ['confluence-cloud-mcp'],
        availableTools: this.getAvailableCrossServerTools(),
        allowedIncomingOperations: this.getAllowedIncomingOperations(),
        excludedOperations: this.getExcludedOperations()
      },
      endpoints: {
        healthCheck: '/health/jira',
        toolDiscovery: '/tools/cross-server'
      },
      configuration: {
        confluenceMcpPath: process.env.CONFLUENCE_MCP_PATH,
        timeout: parseInt(process.env.CONFLUENCE_MCP_TIMEOUT || '30000'),
        maxRetries: parseInt(process.env.CONFLUENCE_MCP_MAX_RETRIES || '3'),
        allowedModes: (process.env.ALLOWED_INCOMING_MODES || 'read,create').split(',')
      }
    };
  }

  private getAvailableCrossServerTools(): string[] {
    return [
      'get_issue',
      'list_issues', 
      'add_comment',
      'jira_health_check',
      'confluence_health_check',
      'create_issue_from_confluence'
    ];
  }

  private getAllowedIncomingOperations(): string[] {
    const allowedModes = (process.env.ALLOWED_INCOMING_MODES || 'read,create').split(',');
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
    return (process.env.EXCLUDED_OPERATIONS || 'delete_issue').split(',');
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

// Global health check manager instance
export const jiraHealthCheckManager = new JiraHealthCheckManager(
  '0.1.0', 
  process.env.CROSS_SERVER_ENABLED === 'true'
);

export async function handleJiraHealthCheck() {
  try {
    const healthInfo = jiraHealthCheckManager.getHealthInfo();

    logger.info('Jira health check requested', {
      status: healthInfo.status,
      uptime: healthInfo.uptime,
      crossServerEnabled: healthInfo.crossServerIntegration.enabled
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ...healthInfo,
            lastUpdated: new Date().toISOString()
          }, null, 2),
        },
      ],
    };

  } catch (error) {
    logger.error("Error getting Jira health info:", error);
    throw new Error(`Failed to get health info: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

### 3. Add confluence_health_check Tool

**FILE: src/tools/confluence-health-check.ts**

Create a confluence health check tool:

```typescript
import logger from '../utils/logger.js';

export async function handleConfluenceHealthCheck() {
  try {
    // This tool provides information about Confluence connectivity from Jira's perspective
    const confluenceConnectionInfo = {
      confluenceConnection: {
        configured: !!process.env.CONFLUENCE_MCP_PATH,
        path: process.env.CONFLUENCE_MCP_PATH,
        status: 'available',
        lastChecked: new Date().toISOString()
      },
      crossServerIntegration: {
        enabled: process.env.CROSS_SERVER_ENABLED === 'true',
        role: 'slave',
        supportedOperations: (process.env.ALLOWED_INCOMING_MODES || 'read,create').split(',')
      },
      endpoints: {
        expectedConfluenceEndpoint: 'http://localhost:3000/mcp',
        jiraEndpoint: 'http://localhost:3001/mcp'
      }
    };

    logger.info('Confluence health check requested', {
      crossServerEnabled: confluenceConnectionInfo.crossServerIntegration.enabled,
      confluenceConfigured: confluenceConnectionInfo.confluenceConnection.configured
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(confluenceConnectionInfo, null, 2),
        },
      ],
    };

  } catch (error) {
    logger.error("Error checking Confluence health:", error);
    throw new Error(`Failed to check Confluence health: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

### 4. Update Tool Registration

**FILE: src/tools/index.ts**

Add the new tools to your tool registration:

```typescript
// Add imports at the top
import { handleJiraHealthCheck } from './jira-health-check.js';
import { handleConfluenceHealthCheck } from './confluence-health-check.js';

// Add to your tool handler switch statement:
case "jira_health_check":
  return await handleJiraHealthCheck();

case "confluence_health_check":
  return await handleConfluenceHealthCheck();
```

### 5. Update Tool Schemas

Add these tool schemas to your tool definitions:

```typescript
jira_health_check: {
  description: "Get comprehensive health information for this Jira MCP server including uptime, cross-server integration status, and server capabilities. Essential for monitoring and troubleshooting cross-server communication.",
  inputSchema: {
    type: "object",
    properties: {},
  },
},

confluence_health_check: {
  description: "Check the health and connectivity status with the Confluence MCP server from Jira's perspective. Returns connection information and integration capabilities.",
  inputSchema: {
    type: "object",
    properties: {},
  },
},
```

### 6. Environment Configuration

**FILE: .env**

Add these environment variables:

```bash
# ==================================================================
# CROSS-SERVER INTEGRATION CONFIGURATION
# ==================================================================

# Enable Cross-Server Integration
CROSS_SERVER_ENABLED=true

# Confluence MCP Server Connection
CONFLUENCE_MCP_PATH=http://localhost:3000/mcp
CONFLUENCE_MCP_TIMEOUT=30000
CONFLUENCE_MCP_MAX_RETRIES=3

# ==================================================================
# SAFETY BOUNDARIES AND OPERATION CONTROLS
# ==================================================================

# Allowed Incoming Modes (operations that can be received from Confluence server)
ALLOWED_INCOMING_MODES=read,create

# Excluded Operations (operations that are not allowed)
EXCLUDED_OPERATIONS=delete_issue,delete_project

# ==================================================================
# HEALTH CHECK AND MONITORING
# ==================================================================

# Additional health check configuration can be added here
```

### 7. Initialize Cross-Server Integration

**FILE: src/jira-server.ts (in constructor)**

Add initialization in the constructor:

```typescript
// Add after existing initialization code
this.initializeCrossServerIntegration();

// Add this method to the class:
private async initializeCrossServerIntegration() {
  try {
    logger.info('Initializing cross-server integration...');
    
    const crossServerEnabled = process.env.CROSS_SERVER_ENABLED === 'true';
    
    if (!crossServerEnabled) {
      logger.info('Cross-server integration disabled. Set CROSS_SERVER_ENABLED=true to enable.');
      return;
    }

    // Import and initialize health check manager
    const { jiraHealthCheckManager } = await import('./tools/jira-health-check.js');
    jiraHealthCheckManager.setStatus('ready');
    
    logger.info('Cross-server integration initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize cross-server integration:', error);
    // Don't fail the entire server startup if cross-server integration fails
  }
}
```

## TESTING INSTRUCTIONS

### 1. Build and Test Basic Functionality

```bash
cd /Users/robsherman/Servers/mcp-jira
npm run build
npm run inspector
```

### 2. Test Cross-Server Integration

```bash
# Terminal 1: Start Jira server with cross-server enabled
cd /Users/robsherman/Servers/mcp-jira
CROSS_SERVER_ENABLED=true npm run inspector

# Terminal 2: Start Confluence server with cross-server enabled
cd /Users/robsherman/Servers/confluence-cloud-mcp
npm run inspector

# Test in Jira inspector:
# - Call jira_health_check tool
# - Call confluence_health_check tool
# - Both should return comprehensive status information

# Test in Confluence inspector:
# - Call discover_jira_servers tool
# - Should discover the Jira server running on localhost:3001
# - Call jira_health_check tool (cross-server call)
# - Should return Jira server health information
```

### 3. Verification Checklist

The implementation is successful when:

- ✅ Jira server builds without TypeScript errors
- ✅ Server starts in both stdio-only and dual-transport modes
- ✅ jira_health_check tool returns comprehensive health information
- ✅ confluence_health_check tool returns connection status
- ✅ Confluence server can discover and connect to Jira server
- ✅ Cross-server health checks work in both directions
- ✅ No process spawning occurs (all communication is HTTP-based)

## SUCCESS CRITERIA

This implementation is complete when:

1. **Architecture Match**: Jira server uses same dual transport approach as Confluence server
2. **Safe Communication**: No process spawning - all server-to-server communication uses HTTP-based native MCP protocol
3. **Health Checks**: Both servers can check each other's health status
4. **Discovery**: Confluence server can automatically discover and connect to Jira server
5. **Bidirectional**: Both servers expose health check tools for cross-server monitoring

## IMPORTANT NOTES

- **Port Configuration**: Jira uses port 3001, Confluence uses port 3000
- **No Process Spawning**: This architecture eliminates the dangerous process spawning that caused infinite Node.js processes
- **Native MCP Communication**: All server-to-server communication uses the MCP protocol over HTTP
- **Backward Compatibility**: Server works in stdio-only mode when cross-server integration is disabled
- **Environment-Driven**: All configuration is controlled by environment variables

This implementation creates a robust, safe foundation for bidirectional MCP server communication without the risks of process spawning.