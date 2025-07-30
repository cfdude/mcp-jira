/**
 * Script to update ALL remaining tool descriptions with AI-optimized guidance
 */

const fs = require('fs');
const path = require('path');

const toolsFilePath = '/Users/robsherman/Servers/mcp-jira/src/tools/index.ts';
let content = fs.readFileSync(toolsFilePath, 'utf8');

// Define all remaining tool description updates
const updates = [
  // Board Management
  { 
    old: 'description: "Get detailed configuration of a board including columns and settings",',
    new: 'description: "Get detailed configuration of a board including columns and settings. CRITICAL FOR AI: ALWAYS specify \'instance\' and use boardId from list_boards. Example: {working_dir: \'/path\', instance: \'onvex\', boardId: 102}",',
  },
  {
    old: 'description: "Get board reports and current metrics",',
    new: 'description: "Get board reports and current metrics. CRITICAL FOR AI: ALWAYS specify \'instance\' and use boardId from list_boards. Example: {working_dir: \'/path\', instance: \'onvex\', boardId: 102}",',
  },
  {
    old: 'description: "List or get details of board quickfilters",',
    new: 'description: "List or get details of board quickfilters. CRITICAL FOR AI: ALWAYS specify \'instance\' and use boardId from list_boards. Example: {working_dir: \'/path\', instance: \'onvex\', boardId: 102, action: \'list\'}",',
  },

  // Epic Management
  {
    old: 'description: "Create a new epic",',
    new: 'description: "Create a new Epic issue. CRITICAL FOR AI: ALWAYS specify \'instance\' and \'projectKey\'. Epics organize related stories/tasks. Example: {working_dir: \'/path\', instance: \'onvex\', projectKey: \'JOB\', name: \'User Auth\', summary: \'Authentication System Epic\'}",',
  },
  {
    old: 'description: "Update epic details using Agile API",',
    new: 'description: "Update epic details using Agile API. CRITICAL FOR AI: ALWAYS specify \'instance\' and use exact epicKey from list_epic_issues. Example: {working_dir: \'/path\', instance: \'onvex\', epicKey: \'JOB-1\', name: \'Updated Epic Name\'}",',
  },
  {
    old: 'description: "Rank epics relative to each other",',
    new: 'description: "Rank epics relative to each other. CRITICAL FOR AI: ALWAYS specify \'instance\' and use exact epic keys. Example: {working_dir: \'/path\', instance: \'onvex\', epicToRank: \'JOB-1\', rankAfterEpic: \'JOB-2\'}",',
  },
  {
    old: 'description: "List all issues in an epic",',
    new: 'description: "List all issues in an epic. CRITICAL FOR AI: ALWAYS specify \'instance\' and use exact epicKey from create_epic. Example: {working_dir: \'/path\', instance: \'onvex\', epicKey: \'JOB-1\'}",',
  },
  {
    old: 'description: "Move issues to an epic",',
    new: 'description: "Move issues to an epic. CRITICAL FOR AI: ALWAYS specify \'instance\' and use exact keys from list_issues and create_epic. Example: {working_dir: \'/path\', instance: \'onvex\', epicKey: \'JOB-1\', issueKeys: [\'JOB-5\', \'JOB-6\']}",',
  },

  // Advanced Issue Operations
  {
    old: 'description: "Update multiple issues at once",',
    new: 'description: "Update multiple issues at once. CRITICAL FOR AI: ALWAYS specify \'instance\' and use exact issue keys from list_issues. Example: {working_dir: \'/path\', instance: \'onvex\', issueKeys: [\'JOB-1\', \'JOB-2\'], updates: {status: \'In Progress\'}}",',
  },
  {
    old: 'description: "Rank multiple issues relative to other issues",',
    new: 'description: "Rank multiple issues relative to other issues. CRITICAL FOR AI: ALWAYS specify \'instance\' and use exact issue keys. Example: {working_dir: \'/path\', instance: \'onvex\', issues: [\'JOB-1\'], rankAfterIssue: \'JOB-2\'}",',
  },
  {
    old: 'description: "Set estimation value for an issue",',
    new: 'description: "Set estimation value for an issue. CRITICAL FOR AI: ALWAYS specify \'instance\' and use exact issue key. Example: {working_dir: \'/path\', instance: \'onvex\', issueKey: \'JOB-1\', value: \'5\'}",',
  },

  // Reporting & Analytics
  {
    old: 'description: "Get comprehensive sprint report with metrics and analysis",',
    new: 'description: "Get comprehensive sprint report with metrics and analysis. CRITICAL FOR AI: ALWAYS specify \'instance\' and use boardId from list_boards. Example: {working_dir: \'/path\', instance: \'onvex\', boardId: 102, sprintId: 335}",',
  },
  {
    old: 'description: "Get velocity chart data for team performance analysis",',
    new: 'description: "Get velocity chart data for team performance analysis. CRITICAL FOR AI: ALWAYS specify \'instance\' and use boardId from list_boards. Example: {working_dir: \'/path\', instance: \'onvex\', boardId: 102}",',
  },
  {
    old: 'description: "Get burndown chart data for a specific sprint",',
    new: 'description: "Get burndown chart data for a specific sprint. CRITICAL FOR AI: ALWAYS specify \'instance\' and use sprintId from create_sprint. Example: {working_dir: \'/path\', instance: \'onvex\', sprintId: 335}",',
  },
  {
    old: 'description: "Get cumulative flow diagram data for a board",',
    new: 'description: "Get cumulative flow diagram data for a board. CRITICAL FOR AI: ALWAYS specify \'instance\' and use boardId from list_boards. Example: {working_dir: \'/path\', instance: \'onvex\', boardId: 102}",',
  },

  // Project Planning Tools
  {
    old: 'description: "List project versions for release planning and milestone tracking. Shows active, released, and archived versions with timeline information. Use first to discover available versions, then follow with get_version_progress for detailed tracking.",',
    new: 'description: "List project versions for release planning and milestone tracking. CRITICAL FOR AI: ALWAYS specify \'instance\' and usually \'projectKey\'. Example: {working_dir: \'/path\', instance: \'onvex\', projectKey: \'JOB\'}",',
  },
  {
    old: 'description: "Create a new project version/release for organizing work by milestones. Typically used before sprint planning to establish release targets. Follow with list_versions to confirm creation.",',
    new: 'description: "Create a new project version/release for organizing work by milestones. CRITICAL FOR AI: ALWAYS specify \'instance\' and \'projectKey\'. Example: {working_dir: \'/path\', instance: \'onvex\', projectKey: \'JOB\', name: \'v1.0.0\'}",',
  },
  {
    old: 'description: "Get detailed version progress including issue counts, status breakdown, and timeline analysis. Essential for release planning and stakeholder reporting. Use version ID from list_versions output.",',
    new: 'description: "Get detailed version progress including issue counts, status breakdown, and timeline analysis. CRITICAL FOR AI: ALWAYS specify \'instance\' and use versionId from list_versions. Example: {working_dir: \'/path\', instance: \'onvex\', versionId: \'10123\'}",',
  },
  {
    old: 'description: "List project components for feature-based work organization. Components help categorize issues by system areas, features, or teams. Use first to discover existing components, then follow with get_component_progress for detailed tracking.",',
    new: 'description: "List project components for feature-based work organization. CRITICAL FOR AI: ALWAYS specify \'instance\' and usually \'projectKey\'. Example: {working_dir: \'/path\', instance: \'onvex\', projectKey: \'JOB\'}",',
  },
  {
    old: 'description: "Create a new project component for organizing work by feature areas, system modules, or team ownership. Essential for structured project organization and workload distribution. Use after project setup and before issue creation.",',
    new: 'description: "Create a new project component for organizing work by feature areas. CRITICAL FOR AI: ALWAYS specify \'instance\' and \'projectKey\'. Example: {working_dir: \'/path\', instance: \'onvex\', projectKey: \'JOB\', name: \'Frontend UI\'}",',
  },
  {
    old: 'description: "Get detailed component progress with issue distribution, team workload, and completion metrics. Critical for feature-based planning and team performance tracking. Use component ID from list_components output.",',
    new: 'description: "Get detailed component progress with issue distribution and completion metrics. CRITICAL FOR AI: ALWAYS specify \'instance\' and use componentId from list_components. Example: {working_dir: \'/path\', instance: \'onvex\', componentId: \'10456\'}",',
  },

  // Project Discovery
  {
    old: 'description: "Search and discover projects across the Jira instance with advanced filtering. Essential for cross-project planning, finding related projects, and project portfolio management. Use before detailed project analysis.",',
    new: 'description: "Search and discover projects across the Jira instance with advanced filtering. CRITICAL FOR AI: ALWAYS specify \'instance\'. Example: {working_dir: \'/path\', instance: \'onvex\', query: \'mobile\'}",',
  },
  {
    old: 'description: "Get comprehensive project information including components, versions, roles, and features. Essential for project analysis, planning context, and understanding project structure. Use project key from search_projects or known project.",',
    new: 'description: "Get comprehensive project information including components, versions, and features. CRITICAL FOR AI: ALWAYS specify \'instance\' and \'projectKey\'. Example: {working_dir: \'/path\', instance: \'onvex\', projectKey: \'JOB\'}",',
  },
  {
    old: 'description: "Advanced issue search using Jira Query Language (JQL) for powerful project analysis and custom reporting. Essential for complex filtering, cross-project queries, and detailed project insights. Use before creating filters to test queries.",',
    new: 'description: "Advanced issue search using Jira Query Language (JQL) for powerful project analysis. CRITICAL FOR AI: ALWAYS specify \'instance\'. Example: {working_dir: \'/path\', instance: \'onvex\', jql: \'project = JOB AND status != Done\'}",',
  },
  {
    old: 'description: "Create saved filters for consistent project tracking, dashboard widgets, and team collaboration. Essential for recurring project views and shared reporting. Test JQL with search_issues_jql first before creating filters.",',
    new: 'description: "Create saved filters for consistent project tracking and reporting. CRITICAL FOR AI: ALWAYS specify \'instance\'. Test JQL first with search_issues_jql. Example: {working_dir: \'/path\', instance: \'onvex\', name: \'Sprint Planning\', jql: \'project = JOB\'}",',
  },

  // Project Status & Types
  {
    old: 'description: "Get comprehensive project workflow statuses and transitions for process understanding and planning optimization. Essential for workflow analysis, status planning, and understanding issue lifecycle. Use before creating complex JQL queries with status filters.",',
    new: 'description: "Get comprehensive project workflow statuses and transitions. CRITICAL FOR AI: ALWAYS specify \'instance\' and usually \'projectKey\'. Example: {working_dir: \'/path\', instance: \'onvex\', projectKey: \'JOB\'}",',
  },
  {
    old: 'description: "Get available issue types, their hierarchy, required fields, and configuration for effective work categorization and issue creation planning. Critical for understanding project structure and choosing appropriate issue types for different work items.",',
    new: 'description: "Get available issue types, their hierarchy, and required fields. CRITICAL FOR AI: ALWAYS specify \'instance\' and usually \'projectKey\'. Example: {working_dir: \'/path\', instance: \'onvex\', projectKey: \'JOB\'}",',
  },
];

// Apply all updates
updates.forEach(update => {
  if (content.includes(update.old)) {
    content = content.replace(update.old, update.new);
    console.log(`✅ Updated: ${update.old.substring(0, 50)}...`);
  } else {
    console.log(`❌ Not found: ${update.old.substring(0, 50)}...`);
  }
});

// Write the updated content back to the file
fs.writeFileSync(toolsFilePath, content, 'utf8');
console.log('\n🎉 All tool descriptions updated successfully!');