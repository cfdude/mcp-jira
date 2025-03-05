/**
 * Jira API interaction utilities
 */
import axios, { AxiosInstance } from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN } from "../config.js";

/**
 * Create Axios instances for Jira API
 */
export function createJiraApiInstances() {
  // Create instance for REST API v2
  const axiosInstance = axios.create({
    baseURL: `https://${JIRA_DOMAIN}.atlassian.net/rest/api/2`,
    auth: {
      username: JIRA_EMAIL,
      password: JIRA_API_TOKEN,
    },
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
  });

  // Create instance for Agile API
  const agileAxiosInstance = axios.create({
    baseURL: `https://${JIRA_DOMAIN}.atlassian.net/rest/agile/1.0`,
    auth: {
      username: JIRA_EMAIL,
      password: JIRA_API_TOKEN,
    },
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
  });

  return { axiosInstance, agileAxiosInstance };
}

/**
 * Get the board ID for a project
 */
export async function getBoardId(
  agileAxiosInstance: AxiosInstance,
  projectKey: string
): Promise<number> {
  // Use Agile REST API to find the board for the project
  const boardsResponse = await agileAxiosInstance.get(
    `/board`,
    {
      params: {
        projectKeyOrId: projectKey
      }
    }
  );
  
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
  const sprintsResponse = await agileAxiosInstance.get(
    `/board/${boardId}/sprint`,
    {
      params: {
        state: 'active'
      }
    }
  );
  
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
  const storyPointsFields = fieldConfigResponse.data
    .filter((field: any) => {
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
  console.error("Found board ID:", boardId);

  const sprintsResponse = await agileAxiosInstance.get(
    `/board/${boardId}/sprint`,
    {
      params: {
        state: 'active,closed,future'
      }
    }
  );
  
  console.error("Available sprints:", JSON.stringify(sprintsResponse.data, null, 2));
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
  
  // Look specifically for Story Points field
  const storyPointsFields = fieldConfigResponse.data
    .filter((field: any) => {
      const nameMatch = field.name?.toLowerCase().includes('story point');
      const descMatch = field.description?.toLowerCase().includes('story point');
      return nameMatch || descMatch;
    });
  
  console.error("Story Points Fields:", JSON.stringify(storyPointsFields, null, 2));

  // Get available field metadata for the project
  const metadataResponse = await axiosInstance.get('/issue/createmeta', {
    params: {
      projectKeys: projectKey,
      expand: 'projects.issuetypes.fields'
    }
  });

  // Look for Story Points in available fields
  const availableFields = metadataResponse.data.projects[0].issuetypes[0].fields;
  const storyPointsInMeta = Object.entries(availableFields)
    .filter(([_, value]: [string, any]) =>
      value.name?.toLowerCase().includes('story point') ||
      value.description?.toLowerCase().includes('story point')
    );
  
  console.error("Story Points in Metadata:", JSON.stringify(storyPointsInMeta, null, 2));

  // Get current field values
  const response = await axiosInstance.get(`/issue/${issueKey}`, {
    params: {
      expand: "renderedFields,names,schema,editmeta",
      fields: "*all"
    }
  });
  
  // Look for potential Story Points values in custom fields
  const customFields = Object.entries(response.data.fields)
    .filter(([key, value]) =>
      key.startsWith('customfield_') &&
      (typeof value === 'number' || value === null)
    )
    .reduce((acc: any, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  
  console.error("Potential Story Points Fields:", JSON.stringify(customFields, null, 2));
}