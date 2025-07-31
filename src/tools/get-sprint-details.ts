/**
 * Handler for the get_sprint_details tool
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { GetSprintDetailsArgs } from '../types.js';

export async function handleGetSprintDetails(args: GetSprintDetailsArgs) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async ({ sprintId }, { agileAxiosInstance }) => {
      console.error('Getting sprint details for:', sprintId);

      try {
        // Get sprint details
        const sprintResponse = await agileAxiosInstance.get(`/sprint/${sprintId}`);
        const sprint = sprintResponse.data;

        // Get sprint issues
        const issuesResponse = await agileAxiosInstance.get(`/sprint/${sprintId}/issue`);
        const issues = issuesResponse.data.issues || [];

        // Calculate sprint statistics
        const totalIssues = issues.length;
        const completedIssues = issues.filter(
          (issue: any) => issue.fields.status.statusCategory.key === 'done'
        ).length;
        const inProgressIssues = issues.filter(
          (issue: any) => issue.fields.status.statusCategory.key === 'indeterminate'
        ).length;
        const todoIssues = issues.filter(
          (issue: any) => issue.fields.status.statusCategory.key === 'new'
        ).length;

        // Calculate story points if available
        let totalStoryPoints = 0;
        let completedStoryPoints = 0;
        issues.forEach((issue: any) => {
          const storyPoints = issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
          if (storyPoints) {
            totalStoryPoints += storyPoints;
            if (issue.fields.status.statusCategory.key === 'done') {
              completedStoryPoints += storyPoints;
            }
          }
        });

        const completionPercentage =
          totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;
        const storyPointsCompletion =
          totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0;

        return {
          content: [
            {
              type: 'text',
              text: `📊 **Sprint Details: ${sprint.name}**

**Basic Information:**
- **ID:** ${sprint.id}
- **State:** ${sprint.state}
- **Board ID:** ${sprint.originBoardId}
${sprint.goal ? `- **Goal:** ${sprint.goal}` : ''}
${sprint.startDate ? `- **Start Date:** ${new Date(sprint.startDate).toLocaleDateString()}` : ''}
${sprint.endDate ? `- **End Date:** ${new Date(sprint.endDate).toLocaleDateString()}` : ''}

**Progress Summary:**
- **Total Issues:** ${totalIssues}
- **Completed:** ${completedIssues} (${completionPercentage}%)
- **In Progress:** ${inProgressIssues}
- **To Do:** ${todoIssues}

${
  totalStoryPoints > 0
    ? `**Story Points:**
- **Total:** ${totalStoryPoints}
- **Completed:** ${completedStoryPoints} (${storyPointsCompletion}%)
- **Remaining:** ${totalStoryPoints - completedStoryPoints}

`
    : ''
}**Issues in Sprint:**
${issues
  .slice(0, 10)
  .map((issue: any) => `- ${issue.key}: ${issue.fields.summary} [${issue.fields.status.name}]`)
  .join('\n')}
${issues.length > 10 ? `\n... and ${issues.length - 10} more issues` : ''}`,
            },
          ],
        };
      } catch (error: any) {
        console.error('Error getting sprint details:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get sprint details: ${error.response?.data?.message || error.message}`
        );
      }
    }
  );
}
