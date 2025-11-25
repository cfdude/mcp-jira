/**
 * Configuration for the Jira MCP server with multi-instance support
 */
import fs from 'fs';
import path from 'path';
import { loadOpenCodeEnvironment, normalizePotentialPath } from './utils/opencode-config.js';
import { getJiraApiToken, getJiraDomain, getJiraEmail } from './utils/env.js';
import {
  JiraConfig,
  MultiInstanceJiraConfig,
  JiraInstanceConfig,
  FieldIdDefaults,
} from './types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Global configuration cache
let globalConfig: MultiInstanceJiraConfig | null = null;
let configLoadPath: string | null = null;

/**
 * Load multi-instance configuration from .jira-config.json file
 */
export async function loadMultiInstanceConfig(
  workingDir: string
): Promise<MultiInstanceJiraConfig> {
  // Return cached config if available
  if (globalConfig) {
    console.error('Using cached global config from:', configLoadPath);
    return globalConfig;
  }

  console.error('Loading multi-instance config. Received working_dir parameter:', workingDir);

  const serverKey = process.env.JIRA_MCP_KEY || 'jira';
  let explicitConfigPath = process.env.JIRA_CONFIG_PATH;

  try {
    const openCodeEnv = await loadOpenCodeEnvironment(workingDir, serverKey);
    if (openCodeEnv) {
      console.error(
        `Found OpenCode MCP configuration for key '${openCodeEnv.serverKey}' at: ${openCodeEnv.configPath}`
      );

      for (const [envKey, envValue] of Object.entries(openCodeEnv.environment)) {
        if (process.env[envKey] === undefined) {
          process.env[envKey] = envValue;
          console.error(`Applied environment variable from OpenCode config: ${envKey}`);
        }
      }

      if (!explicitConfigPath && openCodeEnv.environment.JIRA_CONFIG_PATH) {
        explicitConfigPath = openCodeEnv.environment.JIRA_CONFIG_PATH;
      }
    }
  } catch (error) {
    console.error(
      'Failed to resolve OpenCode configuration:',
      error instanceof Error ? error.message : String(error)
    );
  }

  if (explicitConfigPath) {
    explicitConfigPath = normalizePotentialPath(explicitConfigPath, workingDir || process.cwd());
    console.error('Explicit JIRA config path detected:', explicitConfigPath);
  }

  // List of potential config locations
  const configSearchLocations = [
    workingDir,
    process.cwd(),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'),
    path.join(process.cwd(), '..'),
  ];

  console.error('Will try these config search locations:', configSearchLocations);

  const configCandidates: string[] = [];
  if (explicitConfigPath) {
    configCandidates.push(explicitConfigPath);
  }
  for (const location of configSearchLocations) {
    configCandidates.push(path.join(location, '.jira-config.json'));
  }

  console.error('Resolved config candidates (in priority order):', configCandidates);

  const attemptedPaths: string[] = [];
  const seen = new Set<string>();

  // Try each candidate path
  for (const candidatePath of configCandidates) {
    const normalized = path.resolve(candidatePath);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    attemptedPaths.push(candidatePath);

    try {
      console.error('\nTrying config path:', candidatePath);
      const configContent = await fs.promises.readFile(candidatePath, 'utf-8');
      console.error('Found config content (truncated):', configContent.substring(0, 200) + '...');

      const rawConfig = JSON.parse(configContent);

      // Check if this is a legacy single-instance config or multi-instance config
      if (rawConfig.instances) {
        // Multi-instance configuration
        console.error('Detected multi-instance configuration');
        globalConfig = rawConfig as MultiInstanceJiraConfig;
        configLoadPath = candidatePath;

        console.error('Successfully loaded multi-instance config from:', candidatePath);
        console.error('Available instances:', Object.keys(globalConfig.instances));
        console.error('Configured projects:', Object.keys(globalConfig.projects || {}));

        // Validate configuration
        const { validateMultiInstanceConfig, formatValidationResults } = await import(
          './utils/config-validator.js'
        );
        const validation = validateMultiInstanceConfig(globalConfig);

        if (!validation.isValid) {
          console.error('❌ Configuration validation failed:');
          console.error(formatValidationResults(validation, 'Jira Configuration'));
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid Jira configuration: ${validation.errors.join(', ')}`
          );
        }

        if (validation.warnings.length > 0) {
          console.error('⚠️ Configuration warnings:');
          validation.warnings.forEach(warning => console.error(`  - ${warning}`));
        }

        return globalConfig;
      } else if (rawConfig.projectKey) {
        // Legacy single-instance configuration - convert to multi-instance format
        console.error('Detected legacy single-instance configuration, converting...');

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

        globalConfig = {
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

        configLoadPath = candidatePath;
        console.error(
          'Converted legacy config. Default instance created for project:',
          rawConfig.projectKey
        );
        return globalConfig;
      }
    } catch (error) {
      console.error('Error trying config path', candidatePath, ':', error);
      // Continue to next candidate path
    }
  }

  // If no config file found, try environment variables as fallback
  const legacyEmail = getJiraEmail();
  const legacyToken = getJiraApiToken();
  const legacyDomain = getJiraDomain();

  if (legacyEmail && legacyToken && legacyDomain) {
    console.error('No config file found, using environment variables as fallback');
    globalConfig = {
      instances: {
        default: {
          email: legacyEmail,
          apiToken: legacyToken,
          domain: legacyDomain,
        },
      },
      projects: {},
      defaultInstance: 'default',
    };
    configLoadPath = 'environment variables';
    return globalConfig;
  }

  // If we get here, no config was found
  console.error('Failed to load config from any location');
  throw new McpError(
    ErrorCode.InvalidRequest,
    `Failed to load Jira configuration. Tried config paths: ${attemptedPaths.join(', ')}. ` +
      `Either provide a .jira-config.json file or set JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_DOMAIN environment variables.`
  );
}

function buildProjectConfig(
  projectKey: string,
  instanceConfig: JiraInstanceConfig,
  projectEntry?: {
    storyPointsField?: string;
    sprintField?: string;
    epicLinkField?: string;
    rankField?: string;
    fieldDefaults?: Record<string, any>;
    defaultFields?: FieldIdDefaults;
  }
): JiraConfig {
  const instanceDefaultFields = instanceConfig.defaultFields || {};
  const projectDefaultFields = projectEntry?.defaultFields || {};

  const mergedFieldDefaults = {
    ...(instanceConfig.fieldDefaults || {}),
    ...(projectEntry?.fieldDefaults || {}),
  };

  const fieldDefaults = Object.keys(mergedFieldDefaults).length ? mergedFieldDefaults : undefined;

  const combinedDefaultFields = Object.entries({
    ...instanceDefaultFields,
    ...projectDefaultFields,
  }).reduce<Partial<FieldIdDefaults>>((acc, [key, value]) => {
    if (value) {
      acc[key as keyof FieldIdDefaults] = value;
    }
    return acc;
  }, {});

  const defaultFields = Object.keys(combinedDefaultFields).length
    ? combinedDefaultFields
    : undefined;

  return {
    projectKey,
    // Field precedence: explicit project config -> project defaultFields -> instance defaultFields
    storyPointsField:
      projectEntry?.storyPointsField ||
      projectDefaultFields.storyPointsField ||
      instanceDefaultFields.storyPointsField,
    sprintField:
      projectEntry?.sprintField ||
      projectDefaultFields.sprintField ||
      instanceDefaultFields.sprintField,
    epicLinkField:
      projectEntry?.epicLinkField ||
      projectDefaultFields.epicLinkField ||
      instanceDefaultFields.epicLinkField,
    rankField:
      projectEntry?.rankField || projectDefaultFields.rankField || instanceDefaultFields.rankField,
    fieldDefaults,
    defaultFields,
  };
}

/**
 * Get instance configuration for a specific project
 */
export async function getInstanceForProject(
  workingDir: string,
  projectKey?: string,
  instanceOverride?: string
): Promise<{ instance: JiraInstanceConfig; projectConfig: JiraConfig }> {
  const multiConfig = await loadMultiInstanceConfig(workingDir);

  // If instance is explicitly specified, use that
  if (instanceOverride) {
    console.error(
      `Using explicitly specified instance: ${instanceOverride} for project: ${projectKey}`
    );
    const instance = multiConfig.instances[instanceOverride];
    if (!instance) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Instance '${instanceOverride}' not found. Available instances: ${Object.keys(multiConfig.instances).join(', ')}`
      );
    }

    // Get project config or create default
    const projectConfigEntry = projectKey ? multiConfig.projects[projectKey] : undefined;
    return {
      instance,
      projectConfig: buildProjectConfig(projectKey || '', instance, projectConfigEntry),
    };
  }

  // Check if project is explicitly configured
  if (projectKey) {
    const projectConfigEntry = multiConfig.projects[projectKey];
    if (projectConfigEntry) {
      console.error(
        `Found configured project ${projectKey} using instance: ${projectConfigEntry.instance}`
      );
      const instance = multiConfig.instances[projectConfigEntry.instance];
      if (!instance) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Instance '${projectConfigEntry.instance}' configured for project '${projectKey}' not found`
        );
      }

      return {
        instance,
        projectConfig: buildProjectConfig(projectKey, instance, projectConfigEntry),
      };
    }

    // Try to auto-discover project in instances
    console.error(`Project ${projectKey} not explicitly configured. Attempting auto-discovery...`);

    for (const [instanceName, instanceConfig] of Object.entries(multiConfig.instances)) {
      if (instanceConfig.projects && instanceConfig.projects.includes(projectKey)) {
        console.error(`Auto-discovered project ${projectKey} in instance: ${instanceName}`);
        return {
          instance: instanceConfig,
          projectConfig: buildProjectConfig(projectKey, instanceConfig),
        };
      }
    }
  }

  // Use default instance if available
  if (multiConfig.defaultInstance) {
    console.error(
      `Using default instance ${multiConfig.defaultInstance} for project: ${projectKey}`
    );
    const instance = multiConfig.instances[multiConfig.defaultInstance];
    return {
      instance,
      projectConfig: buildProjectConfig(projectKey || '', instance),
    };
  }

  // If only one instance available, use it
  const instanceNames = Object.keys(multiConfig.instances);
  if (instanceNames.length === 1) {
    const instanceName = instanceNames[0];
    console.error(`Only one instance available. Using ${instanceName} for project: ${projectKey}`);
    return {
      instance: multiConfig.instances[instanceName],
      projectConfig: buildProjectConfig(projectKey || '', multiConfig.instances[instanceName]),
    };
  }

  // Unable to determine instance
  throw new McpError(
    ErrorCode.InvalidRequest,
    `Unable to determine Jira instance for project '${projectKey}'. ` +
      `Available instances: ${instanceNames.join(', ')}. ` +
      `Please configure the project in .jira-config.json or specify an instance parameter.`
  );
}

/**
 * List available instances and their configured projects
 */
export async function listAvailableInstances(workingDir: string): Promise<{
  instances: Array<{
    name: string;
    domain: string;
    email: string;
    configuredProjects: string[];
  }>;
  projects: Array<{
    projectKey: string;
    instance: string;
  }>;
}> {
  const multiConfig = await loadMultiInstanceConfig(workingDir);

  const instances = Object.entries(multiConfig.instances).map(([name, config]) => ({
    name,
    domain: config.domain,
    email: config.email,
    configuredProjects: config.projects || [],
  }));

  const projects = Object.entries(multiConfig.projects).map(([projectKey, config]) => ({
    projectKey,
    instance: config.instance,
  }));

  return { instances, projects };
}

/**
 * Legacy function for backward compatibility
 */
export async function loadProjectConfig(workingDir: string): Promise<JiraConfig> {
  console.error('Warning: loadProjectConfig is deprecated. Use getInstanceForProject instead.');

  // Try to load multi-instance config and return the first project found
  try {
    const multiConfig = await loadMultiInstanceConfig(workingDir);
    const projectKeys = Object.keys(multiConfig.projects);

    if (projectKeys.length > 0) {
      const firstProject = projectKeys[0];
      const { projectConfig } = await getInstanceForProject(workingDir, firstProject);
      return projectConfig;
    }

    // No projects configured, return a default
    return {
      projectKey: 'UNKNOWN',
      storyPointsField: undefined,
      sprintField: undefined,
      epicLinkField: undefined,
    };
  } catch (error) {
    console.error('Error in legacy loadProjectConfig:', error);
    throw error;
  }
}
