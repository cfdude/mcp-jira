/**
 * Handler for the get_velocity_chart_data tool
 */
import { AxiosInstance } from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

interface GetVelocityChartDataArgs {
  working_dir: string;
  boardId: number;
  numberOfSprints?: number;
}

export async function handleGetVelocityChartData(
  agileAxiosInstance: AxiosInstance,
  args: GetVelocityChartDataArgs
) {
  const { boardId, numberOfSprints = 10 } = args;
  
  console.error("Getting velocity chart data:", {
    boardId,
    numberOfSprints
  });

  try {
    // Get board details
    const boardResponse = await agileAxiosInstance.get(`/board/${boardId}`);
    const board = boardResponse.data;
    
    // Get recent sprints (closed ones for velocity calculation)
    const sprintsResponse = await agileAxiosInstance.get(`/board/${boardId}/sprint`, {
      params: { 
        state: 'closed',
        maxResults: numberOfSprints
      }
    });
    const sprints = sprintsResponse.data.values || [];

    if (sprints.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `📊 **Velocity Chart Data for ${board.name}**

No completed sprints found for velocity calculation.

Complete at least one sprint to see velocity data.`,
          },
        ],
      };
    }

    // Calculate velocity for each sprint
    const velocityData = [];
    let totalStoryPoints = 0;
    let totalIssues = 0;

    for (const sprint of sprints.reverse()) { // Most recent first
      try {
        const issuesResponse = await agileAxiosInstance.get(`/sprint/${sprint.id}/issue`);
        const issues = issuesResponse.data.issues || [];
        
        // Calculate completed story points and issues
        let sprintStoryPoints = 0;
        let completedIssues = 0;
        
        issues.forEach((issue: any) => {
          if (issue.fields.status.statusCategory.key === 'done') {
            completedIssues++;
            const storyPoints = issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
            if (storyPoints) {
              sprintStoryPoints += storyPoints;
            }
          }
        });

        velocityData.push({
          sprintName: sprint.name,
          sprintId: sprint.id,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          completedStoryPoints: sprintStoryPoints,
          completedIssues: completedIssues,
          totalIssues: issues.length
        });

        totalStoryPoints += sprintStoryPoints;
        totalIssues += completedIssues;
      } catch (sprintError) {
        console.error(`Error getting data for sprint ${sprint.id}:`, sprintError);
        velocityData.push({
          sprintName: sprint.name,
          sprintId: sprint.id,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          completedStoryPoints: 0,
          completedIssues: 0,
          totalIssues: 0,
          error: 'Data unavailable'
        });
      }
    }

    // Calculate averages
    const averageVelocity = velocityData.length > 0 ? Math.round(totalStoryPoints / velocityData.length) : 0;
    const averageIssues = velocityData.length > 0 ? Math.round(totalIssues / velocityData.length) : 0;

    // Find best and worst sprints
    const validSprints = velocityData.filter(s => !s.error);
    const bestSprint = validSprints.reduce((best, current) => 
      current.completedStoryPoints > best.completedStoryPoints ? current : best, validSprints[0] || null);
    const worstSprint = validSprints.reduce((worst, current) => 
      current.completedStoryPoints < worst.completedStoryPoints ? current : worst, validSprints[0] || null);

    return {
      content: [
        {
          type: "text",
          text: `📊 **Velocity Chart Data for ${board.name}**

**Summary:**
- **Sprints Analyzed:** ${velocityData.length}
- **Average Velocity:** ${averageVelocity} story points/sprint
- **Average Issues Completed:** ${averageIssues} issues/sprint

${bestSprint ? `**Best Sprint:** ${bestSprint.sprintName} (${bestSprint.completedStoryPoints} points)` : ''}
${worstSprint ? `**Lowest Sprint:** ${worstSprint.sprintName} (${worstSprint.completedStoryPoints} points)` : ''}

**Sprint-by-Sprint Velocity:**
${velocityData.map((sprint, index) => {
  const endDate = sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : 'Ongoing';
  return `${index + 1}. **${sprint.sprintName}** (Ended: ${endDate})
   - Story Points: ${sprint.completedStoryPoints}
   - Issues Completed: ${sprint.completedIssues}/${sprint.totalIssues}
   ${sprint.error ? `   - ⚠️ ${sprint.error}` : ''}`;
}).join('\n\n')}

**Velocity Trend:**
${velocityData.length >= 3 ? (() => {
  const recent3 = velocityData.slice(-3);
  const recentAvg = Math.round(recent3.reduce((sum, s) => sum + s.completedStoryPoints, 0) / 3);
  const comparison = recentAvg > averageVelocity ? '📈 Increasing' : 
                    recentAvg < averageVelocity ? '📉 Decreasing' : '➡️ Stable';
  return `Recent 3 sprints average: ${recentAvg} points (${comparison})`;
})() : 'Need more sprints for trend analysis'}

---
*Use \`get_sprint_report\` for detailed analysis of individual sprints.*`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error getting velocity chart data:", error);
    
    if (error.response?.status === 404) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Board ${boardId} not found`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get velocity chart data: ${error.response?.data?.message || error.message}`
    );
  }
}