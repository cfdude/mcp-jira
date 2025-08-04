# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-08-04

### Fixed
- **ADF to Markdown Conversion**: Fixed critical "[object Object]" display issue when Jira descriptions contain Atlassian Document Format (ADF) content
- **Logger Output**: Fixed MCP JSON-RPC communication issues by redirecting all logging to stderr instead of stdout
- **Library Integration**: Replaced unmaintained adf2md library with actively maintained adf-to-md for reliable ADF conversion

### Added
- **Environment Field Support**: Added ADF-aware environment field retrieval and display in get_issue tool
- **Type Declarations**: Added TypeScript declarations for adf-to-md library

### Enhanced
- **Description Display**: Improved description formatting in both detailed (get_issue) and list (list_issues) views
- **Field Retrieval**: Environment field now included in standard field list for all issue queries

### Technical Improvements
- **ADF Handling**: Robust conversion handling for issue descriptions, comments, and environment fields
- **Error Handling**: Better error messages when ADF conversion fails with graceful fallbacks

## [1.0.0] - 2025-08-04

🚀 **First Major Release - Production Ready!**

This release represents a complete, production-ready MCP server for comprehensive Jira integration with enterprise-level features, automated field detection, and cross-server capabilities.

### 🆕 Major New Features

#### **Automated Field Detection & Onboarding**
- **`detect_project_fields` Tool**: Revolutionary automated custom field discovery eliminates the #1 onboarding pain point
- **Intelligent Field Matching**: Advanced heuristics automatically detect Story Points, Sprint, and Epic Link fields
- **Ready-to-Copy Configuration**: Generates complete `.jira-config.json` snippets for instant setup
- **Multi-Instance Support**: Full field detection across multiple Jira Cloud environments
- **Session-Aware Guidance**: Smart first-time project access detection with automatic configuration assistance

#### **Cross-Server Integration Architecture**
- **Health Monitoring**: New `jira_health_check` and `confluence_health_check` tools for server connectivity verification
- **Dual Transport Support**: Advanced architecture supporting both STDIO and HTTP for cross-server communication
- **Configuration Integration**: Seamless Confluence API configuration within existing Jira config structure
- **Connection Status**: Real-time integration status and capability reporting

#### **Enterprise Session Management**
- **Thread-Safe Concurrency**: Multiple Claude Code sessions can safely use the same server simultaneously
- **Session State Isolation**: Each client connection gets completely isolated session state preventing cross-contamination
- **Automatic Cleanup**: Smart 30-minute session timeout with 5-minute cleanup intervals
- **Per-Session Configuration Caching**: Eliminates race conditions and improves performance
- **Real-Time Monitoring**: Session count and activity tracking for enterprise debugging

### 🎯 User Experience Enhancements

#### **Intelligent Configuration Management**
- **Automatic Validation**: Enhanced field validation with specific troubleshooting guidance
- **Context-Aware Help**: Configuration guidance appears only when needed, preventing spam
- **Error Message Enhancement**: Field validation errors now include friendly names and actionable steps
- **First-Access Detection**: Smart detection of new project access triggers helpful guidance once per session

#### **Enhanced Tool Descriptions**
- **AI-Optimized Documentation**: All 60+ tools now have comprehensive descriptions optimized for AI assistance
- **Parameter Guidance**: Clear parameter explanations with examples and validation requirements
- **Multi-Instance Instructions**: Specific guidance for multi-instance parameter usage
- **Best Practices**: Embedded best practices and usage patterns in tool descriptions

### 🏗️ Architecture & Technical Improvements

#### **Advanced Multi-Instance Architecture**
- **Automatic Instance Resolution**: Smart instance selection based on project keys and configuration
- **Priority-Based Selection**: Sophisticated resolution logic with fallback strategies
- **Configuration Validation**: Comprehensive validation with detailed error reporting
- **Instance Discovery**: Built-in tools for exploring and managing multiple instances

#### **Robust Error Handling & Validation**
- **Enhanced Error Formatter**: User-friendly error messages with field name mapping
- **Comprehensive Validation**: Input validation using Zod schemas across all tools
- **Contextual Troubleshooting**: Error messages include specific troubleshooting steps
- **Graceful Degradation**: Intelligent fallback behavior when components fail

#### **Performance & Reliability**
- **Memory Management**: Efficient session cleanup and resource management
- **API Optimization**: Reduced API calls through intelligent caching and bulk operations
- **Request Tracking**: Enhanced logging with request ID tracking for debugging
- **Connection Pooling**: Optimized HTTP client configuration for performance

### 🔧 New Tools & Capabilities

#### **Project Analysis & Discovery**
- **`detect_project_fields`**: Automatic custom field detection with multi-instance support
- **`get_project_details`**: Enhanced project information with comprehensive metadata
- **`search_projects`**: Organization-wide project discovery and analysis
- **`get_issue_types`**: Issue type discovery with field requirements

#### **Health & Monitoring**
- **`jira_health_check`**: Comprehensive server health monitoring with cross-server integration status
- **`confluence_health_check`**: Cross-server connectivity verification from Jira perspective
- **Session Metrics**: Real-time session count and activity monitoring
- **Configuration Status**: Live configuration validation and health reporting

#### **Enhanced Existing Tools**
- **All Tools**: Enhanced with session isolation and automatic config guidance
- **Tool Registration**: Centralized registration system with comprehensive metadata
- **Parameter Validation**: Enhanced input validation and error handling
- **Response Formatting**: Improved response formatting for better AI consumption

### 🔒 Security & Compliance

#### **Production Security**
- **Cryptographically Secure Session IDs**: Secure session identification using Node.js crypto
- **Input Sanitization**: Comprehensive input validation and sanitization
- **Credential Management**: Secure credential handling with no exposure risks
- **Session Isolation**: Complete isolation prevents credential leakage between sessions

#### **Development Security**
- **Secret Detection**: Automated secret detection in CI/CD pipeline
- **Dependency Scanning**: Regular dependency vulnerability scanning
- **Code Quality**: Comprehensive ESLint and security linting
- **Repository Cleanup**: Removal of temporary files and credential exposure risks

### 📚 Documentation & Developer Experience

#### **Comprehensive Documentation**
- **README.md**: Complete rewrite with enterprise-level documentation
- **CLAUDE.md**: Detailed development guidelines and workflow documentation
- **Configuration Examples**: Ready-to-use configuration templates
- **Troubleshooting Guide**: Comprehensive troubleshooting with common scenarios

#### **Developer Tools**
- **MCP Inspector Integration**: Enhanced inspector support for tool testing
- **Test Coverage**: Comprehensive Jest test suite with ESM support
- **Linting & Formatting**: Modern ESLint and Prettier configuration
- **CI/CD Pipeline**: Automated testing, security scanning, and code quality checks

### 🐛 Bug Fixes & Stability

#### **Critical Fixes**
- **Session Management**: Resolved concurrency issues with proper session isolation
- **Configuration Loading**: Fixed race conditions in multi-instance configuration loading
- **Memory Leaks**: Proper cleanup of sessions and event listeners
- **Error Handling**: Enhanced error recovery and graceful degradation

#### **Performance Improvements**
- **Configuration Caching**: Per-session caching eliminates redundant file system access
- **API Efficiency**: Reduced API calls through intelligent batching and caching
- **Resource Management**: Proper cleanup and resource management
- **Connection Optimization**: Optimized HTTP client configuration

### 🚀 Breaking Changes

**None!** This release maintains 100% backward compatibility with existing configurations and integrations.

### 📦 Package & Distribution

#### **NPM Package Preparation**
- **Complete Package Metadata**: Comprehensive package.json with all required npm fields
- **License Compliance**: MIT license with proper attribution
- **File Optimization**: Optimized published files with .npmignore
- **Installation Instructions**: Complete npm installation and setup documentation

#### **Build & Distribution**
- **TypeScript Compilation**: Clean TypeScript builds with proper module resolution
- **Binary Packaging**: Proper executable permissions and binary configuration
- **Dependency Management**: Optimized dependency declarations and peer dependencies
- **Version Management**: Semantic versioning with comprehensive changelog

### 📈 Metrics & Impact

- **60+ Tools**: Complete Jira REST API v3 coverage
- **Multi-Instance**: Support for unlimited Jira Cloud instances
- **Enterprise Ready**: Thread-safe concurrent operation
- **Zero Downtime**: Hot configuration reloading and graceful error recovery
- **Developer Friendly**: Comprehensive documentation and testing tools

### 🙏 Acknowledgments

This release builds upon the excellent foundation provided by [1broseidon/mcp-jira-server](https://github.com/1broseidon/mcp-jira-server). We are grateful for the original work and continue to develop and enhance this project as a maintained fork.

---

## [0.2.0] - 2025-08-04

### Added
- **Field Detection UX Enhancement**: New `detect_project_fields` tool for automatic custom field discovery
- **Cross-Server Integration**: Health check tools (`jira_health_check`, `confluence_health_check`) for monitoring server connectivity
- **Session-Aware Project Tracking**: Automatic configuration guidance on first project access per session
- **Configuration Validation**: Enhanced field validation with intelligent suggestions and ready-to-copy config snippets
- **Multi-Instance Field Detection**: Full support for custom field discovery across multiple Jira instances
- **Confluence Integration Support**: Configuration structure for cross-server Jira-Confluence workflows

### Enhanced
- **User Experience**: Eliminated manual custom field ID hunting with automated detection and guidance
- **Configuration Management**: Automatic detection of missing field configurations with targeted guidance
- **Error Handling**: Improved field validation error messages with specific troubleshooting steps
- **Documentation**: Comprehensive updates to README.md, CLAUDE.md, and configuration examples

### Technical Improvements
- **Session State Isolation**: Extended session management with per-session project access tracking
- **Config Field Checker**: New utility for checking missing field configurations and providing guidance
- **Tool Wrapper Enhancement**: Integrated automatic config guidance without breaking existing tools
- **Test Coverage**: Updated test suite with proper imports and enhanced validation

### Security
- **Repository Cleanup**: Removed temporary test files with hardcoded credentials
- **Gitignore Enhancement**: Added patterns to prevent future temporary file commits
- **Credential Protection**: Enhanced protection against accidental credential exposure

## [0.1.0] - 2025-07-31

### Added
- Complete migration to Jira REST API v3 with comprehensive tool coverage
- Multi-instance architecture supporting multiple Jira Cloud instances
- Enhanced tool descriptions optimized for AI assistance
- Comprehensive logging system with console output and request tracking
- Modern development tooling (ESLint, Prettier, Jest configuration)
- Strategic planning tools for Jira Premium features
- Enhanced error handling and user-friendly response formatting
- Sprint state transition improvements and validation

### Changed
- Migrated from Winston file logging to console logging for better visibility
- Removed ADF (Atlassian Document Format) converter dependency for simpler implementation
- Updated all 60+ tools with multi-instance wrapper architecture
- Enhanced tool-wrapper.ts with request ID tracking and performance metrics
- Modernized TypeScript configuration and build system

### Fixed
- Resolved SIGINT server crash issues through systematic debugging
- Fixed Winston logging configuration issues
- Corrected dependency management and package installation
- Improved sprint state transitions and error handling

### Security
- Comprehensive security review completed
- Proper gitignore configuration for sensitive files
- No secrets or credentials exposed in codebase

### Development
- Added ESLint and Prettier configurations
- Created Jest testing framework setup
- Enhanced build process with chmod permissions
- Added development scripts for linting, formatting, and testing