/**
 * Handler for the get_burndown_chart_data tool
 */
import { withJiraContext } from '../utils/tool-wrapper.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface GetBurndownChartDataArgs {
  working_dir: string;
  instance?: string;
  sprintId: number;
}

export async function handleGetBurndownChartData(args: GetBurndownChartDataArgs) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { agileAxiosInstance }) => {
      const { sprintId } = toolArgs;

      console.error('Getting burndown chart data:', {
        sprintId,
      });

      try {
        // Get sprint details
        const sprintResponse = await agileAxiosInstance.get(`/sprint/${sprintId}`);
        const sprint = sprintResponse.data;

        // Get sprint issues
        const issuesResponse = await agileAxiosInstance.get(`/sprint/${sprintId}/issue`);
        const issues = issuesResponse.data.issues || [];

        if (!sprint.startDate) {
          return {
            content: [
              {
                type: 'text',
                text: `📊 **Burndown Chart Data for Sprint: ${sprint.name}**

Sprint has not started yet. Burndown data will be available once the sprint begins.`,
              },
            ],
          };
        }

        // Calculate total scope
        let totalStoryPoints = 0;
        let totalIssues = issues.length;

        issues.forEach((issue: any) => {
          const storyPoints = issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
          if (storyPoints) {
            totalStoryPoints += storyPoints;
          }
        });

        // Calculate current progress
        let completedStoryPoints = 0;
        let completedIssues = 0;
        let inProgressIssues = 0;

        issues.forEach((issue: any) => {
          const status = issue.fields.status.statusCategory.key;
          if (status === 'done') {
            completedIssues++;
            const storyPoints =
              issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
            if (storyPoints) {
              completedStoryPoints += storyPoints;
            }
          } else if (status === 'indeterminate') {
            inProgressIssues++;
          }
        });

        // Calculate sprint timeline
        const startDate = new Date(sprint.startDate);
        const endDate = sprint.endDate
          ? new Date(sprint.endDate)
          : new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000); // Default 2 weeks
        const now = new Date();

        const totalDays = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysElapsed = Math.max(
          0,
          Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        const daysRemaining = Math.max(0, totalDays - daysElapsed);

        // Calculate ideal burndown
        const dailyIdealBurn = totalStoryPoints > 0 ? totalStoryPoints / totalDays : 0;
        const idealRemaining = Math.max(0, totalStoryPoints - dailyIdealBurn * daysElapsed);

        // Calculate actual remaining
        const actualRemaining = totalStoryPoints - completedStoryPoints;

        // Calculate projected completion
        let projectedCompletion = 'On track';
        if (daysElapsed > 0 && actualRemaining > 0) {
          const currentBurnRate = completedStoryPoints / daysElapsed;
          const projectedDaysToComplete =
            currentBurnRate > 0 ? actualRemaining / currentBurnRate : Infinity;

          if (projectedDaysToComplete > daysRemaining) {
            projectedCompletion = `⚠️ At risk (${Math.ceil(projectedDaysToComplete - daysRemaining)} days over)`;
          } else if (projectedDaysToComplete < daysRemaining * 0.8) {
            projectedCompletion = '🎯 Ahead of schedule';
          }
        }

        // Calculate team performance metrics
        const velocityPerDay = daysElapsed > 0 ? completedStoryPoints / daysElapsed : 0;
        const completionRate =
          totalStoryPoints > 0 ? (completedStoryPoints / totalStoryPoints) * 100 : 0;
        const timeElapsedPercentage = (daysElapsed / totalDays) * 100;

        return {
          content: [
            {
              type: 'text',
              text: `📊 **Burndown Chart Data for Sprint: ${sprint.name}**

**Sprint Timeline:**
- **Start Date:** ${startDate.toLocaleDateString()}
- **End Date:** ${endDate.toLocaleDateString()}
- **Total Duration:** ${totalDays} days
- **Days Elapsed:** ${daysElapsed} days (${Math.round(timeElapsedPercentage)}%)
- **Days Remaining:** ${daysRemaining} days

**Scope & Progress:**
- **Total Story Points:** ${totalStoryPoints}
- **Completed Story Points:** ${completedStoryPoints}
- **Remaining Story Points:** ${actualRemaining}
- **Total Issues:** ${totalIssues}
- **Completed Issues:** ${completedIssues}
- **In Progress Issues:** ${inProgressIssues}

**Burndown Analysis:**
- **Ideal Remaining (today):** ${Math.round(idealRemaining)} points
- **Actual Remaining:** ${actualRemaining} points
- **Variance:** ${actualRemaining - Math.round(idealRemaining)} points ${actualRemaining > idealRemaining ? '(behind)' : '(ahead)'}

**Performance Metrics:**
- **Daily Velocity:** ${velocityPerDay.toFixed(1)} points/day
- **Completion Rate:** ${completionRate.toFixed(1)}%
- **Time Elapsed:** ${timeElapsedPercentage.toFixed(1)}%
- **Projection:** ${projectedCompletion}

**Daily Burndown Simulation:**
${Array.from({ length: Math.min(totalDays, 15) }, (_, i) => {
  const day = i + 1;
  const idealForDay = Math.max(0, totalStoryPoints - dailyIdealBurn * day);
  const dayDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
  const isToday = day === daysElapsed;
  const isPast = day <= daysElapsed;

  return `Day ${day} (${dayDate.toLocaleDateString()}): ${Math.round(idealForDay)} points ${isToday ? '← Today' : isPast ? '(past)' : '(future)'}`;
}).join('\n')}
${totalDays > 15 ? '\n... (showing first 15 days)' : ''}

---
*This burndown shows ideal vs. actual progress. Use \`get_sprint_report\` for detailed issue analysis.*`,
            },
          ],
        };
      } catch (error: any) {
        console.error('Error getting burndown chart data:', error);

        if (error.response?.status === 404) {
          throw new McpError(ErrorCode.InvalidRequest, `Sprint ${sprintId} not found`);
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get burndown chart data: ${error.response?.data?.message || error.message}`
        );
      }
    }
  );
}
