/**
 * Handler for the transition_issue tool with multi-instance support
 * Performs a workflow transition on an issue
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { TransitionIssueArgs } from '../types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

export async function handleTransitionIssue(args: TransitionIssueArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { extractProjectFromIssueKey: true },
    async (
      { issue_key, transition_id, transition_name, comment, resolution, fields },
      { axiosInstance, instanceConfig }
    ) => {
      console.error(`Transitioning issue ${issue_key}`);
      console.error(`Instance domain: ${instanceConfig.domain}`);

      try {
        // If transition_name is provided instead of transition_id, we need to look up the ID
        let effectiveTransitionId = transition_id;

        if (!effectiveTransitionId && transition_name) {
          console.error(`Looking up transition ID for name: ${transition_name}`);

          try {
            const transitionsResponse = await axiosInstance.get(`/issue/${issue_key}/transitions`);
            const transitions = transitionsResponse.data.transitions || [];

            const matchingTransition = transitions.find(
              (t: any) => t.name.toLowerCase() === transition_name.toLowerCase()
            );

            if (!matchingTransition) {
              const availableTransitions = transitions.map((t: any) => t.name).join(', ');
              throw new McpError(
                ErrorCode.InvalidRequest,
                `Transition '${transition_name}' not found for issue ${issue_key}. Available transitions: ${availableTransitions}`
              );
            }

            effectiveTransitionId = matchingTransition.id;
            console.error(
              `Found transition ID: ${effectiveTransitionId} for name: ${transition_name}`
            );
          } catch (transitionLookupError: any) {
            console.error('Error looking up transition:', transitionLookupError.response?.data);
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Failed to look up transition '${transition_name}' for issue ${issue_key}: ${transitionLookupError.message}`
            );
          }
        }

        if (!effectiveTransitionId) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Either transition_id or transition_name must be provided'
          );
        }

        // Build the transition request body
        const requestBody: any = {
          transition: {
            id: effectiveTransitionId.toString(),
          },
        };

        // Add optional fields if provided
        if (comment || resolution || fields) {
          requestBody.fields = {};

          // Add resolution if provided
          if (resolution) {
            requestBody.fields.resolution = { name: resolution };
          }

          // Add any additional fields
          if (fields) {
            Object.assign(requestBody.fields, fields);
          }
        }

        // Add comment if provided
        if (comment) {
          // Import ADF converter for comment
          const { safeConvertTextToADF } = await import('../utils/adf-converter.js');

          requestBody.update = {
            comment: [
              {
                add: {
                  body: safeConvertTextToADF(comment),
                },
              },
            ],
          };
        }

        console.error('Transition request body:', JSON.stringify(requestBody, null, 2));

        // Perform the transition
        await axiosInstance.post(`/issue/${issue_key}/transitions`, requestBody);

        console.error('✅ Transition completed successfully');

        // Get the updated issue to show the new status
        try {
          const updatedIssue = await axiosInstance.get(`/issue/${issue_key}`, {
            params: {
              fields: 'summary,status,resolution',
            },
          });

          const newStatus = updatedIssue.data.fields.status.name;
          const newResolution = updatedIssue.data.fields.resolution?.name || 'Unresolved';

          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully transitioned issue ${issue_key}!\n\n**New Status:** ${newStatus}\n**Resolution:** ${newResolution}\n**Summary:** ${updatedIssue.data.fields.summary}`,
              },
            ],
          };
        } catch {
          // If we can't get the updated issue, still report success
          return {
            content: [
              {
                type: 'text',
                text: `✅ Successfully transitioned issue ${issue_key}! (Unable to fetch updated status)`,
              },
            ],
          };
        }
      } catch (error: any) {
        console.error('❌ Transition failed:', error.response?.status, error.response?.data);

        // Handle common errors
        if (error.response?.status === 400) {
          const errorData = error.response.data;
          let errorMessage = `Failed to transition issue ${issue_key}. `;

          if (errorData.errors || errorData.errorMessages) {
            errorMessage += 'Issues found:\n';

            // Handle field-specific errors
            if (errorData.errors) {
              Object.entries(errorData.errors).forEach(([field, message]) => {
                errorMessage += `- ${field}: ${message}\n`;
              });
            }

            // Handle general error messages
            if (errorData.errorMessages && Array.isArray(errorData.errorMessages)) {
              errorData.errorMessages.forEach((msg: string) => {
                errorMessage += `- ${msg}\n`;
              });
            }

            errorMessage += '\n**Suggestions:**\n';
            errorMessage +=
              '1. Use `get_transitions` tool to check available transitions and required fields\n';
            errorMessage += '2. Ensure you have permission to perform this transition\n';
            errorMessage +=
              '3. Check if any required fields are missing (like resolution for "Done" transitions)';
          } else {
            errorMessage += `${JSON.stringify(errorData)}`;
          }

          throw new McpError(ErrorCode.InvalidRequest, errorMessage);
        }

        if (error.response?.status === 404) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Issue ${issue_key} not found or transition is not available. Use 'get_transitions' tool to check available transitions.`
          );
        }

        if (error.response?.status === 401) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Authentication failed: Invalid API token or email for ${instanceConfig.domain}. Please check your credentials in .jira-config.json.`
          );
        }

        // Generic error handling
        const errorMessage = `Failed to transition issue ${issue_key}. Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`;
        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
    },
    session
  );
}
