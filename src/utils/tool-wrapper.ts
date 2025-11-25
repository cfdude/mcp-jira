/**
 * Tool wrapper utility for handling multi-instance Jira configuration
 * Eliminates duplication of instance resolution logic across all tools
 */
import { AxiosInstance } from 'axios';
import { BaseArgs, JiraConfig, JiraInstanceConfig } from '../types.js';
import {
  getInstanceForProjectWithSession,
  loadMultiInstanceConfigForSession,
} from '../session-config.js';
import { createJiraApiInstances } from './jira-api.js';
import logger from './logger.js';
import { COMMON_STORY_POINT_FIELD_IDS } from './story-point-fields.js';
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

    // Always use session-aware configuration loading
    if (!session) {
      throw new Error('Session is required for configuration loading');
    }

    const configResult = await getInstanceForProjectWithSession(
      working_dir,
      projectKey || '',
      session,
      instance
    );
    instanceConfig = configResult.instance;
    projectConfig = configResult.projectConfig;

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
    if (projectKey) {
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

  // Add configured custom fields (backwards compatibility)
  const sprintFieldId = projectConfig.sprintField || projectConfig.defaultFields?.sprintField;
  if (sprintFieldId && !fields.includes(sprintFieldId)) {
    fields.push(sprintFieldId);
  }

  const storyPointsFieldId =
    projectConfig.storyPointsField || projectConfig.defaultFields?.storyPointsField;
  if (storyPointsFieldId && !fields.includes(storyPointsFieldId)) {
    fields.push(storyPointsFieldId);
  }

  const epicLinkFieldId = projectConfig.epicLinkField || projectConfig.defaultFields?.epicLinkField;
  if (epicLinkFieldId && !fields.includes(epicLinkFieldId)) {
    fields.push(epicLinkFieldId);
  }

  // Return the actual field names for the new /search/jql API
  // The new API requires specific field names, not '*all'
  return fields;
}

/**
 * Helper function to format sprint information consistently
 */
export function formatSprintInfo(issue: any, projectConfig: JiraConfig): string {
  // Try configured field first, then look for any field containing sprint data
  let sprintField = projectConfig.sprintField;

  if (!sprintField) {
    // Dynamically find Sprint field by looking for fields with array of sprint objects
    for (const [fieldId, fieldValue] of Object.entries(issue.fields)) {
      if (
        fieldId.startsWith('customfield_') &&
        Array.isArray(fieldValue) &&
        fieldValue.length > 0 &&
        fieldValue[0] &&
        typeof fieldValue[0] === 'object' &&
        'name' in fieldValue[0] &&
        'state' in fieldValue[0] &&
        'id' in fieldValue[0]
      ) {
        // This looks like a sprint field
        sprintField = fieldId;
        break;
      }
    }
  }

  if (
    !sprintField ||
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
  if (!issue?.fields) {
    return '';
  }

  const candidateFieldIds: string[] = [];

  const configuredField = projectConfig.storyPointsField;
  if (configuredField) candidateFieldIds.push(configuredField);

  const defaultField = projectConfig.defaultFields?.storyPointsField;
  if (defaultField && !candidateFieldIds.includes(defaultField)) {
    candidateFieldIds.push(defaultField);
  }

  // Common Jira story point custom field IDs for fallback coverage
  COMMON_STORY_POINT_FIELD_IDS.forEach(candidate => {
    if (candidate && !candidateFieldIds.includes(candidate)) {
      candidateFieldIds.push(candidate);
    }
  });

  for (const fieldId of candidateFieldIds) {
    if (fieldId && Object.prototype.hasOwnProperty.call(issue.fields, fieldId)) {
      const value = issue.fields[fieldId];
      const hasValue = value !== undefined && value !== null && value !== '';
      return `\n- Story Points: ${hasValue ? value : 'Not set'}`;
    }
  }

  // Story Points field not detected
  return '';
}

/**
 * Validate nextPageToken format and handle pagination errors
 */
export function validateNextPageToken(token?: string): void {
  if (!token) return;

  // Basic validation - tokens should be non-empty strings
  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('nextPageToken must be a non-empty string');
  }

  // Additional validation could be added here if token format is known
  // For now, we'll rely on the Jira API to validate the token
}

/**
 * Handle pagination errors and provide helpful error messages
 */
export function handlePaginationError(error: any): never {
  if (
    error.response?.status === 400 &&
    error.response?.data?.errorMessages?.some(
      (msg: string) =>
        msg.toLowerCase().includes('token') || msg.toLowerCase().includes('pagination')
    )
  ) {
    throw new Error(
      `Invalid pagination token. Please use a valid nextPageToken from a previous search response.`
    );
  }

  // Re-throw the original error if it's not pagination-related
  throw error;
}
