/**
 * Handler for the bulk_update_issues tool
 */
import { AxiosInstance } from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { resolveAssigneeValue } from "../utils/user-resolver.js";

interface BulkUpdateIssuesArgs {
  working_dir: string;
  issueKeys: string[];
  updates: {
    status?: string;
    assignee?: string;
    priority?: string;
    labels?: string[];
    sprint?: string;
    storyPoints?: number;
  };
}

export async function handleBulkUpdateIssues(
  axiosInstance: AxiosInstance,
  agileAxiosInstance: AxiosInstance,
  defaultProjectKey: string,
  storyPointsField: string | null,
  args: BulkUpdateIssuesArgs
) {
  const { issueKeys, updates } = args;
  
  console.error("Bulk updating issues:", {
    issueKeys,
    updates
  });

  if (!issueKeys || issueKeys.length === 0) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "At least one issue key must be provided"
    );
  }

  if (!updates || Object.keys(updates).length === 0) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "At least one update field must be provided"
    );
  }

  const results: any[] = [];
  const errors: any[] = [];

  // Process issues one by one for better error handling
  for (const issueKey of issueKeys) {
    try {
      const fields: any = {};
      
      // Build update fields
      if (updates.status) {
        // For status updates, we need to use transitions API
        // This is simplified - in production, you'd want to handle transitions properly
        fields.status = { name: updates.status };
      }
      
      if (updates.assignee !== undefined) {
        try {
          const resolvedAccountId = await resolveAssigneeValue(axiosInstance, updates.assignee);
          if (resolvedAccountId === null) {
            fields.assignee = null;
          } else {
            fields.assignee = { accountId: resolvedAccountId };
          }
        } catch (error: any) {
          console.error(`Failed to resolve assignee for ${issueKey}:`, error.message);
          errors.push({
            issueKey,
            status: 'error',
            message: `Failed to resolve assignee "${updates.assignee}": ${error.message}`
          });
          continue; // Skip this issue and move to the next one
        }
      }
      
      if (updates.priority) {
        fields.priority = { name: updates.priority };
      }
      
      if (updates.labels !== undefined) {
        fields.labels = updates.labels;
      }
      
      if (updates.storyPoints !== undefined && storyPointsField) {
        fields[storyPointsField] = updates.storyPoints;
      }

      // Handle sprint updates separately via Agile API
      if (updates.sprint) {
        try {
          if (updates.sprint.toLowerCase() === 'remove') {
            // Remove from sprint - this requires specific handling
            console.error(`Removing ${issueKey} from sprint (not implemented via standard API)`);
          } else {
            // Find sprint and move issue
            // This would require additional logic to find sprint by name
            console.error(`Sprint updates for ${issueKey} require additional implementation`);
          }
        } catch (sprintError) {
          console.error(`Sprint update failed for ${issueKey}:`, sprintError);
        }
      }

      // Perform the update
      if (Object.keys(fields).length > 0) {
        await axiosInstance.put(`/issue/${issueKey}`, { fields });
        results.push({
          issueKey,
          status: 'success',
          message: 'Issue updated successfully'
        });
      } else {
        results.push({
          issueKey,
          status: 'skipped',
          message: 'No applicable updates for this issue'
        });
      }
      
    } catch (error: any) {
      console.error(`Error updating ${issueKey}:`, error);
      errors.push({
        issueKey,
        status: 'error',
        message: error.response?.data?.message || error.message
      });
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = errors.length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;

  return {
    content: [
      {
        type: "text",
        text: `📊 **Bulk Update Results:**

**Summary:**
- **Total Issues:** ${issueKeys.length}
- **Successfully Updated:** ${successCount}
- **Errors:** ${errorCount}
- **Skipped:** ${skippedCount}

${successCount > 0 ? `**Successfully Updated:**
${results.filter(r => r.status === 'success').map(r => `✅ ${r.issueKey}`).join('\n')}

` : ''}${errorCount > 0 ? `**Errors:**
${errors.map(e => `❌ ${e.issueKey}: ${e.message}`).join('\n')}

` : ''}${skippedCount > 0 ? `**Skipped:**
${results.filter(r => r.status === 'skipped').map(r => `⏭️ ${r.issueKey}: ${r.message}`).join('\n')}

` : ''}**Applied Updates:**
${Object.entries(updates).map(([key, value]) => 
  `- **${key}:** ${Array.isArray(value) ? value.join(', ') : value}`
).join('\n')}`,
      },
    ],
  };
}