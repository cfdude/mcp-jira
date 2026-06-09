# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔁 Development Workflow — OpenSpec + Superpowers (MANDATORY for new work)

All **new, non-trivial work** (features, behavior changes, multi-file refactors)
flows through OpenSpec for specs and Superpowers for two mandatory third-party
code-review gates. Trivial one-line fixes and pure chores are exempt. The pipeline:

1. **Propose (OpenSpec).** Run `/opsx:propose "<idea>"` to generate
   `openspec/changes/<change-id>/` with `proposal.md`, `design.md`, `specs/*.md`,
   and `tasks.md`. Validate with `openspec validate <change-id> --strict`.

2. **🚦 GATE 1 — spec review (Superpowers, BEFORE any code).** Invoke the
   `superpowers:requesting-code-review` skill against the change artifacts as a
   fresh-context third-party audit. Because the artifacts are uncommitted
   markdown, point the reviewer at the file paths (not a git SHA range). Check:
   spec testability (WHEN/THEN), cross-capability consistency, data-model
   correctness, fidelity to existing code, and TDD-ordered tasks.
   - Fix **Critical + Important** findings in the specs before proceeding.
   - Re-run `openspec validate <change-id> --strict`. Do not apply until clean.

3. **Apply (OpenSpec).** Run `/opsx:apply`. Implement tasks with TDD
   (RED → GREEN → REFACTOR), **one conventional commit per task** (never batch).

4. **🚦 GATE 2 — implementation review (Superpowers, AFTER commits, BEFORE docs).**
   Once all tasks are implemented and committed — but before any documentation
   changes — invoke `superpowers:requesting-code-review` against the full
   committed diff (`BASE_SHA..HEAD_SHA`). Check: spec/plan alignment, tests
   actually passing, error/edge handling, security, and the STDIO
   stdout/JSON-RPC invariant. Fix **Critical + Important** before docs; note
   **Minor**, pushing back with reasoning if the reviewer is wrong.

5. **Acceptance + docs.** Only after Gate 2 is clean: update docs / README /
   CHANGELOG.

6. **Archive (OpenSpec).** Run `/opsx:archive <change-id>` to sync delta specs
   into `openspec/specs/` and move the change to `openspec/changes/archive/`.
   Never skip — archived specs are how the next session knows the feature exists.

**Gate rules:** the reviewer is a fresh-context subagent (sees the work product,
not the session history). **Critical → fix now. Important → fix before
proceeding. Minor → note.** A gate is not "done" until you re-validate/re-test
after applying fixes. Per-task quality fix-ups inside `apply` are autonomous and
do not need a check-in.

Project context for OpenSpec artifact generation lives in `openspec/config.yaml`.
The `/opsx:*` commands and `openspec-*` skills are provided by `openspec init`
(regenerate with `openspec init --tools claude` / `openspec update`); they live
under the gitignored `.claude/` dir, so each clone runs init once.

## Development Commands

- `npm run build` - Compile TypeScript to JavaScript in build/ directory
- `npm run watch` - Development mode with auto-rebuild on file changes
- `npm run prepare` - Build the project (runs automatically on npm install)
- `npm run inspector` - Run MCP inspector for debugging server functionality
- `npm run start:http` - Start the HTTP server locally (port 8107)
- `npm install` - Install dependencies
- `npm test` - Run tests (if available)

## Architecture Overview

This is a **Model Context Protocol (MCP) server** that provides comprehensive Jira integration for AI assistants. The server enables advanced project management, analytics, and strategic planning through Jira's REST API.

### Core Architecture

#### Server Architecture

The server supports two transport modes via separate entry points:

- **STDIO Entry Point**: `src/index.ts` - For Claude Desktop (spawns process directly)
- **HTTP Entry Point**: `src/http-server.ts` - For Claude Code via PM2 (shared across projects)
- **Server Core**: `src/jira-server.ts` - Transport-agnostic server with `createMcpServer()` factory

#### Transport Modes

##### STDIO Mode (Claude Desktop)
```bash
node build/index.js
```
Used by Claude Desktop which spawns the process directly. Each Desktop session gets its own process.

##### HTTP Mode (Claude Code / PM2)
```bash
node build/http-server.js
# Or via PM2:
pm2 start ecosystem.config.cjs
```
Stateful HTTP transport on port 8107 (configurable via `MCP_HTTP_PORT` env var).
Multiple Claude Code projects share a single server instance.
Each client session gets its own MCP Server instance with isolated state.

The HTTP server uses a **server-per-session factory pattern** because the MCP SDK's `Server.connect()` only allows one transport per `Server` instance. The `JiraServer.createMcpServer()` static method creates a fresh `Server` with all tool/resource/prompt handlers for each HTTP session.

Configure in Claude Code (user scope):
```bash
claude mcp add --scope user jira --transport http --url http://localhost:8107/mcp
```

#### Key Components

- **Session Manager**: `src/session-manager.ts` - Thread-safe session lifecycle and state isolation
- **Configuration**:
  - `src/config.ts` - Legacy global configuration management
  - `src/session-config.ts` - Session-aware configuration loading for thread safety
- **Tool Registry**: `src/tools/index.ts` - Central tool registration and routing with session support
- **Individual Tools**: `src/tools/*.ts` - Each Jira operation with session isolation support
- **Utilities**: `src/utils/` - Shared utilities with session-aware context handling
- **Graceful Shutdown**: `src/utils/graceful-shutdown.ts` - HTTP-only shutdown handler (STDIO relies on Claude's process management)

### Multi-Instance Support

The server supports multiple Jira Cloud instances through `.jira-config.json`:
- Automatic instance selection based on project keys
- Instance-specific credentials and configurations
- Fallback to environment variables for legacy setups
- Instance discovery and validation tools

### Tool Categories

1. **Issue Management** - Create, update, delete, search issues
2. **Sprint Management** - Sprint operations and lifecycle
3. **Epic Management** - Epic creation and organization
4. **Board Management** - Board configuration and reports
5. **Project Planning** - Components, versions, filters
6. **Analytics & Reporting** - Progress tracking and metrics
7. **Advanced Operations** - Bulk updates, ranking, JQL queries

### Configuration Files

- `.jira-config.json` - Primary configuration for multi-instance setup
- `ecosystem.config.cjs` - PM2 deployment config (gitignored, see `.example`)
- `tsconfig.json` - TypeScript compilation settings
- `package.json` - Dependencies and build scripts

### Session Management & Concurrency

The server provides thread-safe concurrent operation through session isolation:

- **Session Isolation**: Each connection (STDIO or HTTP) gets its own session with isolated state
- **Configuration Caching**: Per-session configuration caching prevents race conditions between concurrent clients
- **Automatic Cleanup**: Sessions expire after 30 minutes of inactivity and are cleaned up on transport close
- **Session Metrics**: Real-time session count and activity monitoring for debugging
- **Graceful Shutdown**: Proper cleanup of sessions and connections on server termination (HTTP mode)

### Tool Implementation Pattern

Each tool follows a consistent session-aware pattern:
1. Accept optional `SessionState` parameter for session isolation
2. Input validation and parameter extraction
3. Session-aware instance resolution (per-session config cache)
4. Jira API client creation with instance credentials
5. API operation execution with error handling
6. Response formatting for Claude consumption

### Testing and Debugging

- **CRITICAL**: Always use `npm run inspector` to test MCP server functionality after any changes
- Check console.error output for detailed logging with session context
- Configuration loading is extensively logged for troubleshooting
- Multi-instance selection logic includes detailed tracing
- Session management includes per-session logging for debugging concurrent issues
- Session lifecycle events (creation, cleanup, timeout) are logged for concurrency debugging

#### MCP Inspector Workflow
```bash
# Always test after changes
npm run build
npm run inspector build/index.js

# Open inspector at http://localhost:6274
# Test all tools and verify functionality
# Each inspector connection creates its own isolated session
```

## Key Development Notes

- All tools require `working_dir` parameter containing `.jira-config.json`
- Instance selection follows priority: explicit override > project mapping > instance project lists > default instance
- Error handling includes Axios error unwrapping for better debugging
- **Field Detection UX Enhancement**: Use `detect_project_fields` tool for new project setup
- **Automatic Config Guidance**: Tools provide guidance on missing fields during first project access per session
- **Session-Based Project Tracking**: Each session tracks accessed projects to provide targeted guidance
- Tool registration includes comprehensive input schemas for validation

### Field Detection Workflow

For new users or projects without field configuration:

1. **Manual Detection**: Use `detect_project_fields` tool to automatically discover field IDs
   ```javascript
   detect_project_fields({
     working_dir: "/path/to/project",
     projectKey: "PROJ",
     instance: "primary"  // optional, auto-resolves if not provided
   })
   ```

2. **Automatic Guidance**: When accessing a project for the first time in a session:
   - Tools automatically check for missing field configurations
   - Provide copy/paste ready configuration snippets
   - Include guidance on using `detect_project_fields` for discovery

3. **Session Isolation**: Each client session independently tracks project access
   - First access per project triggers configuration guidance
   - Subsequent accesses in same session don't repeat guidance
   - Prevents guidance spam while ensuring new projects get help

### Running the Server

#### STDIO Mode (Claude Desktop)
```bash
# Build the project
npm run build

# Run the server (connects via STDIO)
node build/index.js

# For development with debugging
DEBUG=* node build/index.js

# Test with MCP Inspector
npm run inspector build/index.js
```

#### HTTP Mode (PM2 / Claude Code)
```bash
# Build the project
npm run build

# Run directly
npm run start:http

# Or via PM2 (production)
cp ecosystem.config.cjs.example ecosystem.config.cjs
# Edit ecosystem.config.cjs with your paths
pm2 start ecosystem.config.cjs
pm2 save

# Verify
curl http://localhost:8107/health
```

### Session Architecture

Each client connection creates its own session with isolated:
- Configuration cache (prevents race conditions)
- Story points field reference
- Session activity tracking
- Error context and logging

In HTTP mode, each session also gets its own MCP `Server` instance, ensuring complete isolation between concurrent Claude Code projects.
