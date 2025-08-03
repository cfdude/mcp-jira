/**
 * Handler for the complete_sprint tool
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { CompleteSprintArgs } from '../types.js';
import type { SessionState } from '../session-manager.js';

export async function handleCompleteSprint(args: CompleteSprintArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async ({ sprintId }, { agileAxiosInstance }) => {
      console.error('Completing sprint:', sprintId);

      try {
        // First get current sprint state to validate
        const sprintResponse = await agileAxiosInstance.get(`/sprint/${sprintId}`);
        const sprint = sprintResponse.data;

        if (sprint.state === 'closed') {
          return {
            content: [
              {
                type: 'text',
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
          state: 'closed',
        });

        return {
          content: [
            {
              type: 'text',
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
        console.error('Error completing sprint:', error);
        console.error('Error details:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });

        if (error.response?.status === 401) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Authentication failed: Invalid API token or email. Please check your credentials in .jira-config.json.'
          );
        }

        if (error.response?.status === 403) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Permission denied: You don't have permission to complete sprints. Required permissions: 'Manage Sprints' in the project or board.`
          );
        }

        if (error.response?.status === 404) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Sprint ${sprintId} not found. Check: 1) Sprint ID is correct, 2) Sprint exists in your accessible projects, 3) You have permission to view the board.`
          );
        }

        if (error.response?.status === 400) {
          const errorMessage = error.response?.data?.errorMessages?.join(', ') || 'Invalid request';
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Cannot complete sprint: ${errorMessage}. Common issues: 1) Sprint is not in 'active' state, 2) Sprint has incomplete required fields, 3) Board configuration prevents completion.`
          );
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Failed to complete sprint: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
        );
      }
    },
    session
  );
}
