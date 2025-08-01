/**
 * Handler for the delete_issue tool with multi-instance support
 */
import { DeleteIssueArgs } from '../types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

export async function handleDeleteIssue(args: DeleteIssueArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { extractProjectFromIssueKey: true },
    async ({ issue_key }, { axiosInstance }) => {
      try {
        // Delete the issue
        await axiosInstance.delete(`/issue/${issue_key}`);

        return {
          content: [
            {
              type: 'text',
              text: `Issue ${issue_key} has been deleted successfully.`,
            },
          ],
        };
      } catch (error: any) {
        if (error.response?.status === 403) {
          return {
            content: [
              {
                type: 'text',
                text: `# Permission Denied: Cannot Delete Issue ${issue_key}

**Error**: Insufficient permissions to delete this issue.

**Common Causes**:
- Only the issue creator or project administrators can delete issues
- Your user account may not have "Delete Issues" permission
- The issue may be in a workflow state that prevents deletion

**Solutions**:
1. **Ask Project Admin**: Request a project administrator to delete the issue
2. **Alternative Actions**: Instead of deleting, consider:
   - Moving to "Done" or "Canceled" status
   - Adding a "deleted" or "invalid" label
   - Moving to a different project or component
3. **Check Permissions**: Ask your Jira admin to grant "Delete Issues" permission

**Jira Permission Required**: "Delete Issues" project permission or "Jira Administrators" global permission.`,
              },
            ],
          };
        }

        if (error.response?.status === 404) {
          return {
            content: [
              {
                type: 'text',
                text: `# Issue Not Found: ${issue_key}

**Error**: The issue ${issue_key} does not exist or you don't have permission to view it.

**Possible Causes**:
- Issue key is incorrect or typo in the key
- Issue exists in a different project
- You don't have "Browse Projects" permission for this project
- Issue has already been deleted

**Solutions**:
1. **Verify Issue Key**: Double-check the issue key format (e.g., "PROJ-123")
2. **Check Project Access**: Ensure you have access to this project
3. **Search for Issue**: Use the search function to locate the issue`,
              },
            ],
          };
        }

        // Re-throw other errors to be handled by the wrapper
        throw error;
      }
    },
    session
  );
}
