/**
 * Get version progress with issue counts and status breakdown
 */
import { AxiosInstance } from "axios";

export async function handleGetVersionProgress(
  axiosInstance: AxiosInstance,
  projectKey: string,
  args: any
) {
  try {
    // Get version details
    const versionResponse = await axiosInstance.get(
      `/rest/api/3/version/${args.versionId}`
    );
    const version = versionResponse.data;

    // Get issue counts for this version
    const issueCountsResponse = await axiosInstance.get(
      `/rest/api/3/version/${args.versionId}/relatedIssueCounts`
    );
    const issueCounts = issueCountsResponse.data;

    // Get detailed issue breakdown by searching for issues in this version
    const searchResponse = await axiosInstance.get(
      `/rest/api/3/search`,
      {
        params: {
          jql: `project = "${projectKey}" AND fixVersion = "${version.name}"`,
          fields: "status,priority,assignee,summary",
          maxResults: 1000
        }
      }
    );

    const issues = searchResponse.data.issues;
    
    // Calculate status breakdown
    const statusBreakdown: { [key: string]: number } = {};
    const priorityBreakdown: { [key: string]: number } = {};
    const assigneeBreakdown: { [key: string]: number } = {};

    issues.forEach((issue: any) => {
      const status = issue.fields.status.name;
      const priority = issue.fields.priority?.name || "No Priority";
      const assignee = issue.fields.assignee?.displayName || "Unassigned";

      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      priorityBreakdown[priority] = (priorityBreakdown[priority] || 0) + 1;
      assigneeBreakdown[assignee] = (assigneeBreakdown[assignee] || 0) + 1;
    });

    // Calculate progress percentage
    const totalIssues = issueCounts.issuesFixedCount + issueCounts.issuesAffectedCount;
    const progressPercentage = totalIssues > 0 
      ? Math.round((issueCounts.issuesFixedCount / totalIssues) * 100)
      : 0;

    // Determine if version is on track
    const today = new Date();
    const releaseDate = version.releaseDate ? new Date(version.releaseDate) : null;
    const isOverdue = releaseDate && releaseDate < today && !version.released;
    const daysUntilRelease = releaseDate 
      ? Math.ceil((releaseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      content: [
        {
          type: "text",
          text: `# Version Progress Report: ${version.name}

## 📊 Overview
- **Version ID**: ${version.id}
- **Project**: ${projectKey}
- **Description**: ${version.description || "No description"}
- **Progress**: ${progressPercentage}% complete
- **Status**: ${version.released ? "🏁 Released" : version.archived ? "📦 Archived" : isOverdue ? "⚠️ Overdue" : "🚀 Active"}

## 📅 Timeline
- **Start Date**: ${version.startDate || "Not set"}
- **Release Date**: ${version.releaseDate || "Not set"}
${daysUntilRelease !== null ? 
  `- **Days Until Release**: ${daysUntilRelease > 0 ? daysUntilRelease : "OVERDUE"}` : 
  ""
}

## 📈 Issue Metrics
- **Total Issues**: ${totalIssues}
- **Fixed/Completed**: ${issueCounts.issuesFixedCount}
- **Affected/In Progress**: ${issueCounts.issuesAffectedCount}
- **Progress Bar**: ${"█".repeat(Math.floor(progressPercentage / 10))}${"░".repeat(10 - Math.floor(progressPercentage / 10))} ${progressPercentage}%

## 📋 Status Breakdown
${Object.entries(statusBreakdown)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .map(([status, count]) => `- **${status}**: ${count} issues`)
  .join('\n')}

## 🎯 Priority Breakdown
${Object.entries(priorityBreakdown)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .map(([priority, count]) => `- **${priority}**: ${count} issues`)
  .join('\n')}

## 👥 Assignee Breakdown
${Object.entries(assigneeBreakdown)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .slice(0, 10)
  .map(([assignee, count]) => `- **${assignee}**: ${count} issues`)
  .join('\n')}${Object.keys(assigneeBreakdown).length > 10 ? '\n... and more' : ''}

${isOverdue ? "\n⚠️ **WARNING**: This version is overdue for release!" : ""}
${daysUntilRelease !== null && daysUntilRelease <= 7 && daysUntilRelease > 0 ? "\n🔔 **NOTICE**: Version release is approaching soon!" : ""}`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error getting version progress: ${error.response?.data?.errorMessages?.join(", ") || error.message}`,
        },
      ],
      isError: true,
    };
  }
}