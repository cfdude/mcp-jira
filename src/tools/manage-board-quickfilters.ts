/**
 * Handler for the manage_board_quickfilters tool
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { withJiraContext } from '../utils/tool-wrapper.js';
import { BaseArgs } from '../types.js';
import type { SessionState } from '../session-manager.js';

export interface ManageBoardQuickfiltersArgs extends BaseArgs {
  boardId: number;
  action: 'list' | 'get';
  quickfilterId?: number;
}

export async function handleManageBoardQuickfilters(
  args: ManageBoardQuickfiltersArgs,
  session?: SessionState
) {
  return withJiraContext(
    args,
    { requiresProject: false },
    async (toolArgs, { agileAxiosInstance }) => {
      const { boardId, action, quickfilterId } = toolArgs;

      console.error('Managing board quickfilters:', {
        boardId,
        action,
        quickfilterId,
      });

      try {
        if (action === 'list') {
          // List all quickfilters for the board
          const response = await agileAxiosInstance.get(`/board/${boardId}/quickfilter`);
          const quickfilters = response.data.values || [];

          if (quickfilters.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `📋 **Quickfilters for Board ${boardId}:**

No quickfilters found for this board.`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `📋 **Quickfilters for Board ${boardId}:**

${quickfilters
  .map((filter: any) => {
    return `**${filter.name}** (ID: ${filter.id})
- **Query:** ${filter.jql || 'No JQL defined'}
- **Description:** ${filter.description || 'No description'}
- **Position:** ${filter.position || 'N/A'}
`;
  })
  .join('\n')}

**Total:** ${quickfilters.length} quickfilter(s)

Use \`manage_board_quickfilters\` with action 'get' to view detailed filter information.`,
              },
            ],
          };
        } else if (action === 'get') {
          if (!quickfilterId) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              "quickfilterId is required when action is 'get'"
            );
          }

          // Get specific quickfilter details
          const response = await agileAxiosInstance.get(
            `/board/${boardId}/quickfilter/${quickfilterId}`
          );
          const filter = response.data;

          return {
            content: [
              {
                type: 'text',
                text: `🔍 **Quickfilter Details:**

**${filter.name}** (ID: ${filter.id})
- **Board ID:** ${boardId}
- **Query (JQL):** ${filter.jql || 'No JQL defined'}
- **Description:** ${filter.description || 'No description'}
- **Position:** ${filter.position || 'N/A'}

This quickfilter can be used to filter issues on the board based on the JQL query above.`,
              },
            ],
          };
        } else {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid action: ${action}. Supported actions: list, get`
          );
        }
      } catch (error: any) {
        console.error('Error managing board quickfilters:', error);

        if (error.response?.status === 404) {
          if (quickfilterId) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Quickfilter ${quickfilterId} not found on board ${boardId}`
            );
          } else {
            throw new McpError(ErrorCode.InvalidRequest, `Board ${boardId} not found`);
          }
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Failed to manage board quickfilters: ${error.response?.data?.message || error.message}`
        );
      }
    },
    session
  );
}
