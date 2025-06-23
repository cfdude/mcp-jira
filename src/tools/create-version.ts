/**
 * Create a new project version/release
 */
import { withJiraContext } from "../utils/tool-wrapper.js";
import { CreateVersionArgs } from "../types.js";

export async function handleCreateVersion(args: CreateVersionArgs) {
  return withJiraContext(
    args,
    { requiresProject: true },
    async (toolArgs, { axiosInstance, projectKey }) => {
      try {
        const versionData: any = {
          name: toolArgs.name,
          projectId: projectKey,
        };

        // Add optional fields if provided
        if (toolArgs.description) {
          versionData.description = toolArgs.description;
        }
        if (toolArgs.startDate) {
          versionData.startDate = toolArgs.startDate;
        }
        if (toolArgs.releaseDate) {
          versionData.releaseDate = toolArgs.releaseDate;
        }
        if (toolArgs.archived !== undefined) {
          versionData.archived = toolArgs.archived;
        }
        if (toolArgs.released !== undefined) {
          versionData.released = toolArgs.released;
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
  );
}