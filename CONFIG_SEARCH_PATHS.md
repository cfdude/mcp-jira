# Jira Configuration Search Paths

This document outlines the search order for Jira configuration files in the MCP Jira server.

## Search Order

The server searches for configuration in the following order (first match wins):

1. **Explicit environment override**: `JIRA_CONFIG_PATH`
   - Points directly to a `.jira-config.json` file
   - Absolute paths are used as-is
   - Relative paths are resolved against the current `working_dir`
   - Supports `~` expansion to the user home directory

2. **Project-specific config**: `{working_dir}/.jira-config.json`
   - Allows each project to have its own Jira configuration
   - Highest priority for project-specific overrides

3. **Claude Code global config**: `~/.claude/.jira-config.json`
   - Global configuration managed by Claude Code
   - Added for Claude Code integration support
   - Provides fallback when no project-specific config exists

4. **Current working directory**: `{process.cwd()}/.jira-config.json`
   - Legacy support for server working directory
   - Maintains backward compatibility

5. **Server directory**: `{server_root}/.jira-config.json`
   - Configuration co-located with server code
   - Legacy support for development/testing

6. **Parent directory**: `{process.cwd()}/../.jira-config.json`
   - Additional fallback location
   - Legacy support for monorepo structures

### OpenCode Integration

When running under [OpenCode](https://opencode.ai), the server automatically looks for the MCP schema (`opencode.json` or `opencode.jsonc`) in these locations:

- `OPENCODE_CONFIG` environment variable (if set)
- Project root and parent directories (supports `.opencode/opencode.json`)
- Global config: `~/.config/opencode/opencode.json`

If an MCP entry named `jira` (configurable via `JIRA_MCP_KEY`) is found and marked `enabled`, the server applies any environment variables defined in the entry. In particular, setting `JIRA_CONFIG_PATH` in the OpenCode MCP environment block ensures the Jira server reads the correct `.jira-config.json` even when the server is launched outside the project tree.

Example OpenCode snippet:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "jira": {
      "type": "local",
      "enabled": true,
      "command": ["node", "build/index.js"],
      "environment": {
        "JIRA_CONFIG_PATH": "./config/.jira-config.json"
      }
    }
  }
}
```

The path in `JIRA_CONFIG_PATH` may be relative to the OpenCode config file, absolute, or use `~` for the home directory. Environment variables defined here are only applied if they are not already set when the server starts, preserving backward compatibility with manual exports.

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
- **Current**: Prioritizes explicit `JIRA_CONFIG_PATH`, supports OpenCode MCP schema, and maintains full legacy compatibility
