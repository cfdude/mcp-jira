/**
 * Main JiraServer class
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListResourcesRequestSchema, ListPromptsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { setupToolHandlers } from "./tools/index.js";

export class JiraServer {
  private server: Server;
  private storyPointsFieldRef: { current: string | null } = { current: null };

  constructor() {
    this.server = new Server(
      {
        name: "jira-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    // Setup tool handlers (API instances created per-request now)
    setupToolHandlers(
      this.server, 
      this.storyPointsFieldRef
    );

    // Setup resources handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [], // Return empty resources list
    }));

    // Setup prompts handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [], // Return empty prompts list
    }));

    // Setup error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Start the server
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Jira MCP server running on stdio");
  }
}