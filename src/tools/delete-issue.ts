/**
 * Handler for the delete_issue tool with multi-instance support
 */
import { DeleteIssueArgs } from "../types.js";
import { getInstanceForProject } from "../config.js";
import { createJiraApiInstances } from "../utils/jira-api.js";

export async function handleDeleteIssue(args: DeleteIssueArgs) {
  const { issue_key, working_dir, instance } = args;
  
  // Extract project key from issue key (e.g., "MIG-123" -> "MIG")
  const projectKey = issue_key.split('-')[0];
  
  // Get the appropriate instance and project configuration
  const { instance: instanceConfig } = await getInstanceForProject(
    working_dir, 
    projectKey, 
    instance
  );
  
  // Create API instances for this specific Jira instance
  const { axiosInstance } = createJiraApiInstances(instanceConfig);
  
  console.error(`Deleting issue ${issue_key} from project ${projectKey} using instance: ${instanceConfig.domain}`);
  
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