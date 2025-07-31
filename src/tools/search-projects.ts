/**
 * Search for projects with filtering capabilities
 */
import { withJiraContext } from '../utils/tool-wrapper.js';
import { SearchProjectsArgs } from '../types.js';

export async function handleSearchProjects(args: SearchProjectsArgs) {
  return withJiraContext(args, { requiresProject: false }, async (toolArgs, { axiosInstance }) => {
    try {
      const params: any = {};

      // Add search parameters
      if (toolArgs.query) {
        params.query = toolArgs.query;
      }
      if (toolArgs.typeKey) {
        params.typeKey = toolArgs.typeKey;
      }
      if (toolArgs.categoryId) {
        params.categoryId = toolArgs.categoryId;
      }
      if (toolArgs.action) {
        params.action = toolArgs.action;
      }
      if (toolArgs.expand) {
        params.expand = toolArgs.expand;
      }
      if (toolArgs.status) {
        params.status = toolArgs.status;
      }
      if (toolArgs.properties) {
        params.properties = toolArgs.properties;
      }
      if (toolArgs.propertyQuery) {
        params.propertyQuery = toolArgs.propertyQuery;
      }

      // Pagination
      params.startAt = toolArgs.startAt || 0;
      params.maxResults = toolArgs.maxResults || 50;

      const response = await axiosInstance.get(`/project/search`, { params });

      const data = response.data;
      const projects = data.values || [];

      // Format projects with useful information
      const formattedProjects = projects.map((project: any) => ({
        id: project.id,
        key: project.key,
        name: project.name,
        description: project.description || 'No description',
        projectTypeKey: project.projectTypeKey,
        projectCategory: project.projectCategory?.name || 'No category',
        lead: project.lead?.displayName || 'No lead',
        leadAccountId: project.lead?.accountId || null,
        url: project.url || 'No URL',
        email: project.email || 'No email',
        assigneeType: project.assigneeType || 'UNASSIGNED',
        avatarUrls: project.avatarUrls,
        components: project.components?.length || 0,
        versions: project.versions?.length || 0,
        roles: project.roles ? Object.keys(project.roles).length : 0,
        insight: project.insight || null,
        deleted: project.deleted || false,
        retentionTillDate: project.retentionTillDate || null,
        deletedDate: project.deletedDate || null,
        deletedBy: project.deletedBy || null,
        archived: project.archived || false,
        archivedDate: project.archivedDate || null,
        archivedBy: project.archivedBy || null,
      }));

      // Separate into categories
      const activeProjects = formattedProjects.filter((p: any) => !p.deleted && !p.archived);
      const archivedProjects = formattedProjects.filter((p: any) => p.archived);
      const deletedProjects = formattedProjects.filter((p: any) => p.deleted);

      return {
        content: [
          {
            type: 'text',
            text: `# Project Search Results

## 📊 Search Summary
- **Query**: ${toolArgs.query || 'All projects'}
- **Total Found**: ${data.total || formattedProjects.length}
- **Showing**: ${formattedProjects.length} projects
- **Active**: ${activeProjects.length}
- **Archived**: ${archivedProjects.length}
- **Deleted**: ${deletedProjects.length}

## 🚀 Active Projects (${activeProjects.length})
${
  activeProjects.length > 0
    ? activeProjects
        .map(
          (project: any) =>
            `### ${project.name} (${project.key})
- **ID**: ${project.id}
- **Description**: ${project.description}
- **Type**: ${project.projectTypeKey}
- **Category**: ${project.projectCategory}
- **Lead**: ${project.lead}
- **Components**: ${project.components}
- **Versions**: ${project.versions}
- **Roles**: ${project.roles}`
        )
        .join('\n\n')
    : 'No active projects found.'
}

${
  archivedProjects.length > 0
    ? `
## 📦 Archived Projects (${archivedProjects.length})
${archivedProjects
  .slice(0, 5)
  .map(
    (project: any) =>
      `- **${project.name}** (${project.key}) - Archived: ${project.archivedDate || 'Unknown'}`
  )
  .join('\n')}${archivedProjects.length > 5 ? `\n... and ${archivedProjects.length - 5} more` : ''}
`
    : ''
}

${
  deletedProjects.length > 0
    ? `
## 🗑️ Deleted Projects (${deletedProjects.length})
${deletedProjects
  .slice(0, 3)
  .map(
    (project: any) =>
      `- **${project.name}** (${project.key}) - Deleted: ${project.deletedDate || 'Unknown'}`
  )
  .join('\n')}${deletedProjects.length > 3 ? `\n... and ${deletedProjects.length - 3} more` : ''}
`
    : ''
}

## 🔍 Search Tips
- Use \`query\` parameter to search by name or key
- Filter by \`typeKey\` (software, service_desk, business)
- Use \`status\` parameter (live, archived, deleted)
- Add \`expand\` parameter for more details (description, lead, url, projectKeys, insight)`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error searching projects: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}
