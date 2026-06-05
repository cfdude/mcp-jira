#!/usr/bin/env node
/**
 * Entry point for the Jira MCP server
 */
// MUST be first: route all console.* diagnostics to stderr so stray dependency
// logging (adf-to-md, dotenv) cannot corrupt the JSON-RPC stream on stdout.
// Loads before JiraServer (and its `import 'dotenv/config'`) evaluates.
import './utils/stdio-guard.js';
import { JiraServer } from './jira-server.js';

// Create and run the server
const server = new JiraServer();
server.run().catch(console.error);
