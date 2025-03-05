/**
 * Handler for the delete_issue tool
 */
import { AxiosInstance } from "axios";
import { DeleteIssueArgs } from "../types.js";

export async function handleDeleteIssue(
  axiosInstance: AxiosInstance,
  args: DeleteIssueArgs
) {
  const { issue_key } = args;
  
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