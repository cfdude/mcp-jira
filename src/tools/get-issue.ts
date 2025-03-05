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

  // Return both standard issue info and debug info
  return {
    content: [
      {
        type: "text",
        text: `Debug Information:
Available Sprints: ${JSON.stringify(sprintsResponse.data, null, 2)}

Issue Fields: ${JSON.stringify(issueResponse.data.fields, null, 2)}

Standard Issue Info:
${formatIssue(issueResponse.data, storyPointsField)}`
      }
    ]
  };
}