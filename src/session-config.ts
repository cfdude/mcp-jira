/**
 * Session-aware configuration loading for thread-safe operation
 */
import fs from 'fs';
import path from 'path';
import { JiraConfig, MultiInstanceJiraConfig, JiraInstanceConfig } from './types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { SessionState } from './session-manager.js';
import logger from './utils/logger.js';

// Legacy environment variables (for backward compatibility)
export const JIRA_EMAIL = process.env.JIRA_EMAIL as string;
export const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN as string;
export const JIRA_DOMAIN = process.env.JIRA_DOMAIN as string;

/**
 * Load multi-instance configuration with session-specific caching
 */
export async function loadMultiInstanceConfigForSession(
  workingDir: string,
  session: SessionState
): Promise<MultiInstanceJiraConfig> {
  const cacheKey = `config:${workingDir}`;

  // Check session cache first
  if (session.configCache.has(cacheKey)) {
    logger.debug('Using cached config for session', {
      sessionId: session.sessionId,
      workingDir,
    });
    return session.configCache.get(cacheKey) as MultiInstanceJiraConfig;
  }

  logger.debug('Loading new config for session', {
    sessionId: session.sessionId,
    workingDir,
  });

  // List of potential config locations
  const configLocations = [
    workingDir,
    process.cwd(),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'),
    path.join(process.cwd(), '..'),
  ];

  let lastError: Error | null = null;

  // Try each location
  for (const location of configLocations) {
    try {
      const configPath = path.join(location, '.jira-config.json');
      logger.debug('Trying config path', {
        sessionId: session.sessionId,
        configPath,
      });

      const configContent = await fs.promises.readFile(configPath, 'utf-8');
      const rawConfig = JSON.parse(configContent);

      let config: MultiInstanceJiraConfig;

      // Check if this is a legacy single-instance config or multi-instance config
      if (rawConfig.instances) {
        // Multi-instance configuration
        logger.debug('Detected multi-instance configuration', {
          sessionId: session.sessionId,
          instances: Object.keys(rawConfig.instances),
        });
        config = rawConfig as MultiInstanceJiraConfig;
      } else if (rawConfig.projectKey) {
        // Legacy single-instance configuration - convert to multi-instance format
        logger.debug('Converting legacy single-instance configuration', {
          sessionId: session.sessionId,
          projectKey: rawConfig.projectKey,
        });

        // Create default instance from environment variables or legacy config
        const instanceConfig: JiraInstanceConfig = {
          email: JIRA_EMAIL || '',
          apiToken: JIRA_API_TOKEN || '',
          domain: JIRA_DOMAIN || '',
        };

        // Validate that we have credentials
        if (!instanceConfig.email || !instanceConfig.apiToken || !instanceConfig.domain) {
          throw new Error(
            'Legacy config requires JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_DOMAIN environment variables'
          );
        }

        config = {
          instances: {
            default: instanceConfig,
          },
          projects: {
            [rawConfig.projectKey]: {
              instance: 'default',
              storyPointsField: rawConfig.storyPointsField,
              sprintField: rawConfig.sprintField,
              epicLinkField: rawConfig.epicLinkField,
            },
          },
          defaultInstance: 'default',
        };
      } else {
        throw new Error('Invalid configuration format - missing instances or projectKey');
      }

      // Cache the config for this session
      session.configCache.set(cacheKey, config);

      logger.info('Successfully loaded config for session', {
        sessionId: session.sessionId,
        configPath,
        instances: Object.keys(config.instances),
        projects: Object.keys(config.projects || {}),
      });

      return config;
    } catch (error) {
      lastError = error as Error;
      logger.debug('Config loading failed at location', {
        sessionId: session.sessionId,
        location,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
  }

  // If we get here, no config was found
  logger.error('No valid configuration found for session', {
    sessionId: session.sessionId,
    workingDir,
    attemptedLocations: configLocations,
    lastError: lastError?.message,
  });

  throw new McpError(
    ErrorCode.InvalidRequest,
    `No valid .jira-config.json found in any of the expected locations: ${configLocations.join(', ')}. Last error: ${lastError?.message}`
  );
}

/**
 * Get instance and project configuration for session (matching original getInstanceForProject signature)
 */
export async function getInstanceForProjectWithSession(
  workingDir: string,
  projectKey: string,
  session: SessionState,
  instanceOverride?: string
): Promise<{ instance: JiraInstanceConfig; projectConfig: JiraConfig }> {
  const config = await loadMultiInstanceConfigForSession(workingDir, session);

  // Determine which instance to use
  const resolvedInstance =
    instanceOverride ||
    (await getInstanceForProjectNameWithSession(workingDir, projectKey, session));

  const instanceConfig = config.instances[resolvedInstance];
  if (!instanceConfig) {
    throw new Error(`Instance '${resolvedInstance}' not found in configuration`);
  }

  // Get project-specific config if available
  const projectConfig = config.projects?.[projectKey];

  // Build project configuration - merge instance and project field defaults
  // Project defaults override instance defaults
  const fieldDefaults: Record<string, any> = {
    ...instanceConfig.fieldDefaults, // Start with instance defaults
    ...projectConfig?.fieldDefaults, // Override with project-specific defaults
  };

  const finalProjectConfig: JiraConfig = {
    projectKey,
    // Keep backwards compatibility for explicit field IDs
    storyPointsField: projectConfig?.storyPointsField,
    sprintField: projectConfig?.sprintField,
    epicLinkField: projectConfig?.epicLinkField,
    fieldDefaults,
  };

  logger.debug('Built project config for session', {
    sessionId: session.sessionId,
    projectKey,
    instance: resolvedInstance,
    hasStoryPointsField: !!finalProjectConfig.storyPointsField,
    hasSprintField: !!finalProjectConfig.sprintField,
    hasEpicLinkField: !!finalProjectConfig.epicLinkField,
  });

  return {
    instance: instanceConfig,
    projectConfig: finalProjectConfig,
  };
}

/**
 * Get instance name for a project with session-specific resolution (internal helper)
 */
async function getInstanceForProjectNameWithSession(
  workingDir: string,
  projectKey: string,
  session: SessionState,
  instanceOverride?: string
): Promise<string> {
  const config = await loadMultiInstanceConfigForSession(workingDir, session);

  // If explicit instance override is provided, validate and use it
  if (instanceOverride) {
    if (!config.instances[instanceOverride]) {
      throw new Error(`Instance '${instanceOverride}' not found in configuration`);
    }
    logger.debug('Using instance override', {
      sessionId: session.sessionId,
      projectKey,
      instance: instanceOverride,
    });
    return instanceOverride;
  }

  // Priority order for instance selection:
  // 1. Direct project mapping in projects section
  if (config.projects?.[projectKey]?.instance) {
    const instance = config.projects[projectKey].instance;
    logger.debug('Using project mapping for instance', {
      sessionId: session.sessionId,
      projectKey,
      instance,
    });
    return instance;
  }

  // 2. Check which instance has this project in its projects array
  for (const [instanceName, instanceConfig] of Object.entries(config.instances)) {
    if (instanceConfig.projects?.includes(projectKey)) {
      logger.debug('Found project in instance projects array', {
        sessionId: session.sessionId,
        projectKey,
        instance: instanceName,
      });
      return instanceName;
    }
  }

  // 3. Use default instance
  if (config.defaultInstance && config.instances[config.defaultInstance]) {
    logger.debug('Using default instance', {
      sessionId: session.sessionId,
      projectKey,
      instance: config.defaultInstance,
    });
    return config.defaultInstance;
  }

  // 4. Use the first available instance
  const firstInstance = Object.keys(config.instances)[0];
  if (firstInstance) {
    logger.debug('Using first available instance', {
      sessionId: session.sessionId,
      projectKey,
      instance: firstInstance,
    });
    return firstInstance;
  }

  throw new Error('No instances configured');
}
