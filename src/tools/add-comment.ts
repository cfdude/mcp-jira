/**
 * Handler for the add_comment tool
 */
import { AxiosInstance } from "axios";
import { AddCommentArgs } from "../types.js";

export async function handleAddComment(
  axiosInstance: AxiosInstance,
  args: AddCommentArgs
) {
  const { issue_key, comment } = args;
  
  // Add comment to the issue
  await axiosInstance.post(`/issue/${issue_key}/comment`, {
    body: comment,
  });
  
  return {
    content: [
      {
        type: "text",
        text: `Comment added to issue ${issue_key}`,
      },
    ],
  };
}