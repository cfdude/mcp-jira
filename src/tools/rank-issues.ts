/**
 * Handler for the rank_issues tool
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { RankIssuesArgs } from '../types.js';

export async function handleRankIssues(args: RankIssuesArgs) {
  return withJiraContext(
    args,
    { extractProjectFromIssueKey: true },
    async (toolArgs, { agileAxiosInstance }) => {
      const { issues, rankBeforeIssue, rankAfterIssue, rankCustomFieldId } = toolArgs;

      console.error('Ranking issues:', {
        issues,
        rankBeforeIssue,
        rankAfterIssue,
        rankCustomFieldId,
      });

      if (!issues || issues.length === 0) {
        throw new McpError(ErrorCode.InvalidRequest, 'At least one issue must be provided');
      }

      // Validate that only one ranking option is provided
      if (rankBeforeIssue && rankAfterIssue) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Cannot specify both rankBeforeIssue and rankAfterIssue. Choose one.'
        );
      }

      if (!rankBeforeIssue && !rankAfterIssue) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Must specify either rankBeforeIssue or rankAfterIssue'
        );
      }

      const rankData: any = {
        issues: issues,
      };

      if (rankBeforeIssue) rankData.rankBeforeIssue = rankBeforeIssue;
      if (rankAfterIssue) rankData.rankAfterIssue = rankAfterIssue;
      if (rankCustomFieldId) rankData.rankCustomFieldId = rankCustomFieldId;

      try {
        const response = await agileAxiosInstance.put('/issue/rank', rankData);

        return {
          content: [
            {
              type: 'text',
              text: `✅ Issues ranked successfully!

📊 **Ranking Details:**
- **Issues Ranked:** ${issues.length}
- **Issues:** ${issues.join(', ')}
${rankBeforeIssue ? `- **Ranked Before:** ${rankBeforeIssue}` : ''}
${rankAfterIssue ? `- **Ranked After:** ${rankAfterIssue}` : ''}
${rankCustomFieldId ? `- **Custom Field ID:** ${rankCustomFieldId}` : ''}

The issues have been repositioned in the ranking order as requested.`,
            },
          ],
        };
      } catch (error: any) {
        console.error('Error ranking issues:', error);

        if (error.response?.status === 404) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'One or more issues not found or target issue for ranking not found'
          );
        }

        if (error.response?.status === 400) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid ranking request: ${error.response?.data?.message || 'Check issue keys and ranking parameters'}`
          );
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Failed to rank issues: ${error.response?.data?.message || error.message}`
        );
      }
    }
  );
}
