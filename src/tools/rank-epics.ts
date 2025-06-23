/**
 * Handler for the rank_epics tool
 */
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { getInstanceForProject } from "../config.js";
import { createJiraApiInstances } from "../utils/jira-api.js";
import { RankEpicsArgs } from "../types.js";

export async function handleRankEpics(args: RankEpicsArgs) {
  const { working_dir, instance, epicToRank, rankBeforeEpic, rankAfterEpic, rankCustomFieldId } = args;
  
  // Extract project key from epic key (e.g., "MIG-123" -> "MIG")
  const projectKey = epicToRank.split('-')[0];
  
  // Get the instance configuration
  const instanceConfig = await getInstanceForProject(working_dir, projectKey, instance);
  const { agileAxiosInstance } = await createJiraApiInstances(instanceConfig);
  
  console.error("Ranking epics:", {
    epicToRank,
    rankBeforeEpic,
    rankAfterEpic,
    rankCustomFieldId
  });

  // Validate that only one ranking option is provided
  if (rankBeforeEpic && rankAfterEpic) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "Cannot specify both rankBeforeEpic and rankAfterEpic. Choose one."
    );
  }

  if (!rankBeforeEpic && !rankAfterEpic) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "Must specify either rankBeforeEpic or rankAfterEpic"
    );
  }

  const rankData: any = {};
  if (rankBeforeEpic) rankData.rankBeforeEpic = rankBeforeEpic;
  if (rankAfterEpic) rankData.rankAfterEpic = rankAfterEpic;
  if (rankCustomFieldId) rankData.rankCustomFieldId = rankCustomFieldId;

  try {
    const response = await agileAxiosInstance.put(`/epic/${epicToRank}/rank`, rankData);
    
    return {
      content: [
        {
          type: "text",
          text: `✅ Epic ranked successfully!

📊 **Ranking Details:**
- **Epic:** ${epicToRank}
${rankBeforeEpic ? `- **Ranked Before:** ${rankBeforeEpic}` : ''}
${rankAfterEpic ? `- **Ranked After:** ${rankAfterEpic}` : ''}
${rankCustomFieldId ? `- **Custom Field ID:** ${rankCustomFieldId}` : ''}

The epic has been repositioned in the epic ranking order.`,
        },
      ],
    };
  } catch (error: any) {
    console.error("Error ranking epics:", error);
    
    if (error.response?.status === 404) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Epic ${epicToRank} not found or target epic for ranking not found`
      );
    }
    
    if (error.response?.status === 400) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid ranking request: ${error.response?.data?.message || 'Check epic keys and ranking parameters'}`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to rank epics: ${error.response?.data?.message || error.message}`
    );
  }
}