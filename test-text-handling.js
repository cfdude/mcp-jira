#!/usr/bin/env node

/**
 * Test script for MCP Jira server text handling improvements
 * Tests long text content with ADF conversion and API fallback
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

// Test data with long text content
const longDescription = `
This is a comprehensive test of the new text handling capabilities in the MCP Jira server. 

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

### Test Scenarios
This test issue will be used to verify:
- Issue creation with long descriptions
- Comment addition with long text
- Issue updates with long descriptions
- Error handling and fallback mechanisms

### Expected Behavior
All operations should work seamlessly with both short and long text content, automatically using the most appropriate API version and format.

This description contains multiple paragraphs, formatting, and is intentionally long to test the text handling improvements thoroughly.
`.trim();

const longComment = `
This is a test comment with extensive content to verify the ADF conversion and API fallback functionality.

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

### Content Structure
This comment includes:
- Multiple paragraphs with different content
- Bullet points and numbered lists
- Headers and subheadings
- Technical terminology and code references

The text handling system should process all of this content correctly and post it to Jira without any 400 errors or formatting issues.

This validates that our comprehensive solution for long text content is working as expected.
`.trim();

const testIssues = [];

console.log('🧪 Starting MCP Jira Server Text Handling Tests');
console.log('==================================================\n');

// Test 1: Create issue with long description
async function testCreateIssue() {
  console.log('📝 Test 1: Creating issue with long description...');
  
  const testData = {
    working_dir: '/Users/robsherman/Servers/mcp-jira',
    instance: 'onvex',
    projectKey: 'JOB',
    summary: 'TEST: Long Text Handling Verification',
    description: longDescription,
    type: 'Task',
    labels: ['test', 'text-handling', 'verification']
  };

  try {
    // Write test data to file for inspection
    await fs.promises.writeFile('/tmp/test-create-issue.json', JSON.stringify(testData, null, 2));
    
    console.log('✅ Test data prepared for create_issue');
    console.log(`   Description length: ${longDescription.length} characters`);
    console.log(`   Expected: Issue creation with ADF conversion and fallback`);
    
    return testData;
  } catch (error) {
    console.error('❌ Error preparing create_issue test:', error.message);
    throw error;
  }
}

// Test 2: Add comment with long text
async function testAddComment(issueKey) {
  console.log('\n💬 Test 2: Adding comment with long text...');
  
  const testData = {
    working_dir: '/Users/robsherman/Servers/mcp-jira',
    instance: 'onvex',
    issue_key: issueKey,
    comment: longComment
  };

  try {
    await fs.promises.writeFile('/tmp/test-add-comment.json', JSON.stringify(testData, null, 2));
    
    console.log('✅ Test data prepared for add_comment');
    console.log(`   Comment length: ${longComment.length} characters`);
    console.log(`   Expected: Comment posting with ADF conversion and fallback`);
    
    return testData;
  } catch (error) {
    console.error('❌ Error preparing add_comment test:', error.message);
    throw error;
  }
}

// Test 3: Update issue with long description
async function testUpdateIssue(issueKey) {
  console.log('\n📝 Test 3: Updating issue with long description...');
  
  const updatedDescription = longDescription + `\n\n## Update Test\nThis content was added during the update test to verify that long description updates work correctly with our new text handling system. The update should preserve all existing content and add this new section seamlessly.\n\nUpdate timestamp: ${new Date().toISOString()}`;
  
  const testData = {
    working_dir: '/Users/robsherman/Servers/mcp-jira',
    instance: 'onvex',
    issue_key: issueKey,
    description: updatedDescription,
    summary: 'TEST: Long Text Handling Verification (Updated)'
  };

  try {
    await fs.promises.writeFile('/tmp/test-update-issue.json', JSON.stringify(testData, null, 2));
    
    console.log('✅ Test data prepared for update_issue');
    console.log(`   Updated description length: ${updatedDescription.length} characters`);
    console.log(`   Expected: Issue update with comprehensive text field handling`);
    
    return testData;
  } catch (error) {
    console.error('❌ Error preparing update_issue test:', error.message);
    throw error;
  }
}

// Main test execution
async function runTests() {
  try {
    console.log('🔧 MCP Inspector should be running at: http://localhost:6274');
    console.log('🔑 Use the inspector to execute these tests manually\n');
    
    // Prepare all test data
    const createIssueData = await testCreateIssue();
    
    console.log('\n📋 Test Execution Plan:');
    console.log('========================');
    console.log('1. Use MCP Inspector to call create_issue with test data');
    console.log('2. Note the created issue key (e.g., JOB-XXX)');
    console.log('3. Use issue key to test add_comment');
    console.log('4. Use same issue key to test update_issue');
    console.log('5. Verify all operations succeed without 400 errors');
    console.log('6. Clean up test issues when complete\n');
    
    console.log('📁 Test data files created:');
    console.log('   - /tmp/test-create-issue.json (for create_issue test)');
    console.log('   - /tmp/test-add-comment.json (for add_comment test, update issue_key)');
    console.log('   - /tmp/test-update-issue.json (for update_issue test, update issue_key)\n');
    
    console.log('🎯 Success Criteria:');
    console.log('   ✅ Issue creation succeeds with long description');
    console.log('   ✅ Comment addition succeeds with long text');
    console.log('   ✅ Issue update succeeds with long description');
    console.log('   ✅ No 400 Bad Request errors occur');
    console.log('   ✅ Content is properly formatted in Jira');
    console.log('   ✅ ADF conversion and API fallback work correctly\n');
    
    console.log('🧹 Cleanup Plan:');
    console.log('   After testing, delete all test issues from JOB project');
    console.log('   Ensure no test artifacts remain in production\n');
    
    console.log('🚀 Ready for testing! Open MCP Inspector and execute the prepared test data.');
    
  } catch (error) {
    console.error('❌ Test preparation failed:', error.message);
    process.exit(1);
  }
}

// Generate cleanup script
async function generateCleanupScript() {
  const cleanupScript = `#!/usr/bin/env node
/**
 * Cleanup script for test issues
 * Run this after testing to remove all test issues from production
 */

console.log('🧹 Cleaning up test issues...');
console.log('Use MCP Inspector to:');
console.log('1. Call list_issues with projectKey: JOB');
console.log('2. Find issues with summary starting with "TEST:"');
console.log('3. Call delete_issue for each test issue');
console.log('4. Verify all test issues are removed');
console.log('');
console.log('Example delete_issue call:');
console.log('{');
console.log('  "working_dir": "/Users/robsherman/Servers/mcp-jira",');
console.log('  "instance": "onvex",');
console.log('  "issue_key": "JOB-XXX"');
console.log('}');
`;

  await fs.promises.writeFile('/tmp/cleanup-test-issues.js', cleanupScript);
  console.log('📁 Cleanup script created: /tmp/cleanup-test-issues.js');
}

// Run the test preparation
runTests().then(() => {
  return generateCleanupScript();
}).catch(error => {
  console.error('❌ Failed:', error.message);
  process.exit(1);
});