/**
 * Handler for the add_comment tool with multi-instance support
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { AddCommentArgs } from '../types.js';
import type { SessionState } from '../session-manager.js';

export async function handleAddComment(args: AddCommentArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { extractProjectFromIssueKey: true },
    async ({ issue_key, comment }, { axiosInstance }) => {
      try {
        // Add comment to the issue
        await axiosInstance.post(`/issue/${issue_key}/comment`, {
          body: comment,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Comment added to issue ${issue_key}`,
            },
          ],
        };
      } catch (error: any) {
        console.error('Error adding comment:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to add comment: ${error.response?.data?.message || error.message}`
        );
      }
    },
    session
  );
}
