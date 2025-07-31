/**
 * Handler for the update_sprint tool
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { BaseArgs } from '../types.js';
import type { SessionState } from '../session-manager.js';

export interface UpdateSprintArgs extends BaseArgs {
  sprintId: number;
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  state?: 'active' | 'closed' | 'future';
}

/**
 * Helper function to format dates for Jira API
 * Converts various date formats to ISO 8601 format with timezone
 */
function formatJiraDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}`);
  }

  // Format to ISO string and ensure timezone offset
  const isoString = date.toISOString();
  // Convert Z to +00:00 format for Jira compatibility
  return isoString.replace('Z', '+00:00');
}

export async function handleUpdateSprint(args: UpdateSprintArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { agileAxiosInstance }) => {
      const { sprintId, name, goal, startDate, endDate, state } = toolArgs;

      console.error('Updating sprint:', {
        sprintId,
        name,
        goal,
        startDate,
        endDate,
        state,
      });

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (goal !== undefined) updateData.goal = goal;

      // Format dates properly for Jira API
      if (startDate !== undefined) {
        try {
          updateData.startDate = formatJiraDate(startDate);
        } catch (error) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid startDate format: ${startDate}. Use ISO format like "2025-07-29T00:00:00Z" or "2025-07-29"`
          );
        }
      }

      if (endDate !== undefined) {
        try {
          updateData.endDate = formatJiraDate(endDate);
        } catch (error) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid endDate format: ${endDate}. Use ISO format like "2025-08-12T23:59:59Z" or "2025-08-12"`
          );
        }
      }

      if (state !== undefined) {
        updateData.state = state;

        // For state transitions to active, ensure dates are provided
        if (state === 'active') {
          if (!startDate || !endDate) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              "To activate a sprint, both startDate and endDate must be provided. Example: {startDate: '2025-07-29', endDate: '2025-08-12'}"
            );
          }
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'At least one field must be provided to update'
        );
      }

      try {
        console.error('Sprint update request:', JSON.stringify(updateData, null, 2));
        const response = await agileAxiosInstance.put(`/sprint/${sprintId}`, updateData);

        return {
          content: [
            {
              type: 'text',
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
        console.error('Error updating sprint:', error);
        console.error('Sprint update data that failed:', JSON.stringify(updateData, null, 2));
        console.error('Error response:', error.response?.data);

        let errorMessage = `Failed to update sprint: ${error.response?.data?.message || error.message}`;

        if (error.response?.status === 400) {
          const errorData = error.response.data;
          if (errorData?.errorMessages?.length) {
            errorMessage += `\nErrors: ${errorData.errorMessages.join(', ')}`;
          }
          if (errorData?.errors) {
            const fieldErrors = Object.entries(errorData.errors)
              .map(([field, message]) => `${field}: ${message}`)
              .join(', ');
            errorMessage += `\nField errors: ${fieldErrors}`;
          }

          // Add specific guidance for sprint state transitions
          if (updateData.state === 'active') {
            errorMessage += `\n\nSprint State Transition Issue:
- Attempting to change sprint ${sprintId} to ACTIVE state
- Current parameters: ${JSON.stringify(updateData, null, 2)}
- Common causes: Missing startDate/endDate, invalid date format, or sprint already active
- Try: Ensure startDate and endDate are provided in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)`;
          }
        }

        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
    },
    session
  );
}
