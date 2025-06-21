/**
 * Handler for the move_issues_to_sprint tool
 */
import { AxiosInstance } from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

interface MoveIssuesToSprintArgs {
  working_dir: string;
  sprintId: number;
  issueKeys: string[];
}

export async function handleMoveIssuesToSprint(
  agileAxiosInstance: AxiosInstance,
  args: MoveIssuesToSprintArgs
) {
  const { sprintId, issueKeys } = args;
  
  console.error("Moving issues to sprint:", {
    sprintId,
    issueKeys
  });

  if (!issueKeys || issueKeys.length === 0) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "At least one issue key must be provided"
    );
  }

  try {
    const response = await agileAxiosInstance.post(`/sprint/${sprintId}/issue`, {
      issues: issueKeys
    });
    
    return {
      content: [
        {
          type: "text",
          text: `✅ Successfully moved ${issueKeys.length} issue(s) to sprint ${sprintId}!

**Moved Issues:**
${issueKeys.map(key => `- ${key}`).join('\n')}

Use \`get_sprint_details\` to view updated sprint information.`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error moving issues to sprint:", error);
    
    // Handle specific error cases
    if (error.response?.status === 404) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Sprint ${sprintId} not found or one or more issue keys are invalid`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to move issues to sprint: ${error.response?.data?.message || error.message}`
    );
  }
}