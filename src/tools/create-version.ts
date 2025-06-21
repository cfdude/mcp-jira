/**
 * Create a new project version/release
 */
import { AxiosInstance } from "axios";

export async function handleCreateVersion(
  axiosInstance: AxiosInstance,
  projectKey: string,
  args: any
) {
  try {
    const versionData: any = {
      name: args.name,
      projectId: projectKey,
    };

    // Add optional fields if provided
    if (args.description) {
      versionData.description = args.description;
    }
    if (args.startDate) {
      versionData.startDate = args.startDate;
    }
    if (args.releaseDate) {
      versionData.releaseDate = args.releaseDate;
    }
    if (args.archived !== undefined) {
      versionData.archived = args.archived;
    }
    if (args.released !== undefined) {
      versionData.released = args.released;
    }

    const response = await axiosInstance.post(
      `/rest/api/3/version`,
      versionData
    );

    const version = response.data;

    return {
      content: [
        {
          type: "text",
          text: `# Version Created Successfully

**${version.name}** (ID: ${version.id})

- **Project**: ${projectKey}
- **Description**: ${version.description || "No description"}
- **Start Date**: ${version.startDate || "Not set"}
- **Release Date**: ${version.releaseDate || "Not set"}
- **Status**: ${version.released ? "Released" : version.archived ? "Archived" : "Active"}

Version is ready for use in project planning and issue assignment.`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error creating version: ${error.response?.data?.errorMessages?.join(", ") || error.message}`,
        },
      ],
      isError: true,
    };
  }
}