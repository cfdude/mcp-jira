# Jira Configuration Search Paths

This document outlines the search order for Jira configuration files in the MCP Jira server.

## Search Order

The server searches for `.jira-config.json` files in the following order (first found wins):

1. **Project-specific config**: `{working_dir}/.jira-config.json`
   - Allows each project to have its own Jira configuration
   - Highest priority for project-specific overrides

2. **Claude Code global config**: `~/.claude/.jira-config.json`
   - Global configuration managed by Claude Code
   - Added for Claude Code integration support
   - Provides fallback when no project-specific config exists

3. **Current working directory**: `{process.cwd()}/.jira-config.json`
   - Legacy support for server working directory
   - Maintains backward compatibility

4. **Server directory**: `{server_root}/.jira-config.json`
   - Configuration co-located with server code
   - Legacy support for development/testing

5. **Parent directory**: `{process.cwd()}/../.jira-config.json`
   - Additional fallback location
   - Legacy support for monorepo structures

## Configuration Format

Supports both legacy single-instance and modern multi-instance configurations:

### Multi-instance Configuration (Recommended)
```json
{
  "instances": {
    "primary": {
      "email": "user@company.com",
      "apiToken": "your-api-token",
      "domain": "company",
      "projects": ["PROJ1", "PROJ2"]
    },
    "secondary": {
      "email": "user@other.com", 
      "apiToken": "other-token",
      "domain": "other-company"
    }
  },
  "projects": {
    "PROJ1": {
      "instance": "primary",
      "storyPointsField": "customfield_10016"
    }
  },
  "defaultInstance": "primary"
}
```

### Legacy Single-instance Configuration
```json
{
  "projectKey": "PROJ",
  "storyPointsField": "customfield_10016"
}
```

## Environment Variable Fallback

If no configuration files are found, the server falls back to environment variables:
- `JIRA_EMAIL`
- `JIRA_API_TOKEN` 
- `JIRA_DOMAIN`

## Thread Safety

Each session maintains its own configuration cache keyed by working directory to prevent race conditions in concurrent multi-project usage.

## Migration Notes

- **Before thread-safety**: Configuration was only checked in project directory and server directory
- **After thread-safety**: Added Claude Code global config support (`~/.claude/.jira-config.json`)
- **Current**: Full search hierarchy with project-specific overrides and global fallback