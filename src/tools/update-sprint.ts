/**
 * Handler for the update_sprint tool
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { BaseArgs } from '../types.js';
import { normalizeIsoDate, assertStartBeforeEnd } from '../utils/date-utils.js';
import type { SessionState } from '../session-manager.js';

export interface UpdateSprintArgs extends BaseArgs {
  sprintId: number;
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  state?: 'active' | 'closed' | 'future';
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

      let existingSprintData: any | null = null;
      const loadExistingSprint = async () => {
        if (existingSprintData) {
          return existingSprintData;
        }
        try {
          const response = await agileAxiosInstance.get(`/sprint/${sprintId}`);
          existingSprintData = response.data;
          return existingSprintData;
        } catch (error: any) {
          console.error('Failed to load existing sprint before update:', error);
          throw new McpError(
            ErrorCode.InternalError,
            `Unable to load sprint ${sprintId} details before update: ${error.response?.data?.message || error.message}`
          );
        }
      };

      // Format dates properly for Jira API
      let normalizedStartDate: string | undefined;
      let normalizedEndDate: string | undefined;

      if (startDate !== undefined) {
        try {
          normalizedStartDate = normalizeIsoDate(startDate);
          updateData.startDate = normalizedStartDate;
        } catch {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid startDate format: ${startDate}. Use ISO format like "2025-07-29T00:00:00Z" or "2025-07-29"`
          );
        }
      }

      if (endDate !== undefined) {
        try {
          normalizedEndDate = normalizeIsoDate(endDate);
          updateData.endDate = normalizedEndDate;
        } catch {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid endDate format: ${endDate}. Use ISO format like "2025-08-12T23:59:59Z" or "2025-08-12"`
          );
        }
      }

      try {
        assertStartBeforeEnd(
          normalizedStartDate ?? updateData.startDate,
          normalizedEndDate ?? updateData.endDate,
          'Sprint dates'
        );
      } catch (error: any) {
        throw new McpError(ErrorCode.InvalidRequest, error.message);
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

      if (updateData.name === undefined) {
        const existingSprint = await loadExistingSprint();
        if (!existingSprint?.name) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Sprint ${sprintId} is missing a name in Jira; provide 'name' when updating.`
          );
        }
        updateData.name = existingSprint.name;

        if (goal === undefined && existingSprint.goal !== undefined) {
          updateData.goal = existingSprint.goal;
        }
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
