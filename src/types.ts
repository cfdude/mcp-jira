/**
 * Type definitions for the Jira MCP server
 */

export interface JiraConfig {
  projectKey: string;
  storyPointsField?: string; // Custom field ID for story points (backwards compatibility)
  sprintField?: string; // Custom field ID for sprint (backwards compatibility)
  epicLinkField?: string; // Custom field ID for epic link (backwards compatibility)
  fieldDefaults?: Record<string, any>; // Default field values for this project
}

export interface JiraInstanceConfig {
  email: string;
  apiToken: string;
  domain: string;
  projects?: string[]; // Optional: list of project keys this instance supports
  fieldDefaults?: Record<string, any>; // Instance-level default field values
}

export interface CrossServerIntegrationConfig {
  enabled: boolean;
  confluenceMcpPath?: string;
  timeout?: number;
  maxRetries?: number;
  allowedIncomingModes?: string[];
  excludedOperations?: string[];
  role?: 'slave' | 'master';
  supportedConfluenceServers?: string[];
}

export interface MultiInstanceJiraConfig {
  instances: {
    [instanceName: string]: JiraInstanceConfig;
  };
  projects: {
    [projectKey: string]: {
      instance: string; // which instance to use for this project
      storyPointsField?: string; // Backwards compatibility
      sprintField?: string; // Backwards compatibility
      epicLinkField?: string; // Backwards compatibility
      fieldDefaults?: Record<string, any>; // Project-specific default field values
    };
  };
  defaultInstance?: string; // fallback instance if project not found
  crossServerIntegration?: CrossServerIntegrationConfig;
}

export interface JiraComment {
  id: string;
  body: string;
  created: string;
  author: {
    displayName: string;
  };
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string;
    status: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    created: string;
    creator: {
      displayName: string;
    };
    assignee?: {
      displayName: string;
      accountId: string;
    };
    priority?: {
      name: string;
      id?: string;
    };
    comment?: {
      comments: JiraComment[];
    };
    parent?: {
      key: string;
      fields: {
        summary: string;
      };
    };
    [key: string]: any; // Allow dynamic story points field
  };
}

// Tool argument types
export interface BaseArgs {
  working_dir: string;
  instance?: string; // Optional: specify which Jira instance to use
}

export interface CreateIssueArgs extends BaseArgs {
  summary: string;
  description: string;
  type: string;
  projectKey?: string;
  epic_link?: string;
  priority?: string;
  story_points?: number;
  labels?: string[];
  sprint?: string;
  custom_fields?: Record<string, any>; // Dynamic custom fields by name or ID
}

export interface ListIssuesArgs extends BaseArgs {
  projectKey?: string;
  status?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
  epic_key?: string;
}

export interface UpdateIssueArgs extends BaseArgs {
  issue_key: string;
  projectKey?: string;
  summary?: string;
  description?: string;
  status?: string;
  assignee?: string | null; // Display name, email, account ID, or null/"unassigned" to unassign
  epic_link?: string;
  priority?: string;
  story_points?: number | null;
  labels?: string[];
  sprint?: string;
  rank_before_issue?: string;
  rank_after_issue?: string;
  issuetype?: string; // Issue type name (e.g., "Story", "Task", "Epic")
  original_estimate?: string; // Time tracking: original estimate (e.g., "2d", "4h", "1w 2d")
  remaining_estimate?: string; // Time tracking: remaining estimate
  custom_fields?: Record<string, any>; // Dynamic custom fields by name or ID
}

export interface GetIssueArgs extends BaseArgs {
  issue_key: string;
}

export interface DeleteIssueArgs extends BaseArgs {
  issue_key: string;
}

export interface AddCommentArgs extends BaseArgs {
  issue_key: string;
  comment: string;
}

// Sprint Management Args
export interface CreateSprintArgs extends BaseArgs {
  projectKey?: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  boardId?: number;
}

export interface UpdateSprintArgs extends BaseArgs {
  sprintId: number;
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  state?: 'active' | 'closed' | 'future';
}

export interface GetSprintDetailsArgs extends BaseArgs {
  sprintId: number;
}

export interface MoveIssuesToSprintArgs extends BaseArgs {
  sprintId: number;
  issueKeys: string[];
}

export interface CompleteSprintArgs extends BaseArgs {
  sprintId: number;
}

// Board Management Args
export interface ListBoardsArgs extends BaseArgs {
  projectKey?: string;
  type?: 'scrum' | 'kanban' | 'simple';
  name?: string;
  startAt?: number;
  maxResults?: number;
}

export interface GetBoardConfigurationArgs extends BaseArgs {
  boardId: number;
}

export interface GetBoardReportsArgs extends BaseArgs {
  boardId: number;
}

export interface ManageBoardQuickfiltersArgs extends BaseArgs {
  boardId: number;
  action: 'list' | 'get';
  quickfilterId?: number;
}

// Epic Management Args
export interface CreateEpicArgs extends BaseArgs {
  projectKey?: string;
  name: string;
  summary: string;
  description?: string;
  priority?: string;
  labels?: string[];
}

export interface UpdateEpicDetailsArgs extends BaseArgs {
  epicKey: string;
  name?: string;
  summary?: string;
  done?: boolean;
  color?: string;
}

export interface RankEpicsArgs extends BaseArgs {
  epicToRank: string;
  rankBeforeEpic?: string;
  rankAfterEpic?: string;
  rankCustomFieldId?: number;
}

export interface ListEpicIssuesArgs extends BaseArgs {
  epicKey: string;
  startAt?: number;
  maxResults?: number;
}

export interface MoveIssuesToEpicArgs extends BaseArgs {
  epicKey: string;
  issueKeys: string[];
}

// Advanced Issue Operations Args
export interface BulkUpdateIssuesArgs extends BaseArgs {
  issueKeys: string[];
  updates: {
    status?: string;
    assignee?: string;
    priority?: string;
    labels?: string[];
    sprint?: string;
    storyPoints?: number;
  };
}

export interface RankIssuesArgs extends BaseArgs {
  issues: string[];
  rankBeforeIssue?: string;
  rankAfterIssue?: string;
  rankCustomFieldId?: number;
}

export interface EstimateIssueArgs extends BaseArgs {
  issueKey: string;
  value: string;
}

export interface CreateFilterArgs extends BaseArgs {
  name: string;
  description?: string;
  jql: string;
  favourite?: boolean;
  sharePermissions?: Array<{
    type: string;
    projectId?: string;
    groupname?: string;
    projectRoleId?: string;
  }>;
  editPermissions?: Array<{
    type: string;
    projectId?: string;
    groupname?: string;
    projectRoleId?: string;
  }>;
}

export interface CreateVersionArgs extends BaseArgs {
  name: string;
  description?: string;
  startDate?: string;
  releaseDate?: string;
  archived?: boolean;
  released?: boolean;
}

export interface ListVersionsArgs extends BaseArgs {
  projectKey?: string;
}

export interface SearchProjectsArgs extends BaseArgs {
  query?: string;
  typeKey?: string;
  categoryId?: string;
  action?: string;
  expand?: string;
  status?: string;
  properties?: string;
  propertyQuery?: string;
  startAt?: number;
  maxResults?: number;
}

// Reporting & Analytics Args
export interface GetSprintReportArgs extends BaseArgs {
  boardId: number;
  sprintId: number;
}

export interface GetVelocityChartDataArgs extends BaseArgs {
  boardId: number;
  numberOfSprints?: number;
}

export interface GetBurndownChartDataArgs extends BaseArgs {
  sprintId: number;
}

export interface GetBoardCumulativeFlowArgs extends BaseArgs {
  boardId: number;
}

export interface SearchIssuesJqlArgs extends BaseArgs {
  jql: string;
  startAt?: number;
  maxResults?: number;
  fields?: string;
  expand?: string;
  validateQuery?: boolean;
}

// Workflow Transition Args
export interface GetTransitionsArgs extends BaseArgs {
  issue_key: string;
}

export interface TransitionIssueArgs extends BaseArgs {
  issue_key: string;
  transition_id?: string;
  transition_name?: string;
  comment?: string;
  resolution?: string;
  fields?: { [key: string]: any };
}
