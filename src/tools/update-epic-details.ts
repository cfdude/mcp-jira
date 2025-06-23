/**
 * Handler for the update_epic_details tool
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getInstanceForProject } from "../config.js";
import { createJiraApiInstances } from "../utils/jira-api.js";
import { UpdateEpicDetailsArgs } from "../types.js";

export async function handleUpdateEpicDetails(args: UpdateEpicDetailsArgs) {
  const { working_dir, instance, epicKey, name, summary, done, color } = args;
  
  // Extract project key from epic key (e.g., "MIG-123" -> "MIG")
  const projectKey = epicKey.split('-')[0];
  
  // Get the instance configuration
  const instanceConfig = await getInstanceForProject(working_dir, projectKey, instance);
  const { agileAxiosInstance } = await createJiraApiInstances(instanceConfig);
  
  console.error("Updating epic details:", {
    epicKey,
    name,
    summary,
    done,
    color
  });

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (summary !== undefined) updateData.summary = summary;
  if (done !== undefined) updateData.done = done;
  if (color !== undefined) {
    updateData.color = { key: color };
  }

  if (Object.keys(updateData).length === 0) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "At least one field must be provided to update"
    );
  }

  try {
    const response = await agileAxiosInstance.put(`/epic/${epicKey}`, updateData);
    
    return {
      content: [
        {
          type: "text",
          text: `✅ Epic updated successfully!

📊 **Updated Epic Details:**
- **Key:** ${epicKey}
- **Name:** ${response.data.name || 'Not set'}
- **Summary:** ${response.data.summary || 'Not set'}
- **Status:** ${response.data.done ? 'Done' : 'In Progress'}
${response.data.color ? `- **Color:** ${response.data.color.key}` : ''}

Use \`list_epic_issues\` to view issues in this epic.`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error updating epic details:", error);
    
    if (error.response?.status === 404) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Epic ${epicKey} not found`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to update epic: ${error.response?.data?.message || error.message}`
    );
  }
}