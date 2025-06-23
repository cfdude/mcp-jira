/**
 * Handler for the list_epic_issues tool
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { withJiraContext } from "../utils/tool-wrapper.js";
import { ListEpicIssuesArgs } from "../types.js";

export async function handleListEpicIssues(args: ListEpicIssuesArgs) {
  return withJiraContext(
    args,
    { extractProjectFromIssueKey: true },
    async (toolArgs, { agileAxiosInstance }) => {
      const { epicKey, startAt = 0, maxResults = 50 } = toolArgs;
      
      console.error("Listing epic issues:", {
        epicKey,
        startAt,
        maxResults
      });

      try {
        const params = {
          startAt,
          maxResults
        };

        const response = await agileAxiosInstance.get(`/epic/${epicKey}/issue`, { params });
        const issues = response.data.issues || [];
        
        if (issues.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `📋 **Issues in Epic ${epicKey}:**

No issues found in this epic.

Use \`move_issues_to_epic\` to add issues to this epic.`,
              },
            ],
          };
        }

        // Calculate progress statistics
        const totalIssues = response.data.total || issues.length;
        const completedIssues = issues.filter((issue: any) => 
          issue.fields.status.statusCategory.key === 'done'
        ).length;
        const inProgressIssues = issues.filter((issue: any) => 
          issue.fields.status.statusCategory.key === 'indeterminate'
        ).length;
        const todoIssues = issues.filter((issue: any) => 
          issue.fields.status.statusCategory.key === 'new'
        ).length;

        const completionPercentage = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

        // Calculate story points if available
        let totalStoryPoints = 0;
        let completedStoryPoints = 0;
        issues.forEach((issue: any) => {
          const storyPoints = issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
          if (storyPoints) {
            totalStoryPoints += storyPoints;
            if (issue.fields.status.statusCategory.key === 'done') {
              completedStoryPoints += storyPoints;
            }
          }
        });

        return {
          content: [
            {
              type: "text",
              text: `📋 **Issues in Epic ${epicKey}:**

**Progress Summary:**
- **Total Issues:** ${totalIssues}
- **Completed:** ${completedIssues} (${completionPercentage}%)
- **In Progress:** ${inProgressIssues}
- **To Do:** ${todoIssues}

${totalStoryPoints > 0 ? `**Story Points:**
- **Total:** ${totalStoryPoints}
- **Completed:** ${completedStoryPoints}
- **Remaining:** ${totalStoryPoints - completedStoryPoints}

` : ''}**Issues (${startAt + 1}-${startAt + issues.length} of ${totalIssues}):**
${issues.map((issue: any) => {
  const storyPoints = issue.fields.customfield_10016 || issue.fields.customfield_10020;
  return `- **${issue.key}**: ${issue.fields.summary}
  - Status: ${issue.fields.status.name}
  - Type: ${issue.fields.issuetype.name}
  - Priority: ${issue.fields.priority?.name || 'None'}
  ${storyPoints ? `- Story Points: ${storyPoints}` : ''}
  - Assignee: ${issue.fields.assignee?.displayName || 'Unassigned'}`;
}).join('\n\n')}

${issues.length < totalIssues ? `\nShowing ${issues.length} of ${totalIssues} issues. Use startAt parameter for pagination.` : ''}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error listing epic issues:", error);
        
        if (error.response?.status === 404) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Epic ${epicKey} not found`
          );
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to list epic issues: ${error.response?.data?.message || error.message}`
        );
      }
    }
  );
}