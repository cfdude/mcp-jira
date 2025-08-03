/**
 * Handler for the update_issue tool
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { UpdateIssueArgs } from '../types.js';
import { getBoardId } from '../utils/jira-api.js';
import { formatIssue } from '../utils/formatting.js';
import { resolveAssigneeValue } from '../utils/user-resolver.js';
import type { SessionState } from '../session-manager.js';

export async function handleUpdateIssue(args: UpdateIssueArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { extractProjectFromIssueKey: true },
    async (toolArgs, { axiosInstance, agileAxiosInstance, projectConfig, instanceConfig }) => {
      const {
        issue_key,
        summary,
        description,
        status,
        assignee,
        epic_link,
        sprint,
        priority,
        story_points,
        labels,
        rank_before_issue,
        rank_after_issue,
      } = toolArgs;

      // Import text field handler for complex text handling
      const { updateIssueWithTextFallback } = await import('../utils/text-field-handler.js');

      // Get story points field from project config
      const storyPointsField = projectConfig.storyPointsField || null;

      const updateData: any = {
        fields: {},
      };

      // Add fields to update if provided
      if (summary) updateData.fields.summary = summary;
      if (description) {
        // Keep description as plain text - the text handler will convert to ADF if needed
        updateData.fields.description = description;
        console.error('Setting description, length:', description.length);
      }
      if (status) {
        updateData.fields.status = { name: status };
        console.error('Setting status:', status);
      }
      if (priority) {
        updateData.fields.priority = { name: priority };
        console.error('Setting priority:', priority);
      }
      if (story_points !== undefined && storyPointsField) {
        updateData.fields[storyPointsField] = story_points;
        console.error('Setting story points:', story_points);
      }
      if (labels !== undefined) {
        updateData.fields.labels = labels || [];
        console.error('Setting labels:', labels);
      }
      if (assignee !== undefined) {
        try {
          const resolvedAccountId = await resolveAssigneeValue(axiosInstance, assignee);
          if (resolvedAccountId === null) {
            updateData.fields.assignee = null;
            console.error('Unassigning issue');
          } else {
            updateData.fields.assignee = { accountId: resolvedAccountId };
            console.error('Setting assignee to account ID:', resolvedAccountId);
          }
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Failed to resolve assignee "${assignee}": ${error.message}`
          );
        }
      }
      if (epic_link) {
        updateData.fields.parent = {
          key: epic_link,
        };
        console.error('Adding Epic link using parent field:', epic_link);
      }

      // Handle sprint field update
      if (sprint !== undefined) {
        // Get field configuration to find Sprint field ID
        const fieldConfigResponse = await axiosInstance.get('/field');
        const sprintFields = fieldConfigResponse.data.filter((field: any) =>
          field.name?.toLowerCase().includes('sprint')
        );

        let sprintFieldId = projectConfig.sprintField;
        if (!sprintFieldId && sprintFields.length > 0) {
          // Use the first Sprint field found
          sprintFieldId = sprintFields[0].id;
          console.error(`Auto-detected Sprint field: ${sprintFieldId}`);
        }

        if (sprintFieldId) {
          if (sprint === 'remove' || sprint === '' || sprint === null) {
            updateData.fields[sprintFieldId] = null;
            console.error('Removing from sprint');
          } else if (sprint === 'current') {
            // Find active sprint for the project
            try {
              const boardId = await getBoardId(agileAxiosInstance, projectConfig.projectKey);
              const sprintsResponse = await agileAxiosInstance.get(`/board/${boardId}/sprint`, {
                params: { state: 'active' },
              });

              if (sprintsResponse.data.values.length > 0) {
                const activeSprint = sprintsResponse.data.values[0];
                updateData.fields[sprintFieldId] = activeSprint.id;
                console.error('Adding to current active sprint:', activeSprint.name);
              } else {
                throw new Error('No active sprint found');
              }
            } catch (error: any) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                `Failed to find current sprint: ${error.message}`
              );
            }
          } else {
            // Assume sprint is a sprint name or ID
            try {
              const boardId = await getBoardId(agileAxiosInstance, projectConfig.projectKey);
              const sprintsResponse = await agileAxiosInstance.get(`/board/${boardId}/sprint`, {
                params: { state: 'active,closed,future' },
              });

              const targetSprint = sprintsResponse.data.values.find(
                (s: any) => s.name === sprint || s.id.toString() === sprint
              );

              if (targetSprint) {
                updateData.fields[sprintFieldId] = targetSprint.id;
                console.error('Adding to sprint:', targetSprint.name);
              } else {
                throw new Error(`Sprint "${sprint}" not found`);
              }
            } catch (error: any) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                `Failed to find sprint "${sprint}": ${error.message}`
              );
            }
          }
        } else {
          console.error('Sprint field not found, skipping sprint assignment');
        }
      }

      try {
        // Use the comprehensive text field handler for the update
        const result = await updateIssueWithTextFallback(
          axiosInstance,
          instanceConfig,
          issue_key,
          updateData
        );

        if (!result.success) {
          throw new McpError(ErrorCode.InternalError, `Failed to update issue: ${result.error}`);
        }

        console.error(`✅ Issue updated successfully using method: ${result.method}`);

        // Handle ranking after the main update
        if (rank_before_issue || rank_after_issue) {
          try {
            const rankData: any = {
              issues: [issue_key],
            };

            if (rank_before_issue) {
              rankData.rankBeforeIssue = rank_before_issue;
            } else if (rank_after_issue) {
              rankData.rankAfterIssue = rank_after_issue;
            }

            await agileAxiosInstance.put('/issue/rank', rankData);
            console.error('Issue ranking updated successfully');
          } catch (rankError: any) {
            console.error('Ranking failed but main update succeeded:', rankError.message);
            // Don't fail the entire operation for ranking issues
          }
        }

        // Get the updated issue to return current information
        const updatedIssue = await axiosInstance.get(`/issue/${issue_key}`, {
          params: {
            expand: 'renderedFields,names',
            fields:
              'summary,description,status,assignee,priority,labels,created,creator,parent,comment',
          },
        });

        return {
          content: [
            {
              type: 'text',
              text:
                formatIssue(updatedIssue.data, projectConfig.storyPointsField) +
                `\n\n✅ Update method: ${result.method}`,
            },
          ],
        };
      } catch (error: any) {
        console.error('Issue update failed:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to update issue: ${error.response?.data?.errorMessages?.join(', ') || error.message}`
        );
      }
    },
    session
  );
}
