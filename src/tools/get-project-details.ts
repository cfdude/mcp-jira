/**
 * Get comprehensive project details
 */
import { withJiraContext } from '../utils/tool-wrapper.js';

interface GetProjectDetailsArgs {
  working_dir: string;
  instance?: string;
  projectKey: string;
  expand?: string;
}

export async function handleGetProjectDetails(args: GetProjectDetailsArgs) {
  return withJiraContext(args, { requiresProject: false }, async (toolArgs, { axiosInstance }) => {
    try {
      const projectKey = toolArgs.projectKey;
      const expand =
        toolArgs.expand || 'description,lead,url,projectKeys,permissions,insight,features';

      // Get project details
      console.error(
        `[get-project-details] Requesting: /project/${projectKey} with expand: ${expand}`
      );
      const response = await axiosInstance.get(`/project/${projectKey}`, {
        params: { expand },
      });

      const project = response.data;

      // Get additional project information in parallel
      const additionalDataPromises = [];

      // Get project versions
      additionalDataPromises.push(
        axiosInstance
          .get(`/project/${projectKey}/versions`)
          .then((res) => ({ type: 'versions', data: res.data }))
          .catch(() => ({ type: 'versions', data: [] }))
      );

      // Get project components
      additionalDataPromises.push(
        axiosInstance
          .get(`/project/${projectKey}/components`)
          .then((res) => ({ type: 'components', data: res.data }))
          .catch(() => ({ type: 'components', data: [] }))
      );

      // Get project roles
      additionalDataPromises.push(
        axiosInstance
          .get(`/project/${projectKey}/role`)
          .then((res) => ({ type: 'roles', data: res.data }))
          .catch(() => ({ type: 'roles', data: {} }))
      );

      // Get project issue type hierarchy
      additionalDataPromises.push(
        axiosInstance
          .get(`/project/${projectKey}/hierarchy`)
          .then((res) => ({ type: 'hierarchy', data: res.data }))
          .catch(() => ({ type: 'hierarchy', data: [] }))
      );

      // Get project features (if available)
      additionalDataPromises.push(
        axiosInstance
          .get(`/project/${projectKey}/features`)
          .then((res) => ({ type: 'features', data: res.data }))
          .catch(() => ({ type: 'features', data: {} }))
      );

      const additionalData = await Promise.all(additionalDataPromises);
      const dataMap = additionalData.reduce((acc, item) => {
        acc[item.type] = item.data;
        return acc;
      }, {} as any);

      // Process versions
      const versions = dataMap.versions || [];
      const activeVersions = versions.filter((v: any) => !v.released && !v.archived);
      const releasedVersions = versions.filter((v: any) => v.released);

      // Process components
      const components = dataMap.components || [];

      // Process roles
      const roles = dataMap.roles || {};

      // Process hierarchy
      const hierarchy = dataMap.hierarchy || [];

      // Process features
      const features = dataMap.features || {};

      return {
        content: [
          {
            type: 'text',
            text: `# Project Details: ${project.name}

## 📋 Basic Information
- **Key**: ${project.key}
- **ID**: ${project.id}
- **Description**: ${project.description || 'No description'}
- **Type**: ${project.projectTypeKey}
- **Category**: ${project.projectCategory?.name || 'No category'}
- **Lead**: ${project.lead?.displayName || 'No lead'}
- **Email**: ${project.email || 'No email'}
- **URL**: ${project.url || 'No URL'}

## 📊 Project Statistics
- **Components**: ${components.length}
- **Versions**: ${versions.length} (${activeVersions.length} active, ${releasedVersions.length} released)
- **Roles**: ${Object.keys(roles).length}
- **Issue Types**: ${hierarchy.length}

## 🏗️ Project Structure

### Components (${components.length})
${
  components.length > 0
    ? components
        .slice(0, 10)
        .map(
          (comp: any) =>
            `- **${comp.name}**: ${comp.description || 'No description'} (Lead: ${comp.lead?.displayName || 'None'})`
        )
        .join('\n')
    : 'No components defined.'
}${components.length > 10 ? `\n... and ${components.length - 10} more` : ''}

### Active Versions (${activeVersions.length})
${
  activeVersions.length > 0
    ? activeVersions
        .slice(0, 10)
        .map(
          (version: any) =>
            `- **${version.name}**: ${version.description || 'No description'} (Release: ${version.releaseDate || 'Not set'})`
        )
        .join('\n')
    : 'No active versions.'
}${activeVersions.length > 10 ? `\n... and ${activeVersions.length - 10} more` : ''}

### Issue Type Hierarchy (${hierarchy.length})
${
  hierarchy.length > 0
    ? hierarchy
        .slice(0, 10)
        .map(
          (issueType: any) =>
            `- **${issueType.name}**: ${issueType.description || 'No description'} (ID: ${issueType.id})`
        )
        .join('\n')
    : 'No issue type hierarchy available.'
}${hierarchy.length > 10 ? `\n... and ${hierarchy.length - 10} more` : ''}

### Project Roles (${Object.keys(roles).length})
${
  Object.keys(roles).length > 0
    ? Object.entries(roles)
        .slice(0, 10)
        .map(
          ([key, role]: [string, any]) =>
            `- **${role.name}**: ${role.description || 'No description'}`
        )
        .join('\n')
    : 'No roles defined.'
}${Object.keys(roles).length > 10 ? `\n... and ${Object.keys(roles).length - 10} more` : ''}

## ⚙️ Project Features
${
  Object.keys(features).length > 0
    ? Object.entries(features)
        .map(([key, feature]: [string, any]) => `- **${key}**: ${feature.state || 'Unknown state'}`)
        .join('\n')
    : 'Feature information not available.'
}

## 🔐 Permissions & Access
${
  project.permissions
    ? Object.entries(project.permissions)
        .map(
          ([perm, hasAccess]: [string, any]) =>
            `- **${perm}**: ${hasAccess ? '✅ Granted' : '❌ Denied'}`
        )
        .join('\n')
    : 'Permission information not available.'
}

## 💡 Project Insights
${
  project.insight?.totalIssueCount !== undefined
    ? `- **Total Issues**: ${project.insight.totalIssueCount}`
    : ''
}
${
  project.insight?.lastIssueUpdateTime
    ? `- **Last Issue Update**: ${new Date(project.insight.lastIssueUpdateTime).toLocaleDateString()}`
    : ''
}

## 📝 Additional Information
- **Assignee Type**: ${project.assigneeType}
- **Avatar URL**: ${project.avatarUrls?.['48x48'] || 'No avatar'}
- **Self URL**: ${project.self}

${project.archived ? '📦 **This project is archived**' : ''}
${project.deleted ? '🗑️ **This project is deleted**' : ''}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting project details: ${error.response?.data?.errorMessages?.join(', ') || error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}
