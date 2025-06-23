/**
 * Handler for the create_sprint tool
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getBoardId } from "../utils/jira-api.js";
import { withJiraContext } from "../utils/tool-wrapper.js";
import { BaseArgs } from "../types.js";

export interface CreateSprintArgs extends BaseArgs {
  projectKey?: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  boardId?: number;
}

export async function handleCreateSprint(args: CreateSprintArgs) {
  return withJiraContext(
    args,
    { requiresProject: true },
    async (toolArgs, { agileAxiosInstance, projectKey: contextProjectKey }) => {
      const { name, goal, startDate, endDate, boardId, projectKey } = toolArgs;
      
      const effectiveProjectKey = projectKey || contextProjectKey;
      
      console.error("Creating sprint with:", {
        projectKey: effectiveProjectKey,
        name,
        goal,
        startDate,
        endDate,
        boardId
      });

      // Get board ID if not provided
      const effectiveBoardId = boardId || await getBoardId(agileAxiosInstance, effectiveProjectKey);
      
      const sprintData: any = {
        name,
        originBoardId: effectiveBoardId
      };

      if (goal) sprintData.goal = goal;
      if (startDate) sprintData.startDate = startDate;
      if (endDate) sprintData.endDate = endDate;

      try {
        const response = await agileAxiosInstance.post("/sprint", sprintData);
        
        return {
          content: [
            {
              type: "text",
              text: `✅ Sprint created successfully!

📊 **Sprint Details:**
- **ID:** ${response.data.id}
- **Name:** ${response.data.name}
- **State:** ${response.data.state}
- **Board ID:** ${response.data.originBoardId}
${response.data.goal ? `- **Goal:** ${response.data.goal}` : ''}
${response.data.startDate ? `- **Start Date:** ${response.data.startDate}` : ''}
${response.data.endDate ? `- **End Date:** ${response.data.endDate}` : ''}

Use \`update_sprint\` to modify sprint details or \`move_issues_to_sprint\` to add issues.`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error creating sprint:", error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to create sprint: ${error.response?.data?.message || error.message}`
        );
      }
    }
  );
}