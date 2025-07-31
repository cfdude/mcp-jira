/**
 * Advanced issue search using JQL for custom project queries
 */
import { withJiraContext } from '../utils/tool-wrapper.js';
import { SearchIssuesJqlArgs } from '../types.js';
import type { SessionState } from '../session-manager.js';

export async function handleSearchIssuesJql(args: SearchIssuesJqlArgs, session?: SessionState) {
  return withJiraContext(args, { requiresProject: false }, async (toolArgs, { axiosInstance }) => {
    try {
      const params: any = {
        jql: toolArgs.jql,
        startAt: toolArgs.startAt || 0,
        maxResults: toolArgs.maxResults || 50,
        fields:
          toolArgs.fields ||
          'summary,status,priority,assignee,created,updated,components,fixVersions,labels,issueType,epic,sprint',
        expand: toolArgs.expand || 'names,schema',
      };

      if (toolArgs.validateQuery !== undefined) {
        params.validateQuery = toolArgs.validateQuery;
      }

      const response = await axiosInstance.get(`/search`, { params });

      const data = response.data;
      const issues = data.issues || [];

      // Process and format issues
      const formattedIssues = issues.map((issue: any) => {
        const fields = issue.fields;
        return {
          key: issue.key,
          id: issue.id,
          summary: fields.summary,
          status: fields.status?.name || 'No Status',
          priority: fields.priority?.name || 'No Priority',
          assignee: fields.assignee?.displayName || 'Unassigned',
          assigneeAccountId: fields.assignee?.accountId || null,
          issueType: fields.issuetype?.name || 'Unknown',
          created: fields.created,
          updated: fields.updated,
          components: fields.components?.map((c: any) => c.name) || [],
          fixVersions: fields.fixVersions?.map((v: any) => v.name) || [],
          labels: fields.labels || [],
          epic: fields.epic?.name || fields.parent?.fields?.summary || null,
          sprint: fields.sprint?.name || fields.customfield_10020?.name || null,
          description: fields.description || 'No description',
          reporter: fields.reporter?.displayName || 'Unknown',
          project: fields.project?.key || 'Unknown',
        };
      });

      // Generate analytics
      const analytics = {
        totalIssues: data.total || formattedIssues.length,
        statusBreakdown: {} as { [key: string]: number },
        priorityBreakdown: {} as { [key: string]: number },
        assigneeBreakdown: {} as { [key: string]: number },
        componentBreakdown: {} as { [key: string]: number },
        issueTypeBreakdown: {} as { [key: string]: number },
      };

      formattedIssues.forEach((issue: any) => {
        // Status breakdown
        analytics.statusBreakdown[issue.status] =
          (analytics.statusBreakdown[issue.status] || 0) + 1;

        // Priority breakdown
        analytics.priorityBreakdown[issue.priority] =
          (analytics.priorityBreakdown[issue.priority] || 0) + 1;

        // Assignee breakdown
        analytics.assigneeBreakdown[issue.assignee] =
          (analytics.assigneeBreakdown[issue.assignee] || 0) + 1;

        // Component breakdown
        issue.components.forEach((comp: string) => {
          analytics.componentBreakdown[comp] = (analytics.componentBreakdown[comp] || 0) + 1;
        });

        // Issue type breakdown
        analytics.issueTypeBreakdown[issue.issueType] =
          (analytics.issueTypeBreakdown[issue.issueType] || 0) + 1;
      });

      return {
        content: [
          {
            type: 'text',
            text: `# JQL Search Results

## 🔍 Query Information
- **JQL**: \`${toolArgs.jql}\`
- **Total Found**: ${analytics.totalIssues}
- **Showing**: ${formattedIssues.length} issues
- **Page**: ${Math.floor((toolArgs.startAt || 0) / (toolArgs.maxResults || 50)) + 1}

## 📊 Quick Analytics

### Status Distribution
${Object.entries(analytics.statusBreakdown)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .map(([status, count]) => `- **${status}**: ${count}`)
  .join('\n')}

### Priority Distribution
${Object.entries(analytics.priorityBreakdown)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .map(([priority, count]) => `- **${priority}**: ${count}`)
  .join('\n')}

### Issue Type Distribution
${Object.entries(analytics.issueTypeBreakdown)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .map(([type, count]) => `- **${type}**: ${count}`)
  .join('\n')}

## 📋 Issue Results

${
  formattedIssues.length > 0
    ? formattedIssues
        .map(
          (issue: any, index: number) =>
            `### ${index + 1}. ${issue.key}: ${issue.summary}
- **Status**: ${issue.status}
- **Priority**: ${issue.priority}
- **Assignee**: ${issue.assignee}
- **Type**: ${issue.issueType}
- **Components**: ${issue.components.length > 0 ? issue.components.join(', ') : 'None'}
- **Fix Versions**: ${issue.fixVersions.length > 0 ? issue.fixVersions.join(', ') : 'None'}
- **Labels**: ${issue.labels.length > 0 ? issue.labels.join(', ') : 'None'}
- **Created**: ${new Date(issue.created).toLocaleDateString()}
- **Updated**: ${new Date(issue.updated).toLocaleDateString()}
${issue.epic ? `- **Epic**: ${issue.epic}` : ''}
${issue.sprint ? `- **Sprint**: ${issue.sprint}` : ''}`
        )
        .join('\n\n')
    : 'No issues found matching the query.'
}

## 💡 JQL Tips
- Use \`project = "KEY"\` to filter by project
- Add \`AND status != "Done"\` to exclude completed work
- Use \`ORDER BY created DESC\` to sort by newest first
- Filter by component: \`component = "ComponentName"\`
- Filter by version: \`fixVersion = "1.0.0"\`
- Filter by assignee: \`assignee = currentUser()\`
- Date ranges: \`created >= -30d\` (last 30 days)

${
  data.total > formattedIssues.length
    ? `\n**Note**: Showing ${formattedIssues.length} of ${data.total} total results. Use pagination parameters to see more.`
    : ''
}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing JQL search: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}
