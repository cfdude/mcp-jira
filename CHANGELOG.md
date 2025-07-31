# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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