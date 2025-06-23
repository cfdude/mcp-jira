/**
 * Handler for the complete_sprint tool
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getInstanceForProject } from "../config.js";
import { createJiraApiInstances } from "../utils/jira-api.js";
import { BaseArgs } from "../types.js";

export interface CompleteSprintArgs extends BaseArgs {
  sprintId: number;
}

export async function handleCompleteSprint(args: CompleteSprintArgs) {
  const { working_dir, instance, sprintId } = args;
  
  // Get the instance configuration
  const instanceConfig = await getInstanceForProject(working_dir, undefined, instance);
  const { agileAxiosInstance } = await createJiraApiInstances(instanceConfig);
  
  console.error("Completing sprint:", sprintId);

  try {
    // First get current sprint state to validate
    const sprintResponse = await agileAxiosInstance.get(`/sprint/${sprintId}`);
    const sprint = sprintResponse.data;
    
    if (sprint.state === 'closed') {
      return {
        content: [
          {
            type: "text",
            text: `ℹ️ Sprint "${sprint.name}" (${sprintId}) is already completed.`,
          },
        ],
      };
    }
    
    if (sprint.state !== 'active') {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Sprint must be in active state to complete. Current state: ${sprint.state}`
      );
    }

    // Complete the sprint by setting state to closed
    const response = await agileAxiosInstance.put(`/sprint/${sprintId}`, {
      state: 'closed'
    });
    
    return {
      content: [
        {
          type: "text",
          text: `✅ Sprint completed successfully!

📊 **Completed Sprint:**
- **Name:** ${response.data.name}
- **ID:** ${response.data.id}
- **State:** ${response.data.state}
- **Start Date:** ${response.data.startDate ? new Date(response.data.startDate).toLocaleDateString() : 'Not set'}
- **End Date:** ${response.data.endDate ? new Date(response.data.endDate).toLocaleDateString() : 'Not set'}
${response.data.goal ? `- **Goal:** ${response.data.goal}` : ''}

The sprint has been marked as completed. Use \`get_sprint_details\` to view final statistics.`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error completing sprint:", error);
    
    if (error.response?.status === 404) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Sprint ${sprintId} not found`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to complete sprint: ${error.response?.data?.message || error.message}`
    );
  }
}