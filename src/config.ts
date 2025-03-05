/**
 * Configuration for the Jira MCP server
 */
import fs from "fs";
import path from "path";
import { JiraConfig } from "./types.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

// Environment variables
export const JIRA_EMAIL = process.env.JIRA_EMAIL as string;
export const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN as string;
export const JIRA_DOMAIN = process.env.JIRA_DOMAIN as string;

// Validate required environment variables
if (!JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_DOMAIN) {
  throw new Error(
    "JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_DOMAIN environment variables are required"
  );
}

/**
 * Load project configuration from .jira-config.json file
 */
export async function loadProjectConfig(workingDir: string): Promise<JiraConfig> {
  console.error("Received working_dir parameter:", workingDir);
  
  // List of potential config locations, prioritizing process.cwd()
  const configLocations = [
    workingDir,
    process.cwd()
  ];
  
  console.error("Will try these config locations:", configLocations);
  
  let lastError: Error | null = null;
  
  // Try each location
  for (const location of configLocations) {
    try {
      const configPath = path.join(location, ".jira-config.json");
      console.error("\nTrying config path:", configPath);
      
      const configContent = await fs.promises.readFile(configPath, "utf-8");
      console.error("Found config content:", configContent);
      
      const config: JiraConfig = JSON.parse(configContent);
      console.error("Parsed config:", JSON.stringify(config, null, 2));
      
      if (!config.projectKey) {
        console.error("No projectKey found in config, trying next location");
        continue;
      }
      
      console.error("Successfully loaded config from:", configPath);
      return config;
      
    } catch (error) {
      console.error("Error trying location", location, ":", error);
      lastError = error as Error;
    }
  }
  
  // If we get here, no config was found
  console.error("Failed to load config from any location");
  throw new McpError(
    ErrorCode.InvalidRequest,
    `Failed to load project key from .jira-config.json. Tried locations: ${configLocations.join(", ")}`
  );
}