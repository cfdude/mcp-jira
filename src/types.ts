/**
 * Type definitions for the Jira MCP server
 */

export interface JiraConfig {
  projectKey: string;
  storyPointsField?: string; // Custom field ID for story points (e.g., 'customfield_10016')
  sprintField?: string; // Custom field ID for sprint
  epicLinkField?: string; // Custom field ID for epic link
}

export interface JiraInstanceConfig {
  email: string;
  apiToken: string;
  domain: string;
  projects?: string[]; // Optional: list of project keys this instance supports
}

export interface MultiInstanceJiraConfig {
  instances: {
    [instanceName: string]: JiraInstanceConfig;
  };
  projects: {
    [projectKey: string]: {
      instance: string; // which instance to use for this project
      storyPointsField?: string;
      sprintField?: string;
      epicLinkField?: string;
    };
  };
  defaultInstance?: string; // fallback instance if project not found
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
