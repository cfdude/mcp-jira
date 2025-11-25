/**
 * Handler for the create_issue tool with multi-instance support
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { CreateIssueArgs } from '../types.js';
import { getBoardId } from '../utils/jira-api.js';
import { formatCreatedIssue } from '../utils/formatting.js';
import { buildDynamicFields } from '../utils/dynamic-field-resolver.js';
import type { SessionState } from '../session-manager.js';

export async function handleCreateIssue(args: CreateIssueArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { requiresProject: true },
    async (toolArgs, { axiosInstance, agileAxiosInstance, instanceConfig, projectConfig }) => {
      // Extract the instance name from the original args for dynamic field resolution
      const instanceName = args.instance || 'default';
      const {
        summary,
        description,
        type,
        epic_link,
        sprint,
        priority,
        story_points,
        labels,
        projectKey,
        custom_fields: userCustomFields,
      } = toolArgs;

      // Mutable copy for adding convenience fields to dynamic resolution
      let custom_fields = userCustomFields ? { ...userCustomFields } : {};

      const effectiveProjectKey = projectKey || 'UNKNOWN';

      if (effectiveProjectKey === 'UNKNOWN') {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'projectKey is required when creating issues. Either provide it as a parameter or configure a default project in .jira-config.json'
        );
      }

      console.error(
        `Creating issue in project ${effectiveProjectKey} using instance: ${instanceConfig.domain}`
      );

      console.error('Creating issue with:', {
        projectKey: effectiveProjectKey,
        summary,
        description,
        type,
        epic_link,
        sprint,
        priority,
        story_points,
        labels,
        instance: instanceConfig.domain,
      });

      // First, get project metadata to verify it exists and get available issue types
      const metaResponse = await axiosInstance.get('/issue/createmeta', {
        params: {
          projectKeys: effectiveProjectKey,
          expand: 'projects.issuetypes',
        },
      });

      console.error('Project metadata:', JSON.stringify(metaResponse.data, null, 2));

      const project = metaResponse.data.projects[0];
      if (!project) {
        throw new McpError(ErrorCode.InvalidRequest, `Project ${effectiveProjectKey} not found`);
      }

      const issueType = project.issuetypes.find(
        (t: any) => t.name.toLowerCase() === type.toLowerCase()
      );
      if (!issueType) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Issue type "${type}" not found. Available types: ${project.issuetypes
            .map((t: any) => t.name)
            .join(', ')}`
        );
      }

      // Try to find sprint field dynamically if not configured
      let sprintFieldId = projectConfig.sprintField;

      if (!sprintFieldId && sprint) {
        // Get field configuration to find Sprint field ID dynamically
        const fieldConfigResponse = await axiosInstance.get('/field');
        const sprintFields = fieldConfigResponse.data.filter((field: any) =>
          field.name?.toLowerCase().includes('sprint')
        );

        if (sprintFields.length > 0) {
          // Use the first Sprint field found
          sprintFieldId = sprintFields[0].id;
          console.error(`Auto-detected Sprint field: ${sprintFieldId}`);
        } else {
          console.error('No Sprint field found in instance configuration');
        }
      }

      if (sprintFieldId) {
        console.error('Using sprint field ID:', sprintFieldId);
      }

      const fields: any = {
        project: {
          key: effectiveProjectKey,
        },
        summary,
        issuetype: {
          name: type,
        },
        labels: labels || [],
      };

      // Add description in ADF format if provided
      if (description) {
        // Import ADF converter for proper text handling
        const { safeConvertTextToADF } = await import('../utils/adf-converter.js');
        const adfDescription = safeConvertTextToADF(description);
        console.error(
          'Converting description to ADF, length:',
          description.length,
          'ADF nodes:',
          adfDescription.content?.length
        );
        fields.description = adfDescription;
      }

      // Add priority if specified
      if (priority) {
        fields.priority = {
          name: priority,
        };
        console.error('Setting priority:', priority);
      }

      // Add story points if specified
      if (story_points !== undefined) {
        // Try configured field first, fall back to dynamic resolution
        if (projectConfig.storyPointsField) {
          fields[projectConfig.storyPointsField] = story_points;
          console.error('Setting story points via configured field:', story_points);
        } else {
          // Add to custom_fields for dynamic resolution
          custom_fields['Story Points'] = story_points;
          console.error('Adding story points to dynamic resolution:', story_points);
        }
      }

      // Handle sprint assignment if requested
      if (sprint && sprintFieldId) {
        try {
          const boardId = await getBoardId(agileAxiosInstance, effectiveProjectKey);
          console.error('Found board ID:', boardId);

          // Get available sprints
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
          fields[sprintFieldId] = numericSprintId;

          console.error('Setting sprint field:', {
            fieldId: sprintFieldId,
            sprintId: numericSprintId,
            sprintName: sprintObj.name,
            fieldValue: fields[sprintFieldId],
          });

          // Apply field defaults first (if any)
          let combinedCustomFields = {};

          if (projectConfig.fieldDefaults && Object.keys(projectConfig.fieldDefaults).length > 0) {
            console.error(
              'Applying project field defaults:',
              Object.keys(projectConfig.fieldDefaults)
            );
            combinedCustomFields = { ...projectConfig.fieldDefaults };
          }

          // Override defaults with user-specified custom fields
          if (Object.keys(custom_fields).length > 0) {
            console.error('Processing user custom fields:', Object.keys(custom_fields));
            combinedCustomFields = { ...combinedCustomFields, ...custom_fields };
          }

          // Process all custom fields (defaults + user-specified) through dynamic resolution
          if (Object.keys(combinedCustomFields).length > 0) {
            console.error('Processing combined custom fields:', Object.keys(combinedCustomFields));

            // Build dynamic fields with proper resolution and type conversion
            const result = await buildDynamicFields(
              combinedCustomFields,
              axiosInstance,
              instanceName,
              session
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

            // Merge dynamic fields into create data
            if (Object.keys(result.resolvedFields).length > 0) {
              Object.assign(fields, result.resolvedFields);
              console.error('Added dynamic fields:', Object.keys(result.resolvedFields));
            } else {
              console.error('❌ No dynamic fields could be resolved');
            }
          }

          // Create issue with sprint field
          const createResponse = await axiosInstance.post('/issue', {
            fields,
          });

          return {
            content: [
              {
                type: 'text',
                text: formatCreatedIssue(createResponse.data, instanceConfig.domain),
              },
            ],
          };
        } catch (error) {
          console.error('Error setting sprint:', error);
          throw error;
        }
      }

      if (epic_link) {
        // Try configured field first, fall back to parent field
        if (projectConfig.epicLinkField) {
          fields[projectConfig.epicLinkField] = epic_link;
          console.error('Setting epic link via configured field:', epic_link);
        } else {
          // Use parent field as fallback
          fields.parent = {
            key: epic_link,
          };
          console.error('Adding Epic link using parent field:', epic_link);
        }
      }

      // Apply field defaults first (if any)
      let combinedCustomFields = {};

      if (projectConfig.fieldDefaults && Object.keys(projectConfig.fieldDefaults).length > 0) {
        console.error('Applying project field defaults:', Object.keys(projectConfig.fieldDefaults));
        combinedCustomFields = { ...projectConfig.fieldDefaults };
      }

      // Override defaults with user-specified custom fields
      if (Object.keys(custom_fields).length > 0) {
        console.error('Processing user custom fields:', Object.keys(custom_fields));
        combinedCustomFields = { ...combinedCustomFields, ...custom_fields };
      }

      // Process all custom fields (defaults + user-specified) through dynamic resolution
      if (Object.keys(combinedCustomFields).length > 0) {
        console.error('Processing combined custom fields:', Object.keys(combinedCustomFields));

        // Build dynamic fields with proper resolution and type conversion
        const result = await buildDynamicFields(
          combinedCustomFields,
          axiosInstance,
          instanceName,
          session
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

        // Merge dynamic fields into create data
        if (Object.keys(result.resolvedFields).length > 0) {
          Object.assign(fields, result.resolvedFields);
          console.error('Added dynamic fields:', Object.keys(result.resolvedFields));
        } else {
          console.error('❌ No dynamic fields could be resolved');
        }
      }

      const createResponse = await axiosInstance.post('/issue', {
        fields,
      });

      return {
        content: [
          {
            type: 'text',
            text: formatCreatedIssue(createResponse.data, instanceConfig.domain),
          },
        ],
      };
    },
    session
  );
}
