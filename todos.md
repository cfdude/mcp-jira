# MCP Jira Server - Outstanding Tasks

This document tracks pending work items for the MCP Jira Server project. These tasks were identified during development and testing sessions.

## High Priority

### ✅ Completed
- **Implement Jira workflow transitions support** - Successfully implemented `get_transitions` and `transition_issue` tools
- **Fix complete_sprint functionality** - Resolved issue where sprint completion was failing with 400 errors. Solution was to simplify the implementation to match the official API specification exactly.
- **Fix get_board_reports functionality** - Resolved issue where get_board_reports was failing with 400 errors due to calling non-existent `/board/{boardId}/reports` endpoint. Fixed by replacing with valid `/board/{boardId}/sprint?state=active,future` endpoint to properly show current and future sprints.

## Medium Priority

### 🔧 Pending

#### 1. Address Claude's Code Review Recommendations
**Context**: During the PR merge for workflow transitions support, Claude provided several code review suggestions that should be implemented in a future PR.

**Key recommendations**:
- Add proper error handling for edge cases
- Improve type safety in certain areas
- Add more comprehensive documentation
- Consider additional test coverage

**Related PR**: Check the PR history for the workflow transitions implementation to see the full review comments.

#### 2. Refactor /tools/index.ts Into Smaller Files
**Context**: The main tools index file has grown too large and exceeds AI context limits, making it difficult for AI assistants to work with the entire file at once.

**Problem**: 
- File is over 1000 lines
- Contains registration for all tools in a single file
- Difficult to navigate and maintain

**Suggested approach**:
- Split tool registrations into logical groups (e.g., issue-tools.ts, sprint-tools.ts, epic-tools.ts)
- Keep the main index.ts as a thin aggregator
- Maintain backward compatibility

## Low Priority

### 🔧 Pending

#### 1. Address Main Branch Security Warnings
**Context**: GitHub is showing security warnings on the main branch, likely from dependency vulnerabilities in package.json.

**Action needed**:
- Run `npm audit` to identify vulnerabilities
- Update dependencies where possible
- Document any false positives or accepted risks
- Consider setting up Dependabot for automated updates

## Notes for Future Sessions

1. **Testing**: Always use `npm run inspector` to test MCP tools after making changes
2. **Multi-instance support**: This server supports multiple Jira instances - always test with the instance parameter
3. **Session management**: The server uses session-based state isolation for concurrent client support
4. **Configuration**: Check `.jira-config.json` for instance configurations and field mappings

## Recently Completed Work

These items were completed in recent sessions and can serve as reference:

1. **Workflow Transitions**: Added ability to get available transitions and perform state changes on issues
2. **Sprint Completion**: Fixed bug where sprint completion was failing - issue was overly complex implementation
3. **Cross-server Integration**: Added health check endpoints for Jira-Confluence integration

---

*Last updated: 2025-01-04*