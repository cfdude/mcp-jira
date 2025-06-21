#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import fs from "fs";
import path from "path";

const JIRA_EMAIL = process.env.JIRA_EMAIL as string;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN as string;
const JIRA_DOMAIN = process.env.JIRA_DOMAIN as string;

if (!JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_DOMAIN) {
  throw new Error(
    "JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_DOMAIN environment variables are required"
  );
}

interface JiraConfig {
  projectKey: string[];
}

interface JiraComment {
  id: string;
  body: string;
  created: string;
  author: {
    displayName: string;
  };
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string;
    status: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    created: string;
    creator: {
      displayName: string;
    };
    comment?: {
      comments: JiraComment[];
    };
  };
}

class JiraServer {
  private server: Server;
  private axiosInstance;
  private currentProjectKey: string | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "jira-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: `https://${JIRA_DOMAIN}.atlassian.net/rest/api/2`,
      auth: {
        username: JIRA_EMAIL,
        password: JIRA_API_TOKEN,
      },
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    });

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  private formatIssue(issue: JiraIssue): string {
    let output = `${issue.key}: ${issue.fields.summary}
- Type: ${issue.fields.issuetype.name}
- Status: ${issue.fields.status.name}
- Created: ${this.formatDate(issue.fields.created)}
- Description: ${issue.fields.description || "No description"}
- Creator: ${issue.fields.creator.displayName}`;

    const comments = issue.fields.comment?.comments;
    if (comments && comments.length > 0) {
      output += "\n\nComments:";
      comments.forEach((comment) => {
        output += `\n\n[${this.formatDate(comment.created)} by ${
          comment.author.displayName
        }]\n${comment.body}`;
      });
    }

    return output;
  }

  private formatIssueList(issues: JiraIssue[]): string {
    if (issues.length === 0) {
      return "No issues found.";
    }

    const formattedIssues = issues
      .map((issue) => this.formatIssue(issue))
      .join("\n");
    return `Latest Jira Issues in ${this.currentProjectKey} Project:\n\n${formattedIssues}\nTotal Issues: ${issues.length}`;
  }

  private formatCreatedIssue(issue: any): string {
    return `Issue created successfully:
- Key: ${issue.key}
- URL: https://${JIRA_DOMAIN}.atlassian.net/browse/${issue.key}`;
  }

  private async loadProjectKey(workingDir: string, issueKey?: string, projectOverride?: string): Promise<string> {
    try {
      const configPath = path.join(workingDir, ".jira-config.json");
      const configContent = await fs.promises.readFile(configPath, "utf-8");
      const config: JiraConfig = JSON.parse(configContent);
      
      if (!config.projectKey || !Array.isArray(config.projectKey) || config.projectKey.length === 0) {
        throw new Error("projectKey array not found or empty in .jira-config.json");
      }

      // If project override is provided and valid, use it
      if (projectOverride && config.projectKey.includes(projectOverride)) {
        return projectOverride;
      }

      // If an issue key is provided, try to match its project
      if (issueKey) {
        const projectFromKey = issueKey.split('-')[0];
        if (config.projectKey.includes(projectFromKey)) {
          return projectFromKey;
        }
      }

      // For create_issue, list_issues, or when no matching project found
      return config.projectKey[0];
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Failed to load project keys from .jira-config.json. Please ensure the file exists and contains a valid projectKey array."
      );
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
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
              project: {
                type: "string",
                description: "Project key to create the issue in (e.g., TESTSEO, TESTWEB)",
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
              status: {
                type: "string",
                description:
                  'Filter by status (e.g., "To Do", "In Progress", "Done")',
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

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { working_dir, ...args } = request.params.arguments as any;
        
        // Pass issue_key and project to loadProjectKey if they exist
        this.currentProjectKey = await this.loadProjectKey(working_dir, args.issue_key, args.project);

        switch (request.params.name) {
          case "create_issue": {
            const { summary, description, type } = args;

            console.error("Creating issue with:", {
              projectKey: this.currentProjectKey,
              summary,
              description,
              type,
            });

            // First, get project metadata to verify it exists and get available issue types
            const metaResponse = await this.axiosInstance.get(
              "/issue/createmeta",
              {
                params: {
                  projectKeys: this.currentProjectKey,
                  expand: "projects.issuetypes",
                },
              }
            );

            console.error(
              "Project metadata:",
              JSON.stringify(metaResponse.data, null, 2)
            );

            const project = metaResponse.data.projects[0];
            if (!project) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                `Project ${this.currentProjectKey} not found`
              );
            }

            const issueType = project.issuetypes.find(
              (t: any) => t.name.toLowerCase() === type.toLowerCase()
            );
            if (!issueType) {
              throw new McpError(
                ErrorCode.InvalidRequest,
                `Issue type "${type}" not found. Available types: ${project.issuetypes
                  .map((t: any) => t.name)
                  .join(", ")}`
              );
            }

            const createResponse = await this.axiosInstance.post("/issue", {
              fields: {
                project: {
                  key: this.currentProjectKey,
                },
                summary,
                description,
                issuetype: {
                  id: issueType.id,
                },
              },
            });

            return {
              content: [
                {
                  type: "text",
                  text: this.formatCreatedIssue(createResponse.data),
                },
              ],
            };
          }

          case "list_issues": {
            const { status } = args;
            const jql = status
              ? `project = ${this.currentProjectKey} AND status = "${status}" ORDER BY created DESC`
              : `project = ${this.currentProjectKey} ORDER BY created DESC`;

            const searchResponse = await this.axiosInstance.get("/search", {
              params: {
                jql,
                fields: [
                  "summary",
                  "description",
                  "status",
                  "issuetype",
                  "created",
                  "creator",
                ],
              },
            });

            return {
              content: [
                {
                  type: "text",
                  text: this.formatIssueList(searchResponse.data.issues),
                },
              ],
            };
          }

          case "update_issue": {
            const { issue_key, summary, description, status } = args;
            const updateData: any = {
              fields: {},
            };

            if (summary) updateData.fields.summary = summary;
            if (description) updateData.fields.description = description;
            if (status) {
              const transitions = await this.axiosInstance.get(
                `/issue/${issue_key}/transitions`
              );
              const transition = transitions.data.transitions.find(
                (t: any) => t.name.toLowerCase() === status.toLowerCase()
              );
              if (transition) {
                await this.axiosInstance.post(
                  `/issue/${issue_key}/transitions`,
                  {
                    transition: { id: transition.id },
                  }
                );
              }
            }

            if (Object.keys(updateData.fields).length > 0) {
              await this.axiosInstance.put(`/issue/${issue_key}`, updateData);
            }

            const updatedIssue = await this.axiosInstance.get(
              `/issue/${issue_key}`
            );
            return {
              content: [
                {
                  type: "text",
                  text: this.formatIssue(updatedIssue.data),
                },
              ],
            };
          }

          case "get_issue": {
            const { issue_key } = args;
            const getResponse = await this.axiosInstance.get(
              `/issue/${issue_key}`,
              {
                params: {
                  expand:
                    "renderedFields,names,schema,transitions,operations,editmeta,changelog,comments",
                  fields:
                    "summary,description,status,issuetype,created,creator,comment",
                },
              }
            );
            return {
              content: [
                {
                  type: "text",
                  text: this.formatIssue(getResponse.data),
                },
              ],
            };
          }

          case "delete_issue": {
            const { issue_key } = args;
            await this.axiosInstance.delete(`/issue/${issue_key}`);
            return {
              content: [
                {
                  type: "text",
                  text: `Issue ${issue_key} has been deleted.`,
                },
              ],
            };
          }

          case "add_comment": {
            const { issue_key, comment } = args;
            await this.axiosInstance.post(`/issue/${issue_key}/comment`, {
              body: comment,
            });
            return {
              content: [
                {
                  type: "text",
                  text: `Comment added to issue ${issue_key}`,
                },
              ],
            };
          }

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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Jira MCP server running on stdio");
  }
}

const server = new JiraServer();
server.run().catch(console.error);
