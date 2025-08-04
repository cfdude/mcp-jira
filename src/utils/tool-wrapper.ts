/**
 * Tool wrapper utility for handling multi-instance Jira configuration
 * Eliminates duplication of instance resolution logic across all tools
 */
import { AxiosInstance } from 'axios';
import { BaseArgs, JiraConfig, JiraInstanceConfig } from '../types.js';
import { getInstanceForProject } from '../config.js';
import {
  getInstanceForProjectWithSession,
  loadMultiInstanceConfigForSession,
} from '../session-config.js';
import { createJiraApiInstances } from './jira-api.js';
import logger from './logger.js';
import type { SessionState } from '../session-manager.js';
import { checkProjectConfigAndProvideGuidance } from './config-field-checker.js';

export interface JiraContext {
  axiosInstance: AxiosInstance;
  agileAxiosInstance: AxiosInstance;
  instanceConfig: JiraInstanceConfig;
  projectConfig: JiraConfig;
  projectKey: string;
  configGuidance?: string; // Optional guidance for missing field configurations
}

export interface ToolOptions {
  requiresProject?: boolean;
  extractProjectFromIssueKey?: boolean;
  defaultProjectKey?: string;
}

/**
 * Extract project key from various sources
 */
function extractProjectKey(args: any, options: ToolOptions): string | undefined {
  // 1. Use explicit projectKey if provided
  if (args.projectKey) {
    return args.projectKey;
  }

  // 2. Extract from issue key if enabled (e.g., "MIG-123" -> "MIG")
  if (options.extractProjectFromIssueKey && args.issue_key) {
    return args.issue_key.split('-')[0];
  }

  // 3. Extract from epic key if available (and if extractProjectFromIssueKey is enabled)
  if (options.extractProjectFromIssueKey && args.epicKey) {
    return args.epicKey.split('-')[0];
  }

  // 4. Use default if provided
  if (options.defaultProjectKey) {
    return options.defaultProjectKey;
  }

  // 5. Return undefined if no project key can be determined (for tools that don't require it)
  if (!options.requiresProject) {
    return undefined;
  }

  // 6. Require explicit project key
  throw new Error(
    "Project key is required. Either provide 'projectKey' parameter or use a tool that can extract it from issue keys."
  );
}

/**
 * Wrapper function that handles all Jira instance resolution and provides clean context to tools
 */
export async function withJiraContext<TArgs extends BaseArgs, TResult>(
  args: TArgs,
  options: ToolOptions,
  handler: (toolArgs: Omit<TArgs, keyof BaseArgs>, context: JiraContext) => Promise<TResult>,
  session?: SessionState
): Promise<TResult> {
  const { working_dir, instance, ...toolArgs } = args;

  // Request ID generation available for future logging enhancements
  // const requestId = Math.random().toString(36).substring(2, 15);

  const logContext = session ? { sessionId: session.sessionId } : {};

  logger.info('Tool request started', {
    ...logContext,
    args: { ...args },
    options,
  });

  try {
    // Extract project key using smart resolution
    const projectKey = extractProjectKey(args, options);
    logger.debug('Project key resolved', {
      ...logContext,
      projectKey,
      source: projectKey ? 'extracted' : 'none',
    });

    let instanceConfig: JiraInstanceConfig;
    let projectConfig: JiraConfig;

    if (session && projectKey) {
      // Use session-aware configuration loading
      const configResult = await getInstanceForProjectWithSession(
        working_dir,
        projectKey,
        session,
        instance
      );
      instanceConfig = configResult.instance;
      projectConfig = configResult.projectConfig;
    } else {
      // Fall back to legacy global configuration
      const configResult = await getInstanceForProject(working_dir, projectKey, instance);
      instanceConfig = configResult.instance;
      projectConfig = configResult.projectConfig;
    }

    logger.info('Instance configuration resolved', {
      ...logContext,
      instanceDomain: instanceConfig.domain,
      projectKey: projectKey || 'global',
      hasProjectConfig: !!projectConfig,
      sessionAware: !!session,
    });

    // Create API instances for this specific Jira instance
    const { axiosInstance, agileAxiosInstance } = createJiraApiInstances(instanceConfig);
    logger.debug('API instances created successfully', logContext);

    // Check for missing field configuration and provide guidance if needed
    let configGuidance: string | undefined;
    if (session && projectKey) {
      try {
        // Load the full multi-instance config to check field completeness
        const fullConfig = await loadMultiInstanceConfigForSession(working_dir, session);

        // Find which instance is being used for this project
        let resolvedInstanceName = instance;
        if (!resolvedInstanceName) {
          // Use the same logic as getInstanceForProjectWithSession
          if (fullConfig.projects?.[projectKey]?.instance) {
            resolvedInstanceName = fullConfig.projects[projectKey].instance;
          } else {
            // Check which instance has this project in its projects array
            for (const [instanceName, instanceConfig] of Object.entries(fullConfig.instances)) {
              if (instanceConfig.projects?.includes(projectKey)) {
                resolvedInstanceName = instanceName;
                break;
              }
            }
            // Fall back to default instance
            if (!resolvedInstanceName) {
              resolvedInstanceName =
                fullConfig.defaultInstance || Object.keys(fullConfig.instances)[0];
            }
          }
        }

        if (resolvedInstanceName) {
          configGuidance =
            checkProjectConfigAndProvideGuidance(
              session.sessionId,
              fullConfig,
              resolvedInstanceName,
              projectKey
            ) || undefined;
        }
      } catch (error) {
        // Don't fail the main operation if config guidance fails
        logger.debug('Config guidance check failed', {
          ...logContext,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Create context object with all necessary Jira resources
    const context: JiraContext = {
      axiosInstance,
      agileAxiosInstance,
      instanceConfig,
      projectConfig,
      projectKey: projectKey || '',
      configGuidance,
    };

    logger.debug('Calling tool handler', {
      ...logContext,
      toolArgs: Object.keys(toolArgs),
      contextReady: true,
    });

    // Call the actual tool handler with clean context
    const startTime = Date.now();
    const result = await handler(toolArgs as Omit<TArgs, keyof BaseArgs>, context);
    const duration = Date.now() - startTime;

    logger.info('Tool request completed successfully', {
      ...logContext,
      duration: `${duration}ms`,
      resultType: typeof result,
    });

    return result;
  } catch (error: any) {
    logger.error('Tool request failed', {
      ...logContext,
      error: error.message,
      stack: error.stack,
      axiosError: error.response
        ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
          }
        : undefined,
    });

    throw error;
  }
}

/**
 * Helper function to get commonly used field lists based on project configuration
 */
export function getStandardFields(projectConfig: JiraConfig): string[] {
  const fields = [
    'summary',
    'description',
    'environment',
    'status',
    'issuetype',
    'created',
    'creator',
    'assignee',
    'priority',
    'labels',
    'parent',
    'comment',
  ];

  // Add configured custom fields
  if (projectConfig.sprintField) {
    fields.push(projectConfig.sprintField);
  }
  if (projectConfig.storyPointsField) {
    fields.push(projectConfig.storyPointsField);
  }
  if (projectConfig.epicLinkField) {
    fields.push(projectConfig.epicLinkField);
  }

  // Add common fields
  fields.push('customfield_10019'); // Rank field

  return fields;
}

/**
 * Helper function to format sprint information consistently
 */
export function formatSprintInfo(issue: any, projectConfig: JiraConfig): string {
  const sprintField = projectConfig.sprintField || 'customfield_10020';

  if (
    !issue.fields[sprintField] ||
    !Array.isArray(issue.fields[sprintField]) ||
    issue.fields[sprintField].length === 0
  ) {
    return '';
  }

  const sprint = issue.fields[sprintField][0];

  if (!sprint || typeof sprint !== 'object') {
    return '';
  }

  const sprintName = sprint.name || 'Unknown';
  const sprintState = sprint.state || 'Unknown';
  const sprintId = sprint.id || 'Unknown';
  const startDate = sprint.startDate
    ? new Date(sprint.startDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Unknown';
  const endDate = sprint.endDate
    ? new Date(sprint.endDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Unknown';

  return `\n- Sprint: ${sprintName} (ID: ${sprintId}, State: ${sprintState})\n- Sprint Dates: ${startDate} to ${endDate}`;
}

/**
 * Helper function to format story points consistently
 */
export function formatStoryPoints(issue: any, projectConfig: JiraConfig): string {
  if (
    !projectConfig.storyPointsField ||
    issue.fields[projectConfig.storyPointsField] === undefined
  ) {
    return '';
  }

  return `\n- Story Points: ${issue.fields[projectConfig.storyPointsField] || 'Not set'}`;
}
