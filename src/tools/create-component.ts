/**
 * Create a new project component for feature organization
 */
import { withJiraContext } from '../utils/tool-wrapper.js';

interface CreateComponentArgs {
  working_dir: string;
  instance?: string;
  projectKey?: string;
  name: string;
  description?: string;
  leadAccountId?: string;
  assigneeType?: string;
}

export async function handleCreateComponent(args: CreateComponentArgs) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { axiosInstance, projectKey: resolvedProjectKey }) => {
      const projectKey = toolArgs.projectKey || resolvedProjectKey;

      if (!projectKey) {
        throw new Error('projectKey is required for creating component');
      }

      try {
        const componentData: any = {
          name: toolArgs.name,
          project: projectKey,
        };

        // Add optional fields if provided
        if (toolArgs.description) {
          componentData.description = toolArgs.description;
        }
        if (toolArgs.leadAccountId) {
          componentData.leadAccountId = toolArgs.leadAccountId;
        }
        if (toolArgs.assigneeType) {
          componentData.assigneeType = toolArgs.assigneeType;
        }

        const response = await axiosInstance.post(`/component`, componentData);

        const component = response.data;

        return {
          content: [
            {
              type: 'text',
              text: `# Component Created Successfully

**${component.name}** (ID: ${component.id})

- **Project**: ${projectKey}
- **Description**: ${component.description || 'No description'}
- **Component Lead**: ${component.lead?.displayName || 'No lead assigned'}
- **Assignee Type**: ${component.assigneeType || 'PROJECT_DEFAULT'}

## Next Steps
- Start using this component when creating new issues
- Assign issues to this component to organize work by feature area
- Consider setting up filters to track progress within this component
- Update the component lead if needed for better ownership

Component is ready for use in project organization and issue assignment.`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating component: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
