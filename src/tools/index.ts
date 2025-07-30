/**
 * Tool handlers for the Jira MCP server
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema, McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
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

// Project Planning Tools
import { handleListVersions } from "./list-versions.js";
import { handleCreateVersion } from "./create-version.js";
import { handleGetVersionProgress } from "./get-version-progress.js";
import { handleListComponents } from "./list-components.js";
import { handleCreateComponent } from "./create-component.js";
import { handleGetComponentProgress } from "./get-component-progress.js";
import { handleSearchProjects } from "./search-projects.js";
import { handleGetProjectDetails } from "./get-project-details.js";
import { handleSearchIssuesJql } from "./search-issues-jql.js";
import { handleCreateFilter } from "./create-filter.js";
import { handleListPlans } from "./list-plans.js";
import { handleGetProjectStatuses } from "./get-project-statuses.js";
import { handleGetIssueTypes } from "./get-issue-types.js";
import { handleListInstances } from "./list-instances.js";

// Plans Management
import { handleCreatePlan } from "./create-plan.js";
import { handleGetPlan } from "./get-plan.js";
import { handleUpdatePlan } from "./update-plan.js";
import { handleGetPlanTeams } from "./get-plan-teams.js";
import { handleAddPlanTeam } from "./add-plan-team.js";
import { handleRemovePlanTeam } from "./remove-plan-team.js";
import { handleArchivePlan } from "./archive-plan.js";
import { handleDuplicatePlan } from "./duplicate-plan.js";
import { handleTrashPlan } from "./trash-plan.js";

/**
 * Register all tool handlers with the server
 */
export function setupToolHandlers(
  server: Server,
  storyPointsFieldRef: { current: string | null }
) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "create_issue",
        description: "Create a new Jira issue. IMPORTANT FOR AI: Always specify 'instance' and 'projectKey' parameters explicitly to avoid configuration errors. Example: {working_dir: '/path/to/project', instance: 'onvex', projectKey: 'JOB', summary: 'Fix login bug', type: 'Task'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "REQUIRED: Project key (e.g., 'JOB', 'CAO', 'MIG'). Always specify this parameter to ensure issues are created in the correct project.",
            },
            instance: {
              type: "string", 
              description: "REQUIRED: Jira instance name (e.g., 'onvex', 'highway'). Always specify this parameter to avoid instance resolution errors. Use list_instances to see available instances.",
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
        description: "List issues in a specific Jira project. CRITICAL FOR AI: ALWAYS specify 'instance' and 'projectKey' parameters. Use this to see existing issues before creating new ones or to get issue keys for updates. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "REQUIRED: Project key to list issues from (e.g., 'JOB', 'CAO'). Always specify to target the correct project.",
            },
            instance: {
              type: "string",
              description: "REQUIRED: Jira instance name (e.g., 'onvex', 'highway'). Always specify to avoid errors. Use list_instances first.",
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
        description: "Update an existing Jira issue. CRITICAL FOR AI: ALWAYS specify 'instance' parameter and use exact issue key from list_issues. Commonly used to change status, assignee, or add comments. Example: {working_dir: '/path', instance: 'onvex', issue_key: 'JOB-123', status: 'In Progress'}",
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
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
            assignee: {
              type: "string",
              description: "Assignee display name (e.g., 'Esther Yang'), email, or account ID. Use 'unassigned' or null to unassign.",
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
        description: "Get detailed information about a specific Jira issue. CRITICAL FOR AI: ALWAYS specify 'instance' parameter. Use this to get current status, description, and fields before updating. Example: {working_dir: '/path', instance: 'onvex', issue_key: 'JOB-123'}",
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
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
          },
          required: ["working_dir", "issue_key"],
        },
      },
      {
        name: "delete_issue",
        description: "Delete a Jira issue. WARNING: Requires 'Delete Issues' permission. Only issue creators and project administrators can delete issues. Consider using status changes or labels instead of deletion.",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Add a comment to an existing Jira issue. CRITICAL FOR AI: ALWAYS specify 'instance' parameter and use exact issue key from list_issues. Example: {working_dir: '/path', instance: 'onvex', issue_key: 'JOB-123', comment: 'Updated requirements'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
      {
        name: "list_instances",
        description: "List all configured Jira instances and their project mappings. CRITICAL FOR AI: Use this FIRST to discover available instances before any other operations. Shows which projects are mapped to which instances. No additional parameters needed besides working_dir. Example: {working_dir: '/path/to/project'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
          },
          required: ["working_dir"],
        },
      },
      
      // Sprint Management Tools
      {
        name: "create_sprint",
        description: "Create a new sprint in a Jira board. CRITICAL FOR AI: ALWAYS specify 'instance' and 'projectKey'. Use list_boards first to verify board exists. Creates sprint in 'future' state - use update_sprint to start it. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB', name: 'Sprint 1', goal: 'MVP features'}",
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
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Update sprint details or change sprint state (future→active→closed). CRITICAL FOR AI: ALWAYS specify 'instance' parameter. To activate a sprint, MUST provide both startDate and endDate. Example: {working_dir: '/path', instance: 'onvex', sprintId: 123, state: 'active', startDate: '2025-07-29', endDate: '2025-08-12'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
              description: "New start date in ISO format (REQUIRED when activating sprint). Examples: '2025-07-29T00:00:00Z' or '2025-07-29'",
            },
            endDate: {
              type: "string",
              description: "New end date in ISO format (REQUIRED when activating sprint). Examples: '2025-08-12T23:59:59Z' or '2025-08-12'",
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
        description: "Get detailed information about a sprint including progress and issues. CRITICAL FOR AI: ALWAYS specify 'instance' parameter and use sprintId from create_sprint or board reports. Example: {working_dir: '/path', instance: 'onvex', sprintId: 335}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Add issues to a sprint. CRITICAL FOR AI: ALWAYS specify 'instance' parameter. Use list_issues first to get issue keys, and ensure sprint exists. Example: {working_dir: '/path', instance: 'onvex', sprintId: 123, issueKeys: ['JOB-1', 'JOB-2']}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Complete/close an active sprint. CRITICAL FOR AI: ALWAYS specify 'instance' parameter. Use get_sprint_details first to verify sprint is active. Example: {working_dir: '/path', instance: 'onvex', sprintId: 335}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "List all Jira boards for a project. CRITICAL FOR AI: ALWAYS specify 'instance' and usually 'projectKey' to filter results. Use this first to find board IDs for sprint operations. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB'}",
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
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Get detailed configuration of a board including columns and settings. CRITICAL FOR AI: ALWAYS specify 'instance' and use boardId from list_boards. Example: {working_dir: '/path', instance: 'onvex', boardId: 102}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Get board reports and current metrics. CRITICAL FOR AI: ALWAYS specify 'instance' and use boardId from list_boards. Example: {working_dir: '/path', instance: 'onvex', boardId: 102}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "List or get details of board quickfilters. CRITICAL FOR AI: ALWAYS specify 'instance' and use boardId from list_boards. Example: {working_dir: '/path', instance: 'onvex', boardId: 102, action: 'list'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Create a new Epic issue. CRITICAL FOR AI: ALWAYS specify 'instance' and 'projectKey'. Epics organize related stories/tasks. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB', name: 'User Auth', summary: 'Authentication System Epic'}",
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
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Update epic details using Agile API. CRITICAL FOR AI: ALWAYS specify 'instance' and use exact epicKey from list_epic_issues. Example: {working_dir: '/path', instance: 'onvex', epicKey: 'JOB-1', name: 'Updated Epic Name'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Rank epics relative to each other. CRITICAL FOR AI: ALWAYS specify 'instance' and use exact epic keys. Example: {working_dir: '/path', instance: 'onvex', epicToRank: 'JOB-1', rankAfterEpic: 'JOB-2'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "List all issues in an epic. CRITICAL FOR AI: ALWAYS specify 'instance' and use exact epicKey from create_epic. Example: {working_dir: '/path', instance: 'onvex', epicKey: 'JOB-1'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Move issues to an epic. CRITICAL FOR AI: ALWAYS specify 'instance' and use exact keys from list_issues and create_epic. Example: {working_dir: '/path', instance: 'onvex', epicKey: 'JOB-1', issueKeys: ['JOB-5', 'JOB-6']}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Update multiple issues at once. CRITICAL FOR AI: ALWAYS specify 'instance' and use exact issue keys from list_issues. Example: {working_dir: '/path', instance: 'onvex', issueKeys: ['JOB-1', 'JOB-2'], updates: {status: 'In Progress'}}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
                  description: "New assignee for all issues - display name (e.g., 'Esther Yang'), email, or account ID. Use 'unassigned' to unassign.",
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
        description: "Rank multiple issues relative to other issues. CRITICAL FOR AI: ALWAYS specify 'instance' and use exact issue keys. Example: {working_dir: '/path', instance: 'onvex', issues: ['JOB-1'], rankAfterIssue: 'JOB-2'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Set estimation value for an issue. CRITICAL FOR AI: ALWAYS specify 'instance' and use exact issue key. Example: {working_dir: '/path', instance: 'onvex', issueKey: 'JOB-1', value: '5'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Get comprehensive sprint report with metrics and analysis. CRITICAL FOR AI: ALWAYS specify 'instance' and use boardId from list_boards. Example: {working_dir: '/path', instance: 'onvex', boardId: 102, sprintId: 335}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Get velocity chart data for team performance analysis. CRITICAL FOR AI: ALWAYS specify 'instance' and use boardId from list_boards. Example: {working_dir: '/path', instance: 'onvex', boardId: 102}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Get burndown chart data for a specific sprint. CRITICAL FOR AI: ALWAYS specify 'instance' and use sprintId from create_sprint. Example: {working_dir: '/path', instance: 'onvex', sprintId: 335}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
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
        description: "Get cumulative flow diagram data for a board. CRITICAL FOR AI: ALWAYS specify 'instance' and use boardId from list_boards. Example: {working_dir: '/path', instance: 'onvex', boardId: 102}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            boardId: {
              type: "number",
              description: "Board ID to get cumulative flow data for",
            },
          },
          required: ["working_dir", "boardId"],
        },
      },
      
      // Project Planning Tools - Version Management
      {
        name: "list_versions",
        description: "List project versions for release planning and milestone tracking. CRITICAL FOR AI: ALWAYS specify 'instance' and usually 'projectKey'. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config (e.g., 'PROJ', 'APP')",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
          },
          required: ["working_dir"],
        },
      },
      {
        name: "create_version",
        description: "Create a new project version/release for organizing work by milestones. CRITICAL FOR AI: ALWAYS specify 'instance' and 'projectKey'. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB', name: 'v1.0.0'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config (e.g., 'PROJ', 'APP')",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            name: {
              type: "string",
              description: "Version name - use semantic versioning (e.g., '1.0.0', '2.1.0') or milestone names (e.g., 'Q1 2024', 'Beta Release')",
            },
            description: {
              type: "string",
              description: "Version description explaining scope, goals, or key features (e.g., 'Initial release with core features', 'Bug fixes and performance improvements')",
            },
            startDate: {
              type: "string",
              description: "Version start date in YYYY-MM-DD format (e.g., '2024-01-15'). When development/planning begins.",
            },
            releaseDate: {
              type: "string",
              description: "Version release date in YYYY-MM-DD format (e.g., '2024-03-01'). Target completion date for milestone tracking.",
            },
            archived: {
              type: "boolean",
              description: "Whether the version is archived (default: false). Only set to true for old versions no longer in use.",
            },
            released: {
              type: "boolean",
              description: "Whether the version is released (default: false). Set to true only when version is completed and deployed.",
            },
          },
          required: ["working_dir", "name"],
        },
      },
      {
        name: "get_version_progress",
        description: "Get detailed version progress including issue counts, status breakdown, and timeline analysis. CRITICAL FOR AI: ALWAYS specify 'instance' and use versionId from list_versions. Example: {working_dir: '/path', instance: 'onvex', versionId: '10123'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config (e.g., 'PROJ', 'APP')",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            versionId: {
              type: "string",
              description: "Version ID to get progress for (numeric ID from list_versions output, e.g., '10123')",
            },
          },
          required: ["working_dir", "versionId"],
        },
      },
      
      // Project Planning Tools - Component Management
      {
        name: "list_components",
        description: "List project components for feature-based work organization. CRITICAL FOR AI: ALWAYS specify 'instance' and usually 'projectKey'. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config (e.g., 'PROJ', 'APP')",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
          },
          required: ["working_dir"],
        },
      },
      {
        name: "create_component",
        description: "Create a new project component for organizing work by feature areas. CRITICAL FOR AI: ALWAYS specify 'instance' and 'projectKey'. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB', name: 'Frontend UI'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config (e.g., 'PROJ', 'APP')",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            name: {
              type: "string",
              description: "Component name - use clear, descriptive names (e.g., 'Frontend UI', 'Payment API', 'User Management', 'Mobile App', 'Database Layer')",
            },
            description: {
              type: "string",
              description: "Component description explaining scope and responsibilities (e.g., 'Handles user authentication and authorization', 'React-based user interface components')",
            },
            leadAccountId: {
              type: "string",
              description: "Account ID of the component lead/owner responsible for this area (get from user search or team directory)",
            },
            assigneeType: {
              type: "string",
              description: "How new issues in this component get assigned: 'PROJECT_DEFAULT' (use project settings), 'COMPONENT_LEAD' (auto-assign to lead), 'PROJECT_LEAD' (assign to project lead), 'UNASSIGNED' (leave unassigned)",
            },
          },
          required: ["working_dir", "name"],
        },
      },
      {
        name: "get_component_progress",
        description: "Get detailed component progress with issue distribution and completion metrics. CRITICAL FOR AI: ALWAYS specify 'instance' and use componentId from list_components. Example: {working_dir: '/path', instance: 'onvex', componentId: '10456'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config (e.g., 'PROJ', 'APP')",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            componentId: {
              type: "string",
              description: "Component ID to get progress for (numeric ID from list_components output, e.g., '10456')",
            },
          },
          required: ["working_dir", "componentId"],
        },
      },
      
      // Project Planning Tools - Project Search
      {
        name: "search_projects",
        description: "Search and discover projects across the Jira instance with advanced filtering. CRITICAL FOR AI: ALWAYS specify 'instance'. Example: {working_dir: '/path', instance: 'onvex', query: 'mobile'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            query: {
              type: "string",
              description: "Search query for project name or key. Examples: 'mobile' (finds projects with 'mobile'), 'PROJ' (finds project keys containing PROJ), 'api service' (finds projects with both terms)",
            },
            typeKey: {
              type: "string",
              description: "Project type filter: 'software' (development projects), 'service_desk' (IT support projects), 'business' (business process projects). Leave empty for all types.",
            },
            categoryId: {
              type: "string",
              description: "Project category ID filter (numeric ID from project categories). Use to group projects by department or purpose.",
            },
            status: {
              type: "string",
              description: "Project status filter: 'live' (active projects), 'archived' (completed/inactive), 'deleted' (marked for deletion). Default shows live projects.",
            },
            expand: {
              type: "string",
              description: "Additional details to include. Comma-separated: 'description' (project descriptions), 'lead' (project leads), 'url' (project URLs), 'projectKeys' (related keys), 'insight' (metrics)",
            },
            startAt: {
              type: "number",
              description: "Pagination start index (0-based). Use for large result sets. Example: 0 (first page), 50 (second page if maxResults=50)",
            },
            maxResults: {
              type: "number",
              description: "Maximum results to return per page (1-100, default: 50). Use smaller values for faster responses.",
            },
          },
          required: ["working_dir"],
        },
      },
      {
        name: "get_project_details",
        description: "Get comprehensive project information including components, versions, and features. CRITICAL FOR AI: ALWAYS specify 'instance' and 'projectKey'. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            projectKey: {
              type: "string",
              description: "Project key to get details for (e.g., 'PROJ', 'APP', 'WEB'). Case-sensitive and typically uppercase.",
            },
            expand: {
              type: "string",
              description: "Additional details to include. Comma-separated options: 'description,lead,url' (basic info), 'permissions' (user access), 'insight' (project metrics), 'features' (enabled features). Default includes most useful options.",
            },
          },
          required: ["working_dir", "projectKey"],
        },
      },
      
      // Project Planning Tools - Advanced Planning
      {
        name: "search_issues_jql",
        description: "Advanced issue search using Jira Query Language (JQL) for powerful project analysis. CRITICAL FOR AI: ALWAYS specify 'instance'. Example: {working_dir: '/path', instance: 'onvex', jql: 'project = JOB AND status != Done'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            jql: {
              type: "string",
              description: "JQL query string. Examples: 'project = PROJ AND status != Done' (active work), 'fixVersion = \"1.0.0\" AND assignee = currentUser()' (my release work), 'component = \"Frontend\" AND priority >= High' (critical frontend issues), 'created >= -30d ORDER BY created DESC' (recent issues). Use double quotes for multi-word values.",
            },
            startAt: {
              type: "number",
              description: "Pagination start index (0-based). Use for large result sets. Example: 0 (first page), 50 (second page)",
            },
            maxResults: {
              type: "number",
              description: "Maximum results to return per page (1-1000, default: 50). Use 100+ for comprehensive analysis, 50 or less for quick overviews.",
            },
            fields: {
              type: "string",
              description: "Comma-separated fields to return for performance. Examples: 'summary,status,assignee' (basic info), 'key,summary,status,priority,components,fixVersions' (planning view), '*all' (everything). Default includes essential planning fields.",
            },
            expand: {
              type: "string",
              description: "Additional data to expand. Options: 'names' (field names), 'schema' (field types), 'changelog' (history), 'renderedFields' (formatted values). Use sparingly for performance.",
            },
            validateQuery: {
              type: "boolean",
              description: "Whether to validate JQL syntax before execution (default: false). Set to true when testing complex queries to catch syntax errors.",
            },
          },
          required: ["working_dir", "jql"],
        },
      },
      {
        name: "create_filter",
        description: "Create saved filters for consistent project tracking and reporting. CRITICAL FOR AI: ALWAYS specify 'instance'. Test JQL first with search_issues_jql. Example: {working_dir: '/path', instance: 'onvex', name: 'Sprint Planning', jql: 'project = JOB'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            name: {
              type: "string",
              description: "Filter name - use descriptive names (e.g., 'Sprint Planning View', 'Bug Backlog', 'Release 1.0 Progress', 'Team Frontend Tasks')",
            },
            description: {
              type: "string",
              description: "Filter description explaining purpose and usage (e.g., 'Shows all active bugs for triaging', 'Release tracking for stakeholder updates')",
            },
            jql: {
              type: "string",
              description: "JQL query for the filter. Must be valid JQL tested with search_issues_jql. Examples: 'project = PROJ AND status != Done', 'assignee = currentUser() AND resolution = Unresolved'",
            },
            favourite: {
              type: "boolean",
              description: "Whether to mark as favourite for quick access (default: false). Set to true for frequently used filters.",
            },
            sharePermissions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    description: "Permission type: 'global' (everyone), 'project' (project members), 'group' (specific group), 'role' (project role)",
                  },
                  projectId: {
                    type: "string",
                    description: "Project ID for 'project' type permissions (numeric project ID, not key)",
                  },
                  groupname: {
                    type: "string",
                    description: "Group name for 'group' type permissions (e.g., 'jira-developers', 'project-managers')",
                  },
                  projectRoleId: {
                    type: "string",
                    description: "Role ID for 'role' type permissions (numeric role ID from project roles)",
                  },
                },
                required: ["type"],
              },
              description: "Share permissions for the filter. Examples: [{'type': 'project', 'projectId': '10000'}] (project access), [{'type': 'global'}] (everyone), [{'type': 'group', 'groupname': 'developers'}] (specific group)",
            },
          },
          required: ["working_dir", "name", "jql"],
        },
      },
      {
        name: "list_plans",
        description: "List strategic plans for high-level roadmap and portfolio management (Jira Premium feature). CRITICAL FOR AI: ALWAYS specify 'instance'. Example: {working_dir: '/path', instance: 'onvex'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            startAt: {
              type: "number",
              description: "Pagination start index (0-based). Use for large plan sets in enterprise environments.",
            },
            maxResults: {
              type: "number",
              description: "Maximum results to return per page. Plans are typically fewer than 50 per organization.",
            },
          },
          required: ["working_dir"],
        },
      },
      {
        name: "create_plan",
        description: "Create a new strategic plan for high-level roadmap management (Jira Premium feature)",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            name: {
              type: "string",
              description: "Plan name",
            },
            leadAccountId: {
              type: "string",
              description: "Account ID of the plan lead/owner",
            },
            issueSources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["Project", "Board", "Filter"],
                    description: "Type of issue source",
                  },
                  value: {
                    type: "number",
                    description: "ID of the project, board, or filter",
                  },
                },
                required: ["type", "value"],
              },
              description: "Array of issue sources (projects, boards, filters) to include in the plan",
            },
            scheduling: {
              type: "object",
              properties: {
                estimation: {
                  type: "string",
                  enum: ["StoryPoints", "Days", "Hours"],
                  description: "Estimation method for the plan",
                },
                startDate: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["DueDate", "TargetStartDate", "TargetEndDate", "DateCustomField"],
                      description: "Type of start date source",
                    },
                    dateCustomFieldId: {
                      type: "number",
                      description: "Custom field ID if using DateCustomField type",
                    },
                  },
                  required: ["type"],
                },
                endDate: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["DueDate", "TargetStartDate", "TargetEndDate", "DateCustomField"],
                      description: "Type of end date source",
                    },
                    dateCustomFieldId: {
                      type: "number",
                      description: "Custom field ID if using DateCustomField type",
                    },
                  },
                  required: ["type"],
                },
                inferredDates: {
                  type: "string",
                  enum: ["None", "SprintDates", "ReleaseDates"],
                  description: "How to infer dates from sprints or releases",
                },
                dependencies: {
                  type: "string",
                  enum: ["Sequential", "Concurrent"],
                  description: "How to handle dependencies between work items",
                },
              },
              description: "Scheduling configuration for the plan",
            },
            exclusionRules: {
              type: "object",
              properties: {
                numberOfDaysToShowCompletedIssues: {
                  type: "number",
                  description: "Number of days to show completed issues",
                },
                issueIds: {
                  type: "array",
                  items: { type: "number" },
                  description: "Array of issue IDs to exclude",
                },
                workStatusIds: {
                  type: "array",
                  items: { type: "number" },
                  description: "Array of work status IDs to exclude",
                },
                workStatusCategoryIds: {
                  type: "array",
                  items: { type: "number" },
                  description: "Array of work status category IDs to exclude",
                },
                issueTypeIds: {
                  type: "array",
                  items: { type: "number" },
                  description: "Array of issue type IDs to exclude",
                },
                releaseIds: {
                  type: "array",
                  items: { type: "number" },
                  description: "Array of release IDs to exclude",
                },
              },
              description: "Rules for excluding certain issues from the plan",
            },
            crossProjectReleases: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Name of the cross-project release",
                  },
                  releaseIds: {
                    type: "array",
                    items: { type: "number" },
                    description: "Array of release IDs in this cross-project release",
                  },
                },
                required: ["name", "releaseIds"],
              },
              description: "Cross-project releases to include in the plan",
            },
            customFields: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  customFieldId: {
                    type: "number",
                    description: "ID of the custom field",
                  },
                  filter: {
                    type: "boolean",
                    description: "Whether to enable filtering on this custom field",
                  },
                },
                required: ["customFieldId", "filter"],
              },
              description: "Custom fields to include in the plan",
            },
            permissions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["View", "Edit"],
                    description: "Type of permission",
                  },
                  holder: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: ["Group", "AccountId"],
                        description: "Type of permission holder",
                      },
                      value: {
                        type: "string",
                        description: "Group name or account ID",
                      },
                    },
                    required: ["type", "value"],
                  },
                },
                required: ["type", "holder"],
              },
              description: "Permission settings for the plan",
            },
            useGroupId: {
              type: "boolean",
              description: "Whether to use group ID instead of group name for permissions",
            },
          },
          required: ["working_dir", "name", "issueSources"],
        },
      },
      {
        name: "get_plan",
        description: "Get detailed information about a specific strategic plan (Jira Premium feature)",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            planId: {
              type: "string",
              description: "ID of the plan to retrieve",
            },
          },
          required: ["working_dir", "planId"],
        },
      },
      {
        name: "update_plan",
        description: "Update an existing strategic plan using JSON Patch operations (Jira Premium feature)",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            planId: {
              type: "string",
              description: "ID of the plan to update",
            },
            operations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  op: {
                    type: "string",
                    enum: ["add", "remove", "replace", "move", "copy", "test"],
                    description: "JSON Patch operation type",
                  },
                  path: {
                    type: "string",
                    description: "JSON path to the field to modify (e.g., '/name', '/issueSources/0')",
                  },
                  value: {
                    description: "Value to set (required for add, replace, test operations)",
                  },
                  from: {
                    type: "string",
                    description: "Source path for move and copy operations",
                  },
                },
                required: ["op", "path"],
              },
              description: "Array of JSON Patch operations to apply to the plan",
            },
            useGroupId: {
              type: "boolean",
              description: "Whether to use group ID instead of group name for permissions",
            },
          },
          required: ["working_dir", "planId", "operations"],
        },
      },
      {
        name: "get_plan_teams",
        description: "Get detailed information about teams assigned to a strategic plan (Jira Premium feature)",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            planId: {
              type: "string",
              description: "ID of the plan to get teams for",
            },
          },
          required: ["working_dir", "planId"],
        },
      },
      {
        name: "add_plan_team",
        description: "Add a team to a strategic plan (Jira Premium feature)",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            planId: {
              type: "string",
              description: "ID of the plan to add the team to",
            },
            teamId: {
              type: "string",
              description: "ID of the team to add to the plan",
            },
          },
          required: ["working_dir", "planId", "teamId"],
        },
      },
      {
        name: "remove_plan_team",
        description: "Remove a team from a strategic plan (Jira Premium feature)",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            planId: {
              type: "string",
              description: "ID of the plan to remove the team from",
            },
            teamId: {
              type: "string",
              description: "ID of the team to remove from the plan",
            },
          },
          required: ["working_dir", "planId", "teamId"],
        },
      },
      {
        name: "archive_plan",
        description: "Archive a strategic plan (Jira Premium feature)",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            planId: {
              type: "string",
              description: "ID of the plan to archive",
            },
          },
          required: ["working_dir", "planId"],
        },
      },
      {
        name: "duplicate_plan",
        description: "Duplicate a strategic plan to create a new plan based on existing configuration (Jira Premium feature)",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            planId: {
              type: "string",
              description: "ID of the source plan to duplicate",
            },
            newPlanName: {
              type: "string",
              description: "Name for the new duplicated plan",
            },
            copyTeams: {
              type: "boolean",
              description: "Whether to copy team assignments from the source plan",
            },
            copyScheduling: {
              type: "boolean",
              description: "Whether to copy scheduling configuration from the source plan",
            },
            copyExclusionRules: {
              type: "boolean",
              description: "Whether to copy exclusion rules from the source plan",
            },
            copyCustomFields: {
              type: "boolean",
              description: "Whether to copy custom field configurations from the source plan",
            },
            copyPermissions: {
              type: "boolean",
              description: "Whether to copy permission settings from the source plan",
            },
          },
          required: ["working_dir", "planId", "newPlanName"],
        },
      },
      {
        name: "trash_plan",
        description: "Move a strategic plan to trash (soft delete) (Jira Premium feature)",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
            planId: {
              type: "string",
              description: "ID of the plan to move to trash",
            },
          },
          required: ["working_dir", "planId"],
        },
      },
      
      // Project Planning Tools - Workflow Insight
      {
        name: "get_project_statuses",
        description: "Get comprehensive project workflow statuses and transitions. CRITICAL FOR AI: ALWAYS specify 'instance' and usually 'projectKey'. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config (e.g., 'PROJ', 'APP'). Shows statuses specific to this project's workflow configuration.",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
          },
          required: ["working_dir"],
        },
      },
      {
        name: "get_issue_types",
        description: "Get available issue types, their hierarchy, and required fields. CRITICAL FOR AI: ALWAYS specify 'instance' and usually 'projectKey'. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB'}",
        inputSchema: {
          type: "object",
          properties: {
            working_dir: {
              type: "string",
              description: "Working directory containing .jira-config.json",
            },
            projectKey: {
              type: "string",
              description: "Optional project key to override the default from config (e.g., 'PROJ', 'APP'). Shows issue types available for this specific project.",
            },
            instance: {
              type: "string",
              description: "Optional instance name to override automatic instance selection (e.g., 'highway', 'onvex')",
            },
          },
          required: ["working_dir"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { working_dir, ...args } = request.params.arguments as any;
      
      // Tools that use new multi-instance approach
      const multiInstanceTools = [
        "create_issue", "update_issue", "get_issue", "delete_issue", "add_comment", "list_issues", "list_instances",
        // Sprint Management
        "create_sprint", "update_sprint", "get_sprint_details", "move_issues_to_sprint", "complete_sprint",
        // Board Management  
        "list_boards", "get_board_configuration", "get_board_reports", "manage_board_quickfilters",
        // Epic Management
        "create_epic", "update_epic_details", "rank_epics", "list_epic_issues", "move_issues_to_epic",
        // Advanced Issue Operations
        "bulk_update_issues", "rank_issues", "estimate_issue",
        // Reporting & Analytics
        "get_sprint_report", "get_velocity_chart_data", "get_burndown_chart_data", "get_board_cumulative_flow",
        // Project Planning Tools
        "list_versions", "create_version", "get_version_progress", "list_components", "create_component", "get_component_progress",
        "search_projects", "get_project_details", "search_issues_jql", "create_filter", "list_plans", 
        "get_project_statuses", "get_issue_types",
        // Plans Management
        "create_plan", "get_plan", "update_plan", "get_plan_teams", "add_plan_team", "remove_plan_team", 
        "archive_plan", "duplicate_plan", "trash_plan"
      ];
      
      // Route to the appropriate handler based on the tool name
      switch (request.params.name) {
        case "create_issue":
          return handleCreateIssue({ ...args, working_dir });
        
        case "update_issue":
          return handleUpdateIssue({ ...args, working_dir });
        
        case "get_issue":
          return handleGetIssue({ ...args, working_dir });
        
        case "delete_issue":
          return handleDeleteIssue({ ...args, working_dir });
        
        case "add_comment":
          return handleAddComment({ ...args, working_dir });
        
        case "list_issues":
          return handleListIssues({ ...args, working_dir });
        
        case "list_instances":
          return handleListInstances({ ...args, working_dir });
        
        // Sprint Management
        case "create_sprint":
          return handleCreateSprint({ ...args, working_dir });
        case "update_sprint":
          return handleUpdateSprint({ ...args, working_dir });
        case "get_sprint_details":
          return handleGetSprintDetails({ ...args, working_dir });
        case "move_issues_to_sprint":
          return handleMoveIssuesToSprint({ ...args, working_dir });
        case "complete_sprint":
          return handleCompleteSprint({ ...args, working_dir });
        
        // Board Management
        case "list_boards":
          return handleListBoards({ ...args, working_dir });
        case "get_board_configuration":
          return handleGetBoardConfiguration({ ...args, working_dir });
        case "get_board_reports":
          return handleGetBoardReports({ ...args, working_dir });
        case "manage_board_quickfilters":
          return handleManageBoardQuickfilters({ ...args, working_dir });
        
        // Epic Management
        case "create_epic":
          return handleCreateEpic({ ...args, working_dir });
        case "update_epic_details":
          return handleUpdateEpicDetails({ ...args, working_dir });
        case "rank_epics":
          return handleRankEpics({ ...args, working_dir });
        case "list_epic_issues":
          return handleListEpicIssues({ ...args, working_dir });
        case "move_issues_to_epic":
          return handleMoveIssuesToEpic({ ...args, working_dir });
        
        // Advanced Issue Operations
        case "bulk_update_issues":
          return handleBulkUpdateIssues({ ...args, working_dir });
        case "rank_issues":
          return handleRankIssues({ ...args, working_dir });
        case "estimate_issue":
          return handleEstimateIssue({ ...args, working_dir });
        
        // Reporting & Analytics
        case "get_sprint_report":
          return handleGetSprintReport({ ...args, working_dir });
        case "get_velocity_chart_data":
          return handleGetVelocityChartData({ ...args, working_dir });
        case "get_burndown_chart_data":
          return handleGetBurndownChartData({ ...args, working_dir });
        case "get_board_cumulative_flow":
          return handleGetBoardCumulativeFlow({ ...args, working_dir });
        
        // Project Planning Tools
        case "list_versions":
          return handleListVersions({ ...args, working_dir });
        case "create_version":
          return handleCreateVersion({ ...args, working_dir });
        case "get_version_progress":
          return handleGetVersionProgress({ ...args, working_dir });
        case "list_components":
          return handleListComponents({ ...args, working_dir });
        case "create_component":
          return handleCreateComponent({ ...args, working_dir });
        case "get_component_progress":
          return handleGetComponentProgress({ ...args, working_dir });
        case "search_projects":
          return handleSearchProjects({ ...args, working_dir });
        case "get_project_details":
          return handleGetProjectDetails({ ...args, working_dir });
        case "search_issues_jql":
          return handleSearchIssuesJql({ ...args, working_dir });
        case "create_filter":
          return handleCreateFilter({ ...args, working_dir });
        case "list_plans":
          return handleListPlans({ ...args, working_dir });
        case "get_project_statuses":
          return handleGetProjectStatuses({ ...args, working_dir });
        case "get_issue_types":
          return handleGetIssueTypes({ ...args, working_dir });
        
        // Plans Management
        case "create_plan":
          return handleCreatePlan({ ...args, working_dir });
        case "get_plan":
          return handleGetPlan({ ...args, working_dir });
        case "update_plan":
          return handleUpdatePlan({ ...args, working_dir });
        case "get_plan_teams":
          return handleGetPlanTeams({ ...args, working_dir });
        case "add_plan_team":
          return handleAddPlanTeam({ ...args, working_dir });
        case "remove_plan_team":
          return handleRemovePlanTeam({ ...args, working_dir });
        case "archive_plan":
          return handleArchivePlan({ ...args, working_dir });
        case "duplicate_plan":
          return handleDuplicatePlan({ ...args, working_dir });
        case "trash_plan":
          return handleTrashPlan({ ...args, working_dir });
        
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Tool "${request.params.name}" is not yet updated for multi-instance support. Currently available tools: ${multiInstanceTools.join(", ")}`
          );
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Jira API Error:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
        
        const status = error.response?.status;
        const errorData = error.response?.data;
        
        // Provide specific error messages based on status codes
        let enhancedMessage = "";
        
        if (status === 400) {
          enhancedMessage = `Bad Request (400): ${errorData?.errorMessages?.join(', ') || 'Invalid request parameters'}`;
          if (errorData?.errors) {
            const fieldErrors = Object.entries(errorData.errors)
              .map(([field, message]) => `${field}: ${message}`)
              .join(', ');
            enhancedMessage += `\nField errors: ${fieldErrors}`;
          }
        } else if (status === 401) {
          enhancedMessage = "Authentication Failed (401): Invalid API token or expired session. Check your Jira credentials.";
        } else if (status === 403) {
          enhancedMessage = `Permission Denied (403): You don't have permission to perform this action. ${errorData?.errorMessages?.join(', ') || 'Contact your Jira administrator.'}`;
        } else if (status === 404) {
          enhancedMessage = `Not Found (404): The requested resource doesn't exist. ${errorData?.errorMessages?.join(', ') || 'Check your project key, issue key, or other identifiers.'}`;
        } else if (status === 429) {
          enhancedMessage = "Rate Limited (429): Too many requests. Please wait and try again.";
        } else {
          enhancedMessage = `HTTP ${status}: ${error.response?.statusText || 'Unknown error'}`;
          if (errorData?.errorMessages?.length) {
            enhancedMessage += `\nMessages: ${errorData.errorMessages.join(', ')}`;
          }
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          enhancedMessage
        );
      }
      throw error;
    }
  });
}