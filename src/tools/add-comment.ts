/**
 * Handler for the add_comment tool with multi-instance support
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getInstanceForProject } from "../config.js";
import { createJiraApiInstances } from "../utils/jira-api.js";
import { AddCommentArgs } from "../types.js";

export async function handleAddComment(args: AddCommentArgs) {
  const { issue_key, comment, working_dir, instance } = args;
  
  // Extract project key from issue key (e.g., "MIG-123" -> "MIG")
  const projectKey = issue_key.split('-')[0];
  
  // Get the instance configuration
  const { instance: instanceConfig, projectConfig } = await getInstanceForProject(working_dir, projectKey, instance);
  const { axiosInstance } = createJiraApiInstances(instanceConfig);
  
  console.error(`Adding comment to issue ${issue_key} from project ${projectKey} using instance: ${instanceConfig.domain}`);
  
  try {
    // Add comment to the issue
    await axiosInstance.post(`/issue/${issue_key}/comment`, {
      body: comment,
    });
    
    return {
      content: [
        {
          type: "text",
          text: `Comment added to issue ${issue_key}`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error adding comment:", error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to add comment: ${error.response?.data?.message || error.message}`
    );
  }
}