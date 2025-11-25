/**
 * Jira API interaction utilities with multi-instance support
 */
import axios, { AxiosInstance } from 'axios';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getJiraApiToken, getJiraDomain, getJiraEmail } from './env.js';
import { JiraInstanceConfig } from '../types.js';

/**
 * Create Axios instances for Jira API using specific instance configuration
 */
export function createJiraApiInstances(instanceConfig?: JiraInstanceConfig) {
  // Use instance config if provided, otherwise fall back to environment variables
  const domain = instanceConfig?.domain || getJiraDomain();
  const email = instanceConfig?.email || getJiraEmail();
  const apiToken = instanceConfig?.apiToken || getJiraApiToken();

  if (!domain || !email || !apiToken) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'Missing Jira configuration. Either provide instance config or set JIRA_DOMAIN, JIRA_EMAIL, and JIRA_API_TOKEN environment variables.'
    );
  }

  console.error(`Creating Jira API instances for domain: ${domain}, email: ${email}`);
  console.error(`BaseURL will be: https://${domain}.atlassian.net/rest/api/3`);

  // Create instance for REST API v3
  const axiosInstance = axios.create({
    baseURL: `https://${domain}.atlassian.net/rest/api/3`,
    auth: {
      username: email,
      password: apiToken,
    },
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  // Create instance for Agile API
  const agileAxiosInstance = axios.create({
    baseURL: `https://${domain}.atlassian.net/rest/agile/1.0`,
    auth: {
      username: email,
      password: apiToken,
    },
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  return { axiosInstance, agileAxiosInstance };
}

/**
 * Legacy function for backward compatibility
 */
export function createLegacyJiraApiInstances() {
  return createJiraApiInstances();
}

/**
 * Get the board ID for a project
 */
export async function getBoardId(
  agileAxiosInstance: AxiosInstance,
  projectKey: string
): Promise<number> {
  // Use Agile REST API to find the board for the project
  const boardsResponse = await agileAxiosInstance.get(`/board`, {
    params: {
      projectKeyOrId: projectKey,
    },
  });

  if (!boardsResponse.data.values.length) {
    throw new McpError(ErrorCode.InvalidRequest, 'No board found for project');
  }

  return boardsResponse.data.values[0].id;
}

/**
 * Get the active sprint for a board
 */
export async function getActiveSprint(
  agileAxiosInstance: AxiosInstance,
  boardId: number
): Promise<number | null> {
  const sprintsResponse = await agileAxiosInstance.get(`/board/${boardId}/sprint`, {
    params: {
      state: 'active',
    },
  });

  if (!sprintsResponse.data.values.length) {
    return null;
  }

  return sprintsResponse.data.values[0].id;
}

/**
 * Check for Story Points field configuration
 */
export async function checkStoryPointsField(
  axiosInstance: AxiosInstance,
  storyPointsField: string | null
): Promise<void> {
  const fieldConfigResponse = await axiosInstance.get('/field');
  const storyPointsFields = fieldConfigResponse.data.filter((field: any) => {
    // Look specifically for "Story Points" field
    return field.name === 'Story Points';
  });

  if (storyPointsFields.length === 0) {
    console.error(`Story Points field not found. Please ensure:
1. The "Story Points" field is configured in Jira
2. The field is added to the appropriate screens (create/edit) for your issue types
3. You have the necessary permissions to access and modify the field`);
  } else {
    const field = storyPointsFields[0];
    console.error(`Found Story Points field: ${field.name} (${field.id})`);
    if (!storyPointsField) {
      console.error(`To enable Story Points support, add this to .jira-config.json:
"storyPointsField": "${field.id}"`);
    }
  }
}

/**
 * Inspect available sprints for a board
 */
export async function inspectSprints(
  agileAxiosInstance: AxiosInstance,
  boardId: number
): Promise<void> {
  console.error('Found board ID:', boardId);

  const sprintsResponse = await agileAxiosInstance.get(`/board/${boardId}/sprint`, {
    params: {
      state: 'active,closed,future',
    },
  });

  console.error('Available sprints:', JSON.stringify(sprintsResponse.data, null, 2));
}

/**
 * Inspect issue fields to find Story Points field
 */
export async function inspectIssueFields(
  axiosInstance: AxiosInstance,
  issueKey: string,
  projectKey: string
): Promise<void> {
  // Get field configuration first
  const fieldConfigResponse = await axiosInstance.get('/field');
  const storyPointsFields = fieldConfigResponse.data.filter((field: any) => {
    // Look specifically for "Story Points" field
    return field.name === 'Story Points';
  });

  if (storyPointsFields.length === 0) {
    console.error(`Story Points field not found for issue ${issueKey} in project ${projectKey}.`);
    console.error('Available fields:', JSON.stringify(fieldConfigResponse.data, null, 2));
  } else {
    const field = storyPointsFields[0];
    console.error(`Found Story Points field: ${field.name} (${field.id})`);

    const issueResponse = await axiosInstance.get(`/issue/${issueKey}`, {
      params: {
        fields: field.id,
      },
    });

    console.error(
      `Story points value for ${issueKey}:`,
      issueResponse.data.fields[field.id] ?? 'Field not populated'
    );
  }
}
