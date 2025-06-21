/**
 * Handler for the get_board_configuration tool
 */
import { AxiosInstance } from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

interface GetBoardConfigurationArgs {
  working_dir: string;
  boardId: number;
}

export async function handleGetBoardConfiguration(
  agileAxiosInstance: AxiosInstance,
  args: GetBoardConfigurationArgs
) {
  const { boardId } = args;
  
  console.error("Getting board configuration for:", boardId);

  try {
    // Get board details
    const boardResponse = await agileAxiosInstance.get(`/board/${boardId}`);
    const board = boardResponse.data;
    
    // Get board configuration
    const configResponse = await agileAxiosInstance.get(`/board/${boardId}/configuration`);
    const config = configResponse.data;
    
    // Get current sprints for the board
    let currentSprints = [];
    try {
      const sprintsResponse = await agileAxiosInstance.get(`/board/${boardId}/sprint`, {
        params: { state: 'active' }
      });
      currentSprints = sprintsResponse.data.values || [];
    } catch (e) {
      console.error("Could not fetch sprints for board:", e);
    }

    return {
      content: [
        {
          type: "text",
          text: `⚙️ **Board Configuration: ${board.name}**

**Basic Information:**
- **ID:** ${board.id}
- **Type:** ${board.type}
- **Location:** ${board.location?.projectName || board.location?.displayName || 'N/A'}
${board.location?.projectKey ? `- **Project:** ${board.location.projectKey}` : ''}

**Configuration Details:**
- **Board ID:** ${config.id}
- **Name:** ${config.name}
- **Type:** ${config.type}
${config.filter ? `- **Filter ID:** ${config.filter.id}` : ''}

${config.columnConfig ? `**Columns:**
${config.columnConfig.columns?.map((col: any) => 
  `- **${col.name}** (${col.statuses?.length || 0} statuses)${col.min ? ` [Min: ${col.min}]` : ''}${col.max ? ` [Max: ${col.max}]` : ''}`
).join('\n') || 'No columns configured'}

${config.columnConfig.constraintType ? `**WIP Constraint:** ${config.columnConfig.constraintType}` : ''}
` : ''}

${config.estimation ? `**Estimation:**
- **Type:** ${config.estimation.type}
- **Field:** ${config.estimation.field?.displayName || 'Not configured'}
` : ''}

${config.ranking ? `**Ranking:**
- **Custom Field ID:** ${config.ranking.rankCustomFieldId}
` : ''}

${currentSprints.length > 0 ? `**Active Sprints:**
${currentSprints.map((sprint: any) => 
  `- **${sprint.name}** (ID: ${sprint.id}) - ${sprint.state}`
).join('\n')}
` : '**Active Sprints:** None'}

Use \`list_boards\` to see all boards or \`get_board_reports\` for analytics.`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error getting board configuration:", error);
    
    if (error.response?.status === 404) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Board ${boardId} not found`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get board configuration: ${error.response?.data?.message || error.message}`
    );
  }
}