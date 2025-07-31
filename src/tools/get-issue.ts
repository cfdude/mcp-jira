/**
 * Handler for the get_issue tool with multi-instance support
 */
import { GetIssueArgs } from '../types.js';
import {
  withJiraContext,
  getStandardFields,
  formatSprintInfo,
  formatStoryPoints,
} from '../utils/tool-wrapper.js';

export async function handleGetIssue(args: GetIssueArgs) {
  return withJiraContext(
    args,
    { extractProjectFromIssueKey: true },
    async ({ issue_key }, { axiosInstance, projectConfig }) => {
      // Get issue with all relevant fields
      const fields = getStandardFields(projectConfig);
      const issueResponse = await axiosInstance.get(`/issue/${issue_key}`, {
        params: {
          fields: fields.join(','),
        },
      });

      const issue = issueResponse.data;

      // Build formatted issue information
      let standardIssueInfo = `${issue.key}: ${issue.fields.summary}
- Type: ${issue.fields.issuetype.name}
- Status: ${issue.fields.status.name}
- Priority: ${issue.fields.priority?.name || 'Not set'}
- Assignee: ${issue.fields.assignee?.displayName || 'Unassigned'}`;

      // Add story points and sprint info using helper functions
      standardIssueInfo += formatStoryPoints(issue, projectConfig);
      standardIssueInfo += formatSprintInfo(issue, projectConfig);

      // Add Rank information if available
      if (issue.fields.customfield_10019) {
        standardIssueInfo += `\n- Rank: ${issue.fields.customfield_10019}`;
      }

      // Add remaining issue information
      standardIssueInfo += `\n- Created: ${new Date(issue.fields.created).toLocaleDateString(
        'en-US',
        {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }
      )}`;
      standardIssueInfo += `\n- Description: ${issue.fields.description || 'No description'}`;
      standardIssueInfo += `\n- Creator: ${issue.fields.creator.displayName}`;

      // Add labels if any exist
      if (issue.fields.labels && issue.fields.labels.length > 0) {
        standardIssueInfo += `\n- Labels: ${issue.fields.labels.join(', ')}`;
      }

      // Add Epic link information if available (parent field)
      if (issue.fields.parent) {
        standardIssueInfo += `\n- Epic Link: ${issue.fields.parent.key}`;
      }

      // Add comments if available
      if (issue.fields.comment && issue.fields.comment.comments.length > 0) {
        standardIssueInfo += `\n- Comments: ${issue.fields.comment.comments.length} comment(s)`;

        // Show latest comment
        const latestComment =
          issue.fields.comment.comments[issue.fields.comment.comments.length - 1];
        const commentDate = new Date(latestComment.created).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        standardIssueInfo += `\n- Latest Comment: "${latestComment.body.substring(0, 100)}${latestComment.body.length > 100 ? '...' : ''}" by ${latestComment.author.displayName} on ${commentDate}`;
      }

      return {
        content: [
          {
            type: 'text',
            text: standardIssueInfo,
          },
        ],
      };
    }
  );
}
