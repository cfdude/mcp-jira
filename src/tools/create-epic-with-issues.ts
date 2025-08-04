/**
 * Create an epic with linked issues in a single operation
 * Reduces API calls and ensures proper linking
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { BaseArgs } from '../types.js';
import type { SessionState } from '../session-manager.js';

interface EpicData {
  name: string;
  summary: string;
  description?: string;
  priority?: string;
  labels?: string[];
}

interface IssueData {
  summary: string;
  description?: string;
  type: string;
  priority?: string;
  labels?: string[];
  story_points?: number;
  assignee?: string;
}

export interface CreateEpicWithIssuesArgs extends BaseArgs {
  projectKey?: string;
  epic: EpicData;
  issues: IssueData[];
}

export async function handleCreateEpicWithIssues(
  args: CreateEpicWithIssuesArgs,
  session?: SessionState
) {
  return withJiraContext(
    args,
    { requiresProject: true },
    async (
      toolArgs,
      { axiosInstance, projectKey: contextProjectKey, instanceConfig, projectConfig }
    ) => {
      const { epic, issues, projectKey } = toolArgs;
      const effectiveProjectKey = projectKey || contextProjectKey;

      console.error('Creating epic with issues:', {
        projectKey: effectiveProjectKey,
        epicSummary: epic.summary,
        issueCount: issues.length,
      });

      // Import ADF converter for text handling
      const { safeConvertTextToADF } = await import('../utils/adf-converter.js');

      // Get project metadata for validation
      const metaResponse = await axiosInstance.get('/issue/createmeta', {
        params: {
          projectKeys: effectiveProjectKey,
          expand: 'projects.issuetypes.fields',
        },
      });

      const project = metaResponse.data.projects[0];
      if (!project) {
        throw new McpError(ErrorCode.InvalidRequest, `Project ${effectiveProjectKey} not found`);
      }

      // Validate epic issue type exists
      const epicIssueType = project.issuetypes.find((t: any) => t.name.toLowerCase() === 'epic');
      if (!epicIssueType) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Epic issue type not found in project ${effectiveProjectKey}. Available types: ${project.issuetypes
            .map((t: any) => t.name)
            .join(', ')}`
        );
      }

      // Validate all issue types exist
      const availableIssueTypes = project.issuetypes.map((t: any) => t.name.toLowerCase());
      for (const issue of issues) {
        if (!availableIssueTypes.includes(issue.type.toLowerCase())) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Issue type '${issue.type}' not found in project ${effectiveProjectKey}. Available types: ${project.issuetypes
              .map((t: any) => t.name)
              .join(', ')}`
          );
        }
      }

      const results = {
        epic: null as any,
        issues: [] as any[],
        errors: [] as string[],
      };

      try {
        // Step 1: Create the epic
        console.error('Creating epic...');
        const epicFields: any = {
          project: { key: effectiveProjectKey },
          summary: epic.summary,
          issuetype: { name: 'Epic' },
          labels: epic.labels || [],
        };

        // Add epic description with ADF conversion
        if (epic.description) {
          epicFields.description = safeConvertTextToADF(epic.description);
        }

        // Add epic name field (try common field IDs)
        epicFields.customfield_10011 = epic.name;

        // Add priority if specified
        if (epic.priority) {
          epicFields.priority = { name: epic.priority };
        }

        let epicResponse;
        try {
          epicResponse = await axiosInstance.post('/issue', { fields: epicFields });
          results.epic = {
            key: epicResponse.data.key,
            name: epic.name,
            summary: epic.summary,
            link: `https://${instanceConfig.domain}/browse/${epicResponse.data.key}`,
          };
          console.error(`Epic created: ${epicResponse.data.key}`);
        } catch (epicError: any) {
          // If epic name field fails, try without it
          if (
            epicError.response?.status === 400 &&
            epicError.response?.data?.errors?.customfield_10011
          ) {
            console.error('Epic name field not available, trying without it...');
            delete epicFields.customfield_10011;
            epicResponse = await axiosInstance.post('/issue', { fields: epicFields });
            results.epic = {
              key: epicResponse.data.key,
              name: epic.name,
              summary: epic.summary,
              link: `https://${instanceConfig.domain}/browse/${epicResponse.data.key}`,
              warning: 'Epic name field not supported in this project',
            };
          } else {
            throw epicError;
          }
        }

        // Step 2: Create issues and link them to the epic
        console.error(`Creating and linking ${issues.length} issues...`);

        for (let i = 0; i < issues.length; i++) {
          const issueData = issues[i];
          try {
            const issueFields: any = {
              project: { key: effectiveProjectKey },
              summary: issueData.summary,
              issuetype: { name: issueData.type },
              labels: issueData.labels || [],
            };

            // Add issue description with ADF conversion
            if (issueData.description) {
              issueFields.description = safeConvertTextToADF(issueData.description);
            }

            // Add priority if specified
            if (issueData.priority) {
              issueFields.priority = { name: issueData.priority };
            }

            // Add story points if specified and field is available
            if (issueData.story_points && projectConfig.storyPointsField) {
              issueFields[projectConfig.storyPointsField] = issueData.story_points;
            }

            // Add assignee if specified
            if (issueData.assignee) {
              // Try to resolve assignee (could be display name, email, or account ID)
              try {
                const userSearchResponse = await axiosInstance.get('/user/search', {
                  params: { query: issueData.assignee, maxResults: 50 },
                });

                if (userSearchResponse.data.length === 0) {
                  results.errors.push(`Issue ${i + 1}: Assignee '${issueData.assignee}' not found`);
                } else if (userSearchResponse.data.length === 1) {
                  issueFields.assignee = { accountId: userSearchResponse.data[0].accountId };
                } else {
                  // Multiple matches - try exact match
                  const exactMatch = userSearchResponse.data.find(
                    (user: any) =>
                      user.displayName === issueData.assignee ||
                      user.emailAddress === issueData.assignee ||
                      user.accountId === issueData.assignee
                  );
                  if (exactMatch) {
                    issueFields.assignee = { accountId: exactMatch.accountId };
                  } else {
                    results.errors.push(
                      `Issue ${i + 1}: Multiple users found for '${issueData.assignee}'. Please be more specific.`
                    );
                  }
                }
              } catch (assigneeError) {
                console.error('Assignee resolution error:', assigneeError);
                results.errors.push(
                  `Issue ${i + 1}: Error resolving assignee '${issueData.assignee}'`
                );
              }
            }

            // Add epic link if field is available
            if (projectConfig.epicLinkField) {
              issueFields[projectConfig.epicLinkField] = results.epic.key;
            }

            const issueResponse = await axiosInstance.post('/issue', { fields: issueFields });

            // If epic link field wasn't available during creation, link it afterward
            if (!projectConfig.epicLinkField) {
              try {
                await axiosInstance.put(`/issue/${issueResponse.data.key}`, {
                  fields: {
                    parent: { key: results.epic.key },
                  },
                });
              } catch (linkError) {
                console.error('Epic link error:', linkError);
                console.error(
                  `Warning: Could not link issue ${issueResponse.data.key} to epic ${results.epic.key}`
                );
                results.errors.push(
                  `Issue ${issueResponse.data.key}: Could not link to epic (will need manual linking)`
                );
              }
            }

            results.issues.push({
              key: issueResponse.data.key,
              summary: issueData.summary,
              type: issueData.type,
              link: `https://${instanceConfig.domain}/browse/${issueResponse.data.key}`,
              linkedToEpic: true,
            });

            console.error(`Issue created and linked: ${issueResponse.data.key}`);
          } catch (issueError: any) {
            const errorMsg = `Issue ${i + 1} (${issueData.summary}): ${issueError.response?.data?.errorMessages?.join(', ') || issueError.message}`;
            results.errors.push(errorMsg);
            console.error('Error creating issue:', errorMsg);
          }
        }

        // Generate comprehensive result
        const successCount = results.issues.length;
        const errorCount = results.errors.length;
        const totalIssues = issues.length;

        let resultText = `# Epic with Issues Created Successfully! 🎉\n\n`;

        // Epic details
        resultText += `## 📊 Epic Details\n`;
        resultText += `- **Key:** ${results.epic.key}\n`;
        resultText += `- **Name:** ${results.epic.name}\n`;
        resultText += `- **Summary:** ${results.epic.summary}\n`;
        resultText += `- **Project:** ${effectiveProjectKey}\n`;
        if (results.epic.warning) {
          resultText += `- **Warning:** ${results.epic.warning}\n`;
        }
        resultText += `- **Link:** [${results.epic.key}](${results.epic.link})\n\n`;

        // Issues summary
        resultText += `## 📝 Issues Summary\n`;
        resultText += `- **Created:** ${successCount}/${totalIssues} issues\n`;
        if (errorCount > 0) {
          resultText += `- **Errors:** ${errorCount} issues failed\n`;
        }
        resultText += `\n`;

        // Successful issues
        if (successCount > 0) {
          resultText += `## ✅ Successfully Created Issues\n`;
          results.issues.forEach((issue, index) => {
            resultText += `${index + 1}. **[${issue.key}](${issue.link})** - ${issue.summary} (${issue.type})\n`;
          });
          resultText += `\n`;
        }

        // Errors
        if (errorCount > 0) {
          resultText += `## ❌ Issues with Errors\n`;
          results.errors.forEach((error, index) => {
            resultText += `${index + 1}. ${error}\n`;
          });
          resultText += `\n`;
        }

        // Next steps
        resultText += `## 🚀 Next Steps\n`;
        resultText += `- Use \`list_epic_issues\` to view all issues in the epic\n`;
        resultText += `- Use \`update_issue\` to modify individual issues\n`;
        resultText += `- Use \`move_issues_to_sprint\` to add issues to sprints\n`;
        if (errorCount > 0) {
          resultText += `- Retry failed issues individually with \`create_issue\` and \`move_issues_to_epic\`\n`;
        }

        return {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
        };
      } catch (error: any) {
        console.error('Epic with issues creation failed:', error);

        // Enhanced error message with details
        let errorMessage = `# Epic Creation Failed ❌\n\n`;
        errorMessage += `## Error Details\n`;

        if (error.response?.status === 400) {
          errorMessage += `**Status:** 400 Bad Request\n`;
          if (error.response.data?.errorMessages?.length > 0) {
            errorMessage += `**Messages:** ${error.response.data.errorMessages.join(', ')}\n`;
          }
          if (error.response.data?.errors) {
            errorMessage += `**Field Errors:**\n`;
            Object.entries(error.response.data.errors).forEach(([field, msg]) => {
              errorMessage += `- **${field}:** ${msg}\n`;
            });
          }
        } else {
          errorMessage += `**Error:** ${error.message}\n`;
        }

        // Add partial results if any
        if (results.epic) {
          errorMessage += `\n## ⚠️ Partial Success\n`;
          errorMessage += `Epic was created: [${results.epic.key}](${results.epic.link})\n`;
          if (results.issues.length > 0) {
            errorMessage += `${results.issues.length} issues were created before the error occurred.\n`;
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: errorMessage,
            },
          ],
          isError: true,
        };
      }
    },
    session
  );
}
