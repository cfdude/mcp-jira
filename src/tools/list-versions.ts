/**
 * List project versions for release planning
 */
import { withJiraContext } from '../utils/tool-wrapper.js';
import { ListVersionsArgs } from '../types.js';
import type { SessionState } from '../session-manager.js';

export async function handleListVersions(args: ListVersionsArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { requiresProject: true },
    async (toolArgs, { axiosInstance, projectKey }) => {
      try {
        const response = await axiosInstance.get(`/project/${projectKey}/versions`);

        const versions = response.data;

        // Format versions with useful information
        const formattedVersions = versions.map((version: any) => ({
          id: version.id,
          name: version.name,
          description: version.description || 'No description',
          released: version.released,
          archived: version.archived,
          startDate: version.startDate || 'Not set',
          releaseDate: version.releaseDate || 'Not set',
          overdue: version.overdue || false,
          userStartDate: version.userStartDate || 'Not set',
          userReleaseDate: version.userReleaseDate || 'Not set',
          projectId: version.projectId,
          self: version.self,
        }));

        // Separate into different categories for better visibility
        const activeVersions = formattedVersions.filter((v: any) => !v.released && !v.archived);
        const releasedVersions = formattedVersions.filter((v: any) => v.released);
        const archivedVersions = formattedVersions.filter((v: any) => v.archived);

        return {
          content: [
            {
              type: 'text',
              text: `# Project Versions for ${projectKey}

## Active Versions (${activeVersions.length})
${
  activeVersions.length > 0
    ? activeVersions
        .map(
          (v: any) =>
            `- **${v.name}** (ID: ${v.id})
  - Description: ${v.description}
  - Start Date: ${v.startDate}
  - Release Date: ${v.releaseDate}
  - Status: ${v.overdue ? '⚠️ Overdue' : '✅ On Track'}`
        )
        .join('\n\n')
    : 'No active versions found.'
}

## Released Versions (${releasedVersions.length})
${
  releasedVersions.length > 0
    ? releasedVersions
        .slice(0, 5)
        .map((v: any) => `- **${v.name}** (ID: ${v.id}) - Released: ${v.releaseDate}`)
        .join('\n')
    : 'No released versions found.'
}${releasedVersions.length > 5 ? `\n... and ${releasedVersions.length - 5} more` : ''}

## Archived Versions (${archivedVersions.length})
${
  archivedVersions.length > 0
    ? `${archivedVersions.length} archived versions available`
    : 'No archived versions found.'
}

Total versions: ${formattedVersions.length}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error listing versions: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
    session
  );
}
