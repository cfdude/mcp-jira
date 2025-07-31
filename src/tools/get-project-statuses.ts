/**
 * Get project-specific statuses for workflow understanding
 */
import { withJiraContext } from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

interface GetProjectStatusesArgs {
  working_dir: string;
  instance?: string;
  projectKey?: string;
}

export async function handleGetProjectStatuses(
  args: GetProjectStatusesArgs,
  session?: SessionState
) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { axiosInstance, projectKey: resolvedProjectKey }) => {
      const projectKey = toolArgs.projectKey || resolvedProjectKey;

      if (!projectKey) {
        throw new Error('projectKey is required for getting project statuses');
      }

      try {
        // Get project statuses
        const response = await axiosInstance.get(`/project/${projectKey}/statuses`);

        const statusData = response.data;

        // Get additional workflow information
        const workflowsResponse = await axiosInstance
          .get(`/workflows/search`, {
            params: {
              projectId: projectKey,
              expand: 'transitions,statuses',
            },
          })
          .catch(() => ({ data: { values: [] } }));

        const workflows = workflowsResponse.data.values || [];

        // Process status information by issue type
        const statusesByIssueType: { [key: string]: any } = {};

        statusData.forEach((issueTypeStatus: any) => {
          const issueType = issueTypeStatus.issueType;
          const statuses = issueTypeStatus.statuses || [];

          statusesByIssueType[issueType.name] = {
            issueType: issueType,
            statuses: statuses.map((status: any) => ({
              id: status.id,
              name: status.name,
              description: status.description || 'No description',
              categoryKey: status.statusCategory?.key || 'unknown',
              categoryName: status.statusCategory?.name || 'Unknown',
              categoryColorName: status.statusCategory?.colorName || 'medium-gray',
            })),
          };
        });

        // Analyze status categories
        const categoryStats: { [key: string]: number } = {};
        Object.values(statusesByIssueType).forEach((typeData: any) => {
          typeData.statuses.forEach((status: any) => {
            categoryStats[status.categoryName] = (categoryStats[status.categoryName] || 0) + 1;
          });
        });

        // Get unique statuses across all issue types
        const allStatuses = new Set<string>();
        const statusDetails: { [key: string]: any } = {};

        Object.values(statusesByIssueType).forEach((typeData: any) => {
          typeData.statuses.forEach((status: any) => {
            allStatuses.add(status.name);
            if (!statusDetails[status.name]) {
              statusDetails[status.name] = status;
            }
          });
        });

        return {
          content: [
            {
              type: 'text',
              text: `# Project Workflow Statuses: ${projectKey}

## 📊 Overview
- **Issue Types**: ${Object.keys(statusesByIssueType).length}
- **Unique Statuses**: ${allStatuses.size}
- **Workflows**: ${workflows.length}

## 📋 Status Categories
${Object.entries(categoryStats)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .map(([category, count]) => {
    let emoji = '⚪';
    switch (category.toLowerCase()) {
      case 'to do':
        emoji = '🔵';
        break;
      case 'in progress':
        emoji = '🟡';
        break;
      case 'done':
        emoji = '🟢';
        break;
    }
    return `${emoji} **${category}**: ${count} statuses`;
  })
  .join('\n')}

## 🔄 Statuses by Issue Type

${Object.entries(statusesByIssueType)
  .map(
    ([issueTypeName, typeData]: [string, any]) =>
      `### ${issueTypeName} (${typeData.statuses.length} statuses)
${typeData.statuses
  .map((status: any) => {
    let emoji = '⚪';
    switch (status.categoryKey) {
      case 'new':
        emoji = '🔵';
        break;
      case 'indeterminate':
        emoji = '🟡';
        break;
      case 'done':
        emoji = '🟢';
        break;
    }
    return `${emoji} **${status.name}** (${status.categoryName})${status.description !== 'No description' ? ` - ${status.description}` : ''}`;
  })
  .join('\n')}`
  )
  .join('\n\n')}

## 🌊 Workflow Information
${
  workflows.length > 0
    ? workflows
        .map(
          (workflow: any) =>
            `### ${workflow.name}
- **ID**: ${workflow.entityId}
- **Description**: ${workflow.description || 'No description'}
- **Status Count**: ${workflow.statuses?.length || 'Unknown'}
- **Transition Count**: ${workflow.transitions?.length || 'Unknown'}
- **Active**: ${workflow.isActive ? '✅ Yes' : '❌ No'}
${
  workflow.statuses && workflow.statuses.length > 0
    ? `- **Statuses**: ${workflow.statuses.map((s: any) => s.name).join(', ')}`
    : ''
}`
        )
        .join('\n\n')
    : 'No workflow information available.'
}

## 📈 All Unique Statuses
${Array.from(allStatuses)
  .sort()
  .map(statusName => {
    const status = statusDetails[statusName];
    let emoji = '⚪';
    switch (status.categoryKey) {
      case 'new':
        emoji = '🔵';
        break;
      case 'indeterminate':
        emoji = '🟡';
        break;
      case 'done':
        emoji = '🟢';
        break;
    }
    return `${emoji} **${statusName}** (${status.categoryName})`;
  })
  .join('\n')}

## 💡 Workflow Insights
- **Status Distribution**: ${categoryStats['To Do'] || 0} start, ${categoryStats['In Progress'] || 0} active, ${categoryStats['Done'] || 0} end states
- **Complexity**: ${allStatuses.size > 10 ? 'High - Consider simplifying workflow' : allStatuses.size > 5 ? 'Medium - Good balance' : 'Low - Simple workflow'}
- **Consistency**: ${Object.keys(statusesByIssueType).length > 1 ? 'Multiple issue types may have different workflows' : 'Single issue type workflow'}

## 🔧 Configuration Tips
- Keep workflows simple and intuitive for team members
- Ensure status categories are properly configured (To Do, In Progress, Done)
- Use descriptive status names that reflect actual work states
- Consider consolidating similar statuses across issue types
- Regular workflow review helps maintain efficiency`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error getting project statuses: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
    session
  );
}
