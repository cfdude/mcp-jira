#!/usr/bin/env node
/**
 * Entry point for the Jira MCP server
 */
import { JiraServer } from './jira-server.js';

// Create and run the server
const server = new JiraServer();
server.run().catch(console.error);
