/**
 * Handler for the create_sprint tool
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getBoardId } from '../utils/jira-api.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { BaseArgs } from '../types.js';
import type { SessionState } from '../session-manager.js';

export interface CreateSprintArgs extends BaseArgs {
  projectKey?: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  boardId?: number;
}

export async function handleCreateSprint(args: CreateSprintArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { requiresProject: true },
    async (toolArgs, { agileAxiosInstance, projectKey: contextProjectKey }) => {
      const { name, goal, startDate, endDate, boardId, projectKey } = toolArgs;

      const effectiveProjectKey = projectKey || contextProjectKey;

      console.error('Creating sprint with:', {
        projectKey: effectiveProjectKey,
        name,
        goal,
        startDate,
        endDate,
        boardId,
      });

      const normalizeDate = (value?: string) => {
        if (!value) return undefined;

        const trimmed = value.trim();
        if (!trimmed) return undefined;

        const matchesDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
        const isoCandidate = matchesDateOnly ? `${trimmed}T00:00:00.000Z` : trimmed;

        const date = new Date(isoCandidate);
        if (Number.isNaN(date.getTime())) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid date value provided. Expected ISO 8601 string (e.g. 2025-09-29T00:00:00Z). Received: ${value}`
          );
        }

        return date.toISOString();
      };

      const normalizedStartDate = normalizeDate(startDate);
      const normalizedEndDate = normalizeDate(endDate);

      if (normalizedStartDate && normalizedEndDate) {
        const startTime = Date.parse(normalizedStartDate);
        const endTime = Date.parse(normalizedEndDate);
        if (startTime > endTime) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Sprint start date must be before end date. Received start=${normalizedStartDate}, end=${normalizedEndDate}`
          );
        }
      }

      // Get board ID if not provided
      const effectiveBoardId =
        boardId || (await getBoardId(agileAxiosInstance, effectiveProjectKey));

      const sprintData: Record<string, unknown> = {
        name,
        originBoardId: effectiveBoardId,
      };

      if (goal) sprintData.goal = goal;
      if (normalizedStartDate) sprintData.startDate = normalizedStartDate;
      if (normalizedEndDate) sprintData.endDate = normalizedEndDate;

      try {
        console.error('Sprint creation request:', JSON.stringify(sprintData, null, 2));
        const response = await agileAxiosInstance.post('/sprint', sprintData);

        return {
          content: [
            {
              type: 'text',
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
        console.error('Error creating sprint:', error);
        console.error('Sprint data that failed:', JSON.stringify(sprintData, null, 2));
        console.error('Error response:', error.response?.data);

        let errorMessage = `Failed to create sprint: ${error.response?.data?.message || error.message}`;

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

          // Add debugging info for board issues
          if (errorMessage.includes('board') || errorMessage.includes('Board')) {
            errorMessage += `\n\nDebugging Info:
- Attempted Board ID: ${effectiveBoardId}
- Project Key: ${effectiveProjectKey}
- Board ID was ${boardId ? 'explicitly provided' : 'auto-detected'}`;
          }
        }

        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
    },
    session
  );
}
