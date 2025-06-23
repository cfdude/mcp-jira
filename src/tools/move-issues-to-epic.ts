/**
 * Handler for the move_issues_to_epic tool
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getInstanceForProject } from "../config.js";
import { createJiraApiInstances } from "../utils/jira-api.js";
import { MoveIssuesToEpicArgs } from "../types.js";

export async function handleMoveIssuesToEpic(args: MoveIssuesToEpicArgs) {
  const { working_dir, instance, epicKey, issueKeys } = args;
  
  // Extract project key from epic key (e.g., "MIG-123" -> "MIG")
  const projectKey = epicKey.split('-')[0];
  
  // Get the instance configuration
  const instanceConfig = await getInstanceForProject(working_dir, projectKey, instance);
  const { agileAxiosInstance } = await createJiraApiInstances(instanceConfig);
  
  console.error("Moving issues to epic:", {
    epicKey,
    issueKeys
  });

  if (!issueKeys || issueKeys.length === 0) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "At least one issue key must be provided"
    );
  }

  try {
    const response = await agileAxiosInstance.post(`/epic/${epicKey}/issue`, {
      issues: issueKeys
    });
    
    return {
      content: [
        {
          type: "text",
          text: `✅ Successfully moved ${issueKeys.length} issue(s) to epic ${epicKey}!

**Moved Issues:**
${issueKeys.map(key => `- ${key}`).join('\n')}

Use \`list_epic_issues\` to view all issues in this epic.`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error moving issues to epic:", error);
    
    if (error.response?.status === 404) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Epic ${epicKey} not found or one or more issue keys are invalid`
      );
    }
    
    if (error.response?.status === 400) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid request: ${error.response?.data?.message || 'Check epic key and issue keys'}`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to move issues to epic: ${error.response?.data?.message || error.message}`
    );
  }
}