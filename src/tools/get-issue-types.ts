/**
 * Get available issue types for work categorization and project planning
 */
import { AxiosInstance } from "axios";

export async function handleGetIssueTypes(
  axiosInstance: AxiosInstance,
  projectKey: string,
  args: any
) {
  try {
    // Get issue types for the project
    const response = await axiosInstance.get(
      `/rest/api/3/issuetype/project`,
      {
        params: { projectId: projectKey }
      }
    );

    const issueTypes = response.data;

    // Get create metadata to understand which fields are available for each issue type
    const createMetaResponse = await axiosInstance.get(
      `/rest/api/3/issue/createmeta/${projectKey}/issuetypes`
    ).catch(() => ({ data: { values: [] } }));

    const createMeta = createMetaResponse.data.values || [];
    
    // Create a map of issue type metadata
    const metadataMap: { [key: string]: any } = {};
    createMeta.forEach((meta: any) => {
      metadataMap[meta.id] = meta;
    });

    // Get project hierarchy to understand issue type relationships
    const hierarchyResponse = await axiosInstance.get(
      `/rest/api/3/project/${projectKey}/hierarchy`
    ).catch(() => ({ data: [] }));

    const hierarchy = hierarchyResponse.data || [];

    // Process issue types with additional information
    const processedIssueTypes = issueTypes.map((issueType: any) => {
      const metadata = metadataMap[issueType.id];
      const hierarchyInfo = hierarchy.find((h: any) => h.id === issueType.id);
      
      return {
        id: issueType.id,
        name: issueType.name,
        description: issueType.description || "No description",
        iconUrl: issueType.iconUrl,
        avatarId: issueType.avatarId,
        entityId: issueType.entityId,
        hierarchyLevel: issueType.hierarchyLevel || 0,
        scope: issueType.scope,
        subtask: issueType.subtask || false,
        untranslatedName: issueType.untranslatedName,
        // Additional metadata from create meta
        fields: metadata?.fields ? Object.keys(metadata.fields).length : 0,
        requiredFields: metadata?.fields ? 
          Object.entries(metadata.fields)
            .filter(([, field]: [string, any]) => field.required)
            .map(([fieldKey]) => fieldKey) : [],
        // Hierarchy information
        hierarchyInfo: hierarchyInfo || null
      };
    });

    // Categorize issue types
    const standardTypes = processedIssueTypes.filter((type: any) => !type.subtask && type.hierarchyLevel === 0);
    const epicTypes = processedIssueTypes.filter((type: any) => type.hierarchyLevel > 0);
    const subtaskTypes = processedIssueTypes.filter((type: any) => type.subtask);

    // Calculate usage statistics
    const typeStats = {
      total: processedIssueTypes.length,
      standard: standardTypes.length,
      epics: epicTypes.length,
      subtasks: subtaskTypes.length
    };

    return {
      content: [
        {
          type: "text",
          text: `# Issue Types for Project ${projectKey}

## 📊 Overview
- **Total Issue Types**: ${typeStats.total}
- **Standard Types**: ${typeStats.standard}
- **Epic/Parent Types**: ${typeStats.epics}
- **Subtask Types**: ${typeStats.subtasks}

## 📋 Standard Issue Types (${standardTypes.length})
${standardTypes.length > 0 ? 
  standardTypes.map((type: any) => 
    `### ${type.name} (ID: ${type.id})
- **Description**: ${type.description}
- **Hierarchy Level**: ${type.hierarchyLevel}
- **Available Fields**: ${type.fields}
- **Required Fields**: ${type.requiredFields.length > 0 ? type.requiredFields.join(', ') : 'None specified'}
- **Scope**: ${type.scope?.type || 'Global'}
${type.iconUrl ? `- **Icon**: ${type.iconUrl}` : ''}`
  ).join('\n\n') : 
  "No standard issue types found."
}

${epicTypes.length > 0 ? `
## 🎯 Epic/Parent Types (${epicTypes.length})
${epicTypes.map((type: any) => 
  `### ${type.name} (ID: ${type.id})
- **Description**: ${type.description}
- **Hierarchy Level**: ${type.hierarchyLevel}
- **Available Fields**: ${type.fields}
- **Required Fields**: ${type.requiredFields.length > 0 ? type.requiredFields.join(', ') : 'None specified'}
${type.iconUrl ? `- **Icon**: ${type.iconUrl}` : ''}`
).join('\n\n')}
` : ""}

${subtaskTypes.length > 0 ? `
## 📝 Subtask Types (${subtaskTypes.length})
${subtaskTypes.map((type: any) => 
  `### ${type.name} (ID: ${type.id})
- **Description**: ${type.description}
- **Parent Type**: Subtask (can be created under other issues)
- **Available Fields**: ${type.fields}
- **Required Fields**: ${type.requiredFields.length > 0 ? type.requiredFields.join(', ') : 'None specified'}
${type.iconUrl ? `- **Icon**: ${type.iconUrl}` : ''}`
).join('\n\n')}
` : ""}

## 🏗️ Issue Type Hierarchy
${hierarchy.length > 0 ? 
  hierarchy.map((level: any) => 
    `- **Level ${level.level || 0}**: ${level.name} (${level.issueTypes?.length || 0} types)`
  ).join('\n') : 
  "No hierarchy information available."
}

## 💡 Planning Guidelines

### When to Use Each Type:
${standardTypes.map((type: any) => {
  let suggestion = "";
  const name = type.name.toLowerCase();
  
  if (name.includes('story') || name.includes('user story')) {
    suggestion = "Use for user-facing features and functionality";
  } else if (name.includes('task')) {
    suggestion = "Use for general work items and technical tasks";
  } else if (name.includes('bug') || name.includes('defect')) {
    suggestion = "Use for reporting and tracking software defects";
  } else if (name.includes('epic')) {
    suggestion = "Use for large features that span multiple sprints";
  } else if (name.includes('improvement') || name.includes('enhancement')) {
    suggestion = "Use for improvements to existing functionality";
  } else {
    suggestion = "Custom issue type - check with team for usage guidelines";
  }
  
  return `- **${type.name}**: ${suggestion}`;
}).join('\n')}

### Field Configuration:
- Issue types with more required fields need more upfront planning
- Consider field complexity when choosing issue types for rapid issue creation
- Use subtasks to break down larger work items into manageable pieces

## 🔧 Configuration Insights
- **Complexity**: ${typeStats.total > 10 ? "High - Many issue types available" : typeStats.total > 5 ? "Medium - Good variety" : "Low - Simple setup"}
- **Hierarchy Depth**: ${Math.max(...processedIssueTypes.map((t: any) => t.hierarchyLevel))} levels
- **Customization**: ${processedIssueTypes.some((t: any) => t.scope?.type === 'PROJECT') ? "Project-specific types configured" : "Using global issue types"}

Use these issue types strategically to categorize and organize your project work effectively!`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error getting issue types: ${error.response?.data?.errorMessages?.join(", ") || error.message}`,
        },
      ],
      isError: true,
    };
  }
}