# Jira MCP Server

[![smithery badge](https://smithery.ai/badge/jira-server)](https://smithery.ai/server/jira-server)

A comprehensive Model Context Protocol server that provides enterprise-level integration with Jira's REST API, enabling AI assistants to perform advanced project management, analytics, and strategic planning tasks.

> **Note**: This is a maintained fork of [1broseidon/mcp-jira-server](https://github.com/1broseidon/mcp-jira-server). We are grateful for the original work and continue to develop and enhance this project independently. All credit for the initial implementation goes to the original authors.

## 🚀 Features Overview

This server transforms basic Jira functionality into a complete project management platform with enterprise-level concurrency and thread safety:

### **🔒 Enterprise Concurrency & Thread Safety**
- **Thread-Safe Multi-Client Support**: Multiple Claude Code sessions can safely use the same server simultaneously
- **Session-Based State Isolation**: Each client connection gets its own isolated session state
- **Per-Session Configuration Caching**: Prevents race conditions and improves performance
- **Automatic Session Management**: 30-minute session timeout with graceful cleanup
- **Production-Ready Architecture**: Designed for high-concurrency enterprise environments

### **Core Issue Management**
- Create, update, delete, and manage Jira issues
- Advanced issue querying with JQL support
- Story points and sprint management
- Epic linking and hierarchy management
- Comment and attachment handling
- **🆕 Time Tracking Support**: Native time tracking with `original_estimate` and `remaining_estimate` fields
- **🆕 Workflow Transitions**: Complete workflow management with transition tools
- **Multi-instance support**: Work with multiple Jira Cloud environments from one session

### **🏗️ Project Structure & Organization**
- **Component Management**: Organize work by feature areas and teams
- **Version/Release Tracking**: Manage release milestones and progress
- **Project Discovery**: Search and analyze projects across your Jira instance
- **Configuration Analysis**: Understand project setup and optimize workflows

### **📊 Advanced Analytics & Insights**
- **Progress Tracking**: Component and version progress with visual indicators
- **Workflow Analysis**: Understand status transitions and bottlenecks  
- **Team Performance**: Assignee workload distribution and activity tracking
- **Strategic Planning**: High-level roadmap and plan management

### **🔍 Advanced Querying & Automation**
- **JQL Search**: Execute complex queries with comprehensive analytics
- **Saved Filters**: Create reusable queries with sharing permissions
- **Cross-Project Search**: Discover and analyze projects organization-wide
- **Bulk Operations**: Efficiently manage multiple issues and projects

## 📋 Complete Tool Reference

### **Issue Management Tools**

#### `create_issue`
Creates new Jira issues with comprehensive field support
- **Parameters**: summary, description, type, epic_link, priority, story_points, labels, sprint, projectKey
- **Features**: Auto-detects story points fields, supports sprint assignment

#### `list_issues`  
Lists project issues with filtering and sorting options
- **Parameters**: status, epic_key, sortField, sortOrder, projectKey
- **Features**: Visual separators, sprint information display, rank-based sorting

#### `update_issue`
Updates existing issues with full field support including time tracking
- **Parameters**: issue_key, summary, description, status, assignee, epic_link, priority, story_points, labels, sprint, rank_after_issue, rank_before_issue, original_estimate, remaining_estimate, custom_fields, projectKey
- **Features**: Issue ranking, sprint management, epic linking, intelligent assignee resolution, **time tracking support**, dynamic component field handling

#### `get_issue`
Retrieves detailed issue information
- **Parameters**: issue_key
- **Features**: Complete issue metadata, comments, relationships

#### `delete_issue`
Safely removes issues from projects
- **Parameters**: issue_key

#### `add_comment`
Adds comments to existing issues
- **Parameters**: issue_key, comment

#### `get_transitions` **🆕 v1.1.0**
Get available workflow transitions for an issue
- **Parameters**: issue_key, working_dir, instance (optional)
- **Features**: Lists available transitions, required fields, and transition IDs
- **Use Case**: Understand workflow options before performing transitions

#### `transition_issue` **🆕 v1.1.0**
Perform workflow transitions on issues (e.g., move to "In Progress", "Done")
- **Parameters**: issue_key, transition_id OR transition_name, comment (optional), resolution (optional), fields (optional), working_dir, instance (optional)
- **Features**: Transition by name or ID, automatic resolution setting, comment addition
- **Use Case**: Automate status changes and workflow progression

#### `list_custom_fields` **🆕 v1.1.0**
Discover available custom fields for configuration
- **Parameters**: working_dir, instance (optional), projectKey (optional), showSystemFields (optional)
- **Features**: Field discovery, configuration examples, type classification
- **Use Case**: New user onboarding, field configuration, system exploration

### **⚙️ Configuration & Instance Management**

#### `list_instances`
Lists available Jira instances and their configurations
- **Features**: Instance discovery, project mappings, configuration guidance, setup validation
- **Use Cases**: Multi-instance setup verification, troubleshooting, configuration planning

### **🏗️ Project Structure Tools**

#### `create_component`
Creates feature-based project components
- **Parameters**: name, description, leadAccountId, assigneeType
- **Features**: Lead assignment, automatic issue routing

#### `list_components` 
Lists all project components with details
- **Features**: Component categorization, lead information, usage statistics

#### `get_component_progress`
Comprehensive component analytics and progress tracking
- **Features**: Progress percentages, status breakdowns, recent activity analysis, workload distribution

#### `create_version`
Creates project versions for release management
- **Parameters**: name, description, startDate, releaseDate, released, archived
- **Features**: Release timeline management, milestone tracking

#### `list_versions`
Lists project versions with categorization
- **Features**: Active/released/archived separation, timeline information, overdue warnings

#### `get_version_progress`
Detailed version progress and timeline analysis
- **Features**: Completion tracking, issue breakdowns, deadline monitoring, timeline insights

### **🔍 Advanced Query Tools**

#### `search_issues_jql`
Execute advanced JQL queries with comprehensive analytics
- **Parameters**: jql, maxResults, startAt, fields, expand, validateQuery
- **Features**: Query validation, result analytics, pagination, performance optimization

#### `search_projects`
Discover and search projects organization-wide
- **Parameters**: query, typeKey, categoryId, status, maxResults, startAt, expand
- **Features**: Cross-project discovery, metadata analysis, categorization

#### `create_filter`
Create saved filters for consistent tracking
- **Parameters**: name, jql, description, favourite, sharePermissions  
- **Features**: Permission management, team collaboration, query reuse

### **📊 Project Analysis Tools**

#### `get_project_details`
Comprehensive project information and structure analysis
- **Parameters**: projectKey, expand
- **Features**: Complete metadata, component/version summaries, permission analysis

#### `get_project_statuses`
Workflow and status configuration analysis
- **Features**: Status categorization, workflow optimization insights, transition mapping

#### `get_issue_types`
Issue type discovery and configuration analysis
- **Features**: Type hierarchy, field requirements, usage guidelines

#### `detect_project_fields`
**🆕 Field Configuration Discovery** - Essential for new user onboarding
- **Parameters**: working_dir, projectKey, instance (optional)
- **Purpose**: Automatically detect custom field IDs required for project configuration
- **Output**: Ready-to-copy configuration snippets for .jira-config.json
- **Detects**: Story Points, Sprint, and Epic Link field IDs using intelligent heuristics
- **Multi-Instance**: Full support for multiple Jira environments
- **Session-Aware**: Provides guidance only on first project access per session
- **Use Case**: Eliminates manual field ID hunting in Jira admin interface

### **🌉 Cross-Server Integration Tools**

#### `jira_health_check`
**🆕 Server Health Monitoring** - Monitor Jira server status and cross-server integration
- **Purpose**: Check server health, uptime, and cross-server connectivity
- **Output**: Comprehensive health status, configuration details, supported operations
- **Cross-Server**: Shows integration status with Confluence MCP servers
- **Session Info**: Real-time session count and activity monitoring

#### `confluence_health_check`
**🆕 Cross-Server Health Check** - Monitor Confluence server connectivity from Jira
- **Purpose**: Verify Jira-to-Confluence integration status and capabilities
- **Output**: Connection status, endpoint verification, integration configuration

### **🎯 Strategic Planning Tools**

#### `list_plans`
Strategic plan management (Jira Premium feature)
- **Features**: High-level roadmap tracking, timeline analysis, team metrics

### **Sprint & Epic Management Tools**

#### `create_sprint`
Creates new sprints with goals and timelines
- **Parameters**: name, goal, startDate, endDate, boardId, projectKey

#### `update_sprint`
Modifies existing sprint details and timeline
- **Parameters**: sprintId, name, goal, startDate, endDate, state

#### `get_sprint_details`
Comprehensive sprint progress and analytics
- **Features**: Issue tracking, velocity insights, burndown data

#### `move_issues_to_sprint`
Bulk sprint assignment for issues
- **Parameters**: sprintId, issueKeys

#### `complete_sprint`
Closes active sprints and handles remaining work
- **Parameters**: sprintId

#### `create_epic`
Creates new epics for large feature organization
- **Parameters**: name, summary, description, priority, labels, projectKey

#### `create_epic_with_issues`
Creates an epic with linked issues in a single operation ⚡
- **Parameters**: epic (name, summary, description, priority, labels), issues (array of issue data)
- **Features**: Reduces API calls, ensures proper linking, comprehensive error handling
- **Benefits**: Atomic operation, validates all issue types, automatic assignee resolution

#### `update_epic_details`
Updates epic properties and status
- **Parameters**: epicKey, name, summary, color, done

#### `rank_epics` & `rank_issues`
Manages epic and issue prioritization
- **Features**: Relative ranking, priority management

#### `bulk_update_issues`
Efficiently updates multiple issues simultaneously
- **Parameters**: issueKeys, updates (status, assignee, labels, priority, sprint, storyPoints)
- **Features**: Bulk operations, error handling per issue, intelligent assignee resolution

### **Board & Reporting Tools**

#### `list_boards`
Lists available Kanban and Scrum boards
- **Features**: Board categorization, project association

#### `get_board_configuration`
Analyzes board setup and column configuration
- **Features**: Workflow mapping, column analysis

#### `get_sprint_report`, `get_velocity_chart_data`, `get_burndown_chart_data`
Advanced sprint and team performance analytics
- **Features**: Velocity tracking, burndown analysis, performance insights

## 🛠️ Setup & Configuration

### Prerequisites

1. **Jira Account**: With API access and appropriate permissions
2. **API Token**: Generated from [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
3. **Project Access**: Read/write permissions for target projects

### Installation


#### Installing via npm

```bash
npm install -g jira-server
```

After installation, the `jira-server` command will be available globally.

#### Installing via Smithery

To install Jira Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/jira-server):

```bash
npx -y @smithery/cli install jira-server --client claude
```

#### Manual Installation
1. Install dependencies:


```bash
# Clone and install dependencies
npm install

# Build the server
npm run build
```

### Configuration

#### 1. Multi-Instance Configuration (Recommended)

The Jira MCP Server supports **multiple Jira instances** from a single Claude Desktop session. This enables seamless switching between different Jira Cloud environments based on project keys.

Create `.jira-config.json` in your working directory:

```json
{
  "instances": {
    "primary": {
      "email": "your-email@company.com",
      "apiToken": "your-api-token-here",
      "domain": "your-domain",
      "projects": ["PROJ", "DEV", "OPS"]
    },
    "secondary": {
      "email": "your-email@otherdomain.com", 
      "apiToken": "your-other-api-token",
      "domain": "other-domain"
    }
  },
  "projects": {
    "PROJ": {
      "instance": "primary",
      "storyPointsField": "customfield_10016",
      "sprintField": "customfield_10020",
      "epicLinkField": "customfield_10014"
    },
    "DEV": {
      "instance": "primary",
      "storyPointsField": "customfield_10016"
    },
    "OTHER": {
      "instance": "secondary",
      "storyPointsField": "customfield_10020"
    }
  },
  "defaultInstance": "primary"
}
```

#### Instance Selection Logic

The server automatically selects the correct Jira instance using this priority order:

1. **Explicit Override**: Manual `instance` parameter in tool calls
2. **Project Mapping**: Direct project-to-instance configuration in `projects` section
3. **Instance Project Lists**: Projects listed in instance `projects` arrays
4. **Default Instance**: Fallback to `defaultInstance` setting
5. **Single Instance**: Use the only available instance if just one is configured

#### 2. Legacy Single-Instance Configuration (Still Supported)

For single Jira instance setups, use the simplified format:

```json
{
  "projectKey": "YOUR_PROJECT_KEY",
  "storyPointsField": "customfield_XXXXX",  // Optional: auto-detected
  "sprintField": "customfield_YYYYY",       // Optional: auto-detected  
  "epicLinkField": "customfield_ZZZZZ"      // Optional: auto-detected
}
```

#### 3. MCP Server Configuration

**For Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/path/to/jira-server/build/index.js"],
      "cwd": "/path/to/jira-server",
      "env": {
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token", 
        "JIRA_DOMAIN": "your-domain"
      },
      "disabled": false,
      "alwaysAllow": true
    }
  }
}
```

**For VS Code Cline Extension** (`~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/path/to/jira-server/build/index.js"],
      "cwd": "/path/to/jira-server", 
      "env": {
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token",
        "JIRA_DOMAIN": "your-domain"
      },
      "disabled": false,
      "alwaysAllow": [
        "create_issue", "list_issues", "update_issue", "get_issue", "delete_issue", "add_comment",
        "list_instances", "create_component", "list_components", "get_component_progress",
        "create_version", "list_versions", "get_version_progress", 
        "search_issues_jql", "search_projects", "create_filter",
        "get_project_details", "get_project_statuses", "get_issue_types",
        "list_plans", "create_sprint", "update_sprint", "get_sprint_details",
        "create_epic", "update_epic_details", "bulk_update_issues"
      ]
    }
  }
}
```


**For OpenCode** (`opencode.json` in project or `~/.config/opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "jira": {
      "type": "local",
      "command": ["node", "build/index.js"],
      "enabled": true,
      "environment": {
        "JIRA_CONFIG_PATH": "./config/.jira-config.json"
      }
    }
  }
}
```

`JIRA_CONFIG_PATH` can be absolute, relative to the config file, or use `~` for the home directory. If you register the server under a different MCP name, set `JIRA_MCP_KEY` to that value so the loader can locate the correct block.

#### 4. Cross-Server Integration Configuration

For cross-server integration between Jira and Confluence MCP servers, you'll need to install and configure the companion [confluence-cloud-mcp](https://github.com/cfdude/confluence-cloud-mcp) server alongside this Jira server.

Add Confluence API configuration to your `.jira-config.json`:

```json
{
  "instances": {
    "primary": {
      "email": "your-email@company.com",
      "apiToken": "your-jira-api-token",
      "domain": "your-jira-domain",
      "projects": ["PROJ", "DEV"]
    }
  },
  "confluence": {
    "instances": {
      "primary": {
        "email": "your-email@company.com",
        "apiToken": "your-confluence-api-token",
        "domain": "your-confluence-domain"
      }
    },
    "defaultInstance": "primary"
  },
  "defaultInstance": "primary"
}
```

This enables tools like `jira_health_check`, `confluence_health_check`, and cross-server document creation capabilities.

**Cross-Server Integration Benefits:**
- **Bidirectional Linking**: Create smart links between Jira issues and Confluence pages
- **Automated Documentation**: Generate Confluence pages directly from Jira issues (epics, features, etc.)
- **Health Monitoring**: Monitor both servers and their integration status
- **Unified Workflow**: Seamlessly switch between issue tracking and documentation within the same AI session

For complete setup instructions and advanced cross-server features, see the [confluence-cloud-mcp documentation](https://github.com/cfdude/confluence-cloud-mcp).

## 🎯 Usage Examples

### Multi-Instance Management

#### Instance Discovery
```javascript
// List all configured instances and project mappings
await list_instances({ working_dir: "/path/to/config" });
```

#### Automatic Instance Selection
```javascript
// Automatically uses correct instance based on project key
await create_issue({
  working_dir: "/path/to/config",
  projectKey: "HWY",  // Routes to Highway instance
  summary: "New feature request",
  description: "Implement user dashboard",
  type: "Task"
});

await create_issue({
  working_dir: "/path/to/config", 
  projectKey: "ONVX", // Routes to Onvex instance
  summary: "Security update",
  description: "Update authentication system",
  type: "Task"
});
```

#### Manual Instance Override
```javascript
// Explicitly specify instance for any tool call
await create_issue({
  working_dir: "/path/to/config",
  instance: "highway",  // Force use of Highway instance
  projectKey: "PROJ",
  summary: "Cross-instance task",
  type: "Task"
});
```

### Project Planning Workflow

```javascript
// 1. Analyze project structure
await get_project_details({ projectKey: "PROJ" });

// 2. Create components for feature organization  
await create_component({
  name: "Authentication API",
  description: "User authentication and authorization features",
  leadAccountId: "user123"
});

// 3. Create release version
await create_version({
  name: "v2.0.0", 
  description: "Major feature release",
  releaseDate: "2024-06-30"
});

// 4. Search for related work
await search_issues_jql({
  jql: "project = PROJ AND component = 'Authentication API' AND fixVersion = 'v2.0.0'"
});
```

### Progress Tracking & Analytics

```javascript
// Component progress analysis
await get_component_progress({ componentId: "10123" });

// Version release tracking  
await get_version_progress({ versionId: "10456" });

// Sprint performance metrics
await get_sprint_report({ boardId: 1, sprintId: 23 });
```

### Advanced Query & Automation

```javascript
// Create saved filter for team tracking
await create_filter({
  name: "Backend Team Sprint Work",
  jql: "assignee in (dev1, dev2, dev3) AND sprint in openSprints()",
  sharePermissions: [{ type: "project", projectId: "10000" }]
});

// Bulk update for sprint planning
await bulk_update_issues({
  issueKeys: ["PROJ-1", "PROJ-2", "PROJ-3"],
  updates: { sprint: "Sprint 5", storyPoints: 3 }
});
```

### 🆕 Time Tracking & Workflow Management (v1.1.0)

#### Time Tracking Examples
```javascript
// Set time estimates on issue creation
await create_issue({
  working_dir: "/path/to/config",
  projectKey: "PROJ",
  summary: "Implement user authentication",
  description: "Build OAuth2 integration",
  type: "Task",
  story_points: 5,
  original_estimate: "2w",  // 2 weeks
  // Time automatically displayed in get_issue
});

// Update time tracking on existing issues
await update_issue({
  working_dir: "/path/to/config",
  issue_key: "PROJ-123",
  original_estimate: "1w 2d",     // 1 week 2 days
  remaining_estimate: "3d 4h"     // 3 days 4 hours
});

// Use with component assignment
await update_issue({
  working_dir: "/path/to/config", 
  issue_key: "PROJ-124",
  custom_fields: {
    "Component": "Security"  // Automatically converts to [{name: "Security"}]
  },
  original_estimate: "5d"
});
```

#### Workflow Transition Examples
```javascript
// Discover available transitions for an issue
await get_transitions({
  working_dir: "/path/to/config",
  issue_key: "PROJ-123"
});

// Transition issue to "In Progress" with comment
await transition_issue({
  working_dir: "/path/to/config",
  issue_key: "PROJ-123",
  transition_name: "Start Progress",  // or transition_id: "21"
  comment: "Beginning work on this issue"
});

// Complete issue with resolution
await transition_issue({
  working_dir: "/path/to/config",
  issue_key: "PROJ-123", 
  transition_name: "Done",
  comment: "Implementation completed and tested",
  resolution: "Fixed"
});

// Workflow automation - bulk transition
const issueKeys = ["PROJ-101", "PROJ-102", "PROJ-103"];
for (const key of issueKeys) {
  await transition_issue({
    working_dir: "/path/to/config",
    issue_key: key,
    transition_name: "Ready for Review"
  });
}
```

#### Field Discovery Examples
```javascript
// Discover all available fields for configuration
await list_custom_fields({
  working_dir: "/path/to/config",
  instance: "primary",
  projectKey: "PROJ",  // Optional: project-specific fields
  showSystemFields: false  // Show only custom fields
});

// Get ready-to-copy configuration snippets
// Output includes examples like:
// - Story Points: customfield_10036
// - Sprint: customfield_10020  
// - Components: Built-in system field
```

### Epic with Issues - Bulk Creation ⚡

The new `create_epic_with_issues` tool allows you to create an epic and multiple linked issues in a single operation:

```javascript
// Create epic with linked issues in one operation
await create_epic_with_issues({
  working_dir: "/path/to/config",
  projectKey: "PROJ",
  epic: {
    name: "User Authentication System",
    summary: "Complete user authentication and authorization",
    description: "Implement secure user authentication with OAuth2 and role-based access control",
    priority: "High",
    labels: ["security", "authentication"]
  },
  issues: [
    {
      summary: "Design OAuth2 integration",
      description: "Research and design OAuth2 flow for user authentication",
      type: "Task",
      story_points: 5,
      assignee: "john.doe@company.com",
      priority: "High"
    },
    {
      summary: "Implement user registration API",
      description: "Create REST API endpoints for user registration",
      type: "Story",
      story_points: 8,
      assignee: "Jane Smith",
      labels: ["api", "backend"]
    },
    {
      summary: "Build login form UI",
      description: "Create responsive login form with validation",
      type: "Task", 
      story_points: 3,
      assignee: "mike.wilson@company.com",
      priority: "Medium"
    }
  ]
});
```

**Benefits of Bulk Creation:**
- **Reduced API Calls**: Single operation instead of multiple separate calls
- **Automatic Linking**: All issues are automatically linked to the epic
- **Atomic Operation**: Either all items are created successfully or none are
- **Comprehensive Validation**: Validates epic and all issues before creation
- **Enhanced Error Handling**: Detailed feedback on any validation failures
- **Intelligent Assignee Resolution**: Automatically resolves user names/emails to account IDs

### Assignee Management Examples

The MCP Jira Server provides intelligent assignee resolution that accepts display names, emails, or account IDs and automatically resolves them to the correct Jira account.

#### Individual Issue Assignment
```javascript
// Assign by display name (most common)
await update_issue({
  working_dir: "/path/to/config",
  issue_key: "PROJ-123",
  assignee: "Esther Yang"  // Resolves to account ID automatically
});

// Assign by email address
await update_issue({
  working_dir: "/path/to/config", 
  issue_key: "PROJ-124",
  assignee: "esther.yang@company.com"
});

// Unassign issue
await update_issue({
  working_dir: "/path/to/config",
  issue_key: "PROJ-125", 
  assignee: "unassigned"  // or null, or empty string
});
```

#### Bulk Assignment Operations
```javascript
// Assign multiple issues to one person
await bulk_update_issues({
  working_dir: "/path/to/config",
  issueKeys: ["PROJ-101", "PROJ-102", "PROJ-103"],
  updates: {
    assignee: "Rob Sherman",  // Intelligent name resolution
    sprint: "Sprint 10"
  }
});

// Unassign multiple issues
await bulk_update_issues({
  working_dir: "/path/to/config",
  issueKeys: ["PROJ-201", "PROJ-202"],
  updates: {
    assignee: "unassigned"
  }
});
```

#### Assignee Resolution Logic

The system automatically handles user resolution using this priority order:

1. **Exact Display Name Match**: "Esther Yang" → Exact match in Jira users
2. **Email Address Match**: "esther.yang@company.com" → Match by email
3. **Partial Name Match**: "Esther" → Single partial match found
4. **Account ID Pass-through**: If already an account ID, uses as-is

**Error Handling:**
- **No Match Found**: Clear error message with suggested similar names
- **Multiple Matches**: Lists all possibilities and asks for more specificity
- **Invalid Users**: Validates user exists and is active

**Special Values:**
- `"unassigned"`, `null`, or `""` → Unassigns the issue
- Account IDs starting with specific patterns are used directly

## 🔧 Advanced Features

### **Intelligent Field Detection**
- Automatically detects custom fields (Story Points, Sprint, Epic Link)
- Provides configuration guidance in debug logs
- Supports manual field ID override

### **Cross-Project Operations**  
- Search and manage issues across multiple projects
- Project discovery and analysis capabilities
- Organization-wide reporting and insights

### **Performance Optimization**
- Efficient batch operations for bulk updates
- Pagination support for large datasets  
- Query validation and optimization suggestions

### **Rich Analytics & Reporting**
- Visual progress indicators and percentages
- Timeline analysis with deadline tracking
- Team performance and workload distribution
- Historical trend analysis and insights

## 🐛 Troubleshooting

### Debug Logging

Monitor server activity with detailed logs:

```bash
# For Claude Desktop (macOS)
tail -f ~/Library/Logs/Claude/mcp-server-jira.log

# For development
npm run watch  # Auto-rebuild on changes
```

### Common Issues

#### **Field Detection Problems**
- **New Users**: Use `detect_project_fields` tool to automatically discover field IDs
- **Missing Fields**: Tools now provide automatic guidance on first project access per session
- Check debug logs for "Found [Field] field" messages
- Verify custom field IDs in project admin
- Ensure proper field permissions

#### **Query Performance**
- Use `validateQuery: true` for JQL testing
- Implement pagination for large result sets
- Monitor query complexity in debug logs

#### **Configuration Issues**
- Server checks multiple config locations in order:
  1. Working directory parameter (`working_dir`)
  2. Current working directory (`process.cwd()`) 
  3. Server installation directory
- Verify `.jira-config.json` format and permissions

#### **Multi-Instance Configuration Issues**
- **Instance Not Found**: Use `list_instances` to verify instance names and configurations
- **Wrong Instance Selected**: Check project mappings in `projects` section and instance `projects` arrays
- **Authentication Failures**: Verify each instance has correct email, apiToken, and domain
- **Project Key Conflicts**: Ensure project keys are unique across instances or properly mapped
- **Configuration Validation**: Use `list_instances` for setup verification and troubleshooting guidance

#### **API Rate Limiting**
- Implement delays between bulk operations
- Use batch operations where available
- Monitor API response headers for rate limit status

### Enhanced Error Messages 🎯

The server now provides detailed, user-friendly error messages with specific troubleshooting guidance:

#### **Field Validation Errors**
- **Detailed Field Issues**: Clear explanations for each field problem
- **User-Friendly Names**: Technical field IDs converted to readable names (e.g., `customfield_10011` → `Epic Name`)
- **Field-Specific Guidance**: Targeted advice for common field issues

#### **Context-Aware Troubleshooting**
- **Permission Issues**: Specific steps for resolving access problems
- **Configuration Problems**: Guidance for field and project setup issues
- **Validation Failures**: Clear explanation of what went wrong and how to fix it

#### **Example Enhanced Error**
```
# Invalid Request: epic creation failed

The request contains invalid data or violates Jira field requirements.

## Field Issues
- **Epic Name:** Field 'customfield_10011' is not supported for issue type 'Epic' in this project
- **Priority:** Priority 'Critical' is not available. Available priorities: Highest, High, Medium, Low, Lowest

## Troubleshooting Steps
1. Epic Name field may not be available in this project
2. Try creating the epic without the Epic Name field  
3. Check available priorities for this project
4. Common values: Highest, High, Medium, Low, Lowest
```

### Error Codes & Resolution

| Error Type | Common Causes | Resolution |
|------------|---------------|------------|
| `401 Unauthorized` | Invalid API token or email | Verify credentials in MCP config |
| `403 Forbidden` | Insufficient project permissions | Check Jira project roles and permissions |
| `404 Not Found` | Invalid project key or issue key | Verify project/issue exists and is accessible |
| `400 Bad Request` | Invalid field values or transitions | **Enhanced**: Detailed field validation with specific guidance |

## 🚀 Development

### Development Setup

```bash
# Install dependencies
npm install

# Development with auto-rebuild  
npm run watch

# Run tests
npm test

# Build for production
npm run build
```

### Testing

The project includes comprehensive Jest testing with ESM and TypeScript support:

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Generate test coverage report
npm run test:coverage
```

**Test Structure:**
- `tests/unit/` - Unit tests for individual modules (config, formatting, ADF conversion)
- `tests/integration/` - Integration tests for server functionality
- Uses Jest with ts-jest for TypeScript ESM support
- Tests are automatically run in CI/CD pipeline

**Key Features:**
- ESM module testing with `.js` extension imports
- TypeScript compilation via ts-jest
- Node.js experimental VM modules for ESM compatibility
- Comprehensive coverage for utilities and core functionality

### Contributing

1. **Field Detection**: Add new custom field support in `src/config/config.ts`
2. **Tool Development**: Follow existing patterns in `src/tools/`
3. **API Extensions**: Extend base client in `src/jira-client.ts`
4. **Testing**: Add comprehensive tests for new functionality

## 📈 Enterprise Features

### **Strategic Planning Integration**
- Links tactical work to strategic initiatives  
- Portfolio-level reporting and insights
- Cross-project dependency tracking

### **Advanced Analytics**
- Custom metrics and KPI tracking
- Team performance benchmarking  
- Predictive delivery forecasting

### **Workflow Optimization**
- Bottleneck identification and resolution
- Process improvement recommendations
- Automation opportunity discovery

### **Security & Compliance**
- Audit trail and change tracking
- Permission analysis and optimization
- Data governance and compliance reporting

---

**Transform your Jira experience from basic issue tracking to comprehensive project management and strategic planning platform.**