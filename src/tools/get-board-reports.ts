/**
 * Handler for the get_board_reports tool
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { BaseArgs } from '../types.js';
import type { SessionState } from '../session-manager.js';

export interface GetBoardReportsArgs extends BaseArgs {
  boardId: number;
}

export async function handleGetBoardReports(args: GetBoardReportsArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { agileAxiosInstance }) => {
      const { boardId } = toolArgs;

      console.error('Getting board reports for:', boardId);

      try {
        // Get board details first
        const boardResponse = await agileAxiosInstance.get(`/board/${boardId}`);
        const board = boardResponse.data;

        // Get current and future sprints
        const sprintsResponse = await agileAxiosInstance.get(`/board/${boardId}/sprint`, {
          params: { state: 'active,future', maxResults: 50 },
        });
        const sprints = sprintsResponse.data.values || [];

        // Get current board issues for basic metrics
        const issuesResponse = await agileAxiosInstance.get(`/board/${boardId}/issue`, {
          params: { maxResults: 1000 },
        });
        const issues = issuesResponse.data.issues || [];

        // Calculate basic metrics
        const totalIssues = issues.length;
        const issuesByStatus = issues.reduce((acc: any, issue: any) => {
          const status = issue.fields.status.name;
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        const issuesByType = issues.reduce((acc: any, issue: any) => {
          const type = issue.fields.issuetype.name;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});

        // Calculate story points if available
        let totalStoryPoints = 0;
        let storyPointsByStatus: any = {};
        issues.forEach((issue: any) => {
          const storyPoints = issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
          const status = issue.fields.status.name;
          if (storyPoints) {
            totalStoryPoints += storyPoints;
            storyPointsByStatus[status] = (storyPointsByStatus[status] || 0) + storyPoints;
          }
        });

        // Format sprints section
        const sprintsSection =
          sprints.length > 0
            ? sprints
                .map((sprint: any) => {
                  const startDate = sprint.startDate
                    ? new Date(sprint.startDate).toLocaleDateString()
                    : 'Not set';
                  const endDate = sprint.endDate
                    ? new Date(sprint.endDate).toLocaleDateString()
                    : 'Not set';
                  const goal = sprint.goal ? `\n  - Goal: ${sprint.goal}` : '';
                  return `- **${sprint.name}** (ID: ${sprint.id})\n  - State: ${sprint.state}\n  - Start: ${startDate}\n  - End: ${endDate}${goal}`;
                })
                .join('\n\n')
            : 'No active or future sprints found';

        // Format issues by status section
        const issuesByStatusSection = Object.entries(issuesByStatus)
          .map(([status, count]) => `- **${status}:** ${count}`)
          .join('\n');

        // Format issues by type section
        const issuesByTypeSection = Object.entries(issuesByType)
          .map(([type, count]) => `- **${type}:** ${count}`)
          .join('\n');

        // Format story points section
        const storyPointsSection =
          totalStoryPoints > 0
            ? `**Story Points Analysis:**
- **Total Story Points:** ${totalStoryPoints}

**Story Points by Status:**
${Object.entries(storyPointsByStatus)
  .map(([status, points]) => `- **${status}:** ${points} points`)
  .join('\n')}

`
            : '';

        return {
          content: [
            {
              type: 'text',
              text: `📊 **Board Reports: ${board.name}**

**Current & Future Sprints:**
${sprintsSection}

**Current Board Metrics:**

**Issue Summary:**
- **Total Issues:** ${totalIssues}

**Issues by Status:**
${issuesByStatusSection}

**Issues by Type:**
${issuesByTypeSection}

${storyPointsSection}**Board Information:**
- **Board ID:** ${board.id}
- **Type:** ${board.type}
- **Project:** ${board.location?.projectKey || 'N/A'}

For detailed sprint analytics, use \`get_sprint_details\` with specific sprint IDs.
For sprint management, use \`update_sprint\`, \`move_issues_to_sprint\`, or \`complete_sprint\`.`,
            },
          ],
        };
      } catch (error: any) {
        console.error('Error getting board reports:', error);

        if (error.response?.status === 404) {
          throw new McpError(ErrorCode.InvalidRequest, `Board ${boardId} not found`);
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get board reports: ${error.response?.data?.message || error.message}`
        );
      }
    },
    session
  );
}
