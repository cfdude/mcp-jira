/**
 * Script to systematically improve ALL Jira MCP tool descriptions for AI clarity
 */

const toolDescriptionImprovements = {
  // Basic Issue Operations
  "create_issue": {
    description: "Create a new Jira issue. CRITICAL FOR AI: ALWAYS specify 'instance' (e.g., 'onvex') and 'projectKey' (e.g., 'JOB') parameters. Use list_instances first to see available instances. Example usage: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB', summary: 'Fix auth bug', type: 'Task'}",
    parameterGuidance: {
      instance: "REQUIRED: Jira instance name (e.g., 'onvex', 'highway'). ALWAYS specify to avoid errors. Use list_instances to see options.",
      projectKey: "REQUIRED: Project key (e.g., 'JOB', 'CAO'). ALWAYS specify to target correct project."
    }
  },
  
  "list_issues": {
    description: "List issues in a specific Jira project. CRITICAL FOR AI: ALWAYS specify 'instance' and 'projectKey' parameters. Use this to see existing issues before creating new ones or to get issue keys for updates. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB'}",
    parameterGuidance: {
      instance: "REQUIRED: Jira instance name. Use list_instances to see available instances.",
      projectKey: "REQUIRED: Target project key. Without this, results will be unpredictable."
    }
  },
  
  "update_issue": {
    description: "Update an existing Jira issue. CRITICAL FOR AI: ALWAYS specify 'instance' parameter and use exact issue key from list_issues. Commonly used to change status, assignee, or add comments. Example: {working_dir: '/path', instance: 'onvex', issue_key: 'JOB-123', status: 'In Progress'}",
    parameterGuidance: {
      instance: "REQUIRED: Jira instance name where the issue exists.",
      issue_key: "REQUIRED: Exact issue key (e.g., 'JOB-123'). Get from list_issues first."
    }
  },
  
  "get_issue": {
    description: "Get detailed information about a specific Jira issue. CRITICAL FOR AI: ALWAYS specify 'instance' parameter. Use this to get current status, description, and fields before updating. Example: {working_dir: '/path', instance: 'onvex', issue_key: 'JOB-123'}",
    parameterGuidance: {
      instance: "REQUIRED: Jira instance name where the issue exists.",
      issue_key: "REQUIRED: Exact issue key (e.g., 'JOB-123')."
    }
  },
  
  "delete_issue": {
    description: "Delete a Jira issue. WARNING: Requires 'Delete Issues' permission. CRITICAL FOR AI: ALWAYS specify 'instance' parameter. Consider using status changes instead of deletion. Only creators and admins can delete issues. Example: {working_dir: '/path', instance: 'onvex', issue_key: 'JOB-123'}",
    parameterGuidance: {
      instance: "REQUIRED: Jira instance name where the issue exists.",
      issue_key: "REQUIRED: Exact issue key to delete."
    }
  },

  // Sprint Management
  "create_sprint": {
    description: "Create a new sprint in a Jira board. CRITICAL FOR AI: ALWAYS specify 'instance' and 'projectKey'. Use list_boards first to verify board exists. Creates sprint in 'future' state - use update_sprint to start it. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB', name: 'Sprint 1', goal: 'MVP features'}",
    parameterGuidance: {
      instance: "REQUIRED: Jira instance name. Use list_instances to see options.",
      projectKey: "REQUIRED: Project key to find the correct board for sprint creation."
    }
  },
  
  "update_sprint": {
    description: "Update sprint details or change sprint state (future→active→closed). CRITICAL FOR AI: ALWAYS specify 'instance' parameter. Use get_sprint_details first to get current sprint info. Example: {working_dir: '/path', instance: 'onvex', sprintId: 123, state: 'active'} to start a sprint.",
    parameterGuidance: {
      instance: "REQUIRED: Jira instance name where the sprint exists.",
      sprintId: "REQUIRED: Sprint ID number. Get from create_sprint or list_boards."
    }
  },
  
  "move_issues_to_sprint": {
    description: "Add issues to a sprint. CRITICAL FOR AI: ALWAYS specify 'instance' parameter. Use list_issues first to get issue keys, and ensure sprint exists. Example: {working_dir: '/path', instance: 'onvex', sprintId: 123, issueKeys: ['JOB-1', 'JOB-2']}",
    parameterGuidance: {
      instance: "REQUIRED: Jira instance name.",
      sprintId: "REQUIRED: Target sprint ID. Get from create_sprint or board reports.",
      issueKeys: "REQUIRED: Array of exact issue keys from list_issues."
    }
  },

  // Board Management  
  "list_boards": {
    description: "List all Jira boards for a project. CRITICAL FOR AI: ALWAYS specify 'instance' and usually 'projectKey' to filter results. Use this first to find board IDs for sprint operations. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB'}",
    parameterGuidance: {
      instance: "REQUIRED: Jira instance name.",
      projectKey: "RECOMMENDED: Project key to filter boards. Without this, returns all boards."
    }
  },

  // Epic Management
  "create_epic": {
    description: "Create a new Epic issue. CRITICAL FOR AI: ALWAYS specify 'instance' and 'projectKey'. Epics organize related stories/tasks. Use update_issue or move_issues_to_epic afterward to add child issues. Example: {working_dir: '/path', instance: 'onvex', projectKey: 'JOB', name: 'User Auth', summary: 'Authentication System Epic'}",
    parameterGuidance: {
      instance: "REQUIRED: Jira instance name.",
      projectKey: "REQUIRED: Project key where epic will be created."
    }
  },

  // Configuration Discovery
  "list_instances": {
    description: "List all configured Jira instances and their project mappings. CRITICAL FOR AI: Use this FIRST to discover available instances before any other operations. Shows which projects are mapped to which instances. No additional parameters needed besides working_dir. Example: {working_dir: '/path/to/project'}",
    parameterGuidance: {
      working_dir: "REQUIRED: Path to directory containing .jira-config.json file."
    }
  }
};

console.log("Tool Description Improvements:", JSON.stringify(toolDescriptionImprovements, null, 2));