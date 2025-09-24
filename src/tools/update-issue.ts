/**
 * Handler for the update_issue tool
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { UpdateIssueArgs } from '../types.js';
import { getBoardId } from '../utils/jira-api.js';
import { formatIssue } from '../utils/formatting.js';
import { resolveAssigneeValue } from '../utils/user-resolver.js';
import { buildDynamicFields } from '../utils/dynamic-field-resolver.js';
import type { SessionState } from '../session-manager.js';

export async function handleUpdateIssue(args: UpdateIssueArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { extractProjectFromIssueKey: true },
    async (toolArgs, { axiosInstance, agileAxiosInstance, projectConfig, instanceConfig }) => {
      // Extract the instance name from the original args for dynamic field resolution
      const instanceName = args.instance || 'default';
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
        issuetype,
        original_estimate,
        remaining_estimate,
        custom_fields: userCustomFields,
      } = toolArgs;

      // Mutable copy for adding convenience fields to dynamic resolution
      let custom_fields = userCustomFields ? { ...userCustomFields } : {};

      let resolvedStoryPointsField = projectConfig.storyPointsField || null;
      let editMetaFields: Record<string, any> | undefined;

      const loadEditMetaFields = async (): Promise<Record<string, any>> => {
        if (editMetaFields !== undefined) {
          return editMetaFields;
        }

        try {
          const editMetaResponse = await axiosInstance.get(`/issue/${issue_key}/editmeta`);
          editMetaFields = editMetaResponse.data?.fields || {};
        } catch (error: any) {
          console.error(
            'Warning: Unable to load edit metadata for story points detection:',
            error?.response?.status,
            error?.message
          );
          editMetaFields = {};
        }

        return editMetaFields!;
      };

      const detectEditableStoryPointsField = (fields: Record<string, any>) => {
        for (const [fieldId, meta] of Object.entries(fields)) {
          const name = (meta?.name || '').toLowerCase();
          const schema = meta?.schema || {};
          const operations: string[] = meta?.operations || [];

          const isStoryPointsSchema =
            schema?.custom === 'com.pyxis.greenhopper.jira:jsw-story-points' ||
            schema?.custom === 'com.atlassian.jira.plugin.system.customfieldtypes:float';

          const nameMatches = name.includes('story point');

          if (operations.includes('set') && (nameMatches || isStoryPointsSchema)) {
            return fieldId;
          }
        }
        return null;
      };

      // Import text field handler for complex text handling
      const { updateIssueWithTextFallback } = await import('../utils/text-field-handler.js');

      // IMPORTANT: Check for workflow transition attempts
      if (status) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `❌ Cannot update issue status directly. Status transitions must be performed using workflow transitions.

🔄 **Correct approach:**
1. First, get available transitions:
   mcp__jira__get_transitions({
     working_dir: "${args.working_dir}",
     instance: "${instanceName}",
     issueKey: "${issue_key}"
   })

2. Then, perform the transition:
   mcp__jira__transition_issue({
     working_dir: "${args.working_dir}",
     instance: "${instanceName}",
     issueKey: "${issue_key}",
     transitionId: "TRANSITION_ID_FROM_STEP_1",
     comment: "Optional comment explaining the transition"
   })

The 'status' field cannot be set directly via update_issue. Use the workflow transition tools instead.`
        );
      }

      // We'll handle story points through dynamic resolution if no field ID is configured

      const updateData: any = {
        fields: {},
      };

      // Initialize update section for special fields that require it
      const updateSection: any = {};

      // Add fields to update if provided
      if (summary) updateData.fields.summary = summary;
      if (description) {
        // Keep description as plain text - the text handler will convert to ADF if needed
        updateData.fields.description = description;
        console.error('Setting description, length:', description.length);
      }
      if (issuetype) {
        updateData.fields.issuetype = { name: issuetype };
        console.error('Setting issue type:', issuetype);
      }
      if (priority) {
        updateData.fields.priority = { name: priority };
        console.error('Setting priority:', priority);
      }
      if (story_points !== undefined) {
        const fields = await loadEditMetaFields();

        let targetStoryPointsField = resolvedStoryPointsField;

        if (targetStoryPointsField && !fields[targetStoryPointsField]) {
          console.error(
            `Configured story points field ${targetStoryPointsField} is not editable on ${issue_key}, attempting detection`
          );
          targetStoryPointsField = null;
        }

        if (!targetStoryPointsField) {
          const detectedField = detectEditableStoryPointsField(fields);
          if (detectedField) {
            targetStoryPointsField = detectedField;
            console.error(
              `Detected editable story points field ${detectedField} for issue ${issue_key}`
            );
          }
        }

        if (targetStoryPointsField) {
          updateData.fields[targetStoryPointsField] = story_points;
          resolvedStoryPointsField = targetStoryPointsField;
          projectConfig.storyPointsField = targetStoryPointsField;
          console.error(`Setting story points via field ${targetStoryPointsField}:`, story_points);
        } else {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Story points field is not editable on issue ${issue_key}. Add the field to the edit screen or update your configuration.`
          );
        }
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
        // Try configured field first, fall back to dynamic resolution
        if (projectConfig.epicLinkField) {
          updateData.fields[projectConfig.epicLinkField] = epic_link;
          console.error('Setting epic link via configured field:', epic_link);
        } else {
          // Try parent field first, then dynamic resolution
          updateData.fields.parent = {
            key: epic_link,
          };
          console.error('Adding Epic link using parent field:', epic_link);
        }
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

      // Handle dedicated time tracking parameters FIRST
      let timeTrackingUpdate: any = {};
      if (original_estimate || remaining_estimate) {
        console.error('Processing dedicated time tracking parameters:');
        if (original_estimate) {
          timeTrackingUpdate.originalEstimate = original_estimate;
          console.error(`  Original Estimate: ${original_estimate}`);
        }
        if (remaining_estimate) {
          timeTrackingUpdate.remainingEstimate = remaining_estimate;
          console.error(`  Remaining Estimate: ${remaining_estimate}`);
        }
      }

      // Extract time tracking fields from custom_fields (for backwards compatibility)
      const timeTrackingFields: any = {};
      if (custom_fields) {
        console.error(
          'Checking custom_fields for time tracking fields:',
          Object.keys(custom_fields)
        );
        // Check for time tracking related fields and extract them
        for (const [key, value] of Object.entries(custom_fields)) {
          const lowerKey = key.toLowerCase();
          if (
            lowerKey === 'time tracking' ||
            lowerKey === 'timetracking' ||
            lowerKey === 'original estimate' ||
            lowerKey === 'originalestimate' ||
            lowerKey === 'remaining estimate' ||
            lowerKey === 'remainingestimate'
          ) {
            console.error(`Found time tracking field: "${key}" = "${value}"`);
            timeTrackingFields[key] = value;
            delete custom_fields[key]; // Remove from custom_fields so it's not processed by dynamic resolver
          }
        }
        console.error('Extracted time tracking fields:', timeTrackingFields);
        console.error('Remaining custom_fields after extraction:', Object.keys(custom_fields));
      }

      // Handle time tracking fields in update section (for updates, not creates)
      // Merge fields from custom_fields into timeTrackingUpdate
      if (Object.keys(timeTrackingFields).length > 0) {
        for (const [key, value] of Object.entries(timeTrackingFields)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey === 'time tracking' || lowerKey === 'timetracking') {
            timeTrackingUpdate.originalEstimate = value as string;
          } else if (lowerKey === 'original estimate' || lowerKey === 'originalestimate') {
            // Only set if not already set by dedicated parameter
            if (!timeTrackingUpdate.originalEstimate) {
              timeTrackingUpdate.originalEstimate = value as string;
            }
          } else if (lowerKey === 'remaining estimate' || lowerKey === 'remainingestimate') {
            // Only set if not already set by dedicated parameter
            if (!timeTrackingUpdate.remainingEstimate) {
              timeTrackingUpdate.remainingEstimate = value as string;
            }
          }
        }
      }

      // Add time tracking to update section if we have any time tracking updates
      if (Object.keys(timeTrackingUpdate).length > 0) {
        updateSection.timetracking = [
          {
            edit: timeTrackingUpdate,
          },
        ];
        console.error(
          'Setting time tracking in update section:',
          JSON.stringify(updateSection.timetracking, null, 2)
        );
      }

      // Handle dynamic custom fields (user-specified only for updates - no defaults)
      if (custom_fields && Object.keys(custom_fields).length > 0) {
        console.error('Processing user custom fields:', Object.keys(custom_fields));

        // Build dynamic fields with proper resolution and type conversion
        const result = await buildDynamicFields(
          custom_fields,
          axiosInstance,
          instanceName,
          session,
          issue_key // Pass issue key for editability validation
        );

        // Report field resolution results
        for (const resolution of result.fieldResolutions) {
          if (resolution.error) {
            console.error(`❌ ${resolution.error}`);
          } else {
            console.error(
              `✅ Resolved "${resolution.input}" -> "${resolution.fieldName}" (${resolution.matchType} match)`
            );
          }
        }

        // Merge dynamic fields into update data
        if (Object.keys(result.resolvedFields).length > 0) {
          Object.assign(updateData.fields, result.resolvedFields);
          console.error('Added dynamic fields:', Object.keys(result.resolvedFields));
        } else {
          console.error('❌ No dynamic fields could be resolved');
        }
      }

      // Merge update section into updateData if it has content
      if (Object.keys(updateSection).length > 0) {
        updateData.update = updateSection;
        console.error('Added update section to payload:', JSON.stringify(updateSection, null, 2));
      }

      try {
        console.error(
          'FINAL Update data being sent to Jira API:',
          JSON.stringify(updateData, null, 2)
        );

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
        let formattedText = '';
        try {
          const updatedIssue = await axiosInstance.get(`/issue/${issue_key}`, {
            params: {
              expand: 'renderedFields,names',
              fields: '*all', // Fetch all fields to support dynamic field discovery
            },
          });

          console.error('Retrieved updated issue:', issue_key);
          console.error('Issue type:', updatedIssue.data.fields?.issuetype);

          const formattingStoryPointsField =
            projectConfig.storyPointsField || resolvedStoryPointsField;
          formattedText = formatIssue(updatedIssue.data, formattingStoryPointsField);
        } catch (fetchError: any) {
          console.error('Error fetching/formatting updated issue:', fetchError);
          console.error('Error stack:', fetchError.stack);
          // Return success message even if we can't fetch the updated issue
          formattedText = `✅ Issue ${issue_key} updated successfully!`;
        }

        return {
          content: [
            {
              type: 'text',
              text: formattedText + `\n\n✅ Update method: ${result.method}`,
            },
          ],
        };
      } catch (error: any) {
        console.error('Issue update failed:', error);
        console.error('Error type:', typeof error);
        console.error('Error stack:', error.stack);

        let errorMessage = error.message;
        if (error.response?.data?.errorMessages) {
          errorMessage = error.response.data.errorMessages.join(', ');
        }

        // Check for issue type hierarchy conversion error
        if (errorMessage.toLowerCase().includes('issue type selected is invalid') && issuetype) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Cannot change issue type: ${errorMessage}\n\n` +
              `⚠️ Jira API Limitation: Converting between Epic and Story/Task/Bug is not supported via API.\n\n` +
              `This operation must be performed manually in the Jira UI:\n` +
              `1. Open the issue in Jira web interface\n` +
              `2. Click "More" menu (•••) → "Move"\n` +
              `3. Select the new issue type\n` +
              `4. Map any required fields\n` +
              `5. Confirm the move\n\n` +
              `The Jira UI handles all field mappings and custom fields correctly.`
          );
        }

        throw new McpError(ErrorCode.InternalError, `Failed to update issue: ${errorMessage}`);
      }
    },
    session
  );
}
