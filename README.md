# JSONL Tools MCP Server

A Model Context Protocol (MCP) server that provides powerful tools for working with JSON logs (JSONL files). Perfect for parsing, searching, filtering, and analyzing structured log files with intelligent configuration and schema detection.

## Features

### 🔧 Configuration & Setup Tools
1. **get_config** - View current configuration settings
2. **set_config** - Update configuration (log directory, schema mapping, defaults)
3. **detect_schema** - Auto-detect log schema from sample files
4. **list_log_files** - List available log files with filtering

### 📊 Core Analysis Tools
1. **parse_jsonl** - Parse and read JSONL files with intelligent formatting
2. **search_logs** - Search with semantic field names and correlation detection
3. **filter_logs** - Filter by level, event, time range, and custom criteria  
4. **find_related_logs** - Find related logs using configured correlation fields
5. **analyze_log_patterns** - Advanced pattern analysis with error detection

### 🎯 Key Features
- **Semantic Field Mapping** - Use "level", "message", "event" instead of raw field names
- **Auto Schema Detection** - Automatically detect timestamp, correlation, and API response fields
- **Smart Correlation** - Find related logs across multiple ID fields
- **Configurable Display** - Control output formatting, truncation, and pretty-printing
- **Error Analysis** - Dedicated error pattern detection and analysis

## Installation

```bash
bun install
bun run build
```

## Configuration

The server uses a configuration file (`.jsonl-tools-config.json`) to map field names and set defaults:

### Initial Setup
```typescript
// 1. Set your log directory
set_config({ 
  config: { 
    logDirectory: "/path/to/your/logs" 
  } 
})

// 2. Auto-detect schema from sample log
detect_schema({ 
  file_path: "sample.jsonl", 
  sample_size: 100 
})

// 3. Update config with detected schema
set_config({ 
  config: { 
    schema: { 
      timestampField: "timestamp",
      levelField: "level", 
      correlationFields: ["migrationId", "taskId", "listId"]
    }
  }
})
```

### Configuration Options
```typescript
interface LogConfig {
  logDirectory: string;           // Base directory for log files
  schema: {
    timestampField: string;       // Field containing timestamps  
    levelField: string;           // Field containing log levels
    messageField: string;         // Field containing messages
    eventField?: string;          // Field containing event types
    correlationFields: string[];  // Fields for finding related logs
    apiResponseFields: string[];  // Fields containing API JSON
    errorFields: string[];        // Fields containing error info
  };
  defaults: {
    searchLimit: number;          // Default search result limit
    contextWindow: number;        // Context lines around matches
    timeWindowMinutes: number;    // Time window for related logs
  };
  display: {
    prettyPrintApiResponses: boolean;  // Format API JSON
    showLineNumbers: boolean;          // Add line numbers to output
    maxFieldValueLength: number;       // Truncate long values
  };
}
```

## Usage

The server runs as an MCP server and can be integrated with MCP-compatible clients.

### Tool Examples

#### Setup and Configuration
```typescript
// List available log files
list_log_files({ pattern: "*.jsonl" })

// Auto-detect schema from your logs
detect_schema({ 
  file_path: "clickup-migration.jsonl",
  sample_size: 100 
})

// Configure for ClickUp migration logs
set_config({
  config: {
    logDirectory: "./logs",
    schema: {
      timestampField: "timestamp",
      levelField: "level",
      messageField: "message", 
      eventField: "event",
      correlationFields: ["migrationId", "taskId", "listId", "spaceId"],
      apiResponseFields: ["response", "data"],
      errorFields: ["error", "errorMessage"]
    }
  }
})
```

#### Enhanced Log Analysis
```typescript
// Parse with automatic formatting (uses config defaults)
parse_jsonl({
  file_path: "migration.jsonl",  // Relative to configured log directory
  limit: 50
})

// Search using semantic field names
search_logs({
  file_path: "migration.jsonl",
  search_term: "migration-1750050885613",
  field: "message"  // Uses configured messageField
})

// Search and auto-detect correlation fields
search_logs({
  file_path: "migration.jsonl", 
  search_term: "901502943040"  // Will find in taskId, listId, etc.
})

// Filter using semantic fields
filter_logs({
  file_path: "migration.jsonl",
  level: "error",           // Uses configured levelField
  event: "api_response",    // Uses configured eventField
  time_from: "2025-06-16T05:00:00Z"
})

// Find related logs across all correlation fields
find_related_logs({
  file_path: "migration.jsonl",
  correlation_id: "migration-1750050885613"  // Searches all configured correlation fields
})

// Advanced pattern analysis with error detection
analyze_log_patterns({
  file_path: "migration.jsonl",
  group_by: "event",        // Uses semantic field name
  include_timeline: true,
  analyze_errors: true      // Analyzes configured error fields
})
```

#### Working with ClickUp Migration Logs
```typescript
// Find all logs related to a specific migration
find_related_logs({
  file_path: "migration.jsonl",
  correlation_id: "migration-1750050885613",
  context_window: 3,
  time_window_minutes: 5
})

// Analyze API response patterns
analyze_log_patterns({
  file_path: "migration.jsonl",
  group_by: "client",
  include_timeline: true
})

// Filter for ClickUp API errors
filter_logs({
  file_path: "migration.jsonl",
  level: "error",
  custom_filter: { client: "ClickUp" }
})
```

## Log Format Support

Works with any JSONL format. Common fields recognized:
- `timestamp` - For time-based filtering and analysis
- `level` - For log level filtering (info, error, debug, etc.)
- `event` - For event type filtering
- `message` - For message content search
- Any custom fields for correlation (migrationId, taskId, etc.)

## Example Log Entry
```json
{
  "event": "workspace_discovery_start",
  "level": "info",
  "message": "Starting workspace discovery phase",
  "migrationId": "migration-1750050885613",
  "timestamp": "2025-06-16T05:14:45.623Z"
}
```

## Development

```bash
# Watch mode for development
bun run dev

# Build for production
bun run build

# Start the server
bun run start
```

## License

MIT