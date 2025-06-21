/**
 * Handler for the get_board_cumulative_flow tool
 */
import { AxiosInstance } from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

interface GetBoardCumulativeFlowArgs {
  working_dir: string;
  boardId: number;
}

export async function handleGetBoardCumulativeFlow(
  agileAxiosInstance: AxiosInstance,
  args: GetBoardCumulativeFlowArgs
) {
  const { boardId } = args;
  
  console.error("Getting board cumulative flow data:", {
    boardId
  });

  try {
    // Get board details
    const boardResponse = await agileAxiosInstance.get(`/board/${boardId}`);
    const board = boardResponse.data;
    
    // Get board configuration to understand columns
    const configResponse = await agileAxiosInstance.get(`/board/${boardId}/configuration`);
    const config = configResponse.data;
    
    // Get all issues on the board
    const issuesResponse = await agileAxiosInstance.get(`/board/${boardId}/issue`, {
      params: { maxResults: 1000 }
    });
    const issues = issuesResponse.data.issues || [];

    if (issues.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `📊 **Cumulative Flow Diagram for ${board.name}**

No issues found on this board.`,
          },
        ],
      };
    }

    // Analyze current flow state
    const statusFlow: any = {};
    const columns = config.columnConfig?.columns || [];
    
    // Initialize status flow with board columns
    columns.forEach((column: any) => {
      statusFlow[column.name] = {
        issues: 0,
        storyPoints: 0,
        statuses: column.statuses?.map((s: any) => s.id) || []
      };
    });

    // Add "Other" category for statuses not in columns
    statusFlow['Other'] = {
      issues: 0,
      storyPoints: 0,
      statuses: []
    };

    // Categorize issues by column/status
    issues.forEach((issue: any) => {
      const issueStatus = issue.fields.status.id;
      const storyPoints = issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
      
      // Find which column this status belongs to
      let foundColumn = false;
      for (const [columnName, columnData] of Object.entries(statusFlow)) {
        const columnInfo = columnData as any;
        if (columnInfo.statuses.includes(issueStatus)) {
          columnInfo.issues++;
          columnInfo.storyPoints += storyPoints;
          foundColumn = true;
          break;
        }
      }
      
      // If not found in any column, add to "Other"
      if (!foundColumn) {
        statusFlow['Other'].issues++;
        statusFlow['Other'].storyPoints += storyPoints;
        if (!statusFlow['Other'].statuses.includes(issueStatus)) {
          statusFlow['Other'].statuses.push(issueStatus);
        }
      }
    });

    // Remove "Other" if empty
    if (statusFlow['Other'].issues === 0) {
      delete statusFlow['Other'];
    }

    // Calculate flow metrics
    const totalIssues = issues.length;
    const totalStoryPoints = issues.reduce((sum: number, issue: any) => {
      const storyPoints = issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
      return sum + storyPoints;
    }, 0);

    // Identify bottlenecks (columns with high WIP)
    const wipLimits: any = {};
    columns.forEach((column: any) => {
      if (column.max) {
        wipLimits[column.name] = {
          limit: column.max,
          current: statusFlow[column.name]?.issues || 0,
          exceeded: (statusFlow[column.name]?.issues || 0) > column.max
        };
      }
    });

    // Calculate lead time estimation (simplified)
    const todoIssues = issues.filter((issue: any) => 
      issue.fields.status.statusCategory.key === 'new'
    ).length;
    const inProgressIssues = issues.filter((issue: any) => 
      issue.fields.status.statusCategory.key === 'indeterminate'
    ).length;
    const doneIssues = issues.filter((issue: any) => 
      issue.fields.status.statusCategory.key === 'done'
    ).length;

    return {
      content: [
        {
          type: "text",
          text: `📊 **Cumulative Flow Diagram for ${board.name}**

**Board Overview:**
- **Total Issues:** ${totalIssues}
- **Total Story Points:** ${totalStoryPoints}
- **Board Type:** ${board.type}

**Current Flow Distribution:**
${Object.entries(statusFlow).map(([columnName, data]: [string, any]) => {
  const percentage = totalIssues > 0 ? Math.round((data.issues / totalIssues) * 100) : 0;
  return `**${columnName}:**
  - Issues: ${data.issues} (${percentage}%)
  - Story Points: ${data.storyPoints}`;
}).join('\n\n')}

**High-Level Flow Categories:**
- **To Do:** ${todoIssues} issues
- **In Progress:** ${inProgressIssues} issues  
- **Done:** ${doneIssues} issues

${Object.keys(wipLimits).length > 0 ? `**WIP Limits Analysis:**
${Object.entries(wipLimits).map(([column, limit]: [string, any]) => 
  `- **${column}:** ${limit.current}/${limit.limit} ${limit.exceeded ? '⚠️ EXCEEDED' : '✅'}`
).join('\n')}

` : ''}**Flow Health Indicators:**
- **Work Distribution:** ${inProgressIssues > todoIssues ? '⚠️ Too much WIP' : '✅ Balanced'}
- **Completion Rate:** ${Math.round((doneIssues / totalIssues) * 100)}%
- **Bottleneck Risk:** ${Object.values(wipLimits).some((l: any) => l.exceeded) ? '🔴 High (WIP limits exceeded)' : '🟢 Low'}

**Column Configuration:**
${columns.map((column: any) => {
  const statusCount = column.statuses?.length || 0;
  return `- **${column.name}:** ${statusCount} status(es)${column.min ? ` [Min: ${column.min}]` : ''}${column.max ? ` [Max: ${column.max}]` : ''}`;
}).join('\n')}

---
*This analysis shows current work distribution. For historical trends, use \`get_velocity_chart_data\` or \`get_sprint_report\`.*`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error getting board cumulative flow data:", error);
    
    if (error.response?.status === 404) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Board ${boardId} not found`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get board cumulative flow data: ${error.response?.data?.message || error.message}`
    );
  }
}