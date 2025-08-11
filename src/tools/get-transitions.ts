/**
 * Handler for the get_transitions tool with multi-instance support
 * Gets available transitions for an issue
 */
import { GetTransitionsArgs } from '../types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import type { SessionState } from '../session-manager.js';

export async function handleGetTransitions(args: GetTransitionsArgs, session?: SessionState) {
  return withJiraContext(
    args,
    { extractProjectFromIssueKey: true },
    async ({ issue_key }, { axiosInstance, instanceConfig }) => {
      console.error(`Getting available transitions for ${issue_key}`);
      console.error(`Instance domain: ${instanceConfig.domain}`);

      try {
        const response = await axiosInstance.get(`/issue/${issue_key}/transitions`);

        const transitions = response.data.transitions || [];

        if (transitions.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No transitions available for issue ${issue_key}. The issue may be in a final status or you may not have permission to transition it.`,
              },
            ],
          };
        }

        // Format transitions for display
        let output = `Available transitions for issue ${issue_key}:\n\n`;

        transitions.forEach((transition: any, index: number) => {
          output += `${index + 1}. **${transition.name}** (ID: ${transition.id})\n`;

          if (transition.to) {
            output += `   → Moves to: ${transition.to.name}\n`;
            output += `   → Status Category: ${transition.to.statusCategory?.name || 'Unknown'}\n`;
          }

          if (transition.fields && Object.keys(transition.fields).length > 0) {
            output += `   → Required Fields:\n`;
            Object.entries(transition.fields).forEach(([fieldKey, fieldInfo]: [string, any]) => {
              const required = fieldInfo.required ? ' (Required)' : ' (Optional)';
              output += `     - ${fieldInfo.name || fieldKey}${required}\n`;
            });
          }

          output += '\n';
        });

        output += `\n**Usage:** Use the \`transition_issue\` tool with one of the transition IDs above to perform the transition.`;

        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };
      } catch (error: any) {
        console.error('Error getting transitions:', error.response?.status, error.response?.data);

        // Handle common errors
        if (error.response?.status === 404) {
          return {
            content: [
              {
                type: 'text',
                text: `Issue ${issue_key} not found or you don't have permission to view it. Please check:\n1. Issue key is correct\n2. You have permission to view this issue\n3. Your API credentials are valid for ${instanceConfig.domain}`,
              },
            ],
          };
        }

        if (error.response?.status === 401) {
          return {
            content: [
              {
                type: 'text',
                text: `Authentication failed. Please check your API credentials for ${instanceConfig.domain}.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Failed to get transitions for ${issue_key}. Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`,
            },
          ],
        };
      }
    },
    session
  );
}
