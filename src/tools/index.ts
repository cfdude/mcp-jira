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
          return handleCreateIssue(axiosInstance, agileAxiosInstance, projectKey, storyPointsFieldRef.current, args);
        
        case "list_issues":
          return handleListIssues(axiosInstance, projectKey, storyPointsFieldRef.current, args);
        
        case "update_issue":
          return handleUpdateIssue(axiosInstance, agileAxiosInstance, projectKey, storyPointsFieldRef.current, args);
        
        case "get_issue":
          return handleGetIssue(axiosInstance, agileAxiosInstance, projectKey, storyPointsFieldRef.current, args);
        
        case "delete_issue":
          return handleDeleteIssue(axiosInstance, args);
        
        case "add_comment":
          return handleAddComment(axiosInstance, args);
        
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