/**
 * Handler for the get_sprint_report tool
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getInstanceForProject } from "../config.js";
import { createJiraApiInstances } from "../utils/jira-api.js";
import { GetSprintReportArgs } from "../types.js";

export async function handleGetSprintReport(args: GetSprintReportArgs) {
  const { working_dir, instance, boardId, sprintId } = args;
  
  // Get the instance configuration (no project key needed for sprint reports)
  const instanceConfig = await getInstanceForProject(working_dir, undefined, instance);
  const { agileAxiosInstance } = await createJiraApiInstances(instanceConfig);
  
  console.error("Getting sprint report:", {
    boardId,
    sprintId
  });

  try {
    // Get sprint details
    const sprintResponse = await agileAxiosInstance.get(`/sprint/${sprintId}`);
    const sprint = sprintResponse.data;
    
    // Get sprint issues
    const issuesResponse = await agileAxiosInstance.get(`/sprint/${sprintId}/issue`);
    const issues = issuesResponse.data.issues || [];
    
    // Get board details for context
    const boardResponse = await agileAxiosInstance.get(`/board/${boardId}`);
    const board = boardResponse.data;

    // Calculate comprehensive sprint metrics
    const totalIssues = issues.length;
    
    // Status categorization
    const statusBreakdown = issues.reduce((acc: any, issue: any) => {
      const status = issue.fields.status.name;
      const category = issue.fields.status.statusCategory.key;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const completedIssues = issues.filter((issue: any) => 
      issue.fields.status.statusCategory.key === 'done'
    ).length;
    const inProgressIssues = issues.filter((issue: any) => 
      issue.fields.status.statusCategory.key === 'indeterminate'
    ).length;
    const todoIssues = issues.filter((issue: any) => 
      issue.fields.status.statusCategory.key === 'new'
    ).length;

    // Issue type breakdown
    const typeBreakdown = issues.reduce((acc: any, issue: any) => {
      const type = issue.fields.issuetype.name;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Priority breakdown
    const priorityBreakdown = issues.reduce((acc: any, issue: any) => {
      const priority = issue.fields.priority?.name || 'None';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});

    // Story points analysis
    let totalStoryPoints = 0;
    let completedStoryPoints = 0;
    let storyPointsByStatus: any = {};
    
    issues.forEach((issue: any) => {
      const storyPoints = issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
      const status = issue.fields.status.statusCategory.key;
      if (storyPoints) {
        totalStoryPoints += storyPoints;
        if (status === 'done') {
          completedStoryPoints += storyPoints;
        }
        storyPointsByStatus[status] = (storyPointsByStatus[status] || 0) + storyPoints;
      }
    });

    // Assignee analysis
    const assigneeBreakdown = issues.reduce((acc: any, issue: any) => {
      const assignee = issue.fields.assignee?.displayName || 'Unassigned';
      acc[assignee] = (acc[assignee] || 0) + 1;
      return acc;
    }, {});

    // Calculate percentages
    const completionPercentage = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;
    const storyPointsCompletion = totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0;

    // Sprint duration analysis
    let sprintDuration = 'Unknown';
    let daysElapsed = 'Unknown';
    if (sprint.startDate && sprint.endDate) {
      const start = new Date(sprint.startDate);
      const end = new Date(sprint.endDate);
      const now = new Date();
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const elapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      sprintDuration = `${totalDays} days`;
      daysElapsed = `${Math.max(0, elapsed)} days`;
    }

    return {
      content: [
        {
          type: "text",
          text: `📊 **Sprint Report: ${sprint.name}**

**Sprint Overview:**
- **Sprint ID:** ${sprintId}
- **Board:** ${board.name} (ID: ${boardId})
- **State:** ${sprint.state}
- **Duration:** ${sprintDuration}
- **Days Elapsed:** ${daysElapsed}
${sprint.goal ? `- **Goal:** ${sprint.goal}` : ''}
${sprint.startDate ? `- **Start Date:** ${new Date(sprint.startDate).toLocaleDateString()}` : ''}
${sprint.endDate ? `- **End Date:** ${new Date(sprint.endDate).toLocaleDateString()}` : ''}

**Progress Metrics:**
- **Total Issues:** ${totalIssues}
- **Completed:** ${completedIssues} (${completionPercentage}%)
- **In Progress:** ${inProgressIssues}
- **To Do:** ${todoIssues}

${totalStoryPoints > 0 ? `**Story Points:**
- **Total Committed:** ${totalStoryPoints}
- **Completed:** ${completedStoryPoints} (${storyPointsCompletion}%)
- **Remaining:** ${totalStoryPoints - completedStoryPoints}

**Story Points by Category:**
${Object.entries(storyPointsByStatus).map(([status, points]) => 
  `- **${status}:** ${points} points`
).join('\n')}

` : ''}**Issue Breakdown by Status:**
${Object.entries(statusBreakdown).map(([status, count]) => 
  `- **${status}:** ${count}`
).join('\n')}

**Issue Breakdown by Type:**
${Object.entries(typeBreakdown).map(([type, count]) => 
  `- **${type}:** ${count}`
).join('\n')}

**Issue Breakdown by Priority:**
${Object.entries(priorityBreakdown).map(([priority, count]) => 
  `- **${priority}:** ${count}`
).join('\n')}

**Workload by Assignee:**
${Object.entries(assigneeBreakdown).map(([assignee, count]) => 
  `- **${assignee}:** ${count} issue(s)`
).join('\n')}

---
*Use \`get_velocity_chart_data\` for historical velocity analysis or \`get_burndown_chart_data\` for daily progress tracking.*`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error getting sprint report:", error);
    
    if (error.response?.status === 404) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Sprint ${sprintId} or Board ${boardId} not found`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get sprint report: ${error.response?.data?.message || error.message}`
    );
  }
}