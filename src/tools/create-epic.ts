/**
 * Handler for the create_epic tool
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { withJiraContext } from "../utils/tool-wrapper.js";
import { BaseArgs } from "../types.js";

export interface CreateEpicArgs extends BaseArgs {
  projectKey?: string;
  name: string;
  summary: string;
  description?: string;
  priority?: string;
  labels?: string[];
}

export async function handleCreateEpic(args: CreateEpicArgs) {
  return withJiraContext(
    args,
    { requiresProject: true },
    async (toolArgs, { axiosInstance, projectKey: contextProjectKey, instanceConfig }) => {
      const { name, summary, description, priority, labels, projectKey } = toolArgs;
      
      const effectiveProjectKey = projectKey || contextProjectKey;
      
      console.error("Creating epic with:", {
        projectKey: effectiveProjectKey,
        name,
        summary,
        description,
        priority,
        labels
      });

      // First, get project metadata to verify Epic issue type exists
      const metaResponse = await axiosInstance.get(
        "/issue/createmeta",
        {
          params: {
            projectKeys: effectiveProjectKey,
            expand: "projects.issuetypes",
          },
        }
      );

      const project = metaResponse.data.projects[0];
      if (!project) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Project ${effectiveProjectKey} not found`
        );
      }

      const epicIssueType = project.issuetypes.find(
        (t: any) => t.name.toLowerCase() === 'epic'
      );
      if (!epicIssueType) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Epic issue type not found. Available types: ${project.issuetypes
            .map((t: any) => t.name)
            .join(", ")}`
        );
      }

      const fields: any = {
        project: {
          key: effectiveProjectKey,
        },
        summary,
        issuetype: {
          name: 'Epic'
        },
        labels: labels || []
      };

      // Add description if provided
      if (description) {
        fields.description = description;
      }

      // Add Epic Name (usually customfield_10011 but may vary)
      // Try common Epic Name field IDs
      const epicNameFieldIds = ['customfield_10011', 'customfield_10004', 'customfield_10014'];
      // For now, we'll use the most common one
      fields.customfield_10011 = name;

      // Add priority if specified
      if (priority) {
        fields.priority = {
          name: priority
        };
      }

      try {
        const createResponse = await axiosInstance.post("/issue", {
          fields,
        });

        return {
          content: [
            {
              type: "text",
              text: `✅ Epic created successfully!

📊 **Epic Details:**
- **Key:** ${createResponse.data.key}
- **Name:** ${name}
- **Summary:** ${summary}
- **Project:** ${effectiveProjectKey}
${priority ? `- **Priority:** ${priority}` : ''}
${labels && labels.length > 0 ? `- **Labels:** ${labels.join(', ')}` : ''}

🔗 **Link:** https://${instanceConfig.domain}/browse/${createResponse.data.key}

Use \`list_epic_issues\` to view issues in this epic or \`move_issues_to_epic\` to add issues.`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error creating epic:", error);
        
        // If epic name field fails, try without it
        if (error.response?.status === 400 && error.response?.data?.errors?.customfield_10011) {
          console.error("Epic name field not available, trying without it...");
          delete fields.customfield_10011;
          
          try {
            const createResponse = await axiosInstance.post("/issue", {
              fields,
            });

            return {
              content: [
                {
                  type: "text",
                  text: `✅ Epic created successfully!

📊 **Epic Details:**
- **Key:** ${createResponse.data.key}
- **Summary:** ${summary}
- **Project:** ${effectiveProjectKey}
${priority ? `- **Priority:** ${priority}` : ''}
${labels && labels.length > 0 ? `- **Labels:** ${labels.join(', ')}` : ''}

⚠️ **Note:** This project doesn't support the "Epic Name" field (customfield_10011). The epic was created using the Summary field instead.

🔗 **Link:** https://${instanceConfig.domain}/browse/${createResponse.data.key}

Use \`update_issue\` to modify the epic or \`move_issues_to_epic\` to add issues.`,
                },
              ],
            };
          } catch (retryError: any) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to create epic: ${retryError.response?.data?.message || retryError.message}`
            );
          }
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to create epic: ${error.response?.data?.message || error.message}`
        );
      }
    }
  );
}