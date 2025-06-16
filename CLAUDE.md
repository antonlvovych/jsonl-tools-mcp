# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This project uses Bun as the package manager and TypeScript for development:

```bash
# Install dependencies
bun install

# Development with watch mode
bun run dev

# Build the project
bun run build

# Start the MCP server
bun run start
```

## Architecture Overview

This is a Model Context Protocol (MCP) server that provides tools for analyzing JSONL (JSON Lines) log files. The architecture consists of two main components:

### Core Server (`src/index.ts`)
- **JsonlToolsServer Class**: Main server implementation that extends MCP SDK
- **Configuration System**: Loads/saves config from `.jsonl-tools-config.json` in working directory
- **Tool Registration**: Implements 9 MCP tools via `setupToolHandlers()`
- **Semantic Field Mapping**: Translates user-friendly field names ("level", "message") to actual log field names via configuration

### Configuration System (`src/config.ts`)
- **LogConfig Interface**: Defines schema mapping, display preferences, and defaults
- **Schema Detection**: Auto-detects field types from sample log files using heuristics
- **Field Classification**: Categorizes fields as timestamp, level, correlation, API response, or error fields

## Key Architectural Patterns

### Semantic Field Resolution
The server uses a two-layer field system:
1. **Semantic names**: User-friendly names like "level", "message", "event"
2. **Actual field names**: Configured mappings to real log field names

Tools use `getConfiguredField()` to resolve semantic fields to actual fields, enabling the same tool calls to work across different log formats.

### Configuration-Driven Behavior
Most tool behavior is driven by the `LogConfig`:
- **correlationFields**: List of fields to search when finding related logs
- **apiResponseFields**: Fields containing JSON that should be pretty-printed
- **errorFields**: Fields to analyze for error patterns
- **display settings**: Control output formatting, truncation, line numbers

### File Path Resolution
All file paths are resolved via `resolveFilePath()`:
- Absolute paths are used as-is
- Relative paths are resolved against `config.logDirectory`
- This allows users to work with just filenames once the log directory is configured

## MCP Tool Implementation

The server implements 9 MCP tools in two categories:

**Configuration Tools**: `get_config`, `set_config`, `detect_schema`, `list_log_files`
**Analysis Tools**: `parse_jsonl`, `search_logs`, `filter_logs`, `find_related_logs`, `analyze_log_patterns`

Each tool follows the pattern:
1. Extract and validate arguments with config defaults
2. Resolve file paths using `resolveFilePath()`
3. Process logs line-by-line with JSON parsing error handling
4. Format output using `formatLogForDisplay()` for consistent presentation
5. Return structured JSON response with metadata about config usage

## Configuration Workflow

1. **Initial setup**: Server loads config from `.jsonl-tools-config.json` or uses defaults
2. **Schema detection**: User runs `detect_schema` on sample logs to auto-detect field mappings
3. **Configuration update**: User runs `set_config` to apply detected schema or custom mappings
4. **Tool usage**: All other tools use the configured schema for field resolution

## Important Implementation Details

- **Error handling**: Invalid JSON lines are skipped silently, errors tracked in tool responses
- **Memory efficiency**: Large files processed line-by-line, never loaded entirely into memory
- **Type safety**: TypeScript interfaces ensure config structure and tool argument validation
- **Extensibility**: New log formats supported by updating schema configuration, no code changes needed