/**
 * Tool wrapper utility for handling multi-instance Jira configuration
 * Eliminates duplication of instance resolution logic across all tools
 */
import { AxiosInstance } from "axios";
import { BaseArgs, JiraConfig, JiraInstanceConfig } from "../types.js";
import { getInstanceForProject } from "../config.js";
import { createJiraApiInstances } from "./jira-api.js";

export interface JiraContext {
  axiosInstance: AxiosInstance;
  agileAxiosInstance: AxiosInstance;
  instanceConfig: JiraInstanceConfig;
  projectConfig: JiraConfig;
  projectKey: string;
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
  handler: (toolArgs: Omit<TArgs, keyof BaseArgs>, context: JiraContext) => Promise<TResult>
): Promise<TResult> {
  const { working_dir, instance, ...toolArgs } = args;
  
  console.error(`[Tool Wrapper] Processing tool with working_dir: ${working_dir}, instance: ${instance || 'auto'}`);
  
  // Extract project key using smart resolution
  const projectKey = extractProjectKey(args, options);
  console.error(`[Tool Wrapper] Resolved project key: ${projectKey || 'none'}`);
  
  // Get the appropriate instance and project configuration
  const { instance: instanceConfig, projectConfig } = await getInstanceForProject(
    working_dir,
    projectKey,
    instance
  );
  
  console.error(`[Tool Wrapper] Using instance: ${instanceConfig.domain} for project: ${projectKey || 'global'}`);
  
  // Create API instances for this specific Jira instance
  const { axiosInstance, agileAxiosInstance } = createJiraApiInstances(instanceConfig);
  
  // Create context object with all necessary Jira resources
  const context: JiraContext = {
    axiosInstance,
    agileAxiosInstance,
    instanceConfig,
    projectConfig,
    projectKey: projectKey || ''
  };
  
  // Call the actual tool handler with clean context
  return handler(toolArgs as Omit<TArgs, keyof BaseArgs>, context);
}

/**
 * Helper function to get commonly used field lists based on project configuration
 */
export function getStandardFields(projectConfig: JiraConfig): string[] {
  const fields = [
    "summary",
    "description",
    "status",
    "issuetype",
    "created",
    "creator",
    "assignee",
    "priority",
    "labels",
    "parent",
    "comment"
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
  fields.push("customfield_10019"); // Rank field
  
  return fields;
}

/**
 * Helper function to format sprint information consistently
 */
export function formatSprintInfo(issue: any, projectConfig: JiraConfig): string {
  const sprintField = projectConfig.sprintField || 'customfield_10020';
  
  if (!issue.fields[sprintField] || 
      !Array.isArray(issue.fields[sprintField]) || 
      issue.fields[sprintField].length === 0) {
    return '';
  }
  
  const sprint = issue.fields[sprintField][0];
  
  if (!sprint || typeof sprint !== 'object') {
    return '';
  }
  
  const sprintName = sprint.name || 'Unknown';
  const sprintState = sprint.state || 'Unknown';
  const sprintId = sprint.id || 'Unknown';
  const startDate = sprint.startDate ? new Date(sprint.startDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) : 'Unknown';
  const endDate = sprint.endDate ? new Date(sprint.endDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) : 'Unknown';
  
  return `\n- Sprint: ${sprintName} (ID: ${sprintId}, State: ${sprintState})\n- Sprint Dates: ${startDate} to ${endDate}`;
}

/**
 * Helper function to format story points consistently
 */
export function formatStoryPoints(issue: any, projectConfig: JiraConfig): string {
  if (!projectConfig.storyPointsField || issue.fields[projectConfig.storyPointsField] === undefined) {
    return '';
  }
  
  return `\n- Story Points: ${issue.fields[projectConfig.storyPointsField] || "Not set"}`;
}