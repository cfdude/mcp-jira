/**
 * Handler for the update_issue tool
 */
import axios from 'axios';
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
    async (toolArgs, { axiosInstance, agileAxiosInstance, projectConfig }) => {
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

      // Get story points field from project config
      const storyPointsField = projectConfig.storyPointsField || null;

      const updateData: any = {
        fields: {},
      };

      // Add fields to update if provided
      if (summary) updateData.fields.summary = summary;
      if (description) updateData.fields.description = description;
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
        const fieldConfigResponse = await axiosInstance.get(`/field`, {
          params: {
            expand: 'names',
          },
        });

        let sprintFieldId;
        for (const field of fieldConfigResponse.data) {
          if (field.name === 'Sprint') {
            sprintFieldId = field.id;
            break;
          }
        }

        if (!sprintFieldId) {
          throw new McpError(ErrorCode.InvalidRequest, 'Sprint field not found');
        }

        if (sprint === '') {
          // Remove from sprint
          updateData.fields[sprintFieldId] = null;
          console.error('Removing issue from sprint');
        } else {
          // Add to specified sprint
          const boardId = await getBoardId(agileAxiosInstance, toolArgs.issue_key.split('-')[0]);
          const sprintsResponse = await agileAxiosInstance.get(`/board/${boardId}/sprint`, {
            params: {
              state: sprint.toLowerCase() === 'current' ? 'active' : 'active,future',
            },
          });

          console.error('Available sprints:', JSON.stringify(sprintsResponse.data, null, 2));

          // Find the requested sprint
          const sprintObj =
            sprint.toLowerCase() === 'current'
              ? sprintsResponse.data.values.find((s: any) => s.state === 'active')
              : sprintsResponse.data.values.find(
                  (s: any) => s.name.toLowerCase() === sprint.toLowerCase()
                );

          if (!sprintObj) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Sprint "${sprint}" not found. Available sprints: ${sprintsResponse.data.values.map((s: any) => s.name).join(', ')}`
            );
          }

          // Convert sprint ID to number and validate
          const numericSprintId = Number(sprintObj.id);
          if (isNaN(numericSprintId)) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Invalid sprint ID: ${sprintObj.id} is not a number`
            );
          }

          // Set sprint field with just the numeric ID
          updateData.fields[sprintFieldId] = numericSprintId;
          console.error('Adding issue to sprint:', {
            fieldId: sprintFieldId,
            sprintId: numericSprintId,
            sprintName: sprintObj.name,
            fieldValue: updateData.fields[sprintFieldId],
          });
        }
      }

      // Handle status transitions
      if (status) {
        console.error(`Fetching transitions for status update to ${status}...`);
        const transitions = await axiosInstance.get(`/issue/${issue_key}/transitions`);
        const transition = transitions.data.transitions.find(
          (t: any) => t.name.toLowerCase() === status.toLowerCase()
        );
        if (transition) {
          console.error(`Applying transition ID ${transition.id}...`);
          await axiosInstance.post(`/issue/${issue_key}/transitions`, {
            transition: { id: transition.id },
          });
        } else {
          console.error(`No transition found for status: ${status}`);
          console.error(
            `Available transitions: ${transitions.data.transitions.map((t: any) => t.name).join(', ')}`
          );
        }
      }

      // Apply updates if there are any
      if (Object.keys(updateData.fields).length > 0) {
        console.error('Applying field updates:', JSON.stringify(updateData, null, 2));
        await axiosInstance.put(`/issue/${issue_key}`, updateData);
      } else {
        console.error('No field updates to apply');
      }

      // Handle rank update if specified
      if (rank_before_issue || rank_after_issue) {
        if (rank_before_issue && rank_after_issue) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Cannot specify both rank_before_issue and rank_after_issue'
          );
        }

        console.error('Updating issue rank...');
        const rankData: any = {
          issues: [issue_key],
        };

        if (rank_before_issue) {
          rankData.rankBeforeIssue = rank_before_issue;
          console.error(`Ranking issue ${issue_key} before ${rank_before_issue}`);
        } else {
          rankData.rankAfterIssue = rank_after_issue;
          console.error(`Ranking issue ${issue_key} after ${rank_after_issue}`);
        }

        // Default rank field ID is 10019 (standard Jira rank field)
        rankData.rankCustomFieldId = 10019;

        try {
          // Use the Agile API to update the rank
          const rankResponse = await agileAxiosInstance.put('/issue/rank', rankData);
          console.error('Rank update response:', rankResponse.status);

          if (rankResponse.status === 207) {
            // Partial success - some issues may have failed
            console.error(
              'Partial success in rank update:',
              JSON.stringify(rankResponse.data, null, 2)
            );
          }
        } catch (error: any) {
          if (axios.isAxiosError(error)) {
            console.error('Rank update error:', {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data,
            });
            throw new McpError(
              ErrorCode.InternalError,
              `Rank update error: ${JSON.stringify(error.response?.data ?? error.message)}`
            );
          }
          throw error;
        }
      }

      // Fetch updated issue
      console.error('Fetching updated issue...');
      const updatedIssue = await axiosInstance.get(`/issue/${issue_key}`, {
        params: {
          expand: 'renderedFields,names,schema,transitions,operations,editmeta,changelog',
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: formatIssue(updatedIssue.data, storyPointsField),
          },
        ],
      };
    },
    session
  );
}
