/**
 * List project components for feature organization
 */
import { withJiraContext } from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

interface ListComponentsArgs {
  working_dir: string;
  instance?: string;
  projectKey?: string;
}

export async function handleListComponents(args: ListComponentsArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { axiosInstance, projectKey: resolvedProjectKey }) => {
      const projectKey = toolArgs.projectKey || resolvedProjectKey;

      if (!projectKey) {
        throw new Error('projectKey is required for listing components');
      }

      try {
        const response = await axiosInstance.get(`/project/${projectKey}/components`);

        const components = response.data;

        // Format components with useful information
        const formattedComponents = components.map((component: any) => ({
          id: component.id,
          name: component.name,
          description: component.description || 'No description',
          lead: component.lead?.displayName || 'No lead assigned',
          leadAccountId: component.lead?.accountId || null,
          assigneeType: component.assigneeType || 'PROJECT_DEFAULT',
          isAssigneeTypeValid: component.isAssigneeTypeValid,
          projectId: component.projectId,
          project: component.project,
          self: component.self,
        }));

        // Sort components by name
        formattedComponents.sort((a: any, b: any) => a.name.localeCompare(b.name));

        return {
          content: [
            {
              type: 'text',
              text: `# Project Components for ${projectKey}

## 🔧 Components Overview
Total components: ${formattedComponents.length}

${
  formattedComponents.length > 0
    ? formattedComponents
        .map(
          (component: any) =>
            `### ${component.name} (ID: ${component.id})
- **Description**: ${component.description}
- **Component Lead**: ${component.lead}
- **Assignee Type**: ${component.assigneeType}
- **Valid Assignment**: ${component.isAssigneeTypeValid ? '✅ Yes' : '❌ No'}`
        )
        .join('\n\n')
    : 'No components found for this project.'
}

## 💡 Usage Tips
- Components help organize work by feature areas or system modules
- Each component can have a dedicated lead responsible for that area
- Use components in issue creation to categorize work effectively
- Filter issues by component to focus on specific feature areas`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error listing components: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
    session
  );
}
