/**
 * Create a new project component for feature organization
 */
import { AxiosInstance } from "axios";

export async function handleCreateComponent(
  axiosInstance: AxiosInstance,
  projectKey: string,
  args: any
) {
  try {
    const componentData: any = {
      name: args.name,
      project: projectKey,
    };

    // Add optional fields if provided
    if (args.description) {
      componentData.description = args.description;
    }
    if (args.leadAccountId) {
      componentData.leadAccountId = args.leadAccountId;
    }
    if (args.assigneeType) {
      componentData.assigneeType = args.assigneeType;
    }

    const response = await axiosInstance.post(
      `/rest/api/3/component`,
      componentData
    );

    const component = response.data;

    return {
      content: [
        {
          type: "text",
          text: `# Component Created Successfully

**${component.name}** (ID: ${component.id})

- **Project**: ${projectKey}
- **Description**: ${component.description || "No description"}
- **Component Lead**: ${component.lead?.displayName || "No lead assigned"}
- **Assignee Type**: ${component.assigneeType || "PROJECT_DEFAULT"}

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
          type: "text",
          text: `Error creating component: ${error.response?.data?.errorMessages?.join(", ") || error.message}`,
        },
      ],
      isError: true,
    };
  }
}