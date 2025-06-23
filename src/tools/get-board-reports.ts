/**
 * Handler for the get_board_reports tool
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getInstanceForProject, createJiraApiInstances } from "../config.js";
import { BaseArgs } from "../types.js";

export interface GetBoardReportsArgs extends BaseArgs {
  boardId: number;
}

export async function handleGetBoardReports(args: GetBoardReportsArgs) {
  const { working_dir, instance, boardId } = args;
  
  // Get the instance configuration
  const instanceConfig = await getInstanceForProject(working_dir, undefined, instance);
  const { agileAxiosInstance } = await createJiraApiInstances(instanceConfig);
  
  console.error("Getting board reports for:", boardId);

  try {
    // Get board details first
    const boardResponse = await agileAxiosInstance.get(`/board/${boardId}`);
    const board = boardResponse.data;
    
    // Get available reports
    const reportsResponse = await agileAxiosInstance.get(`/board/${boardId}/reports`);
    const reports = reportsResponse.data.reports || [];
    
    // Get current board issues for basic metrics
    const issuesResponse = await agileAxiosInstance.get(`/board/${boardId}/issue`, {
      params: { maxResults: 1000 }
    });
    const issues = issuesResponse.data.issues || [];
    
    // Calculate basic metrics
    const totalIssues = issues.length;
    const issuesByStatus = issues.reduce((acc: any, issue: any) => {
      const status = issue.fields.status.name;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    const issuesByType = issues.reduce((acc: any, issue: any) => {
      const type = issue.fields.issuetype.name;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate story points if available
    let totalStoryPoints = 0;
    let storyPointsByStatus: any = {};
    issues.forEach((issue: any) => {
      const storyPoints = issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
      const status = issue.fields.status.name;
      if (storyPoints) {
        totalStoryPoints += storyPoints;
        storyPointsByStatus[status] = (storyPointsByStatus[status] || 0) + storyPoints;
      }
    });

    return {
      content: [
        {
          type: "text",
          text: `📊 **Board Reports: ${board.name}**

**Available Reports:**
${reports.length > 0 ? reports.map((report: any) => 
  `- **${report.name}**: ${report.description || 'No description'}`
).join('\n') : 'No specific reports available via API'}

**Current Board Metrics:**

**Issue Summary:**
- **Total Issues:** ${totalIssues}

**Issues by Status:**
${Object.entries(issuesByStatus).map(([status, count]) => 
  `- **${status}:** ${count}`
).join('\n')}

**Issues by Type:**
${Object.entries(issuesByType).map(([type, count]) => 
  `- **${type}:** ${count}`
).join('\n')}

${totalStoryPoints > 0 ? `**Story Points Analysis:**
- **Total Story Points:** ${totalStoryPoints}

**Story Points by Status:**
${Object.entries(storyPointsByStatus).map(([status, points]) => 
  `- **${status}:** ${points} points`
).join('\n')}
` : ''}

**Board Information:**
- **Board ID:** ${board.id}
- **Type:** ${board.type}
- **Project:** ${board.location?.projectKey || 'N/A'}

For detailed sprint analytics, use \`get_sprint_report\` with specific sprint IDs.`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error getting board reports:", error);
    
    if (error.response?.status === 404) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Board ${boardId} not found`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get board reports: ${error.response?.data?.message || error.message}`
    );
  }
}