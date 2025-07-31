#!/usr/bin/env node
/**
 * Test script to verify concurrent session management works with STDIO MCP server
 */
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

const WORKING_DIR = '/Users/robsherman/Servers/mcp-jira';
const SERVER_PATH = './build/index.js';

class MCPTestClient {
  constructor(name) {
    this.name = name;
    this.process = null;
    this.requestId = 1;
  }

  async start() {
    console.log(`🚀 Starting ${this.name}...`);
    
    this.process = spawn('node', [SERVER_PATH], {
      cwd: WORKING_DIR,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        console.log(`📋 [${this.name}] ${message}`);
      }
    });

    this.process.on('error', (error) => {
      console.error(`❌ [${this.name}] Process error:`, error);
    });

    // Wait a moment for process to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async sendRequest(method, params = {}) {
    if (!this.process) {
      throw new Error(`${this.name} not started`);
    }

    const request = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params
    };

    console.log(`📤 [${this.name}] Sending: ${method}`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout for ${method}`));
      }, 10000);

      const handleResponse = (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          console.log(`📥 [${this.name}] Response: ${response.error ? 'Error' : 'Success'}`);
          resolve(response);
        } catch (error) {
          reject(error);
        }
        this.process.stdout.off('data', handleResponse);
      };

      this.process.stdout.on('data', handleResponse);
      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async stop() {
    if (this.process) {
      console.log(`🛑 Stopping ${this.name}...`);
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

async function testConcurrentSessions() {
  console.log('🧪 Testing Concurrent Session Management\n');

  const clients = [
    new MCPTestClient('Client-1'),
    new MCPTestClient('Client-2'),
    new MCPTestClient('Client-3'),
  ];

  const createdIssues = [];

  try {
    // Start all clients
    console.log('1. Starting multiple MCP clients...');
    await Promise.all(clients.map(client => client.start()));
    console.log('✅ All clients started\n');

    // Initialize all clients
    console.log('2. Initializing clients...');
    await Promise.all(clients.map(client => 
      client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: client.name, version: '1.0.0' }
      })
    ));
    console.log('✅ All clients initialized\n');

    // Test tool listing concurrently
    console.log('3. Testing concurrent tool listing...');
    await Promise.all(clients.map(client => client.sendRequest('tools/list')));
    console.log('✅ All clients listed tools\n');

    // Test read-only operations concurrently
    console.log('4. Testing concurrent read-only operations...');
    const readOnlyPromises = clients.map(async (client, index) => {
      try {
        await client.sendRequest('tools/call', {
          name: 'list_instances',
          arguments: { working_dir: WORKING_DIR }
        });
        
        await client.sendRequest('tools/call', {
          name: 'list_issues',
          arguments: { 
            working_dir: WORKING_DIR,
            projectKey: 'JOB',
            status: 'Open'
          }
        });
      } catch (error) {
        console.log(`⚠️  [${client.name}] Read-only operation failed:`, error.message);
      }
    });
    
    await Promise.all(readOnlyPromises);
    console.log('✅ All read-only operations completed\n');

    // Test create operations sequentially to avoid conflicts
    console.log('5. Testing issue creation (sequential)...');
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      try {
        const response = await client.sendRequest('tools/call', {
          name: 'create_issue',
          arguments: {
            working_dir: WORKING_DIR,
            projectKey: 'JOB',
            summary: `Test Issue from ${client.name} - ${randomUUID().substring(0, 8)}`,
            description: `Created by concurrent session test from ${client.name}`,
            type: 'Task'
          }
        });

        if (response.result?.content?.[0]?.text) {
          const issueKey = response.result.content[0].text.match(/([A-Z]+-\d+)/)?.[1];
          if (issueKey) {
            createdIssues.push(issueKey);
            console.log(`✅ [${client.name}] Created issue: ${issueKey}`);
          }
        }
      } catch (error) {
        console.log(`⚠️  [${client.name}] Create issue failed:`, error.message);
      }
    }
    console.log(`✅ Created ${createdIssues.length} test issues\n`);

    // Cleanup: Delete created issues
    console.log('6. Cleaning up test issues...');
    for (const issueKey of createdIssues) {
      try {
        const client = clients[0]; // Use first client for cleanup
        await client.sendRequest('tools/call', {
          name: 'delete_issue',
          arguments: {
            working_dir: WORKING_DIR,
            issue_key: issueKey
          }
        });
        console.log(`🗑️ Deleted test issue: ${issueKey}`);
      } catch (error) {
        console.log(`⚠️ Failed to delete ${issueKey}:`, error.message);
      }
    }
    console.log('✅ Cleanup completed\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Stop all clients
    console.log('7. Stopping all clients...');
    await Promise.all(clients.map(client => client.stop()));
    console.log('✅ All clients stopped\n');
  }

  console.log('🏁 Concurrent session test completed!');
}

// Run the test
testConcurrentSessions().catch(console.error);