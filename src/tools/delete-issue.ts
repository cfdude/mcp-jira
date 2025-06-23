/**
 * Handler for the delete_issue tool with multi-instance support
 */
import { DeleteIssueArgs } from "../types.js";
import { withJiraContext } from "../utils/tool-wrapper.js";

export async function handleDeleteIssue(args: DeleteIssueArgs) {
  return withJiraContext(
    args,
    { extractProjectFromIssueKey: true },
    async ({ issue_key }, { axiosInstance }) => {
      // Delete the issue
      await axiosInstance.delete(`/issue/${issue_key}`);
      
      return {
        content: [
          {
            type: "text",
            text: `Issue ${issue_key} has been deleted.`,
          },
        ],
      };
    }
  );
}