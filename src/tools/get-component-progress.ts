/**
 * Get component progress with issue counts and work distribution
 */
import { AxiosInstance } from "axios";

export async function handleGetComponentProgress(
  axiosInstance: AxiosInstance,
  projectKey: string,
  args: any
) {
  try {
    // Get component details
    const componentResponse = await axiosInstance.get(
      `/rest/api/3/component/${args.componentId}`
    );
    const component = componentResponse.data;

    // Get issue counts for this component
    const issueCountsResponse = await axiosInstance.get(
      `/rest/api/3/component/${args.componentId}/relatedIssueCounts`
    );
    const issueCounts = issueCountsResponse.data;

    // Get detailed issue breakdown by searching for issues in this component
    const searchResponse = await axiosInstance.get(
      `/rest/api/3/search`,
      {
        params: {
          jql: `project = "${projectKey}" AND component = "${component.name}"`,
          fields: "status,priority,assignee,summary,issuetype,created,updated",
          maxResults: 1000
        }
      }
    );

    const issues = searchResponse.data.issues;
    
    // Calculate status breakdown
    const statusBreakdown: { [key: string]: number } = {};
    const priorityBreakdown: { [key: string]: number } = {};
    const assigneeBreakdown: { [key: string]: number } = {};
    const issueTypeBreakdown: { [key: string]: number } = {};

    let totalIssues = issues.length;
    let completedIssues = 0;

    issues.forEach((issue: any) => {
      const status = issue.fields.status.name;
      const priority = issue.fields.priority?.name || "No Priority";
      const assignee = issue.fields.assignee?.displayName || "Unassigned";
      const issueType = issue.fields.issuetype.name;

      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      priorityBreakdown[priority] = (priorityBreakdown[priority] || 0) + 1;
      assigneeBreakdown[assignee] = (assigneeBreakdown[assignee] || 0) + 1;
      issueTypeBreakdown[issueType] = (issueTypeBreakdown[issueType] || 0) + 1;

      // Count completed issues (adjust status names as needed for your workflow)
      if (status.toLowerCase().includes('done') || 
          status.toLowerCase().includes('closed') || 
          status.toLowerCase().includes('resolved')) {
        completedIssues++;
      }
    });

    // Calculate progress percentage
    const progressPercentage = totalIssues > 0 
      ? Math.round((completedIssues / totalIssues) * 100)
      : 0;

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentIssues = issues.filter((issue: any) => 
      new Date(issue.fields.updated) > thirtyDaysAgo
    );

    return {
      content: [
        {
          type: "text",
          text: `# Component Progress Report: ${component.name}

## 🔧 Overview
- **Component ID**: ${component.id}
- **Project**: ${projectKey}
- **Description**: ${component.description || "No description"}
- **Component Lead**: ${component.lead?.displayName || "No lead assigned"}
- **Progress**: ${progressPercentage}% complete

## 📊 Issue Metrics
- **Total Issues**: ${totalIssues}
- **Completed Issues**: ${completedIssues}
- **Active Issues**: ${totalIssues - completedIssues}
- **Progress Bar**: ${"█".repeat(Math.floor(progressPercentage / 10))}${"░".repeat(10 - Math.floor(progressPercentage / 10))} ${progressPercentage}%

## 📈 Activity (Last 30 Days)
- **Recently Updated Issues**: ${recentIssues.length}
- **Activity Level**: ${recentIssues.length > totalIssues * 0.3 ? "🔥 High" : recentIssues.length > totalIssues * 0.1 ? "📈 Moderate" : "📉 Low"}

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

## 📝 Issue Type Breakdown
${Object.entries(issueTypeBreakdown)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .map(([type, count]) => `- **${type}**: ${count} issues`)
  .join('\n')}

## 👥 Assignee Distribution
${Object.entries(assigneeBreakdown)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .slice(0, 10)
  .map(([assignee, count]) => `- **${assignee}**: ${count} issues`)
  .join('\n')}${Object.keys(assigneeBreakdown).length > 10 ? '\n... and more' : ''}

## 💡 Insights
${progressPercentage >= 80 ? "🎉 Great progress! Component is nearly complete." :
  progressPercentage >= 50 ? "👍 Good progress! Keep up the momentum." :
  progressPercentage >= 25 ? "🚀 Getting started! Focus on completing active work." :
  "🚩 Early stage. Consider breaking down work into smaller tasks."}

${recentIssues.length === 0 ? "⚠️ No recent activity. Component may need attention." : ""}`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error getting component progress: ${error.response?.data?.errorMessages?.join(", ") || error.message}`,
        },
      ],
      isError: true,
    };
  }
}