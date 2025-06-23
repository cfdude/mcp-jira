/**
 * Handler for the list_boards tool
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getInstanceForProject, createJiraApiInstances } from "../config.js";
import { BaseArgs } from "../types.js";

export interface ListBoardsArgs extends BaseArgs {
  projectKey?: string;
  type?: 'scrum' | 'kanban' | 'simple';
  name?: string;
  startAt?: number;
  maxResults?: number;
}

export async function handleListBoards(args: ListBoardsArgs) {
  const { working_dir, instance, projectKey, type, name, startAt = 0, maxResults = 50 } = args;
  
  // Get the instance configuration
  const instanceConfig = await getInstanceForProject(working_dir, projectKey, instance);
  const { agileAxiosInstance } = await createJiraApiInstances(instanceConfig);
  
  const effectiveProjectKey = projectKey || instanceConfig.config.projectKey;
  
  console.error("Listing boards with:", {
    projectKey: effectiveProjectKey,
    type,
    name,
    startAt,
    maxResults
  });

  try {
    const params: any = {
      startAt,
      maxResults
    };
    
    if (effectiveProjectKey) params.projectKeyOrId = effectiveProjectKey;
    if (type) params.type = type;
    if (name) params.name = name;

    const response = await agileAxiosInstance.get("/board", { params });
    const boards = response.data.values || [];
    
    if (boards.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No boards found${effectiveProjectKey ? ` for project ${effectiveProjectKey}` : ''}.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `📋 **Boards${effectiveProjectKey ? ` for ${effectiveProjectKey}` : ''}:**

${boards.map((board: any) => {
  return `**${board.name}** (ID: ${board.id})
- **Type:** ${board.type}
- **Location:** ${board.location?.projectName || board.location?.displayName || 'N/A'}
${board.location?.projectKey ? `- **Project:** ${board.location.projectKey}` : ''}
- **Can Edit:** ${board.canEdit ? 'Yes' : 'No'}
- **Private:** ${board.isPrivate ? 'Yes' : 'No'}
- **Favorite:** ${board.favourite ? 'Yes' : 'No'}
`;
}).join('\n')}

**Total:** ${boards.length} board(s) shown (${startAt + 1}-${startAt + boards.length} of ${response.data.total || boards.length})

Use \`get_board_configuration\` to view detailed board settings.`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error listing boards:", error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to list boards: ${error.response?.data?.message || error.message}`
    );
  }
}