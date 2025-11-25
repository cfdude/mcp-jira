/**
 * Session-aware configuration loading for thread-safe operation
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadOpenCodeEnvironment, normalizePotentialPath } from './utils/opencode-config.js';
import { getJiraApiToken, getJiraDomain, getJiraEmail } from './utils/env.js';
import {
  JiraConfig,
  MultiInstanceJiraConfig,
  JiraInstanceConfig,
  FieldIdDefaults,
} from './types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { SessionState } from './session-manager.js';
import logger from './utils/logger.js';

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

  const serverKey = process.env.JIRA_MCP_KEY || 'jira';
  let explicitConfigPath = process.env.JIRA_CONFIG_PATH;

  try {
    const openCodeEnv = await loadOpenCodeEnvironment(workingDir, serverKey);
    if (openCodeEnv) {
      logger.info('OpenCode MCP configuration detected for session', {
        sessionId: session.sessionId,
        serverKey: openCodeEnv.serverKey,
        configPath: openCodeEnv.configPath,
      });

      for (const [envKey, envValue] of Object.entries(openCodeEnv.environment)) {
        if (process.env[envKey] === undefined) {
          process.env[envKey] = envValue;
          logger.debug('Applied environment variable from OpenCode config', {
            sessionId: session.sessionId,
            envKey,
          });
        }
      }

      if (!explicitConfigPath && openCodeEnv.environment.JIRA_CONFIG_PATH) {
        explicitConfigPath = openCodeEnv.environment.JIRA_CONFIG_PATH;
      }
    }
  } catch (error) {
    logger.warn('Failed to resolve OpenCode configuration for session', {
      sessionId: session.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (explicitConfigPath) {
    explicitConfigPath = normalizePotentialPath(explicitConfigPath, workingDir || process.cwd());
    logger.debug('Explicit JIRA config path for session', {
      sessionId: session.sessionId,
      configPath: explicitConfigPath,
    });
  }

  // List of potential config locations (see CONFIG_SEARCH_PATHS.md for details)
  const configLocations = [
    workingDir, // Project-specific config
    path.join(os.homedir(), '.claude'), // Claude Code global config
    process.cwd(), // Current working directory (legacy)
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), // Server directory (legacy)
    path.join(process.cwd(), '..'), // Parent directory (legacy)
  ];

  const configCandidates: string[] = [];
  if (explicitConfigPath) {
    configCandidates.push(explicitConfigPath);
  }
  for (const location of configLocations) {
    configCandidates.push(path.join(location, '.jira-config.json'));
  }

  const attemptedPaths: string[] = [];
  const seen = new Set<string>();
  let lastError: Error | null = null;

  // Try each candidate path
  for (const candidatePath of configCandidates) {
    const normalized = path.resolve(candidatePath);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    attemptedPaths.push(candidatePath);

    try {
      logger.debug('Trying config path', {
        sessionId: session.sessionId,
        configPath: candidatePath,
      });

      const configContent = await fs.promises.readFile(candidatePath, 'utf-8');
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
          email: getJiraEmail() || '',
          apiToken: getJiraApiToken() || '',
          domain: getJiraDomain() || '',
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
        configPath: candidatePath,
        instances: Object.keys(config.instances),
        projects: Object.keys(config.projects || {}),
      });

      return config;
    } catch (error) {
      lastError = error as Error;
      logger.debug('Config loading failed at path', {
        sessionId: session.sessionId,
        configPath: candidatePath,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
  }

  // If we get here, no config was found
  logger.error('No valid configuration found for session', {
    sessionId: session.sessionId,
    workingDir,
    attemptedPaths,
    lastError: lastError?.message,
  });

  throw new McpError(
    ErrorCode.InvalidRequest,
    `No valid .jira-config.json found in any of the expected locations. Tried: ${attemptedPaths.join(', ')}. Last error: ${lastError?.message}`
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

  const instanceDefaultFields = instanceConfig.defaultFields || {};
  const projectDefaultFields = projectConfig?.defaultFields || {};

  const combinedFieldDefaults = Object.keys(fieldDefaults).length ? fieldDefaults : undefined;

  const combinedDefaultFields = Object.entries({
    ...instanceDefaultFields,
    ...projectDefaultFields,
  }).reduce<Partial<FieldIdDefaults>>((acc, [key, value]) => {
    if (value) {
      acc[key as keyof FieldIdDefaults] = value;
    }
    return acc;
  }, {});

  // Field precedence: explicit project config -> project defaultFields -> instance defaultFields
  const storyPointsField =
    projectConfig?.storyPointsField ||
    projectDefaultFields.storyPointsField ||
    instanceDefaultFields.storyPointsField;

  const sprintField =
    projectConfig?.sprintField ||
    projectDefaultFields.sprintField ||
    instanceDefaultFields.sprintField;

  const epicLinkField =
    projectConfig?.epicLinkField ||
    projectDefaultFields.epicLinkField ||
    instanceDefaultFields.epicLinkField;

  const rankField =
    projectConfig?.rankField || projectDefaultFields.rankField || instanceDefaultFields.rankField;

  const finalProjectConfig: JiraConfig = {
    projectKey,
    // Keep backwards compatibility for explicit field IDs
    storyPointsField,
    sprintField,
    epicLinkField,
    rankField,
    fieldDefaults: combinedFieldDefaults,
    defaultFields: Object.keys(combinedDefaultFields).length ? combinedDefaultFields : undefined,
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
