/**
 * Type definitions for the Jira MCP server
 */

export interface JiraConfig {
  projectKey: string;
  storyPointsField?: string; // Custom field ID for story points (e.g., 'customfield_10016')
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
}

export interface UpdateIssueArgs extends BaseArgs {
  issue_key: string;
  summary?: string;
  description?: string;
  status?: string;
  epic_link?: string;
  priority?: string;
  story_points?: number | null;
  labels?: string[];
  sprint?: string;
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
