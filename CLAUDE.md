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

# Run tests
bun run test

# Run tests with file watching
bun run test:watch

# Generate test coverage report
bun run test:coverage
```

## Testing Infrastructure

This project includes comprehensive Jest testing with **69 tests** providing excellent coverage of business logic:

### Test Framework
- **Jest** with TypeScript and ES modules support
- **Comprehensive mocking** of fs/promises and MCP SDK
- **Real file I/O testing** with temporary files
- **Coverage reporting** with detailed analysis

### Test Organization
- `config.test.ts`: Configuration validation and DEFAULT_CONFIG testing
- `index.test.ts`: Core utilities, mocking patterns, and server infrastructure  
- `server-unit.test.ts`: Isolated business logic testing (25 comprehensive tests)
- `server-integration.test.ts`: File processing with real JSONL data (12 tests)

### Key Testing Patterns
- **Business logic isolation**: Tests focus on algorithms rather than MCP integration
- **Temporary file management**: Integration tests create/cleanup real files
- **Comprehensive error handling**: Invalid JSON, file errors, edge cases
- **Schema detection validation**: Heuristics for field type identification
- **Pattern analysis verification**: Grouping, correlation, timeline generation

## Model Context Protocol (MCP) Integration

This project implements an **MCP server** using the `@modelcontextprotocol/sdk` package:

### MCP SDK Components Used
- **Server**: Core MCP server framework for handling protocol communication
- **StdioServerTransport**: Communication layer using stdin/stdout 
- **Request Schemas**: TypeScript types for `ListToolsRequestSchema` and `CallToolRequestSchema`
- **Error Handling**: `McpError` and `ErrorCode` for standardized error responses

### MCP Tool Registration
The server registers 9 tools that AI assistants can invoke:
1. **Configuration tools**: `get_config`, `set_config`, `detect_schema`, `list_log_files`
2. **Analysis tools**: `parse_jsonl`, `search_logs`, `filter_logs`, `find_related_logs`, `analyze_log_patterns`

Each tool has a defined JSON schema for input validation and structured responses for AI consumption.

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

## Tool Usage Examples

When working with this MCP server, follow these common patterns:

### Initial Setup Workflow
```typescript
// 1. Check current configuration
get_config()

// 2. Set log directory  
set_config({
  config: { logDirectory: "/path/to/logs" }
})

// 3. Auto-detect schema from sample
detect_schema({
  file_path: "sample.jsonl",
  sample_size: 100
})

// 4. Apply detected or custom schema
set_config({
  config: {
    schema: {
      timestampField: "timestamp",
      levelField: "level",
      correlationFields: ["migrationId", "taskId"]
    }
  }
})
```

### Common Analysis Patterns
```typescript
// Start with overview
list_log_files({ pattern: "*.jsonl" })
analyze_log_patterns({
  file_path: "app.jsonl",
  group_by: "level",
  include_timeline: true
})

// Focus on specific issues
filter_logs({
  file_path: "app.jsonl", 
  level: "error",
  time_from: "2025-06-16T05:00:00Z"
})

// Find related context
find_related_logs({
  file_path: "app.jsonl",
  correlation_id: "session-123",
  context_window: 5
})
```

### Log Processing Best Practices
- **Always configure schema first** for optimal field mapping
- **Use semantic field names** ("level", "message") rather than raw field names
- **Start with pattern analysis** to understand log structure
- **Use correlation fields** to track related events across logs
- **Leverage time windows** when finding related logs
- **Configure display options** for readable output formatting

## Common User Prompts and Expected Workflows

When users interact with this MCP server through Claude, expect these common scenarios:

### Investigation Prompts
- *"Find all errors related to migration X"* → Use `find_related_logs()` + `filter_logs()`
- *"What happened around 3pm yesterday?"* → Use `filter_logs()` with time range
- *"Show me performance issues"* → Use `search_logs()` for "slow"/"timeout" + `analyze_log_patterns()`
- *"Check system health"* → Use `analyze_log_patterns()` by level + timeline
- *"Find failed API calls"* → Use `filter_logs()` with error level + API response analysis

### Setup Prompts  
- *"Help me set up log analysis"* → Guide through `get_config()` → `detect_schema()` → `set_config()`
- *"What log files do I have?"* → Use `list_log_files()`
- *"Analyze my log structure"* → Use `detect_schema()` + explain findings
- *"Configure for ClickUp logs"* → Apply standard ClickUp schema configuration

### Analysis Prompts
- *"Generate a report"* → Combine multiple tools for comprehensive analysis
- *"Find patterns"* → Use `analyze_log_patterns()` with different groupings
- *"Trace a user session"* → Use `find_related_logs()` with session/user ID
- *"Debug this issue"* → Systematic approach: patterns → errors → correlation → timeline

### Best Response Patterns
1. **Always start with context**: Use `get_config()` to understand current setup
2. **Suggest schema detection**: If no custom schema detected, recommend `detect_schema()`
3. **Provide actionable insights**: Don't just show data, explain what it means
4. **Use correlation effectively**: Connect related events across time and IDs
5. **Suggest next steps**: After analysis, recommend specific follow-up actions