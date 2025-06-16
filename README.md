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

# Run tests
bun run test

# Run tests with file watching
bun run test:watch

# Run tests with coverage report
bun run test:coverage
```

## Testing

This project includes a comprehensive test suite with **69 tests** covering all core functionality:

### Test Coverage
- **Configuration management**: Schema validation, field mapping, defaults
- **JSONL processing**: Parsing, search, filter, correlation detection
- **Schema detection**: Automatic field type identification using heuristics
- **Pattern analysis**: Log grouping, timeline generation, error analysis
- **File operations**: Path resolution, nested field access, error handling
- **Integration tests**: Real file I/O with temporary test data

### Test Structure
- `src/__tests__/config.test.ts` - Configuration and schema validation (11 tests)
- `src/__tests__/index.test.ts` - Core server utilities and mocking (21 tests)  
- `src/__tests__/server-unit.test.ts` - Business logic unit tests (25 tests)
- `src/__tests__/server-integration.test.ts` - File I/O integration tests (12 tests)

### Running Tests
```bash
# Run all tests
bun run test

# Watch mode for development
bun run test:watch

# Generate coverage report
bun run test:coverage
```

All tests use Jest with TypeScript and ES modules support. The test suite includes comprehensive mocking of file system operations and focuses on business logic validation.

## Usage Examples

### AI Assistant Prompts and Use Cases

Here are practical examples of how to interact with the MCP server through an AI assistant like Claude:

#### **Initial Setup and Discovery**

**Prompt**: *"I have some JSONL log files from a ClickUp migration. Can you help me set up the log analysis tool and understand what's in my logs?"*

```
AI Response using MCP tools:
1. get_config() - Check current configuration
2. list_log_files() - See what log files are available
3. detect_schema({ file_path: "migration.jsonl", sample_size: 100 }) - Auto-detect the log structure
4. set_config() - Apply the detected schema for optimal analysis
```

#### **Debugging Failed Migrations**

**Prompt**: *"Migration 'migration-1750050885613' failed. Can you find all related logs and tell me what went wrong?"*

```
AI Response:
1. find_related_logs({ correlation_id: "migration-1750050885613" }) - Find all related entries
2. filter_logs({ level: "error", custom_filter: { migrationId: "migration-1750050885613" } }) - Focus on errors
3. analyze_log_patterns({ group_by: "event" }) - See the sequence of events
4. Provide analysis of failure points and recommendations
```

#### **Performance Investigation**

**Prompt**: *"Our API calls seem slow today. Can you analyze the performance patterns and find bottlenecks?"*

```
AI Response:
1. analyze_log_patterns({ group_by: "endpoint", include_timeline: true }) - See which endpoints are active
2. filter_logs({ time_from: "2025-06-16T05:00:00Z" }) - Focus on recent logs
3. search_logs({ search_term: "timeout" }) - Look for timeout errors
4. find_related_logs() - Correlate slow requests with system events
5. Present performance summary with specific recommendations
```

#### **Error Pattern Analysis**

**Prompt**: *"We're getting intermittent 429 rate limit errors. Can you analyze when they occur and what triggers them?"*

```
AI Response:
1. search_logs({ search_term: "429", field: "message" }) - Find rate limit errors
2. analyze_log_patterns({ group_by: "response.status", include_timeline: true }) - Pattern analysis
3. find_related_logs() - See what requests preceded the rate limits
4. Generate timeline showing rate limit patterns and suggestions for rate limiting strategy
```

#### **Data Migration Audit**

**Prompt**: *"I need to audit our data migration. Show me which tasks failed, which succeeded, and any data inconsistencies."*

```
AI Response:
1. analyze_log_patterns({ group_by: "event" }) - Overview of migration events
2. filter_logs({ event: "task_migration_complete" }) - Find completed tasks
3. filter_logs({ level: "error", event: "task_migration_failed" }) - Find failed tasks
4. search_logs({ search_term: "data_inconsistency" }) - Look for data issues
5. Provide comprehensive migration report with success/failure statistics
```

#### **Security Investigation**

**Prompt**: *"I suspect there might be some suspicious activity in our logs. Can you look for authentication failures, unusual access patterns, or potential security issues?"*

```
AI Response:
1. search_logs({ search_term: "authentication failed" }) - Find auth failures
2. search_logs({ search_term: "unauthorized" }) - Look for access denials
3. filter_logs({ level: "error", time_from: "2025-06-16T00:00:00Z" }) - Recent errors
4. analyze_log_patterns({ group_by: "userId", include_timeline: true }) - User activity patterns
5. Present security summary with suspicious patterns and recommendations
```

#### **System Health Monitoring**

**Prompt**: *"Give me a health check of our system. What's the error rate, what are the most common issues, and are there any trends I should be worried about?"*

```
AI Response:
1. analyze_log_patterns({ group_by: "level", include_timeline: true }) - Error rate overview
2. analyze_log_patterns({ group_by: "event" }) - Most common events
3. filter_logs({ level: "error", time_from: "last 24 hours" }) - Recent errors
4. search_logs({ search_term: "exception" }) - Find exceptions
5. Generate system health dashboard with trends and alerts
```

#### **User Experience Analysis**

**Prompt**: *"Our users are complaining about slow responses. Can you analyze user sessions and find where the bottlenecks are?"*

```
AI Response:
1. search_logs({ search_term: "slow" }) - Find slow response mentions
2. filter_logs({ custom_filter: { "response.duration": ">5000" } }) - Find slow requests
3. find_related_logs({ correlation_id: "session-id" }) - Trace user sessions
4. analyze_log_patterns({ group_by: "endpoint" }) - See which endpoints are slow
5. Provide UX analysis with specific performance recommendations
```

#### **API Integration Debugging**

**Prompt**: *"Our integration with ClickUp API is failing intermittently. Can you help me understand what's happening and when it fails?"*

```
AI Response:
1. filter_logs({ custom_filter: { client: "ClickUp" } }) - Focus on ClickUp API calls
2. search_logs({ search_term: "ClickUp", field: "message" }) - Find ClickUp-related logs
3. analyze_log_patterns({ group_by: "response.status" }) - See response patterns
4. find_related_logs({ time_window_minutes: 5 }) - Find correlating events
5. Present API integration analysis with failure patterns and retry recommendations
```

#### **Data Quality Verification**

**Prompt**: *"I need to verify the quality of our migrated data. Can you check for missing fields, invalid formats, or data corruption issues?"*

```
AI Response:
1. search_logs({ search_term: "validation_error" }) - Find validation issues
2. search_logs({ search_term: "missing_field" }) - Look for missing data
3. filter_logs({ event: "data_validation" }) - Focus on validation events
4. analyze_log_patterns({ group_by: "validation_status" }) - See validation results
5. Generate data quality report with specific issues and fix recommendations
```

#### **Custom Business Logic Investigation**

**Prompt**: *"We have custom business rules for task assignments. Can you analyze how often these rules are triggered and if they're working correctly?"*

```
AI Response:
1. search_logs({ search_term: "business_rule", field: "event" }) - Find rule executions
2. filter_logs({ event: "task_assignment" }) - Focus on assignments
3. analyze_log_patterns({ group_by: "rule_type" }) - See which rules fire most
4. find_related_logs({ correlation_id: "task-id" }) - Trace rule execution chains
5. Present business rule analysis with effectiveness metrics
```

### Quick Start Prompts

For new users, here are simple prompts to get started:

**"Set up log analysis for my project"** → Guides through configuration setup
**"What's in my log files?"** → Discovers and analyzes log structure
**"Find all errors from today"** → Quick error analysis
**"Show me the most common events"** → Pattern overview
**"Find logs related to [specific ID]"** → Correlation analysis
**"What happened between 2pm and 3pm?"** → Time-based investigation
**"Check system health"** → Overall health dashboard
**"Find slow requests"** → Performance analysis
**"Show me failed migrations"** → Failure investigation

### Basic Setup and Configuration

```typescript
// 1. Start with configuration
get_config()
// Returns current configuration settings

// 2. Set your log directory
set_config({
  config: {
    logDirectory: "/path/to/your/logs"
  }
})

// 3. Auto-detect schema from your logs
detect_schema({
  file_path: "migration.jsonl",
  sample_size: 100
})
// Analyzes 100 log entries and suggests field mappings

// 4. Apply detected schema
set_config({
  config: {
    schema: {
      timestampField: "timestamp",
      levelField: "level", 
      messageField: "message",
      correlationFields: ["migrationId", "taskId", "listId"],
      apiResponseFields: ["response", "data"],
      errorFields: ["error", "errorMessage"]
    }
  }
})
```

### Working with Log Files

```typescript
// List available log files
list_log_files({ pattern: "*.jsonl" })
// Returns: ["migration.jsonl", "api-calls.jsonl", "errors.jsonl"]

// Parse and read logs with formatting
parse_jsonl({
  file_path: "migration.jsonl",
  limit: 50,
  offset: 0
})
// Returns structured logs with line numbers and formatting
```

### Searching and Filtering

```typescript
// Search for specific terms
search_logs({
  file_path: "migration.jsonl",
  search_term: "migration-1750050885613",
  field: "message",
  case_sensitive: false,
  limit: 20
})

// Search across all fields for correlation IDs
search_logs({
  file_path: "migration.jsonl", 
  search_term: "901502943040"  // Will find in taskId, listId, etc.
})

// Filter by log level
filter_logs({
  file_path: "migration.jsonl",
  level: "error",
  limit: 100
})

// Filter by time range
filter_logs({
  file_path: "migration.jsonl",
  time_from: "2025-06-16T05:00:00Z",
  time_to: "2025-06-16T06:00:00Z",
  event: "api_response"
})

// Custom filtering
filter_logs({
  file_path: "migration.jsonl",
  custom_filter: { 
    client: "ClickUp",
    status: "success" 
  }
})
```

### Finding Related Logs

```typescript
// Find all logs related to a migration
find_related_logs({
  file_path: "migration.jsonl",
  correlation_id: "migration-1750050885613",
  context_window: 5,      // Include 5 logs before/after each match
  time_window_minutes: 10 // Include logs within 10 minutes
})

// Find logs related to a specific task
find_related_logs({
  file_path: "migration.jsonl",
  correlation_id: "task-456789",
  context_window: 3
})
```

### Pattern Analysis

```typescript
// Analyze patterns by event type
analyze_log_patterns({
  file_path: "migration.jsonl",
  group_by: "event",
  include_timeline: true
})
// Returns: { "api_request": 150, "api_response": 148, "error": 12 }

// Analyze by log level with timeline
analyze_log_patterns({
  file_path: "migration.jsonl", 
  group_by: "level",
  include_timeline: true,
  analyze_errors: true
})

// Analyze API client patterns
analyze_log_patterns({
  file_path: "api-calls.jsonl",
  group_by: "client",
  include_timeline: false
})
```

### Real-World ClickUp Migration Example

```typescript
// 1. Setup for ClickUp migration logs
set_config({
  config: {
    logDirectory: "./clickup-migration-logs",
    schema: {
      timestampField: "timestamp",
      levelField: "level",
      messageField: "message",
      eventField: "event", 
      correlationFields: [
        "migrationId", "taskId", "listId", "spaceId", 
        "folderId", "userId", "workspaceId"
      ],
      apiResponseFields: ["response", "data", "result"],
      errorFields: ["error", "errorMessage", "stackTrace"]
    },
    display: {
      prettyPrintApiResponses: true,
      showLineNumbers: true,
      maxFieldValueLength: 500
    }
  }
})

// 2. Find all logs for a failed migration
find_related_logs({
  file_path: "migration-errors.jsonl",
  correlation_id: "migration-1750050885613"
})

// 3. Analyze what went wrong
filter_logs({
  file_path: "migration-errors.jsonl",
  level: "error",
  custom_filter: { migrationId: "migration-1750050885613" }
})

// 4. Check API response patterns for rate limiting
analyze_log_patterns({
  file_path: "api-responses.jsonl",
  group_by: "response.status",
  analyze_errors: true
})

// 5. Find timeline of events for a specific task
search_logs({
  file_path: "task-processing.jsonl",
  search_term: "task-901502943040"
})
```

### Debugging Workflow Example

```typescript
// 1. Start with high-level analysis
analyze_log_patterns({
  file_path: "application.jsonl",
  group_by: "level",
  include_timeline: true
})

// 2. Focus on errors
filter_logs({
  file_path: "application.jsonl", 
  level: "error",
  time_from: "2025-06-16T05:00:00Z"
})

// 3. Find related logs for specific error
find_related_logs({
  file_path: "application.jsonl",
  correlation_id: "session-abc123",
  context_window: 10
})

// 4. Search for similar error patterns
search_logs({
  file_path: "application.jsonl",
  search_term: "database connection failed",
  field: "message"
})
```

### Performance Analysis Example

```typescript
// 1. Analyze API response times by endpoint
analyze_log_patterns({
  file_path: "api-performance.jsonl",
  group_by: "endpoint",
  include_timeline: true
})

// 2. Find slow requests
filter_logs({
  file_path: "api-performance.jsonl",
  custom_filter: { 
    "response.duration": { "$gt": 5000 }  // >5 seconds
  }
})

// 3. Correlate slow requests with system events
find_related_logs({
  file_path: "system-events.jsonl", 
  correlation_id: "request-xyz789",
  time_window_minutes: 5
})
```

## License

MIT