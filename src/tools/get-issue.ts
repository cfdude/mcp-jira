/**
 * Handler for the get_issue tool
 */
import { AxiosInstance } from "axios";
import { GetIssueArgs } from "../types.js";
import { checkStoryPointsField, getBoardId } from "../utils/jira-api.js";
import { formatIssue } from "../utils/formatting.js";

export async function handleGetIssue(
  axiosInstance: AxiosInstance,
  agileAxiosInstance: AxiosInstance,
  projectKey: string,
  storyPointsField: string | null,
  args: GetIssueArgs
) {
  const { issue_key } = args;
  
  // Check Story Points field configuration
  await checkStoryPointsField(axiosInstance, storyPointsField);
  
  // Get all available data
  const boardId = await getBoardId(agileAxiosInstance, projectKey);
  console.error("Found board ID:", boardId);

  const sprintsResponse = await agileAxiosInstance.get(
    `/board/${boardId}/sprint`,
    {
      params: {
        state: 'active,closed,future'
      }
    }
  );

  const issueResponse = await axiosInstance.get(`/issue/${issue_key}`, {
    params: {
      expand: "renderedFields,names,schema,editmeta",
      fields: "*all"
    }
  });

  // Extract sprint information for cleaner display
  let sprintInfo = "No sprints available";
  if (sprintsResponse.data.values && sprintsResponse.data.values.length > 0) {
    sprintInfo = sprintsResponse.data.values.map((sprint: any) =>
      `- ${sprint.name} (ID: ${sprint.id}, State: ${sprint.state}, Dates: ${sprint.startDate?.substring(0, 10) || 'N/A'} to ${sprint.endDate?.substring(0, 10) || 'N/A'})`
    ).join('\n');
  }

  // Create a custom formatted issue output with sprint information
  let standardIssueInfo = `${issueResponse.data.key}: ${issueResponse.data.fields.summary}
- Type: ${issueResponse.data.fields.issuetype.name}
- Status: ${issueResponse.data.fields.status.name}
- Priority: ${issueResponse.data.fields.priority?.name || "Not set"}`;

  // Add Story Points if configured
  if (storyPointsField && issueResponse.data.fields[storyPointsField] !== undefined) {
    standardIssueInfo += `\n- Story Points: ${issueResponse.data.fields[storyPointsField] || "Not set"}`;
  }

  // Add Sprint information if available
  if (issueResponse.data.fields.customfield_10020 &&
      Array.isArray(issueResponse.data.fields.customfield_10020) &&
      issueResponse.data.fields.customfield_10020.length > 0) {
    
    const sprint = issueResponse.data.fields.customfield_10020[0];
    
    if (sprint && typeof sprint === 'object') {
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
      
      standardIssueInfo += `\n- Sprint: ${sprintName} (ID: ${sprintId}, State: ${sprintState})`;
      standardIssueInfo += `\n- Sprint Dates: ${startDate} to ${endDate}`;
    }
  }

  // Add remaining issue information
  standardIssueInfo += `\n- Created: ${new Date(issueResponse.data.fields.created).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
  standardIssueInfo += `\n- Description: ${issueResponse.data.fields.description || "No description"}`;
  standardIssueInfo += `\n- Creator: ${issueResponse.data.fields.creator.displayName}`;
  
  // Add labels if any exist
  if (issueResponse.data.fields.labels && issueResponse.data.fields.labels.length > 0) {
    standardIssueInfo += `\n- Labels: ${issueResponse.data.fields.labels.join(", ")}`;
  }
  
  // Add Epic link information if available
  for (const [fieldId, value] of Object.entries(issueResponse.data.fields)) {
    if (fieldId.startsWith('customfield_') && value && typeof value === 'string') {
      standardIssueInfo += `\n- Epic Link: ${value}`;
    }
  }

  // Return both standard issue info and debug info
  return {
    content: [
      {
        type: "text",
        text: `Debug Information:
Available Sprints: ${JSON.stringify(sprintsResponse.data, null, 2)}

Issue Fields: ${JSON.stringify(issueResponse.data.fields, null, 2)}

Project Sprints:
${sprintInfo}

Standard Issue Info:
${standardIssueInfo}`
      }
    ]
  };
}