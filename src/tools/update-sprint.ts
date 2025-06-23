/**
 * Handler for the update_sprint tool
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { withJiraContext } from "../utils/tool-wrapper.js";
import { BaseArgs } from "../types.js";

export interface UpdateSprintArgs extends BaseArgs {
  sprintId: number;
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  state?: 'active' | 'closed' | 'future';
}

export async function handleUpdateSprint(args: UpdateSprintArgs) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { agileAxiosInstance }) => {
      const { sprintId, name, goal, startDate, endDate, state } = toolArgs;
      
      console.error("Updating sprint:", {
        sprintId,
        name,
        goal,
        startDate,
        endDate,
        state
      });

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (goal !== undefined) updateData.goal = goal;
      if (startDate !== undefined) updateData.startDate = startDate;
      if (endDate !== undefined) updateData.endDate = endDate;
      if (state !== undefined) updateData.state = state;

      if (Object.keys(updateData).length === 0) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "At least one field must be provided to update"
        );
      }

      try {
        const response = await agileAxiosInstance.put(`/sprint/${sprintId}`, updateData);
        
        return {
          content: [
            {
              type: "text",
              text: `✅ Sprint updated successfully!

📊 **Updated Sprint Details:**
- **ID:** ${response.data.id}
- **Name:** ${response.data.name}
- **State:** ${response.data.state}
- **Board ID:** ${response.data.originBoardId}
${response.data.goal ? `- **Goal:** ${response.data.goal}` : ''}
${response.data.startDate ? `- **Start Date:** ${response.data.startDate}` : ''}
${response.data.endDate ? `- **End Date:** ${response.data.endDate}` : ''}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error updating sprint:", error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to update sprint: ${error.response?.data?.message || error.message}`
        );
      }
    }
  );
}