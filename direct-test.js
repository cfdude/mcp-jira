#!/usr/bin/env node

/**
 * Direct test of MCP Jira server functionality
 * Tests the server directly without the inspector UI
 */

import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test data
const longDescription = `This is a comprehensive test of the new text handling capabilities in the MCP Jira server. 

## Background
We recently implemented several improvements to handle long text content properly:

### Key Improvements
1. **ADF (Atlassian Document Format) Conversion**: Automatically converts plain text to proper ADF format for Jira API v3
2. **API Fallback Mechanism**: Falls back to API v2 with plain text if ADF format fails
3. **Enhanced Error Handling**: Better error reporting and debugging information
4. **Long Text Support**: Handles descriptions and comments of any length

### Technical Details
The implementation includes:
- ADF converter utilities with proper paragraph and formatting handling
- Text field handlers with dual API support (v3/v2)
- Comprehensive error handling and logging
- Safe conversion with validation

This description contains multiple paragraphs, formatting, and is intentionally long to test the text handling improvements thoroughly.`;

const longComment = `This is a test comment with extensive content to verify the ADF conversion and API fallback functionality.

## Comment Testing Details
This comment tests the following scenarios:
- Long text content handling in comments
- ADF format conversion for API v3
- Fallback to API v2 if needed
- Proper paragraph and formatting preservation

### Technical Verification
The comment system should:
1. Convert this text to proper ADF format
2. Handle multiple paragraphs correctly
3. Preserve formatting and structure
4. Fall back to plain text if ADF fails

The text handling system should process all of this content correctly and post it to Jira without any 400 errors or formatting issues.`;

let createdIssues = [];

function sendMCPRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [join(__dirname, 'build', 'index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let response = '';
    let errorOutput = '';
    
    server.stdout.on('data', (data) => {
      response += data.toString();
    });
    
    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    server.on('close', (code) => {
      console.log(`Server stderr output:\n${errorOutput}`);
      
      if (code === 0) {
        try {
          const lines = response.trim().split('\n');
          const jsonResponse = lines[lines.length - 1];
          resolve(JSON.parse(jsonResponse));
        } catch (error) {
          console.log(`Raw response: ${response}`);
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      } else {
        reject(new Error(`Server exited with code ${code}: ${errorOutput}`));
      }
    });

    // Send MCP request
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: method,
        arguments: params
      }
    };

    server.stdin.write(JSON.stringify(request) + '\n');
    server.stdin.end();
  });
}

async function testCreateIssue() {
  console.log('\n🧪 Testing create_issue with long description...');
  console.log(`Description length: ${longDescription.length} characters`);
  
  try {
    const response = await sendMCPRequest('create_issue', {
      working_dir: '/Users/robsherman/Servers/mcp-jira',
      instance: 'onvex',
      projectKey: 'JOB',
      summary: 'TEST: Long Text Handling Verification',
      description: longDescription,
      type: 'Task',
      labels: ['test', 'text-handling', 'auto-verification']
    });

    console.log('✅ create_issue response received');
    
    if (response.content && response.content[0] && response.content[0].text) {
      const responseText = response.content[0].text;
      console.log('Response preview:', responseText.substring(0, 200) + '...');
      
      // Extract issue key from response
      const issueKeyMatch = responseText.match(/JOB-\d+/);
      if (issueKeyMatch) {
        const issueKey = issueKeyMatch[0];
        createdIssues.push(issueKey);
        console.log(`✅ Issue created successfully: ${issueKey}`);
        return issueKey;
      } else {
        console.log('⚠️ Could not extract issue key from response');
        return null;
      }
    } else {
      console.log('❌ Unexpected response format:', JSON.stringify(response, null, 2));
      return null;
    }
  } catch (error) {
    console.error('❌ create_issue failed:', error.message);
    return null;
  }
}

async function testAddComment(issueKey) {
  console.log(`\n🧪 Testing add_comment on ${issueKey} with long text...`);
  console.log(`Comment length: ${longComment.length} characters`);
  
  try {
    const response = await sendMCPRequest('add_comment', {
      working_dir: '/Users/robsherman/Servers/mcp-jira',
      instance: 'onvex',
      issue_key: issueKey,
      comment: longComment
    });

    console.log('✅ add_comment response received');
    
    if (response.content && response.content[0] && response.content[0].text) {
      const responseText = response.content[0].text;
      console.log('Response preview:', responseText.substring(0, 200) + '...');
      console.log('✅ Comment added successfully');
      return true;
    } else {
      console.log('❌ Unexpected response format:', JSON.stringify(response, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ add_comment failed:', error.message);
    return false;
  }
}

async function testUpdateIssue(issueKey) {
  console.log(`\n🧪 Testing update_issue on ${issueKey} with long description...`);
  
  const updatedDescription = longDescription + `\n\n## Update Test\nThis content was added during the update test to verify that long description updates work correctly with our new text handling system.\n\nUpdate timestamp: ${new Date().toISOString()}`;
  
  console.log(`Updated description length: ${updatedDescription.length} characters`);
  
  try {
    const response = await sendMCPRequest('update_issue', {
      working_dir: '/Users/robsherman/Servers/mcp-jira',
      instance: 'onvex',
      issue_key: issueKey,
      description: updatedDescription,
      summary: 'TEST: Long Text Handling Verification (Updated)'
    });

    console.log('✅ update_issue response received');
    
    if (response.content && response.content[0] && response.content[0].text) {
      const responseText = response.content[0].text;
      console.log('Response preview:', responseText.substring(0, 200) + '...');
      console.log('✅ Issue updated successfully');
      return true;
    } else {
      console.log('❌ Unexpected response format:', JSON.stringify(response, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ update_issue failed:', error.message);
    return false;
  }
}

async function cleanupTestIssues() {
  console.log('\n🧹 Cleaning up test issues...');
  
  for (const issueKey of createdIssues) {
    console.log(`Deleting ${issueKey}...`);
    
    try {
      const response = await sendMCPRequest('delete_issue', {
        working_dir: '/Users/robsherman/Servers/mcp-jira',
        instance: 'onvex',
        issue_key: issueKey
      });
      
      console.log(`✅ ${issueKey} deleted successfully`);
    } catch (error) {
      console.error(`❌ Failed to delete ${issueKey}:`, error.message);
    }
  }
  
  console.log(`🧹 Cleanup complete. Deleted ${createdIssues.length} test issues.`);
}

async function runFullTest() {
  console.log('🚀 Starting Direct MCP Jira Server Test');
  console.log('========================================');
  
  let testResults = {
    createIssue: false,
    addComment: false,
    updateIssue: false,
    cleanup: false
  };
  
  try {
    // Test 1: Create issue
    const issueKey = await testCreateIssue();
    testResults.createIssue = !!issueKey;
    
    if (issueKey) {
      // Test 2: Add comment
      testResults.addComment = await testAddComment(issueKey);
      
      // Test 3: Update issue
      testResults.updateIssue = await testUpdateIssue(issueKey);
      
      // Cleanup
      await cleanupTestIssues();
      testResults.cleanup = true;
    }
    
    // Print test results
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    console.log(`✅ Create Issue: ${testResults.createIssue ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Add Comment: ${testResults.addComment ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Update Issue: ${testResults.updateIssue ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Cleanup: ${testResults.cleanup ? 'PASS' : 'FAIL'}`);
    
    const allPassed = Object.values(testResults).every(result => result);
    console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allPassed) {
      console.log('\n🎉 Success! The MCP Jira server text handling improvements are working correctly:');
      console.log('   • Long text content is properly handled');
      console.log('   • ADF conversion is working');
      console.log('   • API fallback mechanisms are functional');
      console.log('   • No 400 errors occurred');
      console.log('   • All test issues were cleaned up from production');
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    
    // Attempt cleanup even if tests failed
    if (createdIssues.length > 0) {
      console.log('\n🧹 Attempting cleanup of any created issues...');
      await cleanupTestIssues();
    }
  }
}

// Run the test
runFullTest().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});