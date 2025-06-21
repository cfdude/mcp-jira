/**
 * Tool handlers for the Jira MCP server
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { AxiosInstance } from "axios";
import { ListToolsRequestSchema, CallToolRequestSchema, McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { loadProjectConfig } from "../config.js";
import { handleCreateIssue } from "./create-issue.js";
import { handleListIssues } from "./list-issues.js";
import { handleUpdateIssue } from "./update-issue.js";
import { handleGetIssue } from "./get-issue.js";
import { handleDeleteIssue } from "./delete-issue.js";
import { handleAddComment } from "./add-comment.js";

// Sprint Management
import { handleCreateSprint } from "./create-sprint.js";
import { handleUpdateSprint } from "./update-sprint.js";
import { handleGetSprintDetails } from "./get-sprint-details.js";
import { handleMoveIssuesToSprint } from "./move-issues-to-sprint.js";
import { handleCompleteSprint } from "./complete-sprint.js";

// Board Management
import { handleListBoards } from "./list-boards.js";
import { handleGetBoardConfiguration } from "./get-board-configuration.js";
import { handleGetBoardReports } from "./get-board-reports.js";
import { handleManageBoardQuickfilters } from "./manage-board-quickfilters.js";

// Epic Management
import { handleCreateEpic } from "./create-epic.js";
import { handleUpdateEpicDetails } from "./update-epic-details.js";
import { handleRankEpics } from "./rank-epics.js";
import { handleListEpicIssues } from "./list-epic-issues.js";
import { handleMoveIssuesToEpic } from "./move-issues-to-epic.js";

// Advanced Issue Operations
import { handleBulkUpdateIssues } from "./bulk-update-issues.js";
import { handleRankIssues } from "./rank-issues.js";
import { handleEstimateIssue } from "./estimate-issue.js";

// Reporting & Analytics
import { handleGetSprintReport } from "./get-sprint-report.js";
import { handleGetVelocityChartData } from "./get-velocity-chart-data.js";
import { handleGetBurndownChartData } from "./get-burndown-chart-data.js";
import { handleGetBoardCumulativeFlow } from "./get-board-cumulative-flow.js";

/**
 * Register all tool handlers with the server
 */
export function setupToolHandlers(
  server: Server,
  axiosInstance: AxiosInstance,
  agileAxiosInstance: AxiosInstance,
  storyPointsFieldRef: { current: string | null }
) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "create_issue",
        description: "Create a new Jira issue",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config (e.g., 'APA')",
            },
            summary: {
              type: "string",
              description: "Issue summary/title",
            },
            description: {
              type: "string",
              description: "Issue description",
            },
            type: {
              type: "string",
              description: "Issue type (Task, Epic, or Subtask)",
            },
            epic_link: {
              type: "string",
              description: "Epic issue key to link to (e.g., AIS-27)",
            },
            priority: {
              type: "string",
              description: "Issue priority (e.g., 'Highest', 'High', 'Medium', 'Low', 'Lowest')",
            },
            story_points: {
              type: "number",
              description: "Story Points estimate (e.g., 1, 2, 3, 5, 8)",
            },
            labels: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Labels to add to the issue",
            },
            sprint: {
              type: "string",
              description: "Sprint name or 'current' to add to active sprint",
            },
          },
          required: ["working_dir", "summary", "description", "type"],
        },
      },
      {
        name: "list_issues",
        description: "List issues in the project",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config (e.g., 'APA')",
            },
            status: {
              type: "string",
              description:
                'Filter by status (e.g., "To Do", "In Progress", "Done")',
            },
            sortField: {
              type: "string",
              description: "Field to sort by (e.g., 'created', 'updated', 'priority', 'cf[10019]' for Rank). Default is 'cf[10019]' (Rank).",
            },
            sortOrder: {
              type: "string",
              enum: ["ASC", "DESC"],
              description: "Sort order: ASC (ascending) or DESC (descending). Default is ASC.",
            },
            epic_key: {
              type: "string",
              description: "Filter issues by epic (e.g., 'MIG-5615'). Only shows issues linked to this epic.",
            },
          },
          required: ["working_dir"],
        },
      },
      {
        name: "update_issue",
        description: "Update an existing issue",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config (e.g., 'APA')",
            },
            issue_key: {
              type: "string",
              description: "Issue key (e.g., PRJ-123)",
            },
            summary: {
              type: "string",
              description: "New summary/title",
            },
            description: {
              type: "string",
              description: "New description",
            },
            status: {
              type: "string",
              description: "New status",
            },
            epic_link: {
              type: "string",
              description: "Epic issue key to link to (e.g., AIS-27). Set to empty string to remove epic link.",
            },
            priority: {
              type: "string",
              description: "Issue priority (e.g., 'Highest', 'High', 'Medium', 'Low', 'Lowest')",
            },
            story_points: {
              type: "number",
              description: "Story Points estimate (e.g., 1, 2, 3, 5, 8). Set to null to remove story points.",
            },
            labels: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Labels for the issue. Replaces all existing labels.",
            },
            sprint: {
              type: "string",
              description: "Sprint name or 'current' to add to active sprint. Set to empty string to remove from sprint.",
            },
            rank_before_issue: {
              type: "string",
              description: "Issue key to rank the issue before (e.g., 'APA-123'). Cannot be used with rank_after_issue.",
            },
            rank_after_issue: {
              type: "string",
              description: "Issue key to rank the issue after (e.g., 'APA-123'). Cannot be used with rank_before_issue.",
            },
          },
          required: ["working_dir", "issue_key"],
        },
      },
      {
        name: "get_issue",
        description: "Get details of a specific issue",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            issue_key: {
              type: "string",
              description: "Issue key (e.g., PRJ-123)",
            },
          },
          required: ["working_dir", "issue_key"],
        },
      },
      {
        name: "delete_issue",
        description: "Delete a Jira issue",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            issue_key: {
              type: "string",
              description: "Issue key (e.g., PRJ-123)",
            },
          },
          required: ["working_dir", "issue_key"],
        },
      },
      {
        name: "add_comment",
        description: "Add a comment to an existing issue",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            issue_key: {
              type: "string",
              description: "Issue key (e.g., PRJ-123)",
            },
            comment: {
              type: "string",
              description: "Comment text to add to the issue",
            },
          },
          required: ["working_dir", "issue_key", "comment"],
        },
      },
      
      // Sprint Management Tools
      {
        name: "create_sprint",
        description: "Create a new sprint",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config",
            },
            name: {
              type: "string",
              description: "Sprint name",
            },
            goal: {
              type: "string",
              description: "Sprint goal (optional)",
            },
            startDate: {
              type: "string",
              description: "Sprint start date in ISO format (optional)",
            },
            endDate: {
              type: "string",
              description: "Sprint end date in ISO format (optional)",
            },
            boardId: {
              type: "number",
              description: "Board ID (optional, will auto-detect from project)",
            },
          },
          required: ["working_dir", "name"],
        },
      },
      {
        name: "update_sprint",
        description: "Update an existing sprint",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            sprintId: {
              type: "number",
              description: "Sprint ID to update",
            },
            name: {
              type: "string",
              description: "New sprint name",
            },
            goal: {
              type: "string",
              description: "New sprint goal",
            },
            startDate: {
              type: "string",
              description: "New start date in ISO format",
            },
            endDate: {
              type: "string",
              description: "New end date in ISO format",
            },
            state: {
              type: "string",
              enum: ["active", "closed", "future"],
              description: "Sprint state",
            },
          },
          required: ["working_dir", "sprintId"],
        },
      },
      {
        name: "get_sprint_details",
        description: "Get detailed information about a sprint including progress and issues",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            sprintId: {
              type: "number",
              description: "Sprint ID to get details for",
            },
          },
          required: ["working_dir", "sprintId"],
        },
      },
      {
        name: "move_issues_to_sprint",
        description: "Move issues to a specific sprint",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            sprintId: {
              type: "number",
              description: "Target sprint ID",
            },
            issueKeys: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of issue keys to move to the sprint",
            },
          },
          required: ["working_dir", "sprintId", "issueKeys"],
        },
      },
      {
        name: "complete_sprint",
        description: "Complete/close an active sprint",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            sprintId: {
              type: "number",
              description: "Sprint ID to complete",
            },
          },
          required: ["working_dir", "sprintId"],
        },
      },
      
      // Board Management Tools
      {
        name: "list_boards",
        description: "List all boards in the project or workspace",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to filter boards",
            },
            type: {
              type: "string",
              enum: ["scrum", "kanban", "simple"],
              description: "Board type filter",
            },
            name: {
              type: "string",
              description: "Board name filter",
            },
            startAt: {
              type: "number",
              description: "Pagination start index",
            },
            maxResults: {
              type: "number",
              description: "Maximum results to return",
            },
          },
          required: ["working_dir"],
        },
      },
      {
        name: "get_board_configuration",
        description: "Get detailed configuration of a board including columns and settings",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            boardId: {
              type: "number",
              description: "Board ID to get configuration for",
            },
          },
          required: ["working_dir", "boardId"],
        },
      },
      {
        name: "get_board_reports",
        description: "Get board reports and current metrics",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            boardId: {
              type: "number",
              description: "Board ID to get reports for",
            },
          },
          required: ["working_dir", "boardId"],
        },
      },
      {
        name: "manage_board_quickfilters",
        description: "List or get details of board quickfilters",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            boardId: {
              type: "number",
              description: "Board ID",
            },
            action: {
              type: "string",
              enum: ["list", "get"],
              description: "Action to perform: list all quickfilters or get specific one",
            },
            quickfilterId: {
              type: "number",
              description: "Quickfilter ID (required when action is 'get')",
            },
          },
          required: ["working_dir", "boardId", "action"],
        },
      },
      
      // Epic Management Tools
      {
        name: "create_epic",
        description: "Create a new epic",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config",
            },
            name: {
              type: "string",
              description: "Epic name",
            },
            summary: {
              type: "string",
              description: "Epic summary/title",
            },
            description: {
              type: "string",
              description: "Epic description",
            },
            priority: {
              type: "string",
              description: "Epic priority",
            },
            labels: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Labels for the epic",
            },
          },
          required: ["working_dir", "name", "summary"],
        },
      },
      {
        name: "update_epic_details",
        description: "Update epic details using Agile API",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            epicKey: {
              type: "string",
              description: "Epic key (e.g., PROJ-123)",
            },
            name: {
              type: "string",
              description: "New epic name",
            },
            summary: {
              type: "string",
              description: "New epic summary",
            },
            done: {
              type: "boolean",
              description: "Mark epic as done/not done",
            },
            color: {
              type: "string",
              description: "Epic color (e.g., color_1, color_2, etc.)",
            },
          },
          required: ["working_dir", "epicKey"],
        },
      },
      {
        name: "rank_epics",
        description: "Rank epics relative to each other",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            epicToRank: {
              type: "string",
              description: "Epic key to rank",
            },
            rankBeforeEpic: {
              type: "string",
              description: "Epic key to rank before (cannot use with rankAfterEpic)",
            },
            rankAfterEpic: {
              type: "string",
              description: "Epic key to rank after (cannot use with rankBeforeEpic)",
            },
            rankCustomFieldId: {
              type: "number",
              description: "Custom field ID for ranking",
            },
          },
          required: ["working_dir", "epicToRank"],
        },
      },
      {
        name: "list_epic_issues",
        description: "List all issues in an epic",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            epicKey: {
              type: "string",
              description: "Epic key to list issues for",
            },
            startAt: {
              type: "number",
              description: "Pagination start index",
            },
            maxResults: {
              type: "number",
              description: "Maximum results to return",
            },
          },
          required: ["working_dir", "epicKey"],
        },
      },
      {
        name: "move_issues_to_epic",
        description: "Move issues to an epic",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            epicKey: {
              type: "string",
              description: "Target epic key",
            },
            issueKeys: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of issue keys to move to the epic",
            },
          },
          required: ["working_dir", "epicKey", "issueKeys"],
        },
      },
      
      // Advanced Issue Operations
      {
        name: "bulk_update_issues",
        description: "Update multiple issues at once",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            issueKeys: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of issue keys to update",
            },
            updates: {
              type: "object",
              properties: {
                status: {
                  type: "string",
                  description: "New status for all issues",
                },
                assignee: {
                  type: "string",
                  description: "New assignee for all issues (account ID or 'unassigned')",
                },
                priority: {
                  type: "string",
                  description: "New priority for all issues",
                },
                labels: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "New labels for all issues",
                },
                sprint: {
                  type: "string",
                  description: "Sprint name or 'remove' to remove from sprint",
                },
                storyPoints: {
                  type: "number",
                  description: "Story points for all issues",
                },
              },
              description: "Updates to apply to all issues",
            },
          },
          required: ["working_dir", "issueKeys", "updates"],
        },
      },
      {
        name: "rank_issues",
        description: "Rank multiple issues relative to other issues",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            issues: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of issue keys to rank",
            },
            rankBeforeIssue: {
              type: "string",
              description: "Issue key to rank before (cannot use with rankAfterIssue)",
            },
            rankAfterIssue: {
              type: "string",
              description: "Issue key to rank after (cannot use with rankBeforeIssue)",
            },
            rankCustomFieldId: {
              type: "number",
              description: "Custom field ID for ranking",
            },
          },
          required: ["working_dir", "issues"],
        },
      },
      {
        name: "estimate_issue",
        description: "Set estimation value for an issue",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            issueKey: {
              type: "string",
              description: "Issue key to set estimation for",
            },
            value: {
              type: "string",
              description: "Estimation value",
            },
          },
          required: ["working_dir", "issueKey", "value"],
        },
      },
      
      // Reporting & Analytics Tools
      {
        name: "get_sprint_report",
        description: "Get comprehensive sprint report with metrics and analysis",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            boardId: {
              type: "number",
              description: "Board ID",
            },
            sprintId: {
              type: "number",
              description: "Sprint ID to generate report for",
            },
          },
          required: ["working_dir", "boardId", "sprintId"],
        },
      },
      {
        name: "get_velocity_chart_data",
        description: "Get velocity chart data for team performance analysis",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            boardId: {
              type: "number",
              description: "Board ID",
            },
            numberOfSprints: {
              type: "number",
              description: "Number of recent sprints to analyze (default: 10)",
            },
          },
          required: ["working_dir", "boardId"],
        },
      },
      {
        name: "get_burndown_chart_data",
        description: "Get burndown chart data for a specific sprint",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            sprintId: {
              type: "number",
              description: "Sprint ID to get burndown data for",
            },
          },
          required: ["working_dir", "sprintId"],
        },
      },
      {
        name: "get_board_cumulative_flow",
        description: "Get cumulative flow diagram data for a board",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            boardId: {
              type: "number",
              description: "Board ID to get cumulative flow data for",
            },
          },
          required: ["working_dir", "boardId"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { working_dir, ...args } = request.params.arguments as any;
      
      // Load project configuration
      const config = await loadProjectConfig(working_dir);
      const projectKey = config.projectKey;
      
      // Update story points field reference
      if (config.storyPointsField) {
        console.error("Found story points field in config:", config.storyPointsField);
        storyPointsFieldRef.current = config.storyPointsField;
      } else {
        console.error("No story points field found in this config");
        storyPointsFieldRef.current = null;
      }

      // Route to the appropriate handler based on the tool name
      switch (request.params.name) {
        case "create_issue":
          return handleCreateIssue(axiosInstance, agileAxiosInstance, args.projectKey || projectKey, storyPointsFieldRef.current, args);
        
        case "list_issues":
          return handleListIssues(axiosInstance, args.projectKey || projectKey, storyPointsFieldRef.current, args);
        
        case "update_issue":
          return handleUpdateIssue(axiosInstance, agileAxiosInstance, args.projectKey || projectKey, storyPointsFieldRef.current, args);
        
        case "get_issue":
          return handleGetIssue(axiosInstance, agileAxiosInstance, projectKey, storyPointsFieldRef.current, args);
        
        case "delete_issue":
          return handleDeleteIssue(axiosInstance, args);
        
        case "add_comment":
          return handleAddComment(axiosInstance, args);
        
        // Sprint Management
        case "create_sprint":
          return handleCreateSprint(agileAxiosInstance, args.projectKey || projectKey, args);
        
        case "update_sprint":
          return handleUpdateSprint(agileAxiosInstance, args);
        
        case "get_sprint_details":
          return handleGetSprintDetails(agileAxiosInstance, args);
        
        case "move_issues_to_sprint":
          return handleMoveIssuesToSprint(agileAxiosInstance, args);
        
        case "complete_sprint":
          return handleCompleteSprint(agileAxiosInstance, args);
        
        // Board Management
        case "list_boards":
          return handleListBoards(agileAxiosInstance, args.projectKey || projectKey, args);
        
        case "get_board_configuration":
          return handleGetBoardConfiguration(agileAxiosInstance, args);
        
        case "get_board_reports":
          return handleGetBoardReports(agileAxiosInstance, args);
        
        case "manage_board_quickfilters":
          return handleManageBoardQuickfilters(agileAxiosInstance, args);
        
        // Epic Management
        case "create_epic":
          return handleCreateEpic(axiosInstance, args.projectKey || projectKey, args);
        
        case "update_epic_details":
          return handleUpdateEpicDetails(agileAxiosInstance, args);
        
        case "rank_epics":
          return handleRankEpics(agileAxiosInstance, args);
        
        case "list_epic_issues":
          return handleListEpicIssues(agileAxiosInstance, args);
        
        case "move_issues_to_epic":
          return handleMoveIssuesToEpic(agileAxiosInstance, args);
        
        // Advanced Issue Operations
        case "bulk_update_issues":
          return handleBulkUpdateIssues(axiosInstance, agileAxiosInstance, args.projectKey || projectKey, storyPointsFieldRef.current, args);
        
        case "rank_issues":
          return handleRankIssues(agileAxiosInstance, args);
        
        case "estimate_issue":
          return handleEstimateIssue(agileAxiosInstance, args);
        
        // Reporting & Analytics
        case "get_sprint_report":
          return handleGetSprintReport(agileAxiosInstance, args);
        
        case "get_velocity_chart_data":
          return handleGetVelocityChartData(agileAxiosInstance, args);
        
        case "get_burndown_chart_data":
          return handleGetBurndownChartData(agileAxiosInstance, args);
        
        case "get_board_cumulative_flow":
          return handleGetBoardCumulativeFlow(agileAxiosInstance, args);
        
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Jira API Error:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
        throw new McpError(
          ErrorCode.InternalError,
          `Jira API error: ${JSON.stringify(
            error.response?.data ?? error.message
          )}`
        );
      }
      throw error;
    }
  });
}

// Import axios for error handling
import axios from "axios";