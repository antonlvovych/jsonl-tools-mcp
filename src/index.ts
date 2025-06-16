#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { LogConfig, DEFAULT_CONFIG, SchemaDetectionResult } from './config.js';

interface LogEntry {
  [key: string]: any;
}

class JsonlToolsServer {
  private server: Server;
  private config: LogConfig;
  private configPath: string;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.configPath = path.join(process.cwd(), '.jsonl-tools-config.json');
    
    this.server = new Server(
      {
        name: 'jsonl-tools-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.loadConfig();
  }

  private async loadConfig() {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(configContent) };
    } catch (error) {
      // Config file doesn't exist or is invalid, use defaults
      console.error('Using default config, could not load config file:', error);
    }
  }

  private async saveConfig() {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new McpError(ErrorCode.InternalError, `Failed to save config: ${error}`);
    }
  }

  private resolveFilePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.config.logDirectory, filePath);
  }

  private getConfiguredField(log: LogEntry, semanticField: keyof LogConfig['schema']): any {
    const fieldName = this.config.schema[semanticField];
    if (!fieldName || Array.isArray(fieldName)) return undefined;
    return this.getNestedField(log, fieldName as string);
  }

  private findCorrelationFields(log: LogEntry, correlationId: string): string[] {
    const foundFields: string[] = [];
    for (const field of this.config.schema.correlationFields) {
      const value = this.getNestedField(log, field);
      if (value && String(value).includes(correlationId)) {
        foundFields.push(field);
      }
    }
    return foundFields;
  }

  private formatLogForDisplay(log: LogEntry, lineNumber?: number): any {
    const formatted = { ...log };
    
    // Pretty print API responses
    if (this.config.display.prettyPrintApiResponses) {
      for (const field of this.config.schema.apiResponseFields) {
        const value = this.getNestedField(formatted, field);
        if (value && typeof value === 'object') {
          this.setNestedField(formatted, field, value);
        }
      }
    }

    // Truncate long field values
    if (this.config.display.maxFieldValueLength > 0) {
      this.truncateFieldValues(formatted, this.config.display.maxFieldValueLength);
    }

    // Add line number if requested
    if (this.config.display.showLineNumbers && lineNumber) {
      formatted._line_number = lineNumber;
    }

    return formatted;
  }

  private truncateFieldValues(obj: any, maxLength: number) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.length > maxLength) {
        obj[key] = value.substring(0, maxLength) + '... [truncated]';
      } else if (typeof value === 'object' && value !== null) {
        this.truncateFieldValues(value, maxLength);
      }
    }
  }

  private setNestedField(obj: any, field: string, value: any) {
    const parts = field.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Configuration tools
          {
            name: 'get_config',
            description: 'Get current configuration settings',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'set_config',
            description: 'Update configuration settings',
            inputSchema: {
              type: 'object',
              properties: {
                config: {
                  type: 'object',
                  description: 'Configuration object to merge with current config',
                },
              },
              required: ['config'],
            },
          },
          {
            name: 'detect_schema',
            description: 'Auto-detect schema from sample log files',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to JSONL file for schema detection (relative to log directory)',
                },
                sample_size: {
                  type: 'number',
                  description: 'Number of log entries to analyze (default: 100)',
                  default: 100,
                },
              },
              required: ['file_path'],
            },
          },
          {
            name: 'list_log_files',
            description: 'List available log files in the configured directory',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: {
                  type: 'string',
                  description: 'Optional glob pattern to filter files',
                },
              },
            },
          },
          // Enhanced log tools
          {
            name: 'parse_jsonl',
            description: 'Parse and read JSONL files (uses config for defaults and formatting)',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to JSONL file (relative to log directory or absolute)',
                },
                limit: {
                  type: 'number',
                  description: `Maximum number of lines to read (default: ${DEFAULT_CONFIG.defaults.parseLimit})`,
                },
                offset: {
                  type: 'number',
                  description: 'Number of lines to skip from the beginning (default: 0)',
                  default: 0,
                },
              },
              required: ['file_path'],
            },
          },
          {
            name: 'search_logs',
            description: 'Search for specific patterns in JSONL logs (uses config for field mapping)',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to JSONL file (relative to log directory or absolute)',
                },
                search_term: {
                  type: 'string',
                  description: 'Term to search for in log messages or fields',
                },
                field: {
                  type: 'string',
                  description: 'Specific field to search in (can use semantic names like "message", "level")',
                },
                case_sensitive: {
                  type: 'boolean',
                  description: `Whether search should be case sensitive (default: ${DEFAULT_CONFIG.defaults.caseSensitive})`,
                },
                limit: {
                  type: 'number',
                  description: `Maximum number of results (default: ${DEFAULT_CONFIG.defaults.searchLimit})`,
                },
              },
              required: ['file_path', 'search_term'],
            },
          },
          {
            name: 'filter_logs',
            description: 'Filter logs by various criteria (uses config for field mapping)',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to JSONL file (relative to log directory or absolute)',
                },
                level: {
                  type: 'string',
                  description: 'Filter by log level (uses configured level field)',
                },
                event: {
                  type: 'string',
                  description: 'Filter by event type (uses configured event field)',
                },
                time_from: {
                  type: 'string',
                  description: 'Filter logs from this timestamp (ISO format)',
                },
                time_to: {
                  type: 'string',
                  description: 'Filter logs until this timestamp (ISO format)',
                },
                custom_filter: {
                  type: 'object',
                  description: 'Custom field:value filters',
                },
                limit: {
                  type: 'number',
                  description: `Maximum number of results (default: ${DEFAULT_CONFIG.defaults.filterLimit})`,
                },
              },
              required: ['file_path'],
            },
          },
          {
            name: 'find_related_logs',
            description: 'Find logs related to specific ID using configured correlation fields',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to JSONL file (relative to log directory or absolute)',
                },
                correlation_id: {
                  type: 'string',
                  description: 'ID to find related logs for (searches all configured correlation fields)',
                },
                context_window: {
                  type: 'number',
                  description: `Number of logs before and after to include (default: ${DEFAULT_CONFIG.defaults.contextWindow})`,
                },
                time_window_minutes: {
                  type: 'number',
                  description: `Time window in minutes for related logs (default: ${DEFAULT_CONFIG.defaults.timeWindowMinutes})`,
                },
              },
              required: ['file_path', 'correlation_id'],
            },
          },
          {
            name: 'analyze_log_patterns',
            description: 'Analyze patterns and statistics in JSONL logs',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to JSONL file (relative to log directory or absolute)',
                },
                group_by: {
                  type: 'string',
                  description: 'Field to group by (can use semantic names like "level", "event")',
                },
                include_timeline: {
                  type: 'boolean',
                  description: 'Include timeline analysis (default: false)',
                  default: false,
                },
                analyze_errors: {
                  type: 'boolean',
                  description: 'Include error analysis using configured error fields (default: false)',
                  default: false,
                },
              },
              required: ['file_path'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_config':
            return await this.getConfig();
          case 'set_config':
            return await this.setConfig(args as any);
          case 'detect_schema':
            return await this.detectSchema(args as any);
          case 'list_log_files':
            return await this.listLogFiles(args as any);
          case 'parse_jsonl':
            return await this.parseJsonl(args as any);
          case 'search_logs':
            return await this.searchLogs(args as any);
          case 'filter_logs':
            return await this.filterLogs(args as any);
          case 'find_related_logs':
            return await this.findRelatedLogs(args as any);
          case 'analyze_log_patterns':
            return await this.analyzeLogPatterns(args as any);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error}`
        );
      }
    });
  }

  private async getConfig() {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            config: this.config,
            config_path: this.configPath,
          }, null, 2),
        },
      ],
    };
  }

  private async setConfig(args: { config: Partial<LogConfig> }) {
    this.config = { ...this.config, ...args.config };
    await this.saveConfig();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message: 'Configuration updated successfully',
            config: this.config,
          }, null, 2),
        },
      ],
    };
  }

  private async detectSchema(args: { file_path: string; sample_size?: number }) {
    const { file_path, sample_size = 100 } = args;
    const fullPath = this.resolveFilePath(file_path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim()).slice(0, sample_size);

      const fieldAnalysis: Record<string, any> = {};
      let validLogs = 0;

      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          validLogs++;

          for (const [key, value] of Object.entries(log)) {
            if (!fieldAnalysis[key]) {
              fieldAnalysis[key] = {
                type: typeof value,
                examples: [],
                frequency: 0,
                isLikelyTimestamp: false,
                isLikelyLevel: false,
                isLikelyMessage: false,
                isLikelyEvent: false,
                isLikelyCorrelationId: false,
                isLikelyApiResponse: false,
                isLikelyError: false,
              };
            }

            fieldAnalysis[key].frequency++;
            if (fieldAnalysis[key].examples.length < 3) {
              fieldAnalysis[key].examples.push(value);
            }

            // Heuristics for field detection
            const keyLower = key.toLowerCase();
            const valueStr = String(value).toLowerCase();

            // Timestamp detection
            if ((keyLower.includes('time') || keyLower.includes('date')) && 
                (typeof value === 'string' && !isNaN(Date.parse(value)))) {
              fieldAnalysis[key].isLikelyTimestamp = true;
            }

            // Level detection
            if (keyLower === 'level' || keyLower === 'severity') {
              fieldAnalysis[key].isLikelyLevel = true;
            }

            // Message detection
            if (keyLower.includes('message') || keyLower.includes('msg')) {
              fieldAnalysis[key].isLikelyMessage = true;
            }

            // Event detection
            if (keyLower === 'event' || keyLower === 'type' || keyLower === 'action') {
              fieldAnalysis[key].isLikelyEvent = true;
            }

            // Correlation ID detection
            if (keyLower.includes('id') && typeof value === 'string' && value.length > 10) {
              fieldAnalysis[key].isLikelyCorrelationId = true;
            }

            // API response detection
            if (typeof value === 'object' && value !== null && 
                (keyLower.includes('response') || keyLower.includes('data') || keyLower.includes('result'))) {
              fieldAnalysis[key].isLikelyApiResponse = true;
            }

            // Error detection
            if (keyLower.includes('error') || keyLower.includes('exception') || keyLower.includes('stack')) {
              fieldAnalysis[key].isLikelyError = true;
            }
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }

      // Generate suggested schema
      const detectedFields: SchemaDetectionResult['detectedFields'] = {
        correlationFields: [],
        apiResponseFields: [],
        errorFields: [],
      };

      const suggestions: string[] = [];

      for (const [field, analysis] of Object.entries(fieldAnalysis)) {
        if (analysis.isLikelyTimestamp && !detectedFields.timestampField) {
          detectedFields.timestampField = field;
          suggestions.push(`Detected timestamp field: ${field}`);
        }
        if (analysis.isLikelyLevel && !detectedFields.levelField) {
          detectedFields.levelField = field;
          suggestions.push(`Detected level field: ${field}`);
        }
        if (analysis.isLikelyMessage && !detectedFields.messageField) {
          detectedFields.messageField = field;
          suggestions.push(`Detected message field: ${field}`);
        }
        if (analysis.isLikelyEvent && !detectedFields.eventField) {
          detectedFields.eventField = field;
          suggestions.push(`Detected event field: ${field}`);
        }
        if (analysis.isLikelyCorrelationId) {
          detectedFields.correlationFields.push(field);
        }
        if (analysis.isLikelyApiResponse) {
          detectedFields.apiResponseFields.push(field);
        }
        if (analysis.isLikelyError) {
          detectedFields.errorFields.push(field);
        }
      }

      const confidence = validLogs / lines.length;

      const result: SchemaDetectionResult = {
        detectedFields,
        fieldAnalysis,
        confidence,
        suggestions,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              file_path,
              sample_size: lines.length,
              valid_logs: validLogs,
              schema_detection: result,
              suggested_config_update: {
                schema: {
                  ...this.config.schema,
                  ...detectedFields,
                },
              },
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(ErrorCode.InvalidRequest, `Failed to detect schema: ${error}`);
    }
  }

  private async listLogFiles(args: { pattern?: string } = {}) {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      let filteredFiles = files;

      // Apply include patterns
      if (this.config.filePatterns.include.length > 0) {
        filteredFiles = filteredFiles.filter(file => 
          this.config.filePatterns.include.some(pattern => 
            this.matchesPattern(file, pattern)
          )
        );
      }

      // Apply exclude patterns
      filteredFiles = filteredFiles.filter(file => 
        !this.config.filePatterns.exclude.some(pattern => 
          this.matchesPattern(file, pattern)
        )
      );

      // Apply additional pattern filter
      if (args.pattern) {
        filteredFiles = filteredFiles.filter(file => 
          this.matchesPattern(file, args.pattern!)
        );
      }

      const fileDetails = await Promise.all(
        filteredFiles.map(async (file) => {
          const filePath = path.join(this.config.logDirectory, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            size: stats.size,
            modified: stats.mtime,
            path: filePath,
          };
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              log_directory: this.config.logDirectory,
              total_files: fileDetails.length,
              files: fileDetails.sort((a, b) => b.modified.getTime() - a.modified.getTime()),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(ErrorCode.InvalidRequest, `Failed to list log files: ${error}`);
    }
  }

  private matchesPattern(filename: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    return regex.test(filename);
  }

  private async parseJsonl(args: {
    file_path: string;
    limit?: number;
    offset?: number;
  }) {
    const { 
      file_path, 
      limit = this.config.defaults.parseLimit, 
      offset = 0 
    } = args;

    const fullPath = this.resolveFilePath(file_path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const startIndex = offset;
      const endIndex = Math.min(startIndex + limit, lines.length);
      const selectedLines = lines.slice(startIndex, endIndex);

      const parsedLogs: LogEntry[] = [];
      const errors: string[] = [];

      for (let i = 0; i < selectedLines.length; i++) {
        const lineNumber = startIndex + i + 1;
        try {
          const parsed = JSON.parse(selectedLines[i]);
          const formatted = this.formatLogForDisplay(parsed, lineNumber);
          parsedLogs.push(formatted);
        } catch (error) {
          errors.push(`Line ${lineNumber}: ${error}`);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              file_path: fullPath,
              total_lines: lines.length,
              parsed_count: parsedLogs.length,
              error_count: errors.length,
              range: `${startIndex + 1}-${endIndex}`,
              config_used: {
                log_directory: this.config.logDirectory,
                display_settings: this.config.display,
              },
              logs: parsedLogs,
              errors: errors.length > 0 ? errors : undefined,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(ErrorCode.InvalidRequest, `Failed to read file: ${error}`);
    }
  }

  // [Continue with enhanced versions of other methods...]
  
  private async searchLogs(args: {
    file_path: string;
    search_term: string;
    field?: string;
    case_sensitive?: boolean;
    limit?: number;
  }) {
    const { 
      file_path, 
      search_term, 
      field, 
      case_sensitive = this.config.defaults.caseSensitive, 
      limit = this.config.defaults.searchLimit 
    } = args;

    const fullPath = this.resolveFilePath(file_path);
    
    // Resolve semantic field names
    let resolvedField = field;
    if (field) {
      const semanticFields: Record<string, keyof LogConfig['schema']> = {
        'message': 'messageField',
        'level': 'levelField',
        'event': 'eventField',
        'timestamp': 'timestampField',
      };
      
      if (semanticFields[field]) {
        resolvedField = this.config.schema[semanticFields[field]] as string;
      }
    }

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      const results: Array<{ 
        line_number: number; 
        log: LogEntry; 
        matched_field?: string;
        correlation_fields?: string[];
      }> = [];
      const searchTerm = case_sensitive ? search_term : search_term.toLowerCase();

      for (let i = 0; i < lines.length && results.length < limit; i++) {
        try {
          const log = JSON.parse(lines[i]);
          let matched = false;
          let matchedField: string | undefined;

          if (resolvedField) {
            // Search in specific field
            const fieldValue = this.getNestedField(log, resolvedField);
            if (fieldValue !== undefined) {
              const valueStr = String(fieldValue);
              const checkValue = case_sensitive ? valueStr : valueStr.toLowerCase();
              if (checkValue.includes(searchTerm)) {
                matched = true;
                matchedField = resolvedField;
              }
            }
          } else {
            // Search in all fields
            const logStr = JSON.stringify(log);
            const checkStr = case_sensitive ? logStr : logStr.toLowerCase();
            if (checkStr.includes(searchTerm)) {
              matched = true;
              // Try to find which field matched
              for (const [key, value] of Object.entries(log)) {
                const valueStr = String(value);
                const checkValue = case_sensitive ? valueStr : valueStr.toLowerCase();
                if (checkValue.includes(searchTerm)) {
                  matchedField = key;
                  break;
                }
              }
            }
          }

          if (matched) {
            const formattedLog = this.formatLogForDisplay(log, i + 1);
            const correlationFields = this.findCorrelationFields(log, search_term);
            
            results.push({
              line_number: i + 1,
              log: formattedLog,
              matched_field: matchedField,
              correlation_fields: correlationFields.length > 0 ? correlationFields : undefined,
            });
          }
        } catch (error) {
          // Skip invalid JSON lines
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              file_path: fullPath,
              search_term,
              field: field,
              resolved_field: resolvedField,
              case_sensitive,
              results_count: results.length,
              config_used: {
                correlation_fields: this.config.schema.correlationFields,
                search_limit: limit,
              },
              results,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(ErrorCode.InvalidRequest, `Failed to search file: ${error}`);
    }
  }

  private async filterLogs(args: {
    file_path: string;
    level?: string;
    event?: string;
    time_from?: string;
    time_to?: string;
    custom_filter?: Record<string, any>;
    limit?: number;
  }) {
    const { 
      file_path, 
      level, 
      event, 
      time_from, 
      time_to, 
      custom_filter, 
      limit = this.config.defaults.filterLimit 
    } = args;

    const fullPath = this.resolveFilePath(file_path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      const results: Array<{ line_number: number; log: LogEntry; matched_filters: string[] }> = [];
      const fromTime = time_from ? new Date(time_from) : null;
      const toTime = time_to ? new Date(time_to) : null;

      for (let i = 0; i < lines.length && results.length < limit; i++) {
        try {
          const log = JSON.parse(lines[i]);
          let matches = true;
          const matchedFilters: string[] = [];

          // Filter by level using configured field
          if (level) {
            const logLevel = this.getConfiguredField(log, 'levelField');
            if (logLevel !== level) {
              matches = false;
            } else {
              matchedFilters.push(`level:${level}`);
            }
          }

          // Filter by event using configured field
          if (event) {
            const logEvent = this.getConfiguredField(log, 'eventField');
            if (logEvent !== event) {
              matches = false;
            } else {
              matchedFilters.push(`event:${event}`);
            }
          }

          // Filter by time range using configured timestamp field
          if ((fromTime || toTime)) {
            const logTimestamp = this.getConfiguredField(log, 'timestampField');
            if (logTimestamp) {
              const logTime = new Date(logTimestamp);
              if (fromTime && logTime < fromTime) {
                matches = false;
              }
              if (toTime && logTime > toTime) {
                matches = false;
              }
              if (matches && (fromTime || toTime)) {
                matchedFilters.push('time_range');
              }
            } else if (fromTime || toTime) {
              matches = false; // No timestamp field available
            }
          }

          // Apply custom filters
          if (custom_filter && matches) {
            for (const [filterField, filterValue] of Object.entries(custom_filter)) {
              const logValue = this.getNestedField(log, filterField);
              if (logValue !== filterValue) {
                matches = false;
                break;
              } else {
                matchedFilters.push(`${filterField}:${filterValue}`);
              }
            }
          }

          if (matches) {
            const formattedLog = this.formatLogForDisplay(log, i + 1);
            results.push({
              line_number: i + 1,
              log: formattedLog,
              matched_filters: matchedFilters,
            });
          }
        } catch (error) {
          // Skip invalid JSON lines
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              file_path: fullPath,
              filters: { level, event, time_from, time_to, custom_filter },
              results_count: results.length,
              config_used: {
                level_field: this.config.schema.levelField,
                event_field: this.config.schema.eventField,
                timestamp_field: this.config.schema.timestampField,
              },
              results,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(ErrorCode.InvalidRequest, `Failed to filter file: ${error}`);
    }
  }

  private async findRelatedLogs(args: {
    file_path: string;
    correlation_id: string;
    context_window?: number;
    time_window_minutes?: number;
  }) {
    const { 
      file_path, 
      correlation_id, 
      context_window = this.config.defaults.contextWindow, 
      time_window_minutes = this.config.defaults.timeWindowMinutes 
    } = args;

    const fullPath = this.resolveFilePath(file_path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      const relatedLogs: Array<{ 
        line_number: number; 
        log: LogEntry; 
        relation_type: string;
        correlation_fields?: string[];
      }> = [];
      const matchingIndices: number[] = [];

      // Find all logs that contain the correlation ID in configured correlation fields
      for (let i = 0; i < lines.length; i++) {
        try {
          const log = JSON.parse(lines[i]);
          const correlationFields = this.findCorrelationFields(log, correlation_id);
          
          if (correlationFields.length > 0) {
            matchingIndices.push(i);
            const formattedLog = this.formatLogForDisplay(log, i + 1);
            relatedLogs.push({
              line_number: i + 1,
              log: formattedLog,
              relation_type: 'direct_match',
              correlation_fields: correlationFields,
            });
          }
        } catch (error) {
          // Skip invalid JSON lines
        }
      }

      // Add context logs around matches
      const contextIndices = new Set<number>();
      for (const matchIndex of matchingIndices) {
        for (let i = Math.max(0, matchIndex - context_window); 
             i <= Math.min(lines.length - 1, matchIndex + context_window); 
             i++) {
          if (!matchingIndices.includes(i)) {
            contextIndices.add(i);
          }
        }
      }

      for (const index of contextIndices) {
        try {
          const log = JSON.parse(lines[index]);
          const formattedLog = this.formatLogForDisplay(log, index + 1);
          relatedLogs.push({
            line_number: index + 1,
            log: formattedLog,
            relation_type: 'context',
          });
        } catch (error) {
          // Skip invalid JSON lines
        }
      }

      // Add time-related logs if timestamps are available
      if (matchingIndices.length > 0) {
        for (const matchIndex of matchingIndices) {
          try {
            const matchLog = JSON.parse(lines[matchIndex]);
            const matchTimestamp = this.getConfiguredField(matchLog, 'timestampField');
            
            if (matchTimestamp) {
              const matchTime = new Date(matchTimestamp);
              const timeWindowMs = time_window_minutes * 60 * 1000;
              
              for (let i = 0; i < lines.length; i++) {
                if (matchingIndices.includes(i) || contextIndices.has(i)) continue;
                
                try {
                  const log = JSON.parse(lines[i]);
                  const logTimestamp = this.getConfiguredField(log, 'timestampField');
                  
                  if (logTimestamp) {
                    const logTime = new Date(logTimestamp);
                    const timeDiff = Math.abs(logTime.getTime() - matchTime.getTime());
                    
                    if (timeDiff <= timeWindowMs) {
                      const formattedLog = this.formatLogForDisplay(log, i + 1);
                      relatedLogs.push({
                        line_number: i + 1,
                        log: formattedLog,
                        relation_type: 'time_related',
                      });
                    }
                  }
                } catch (error) {
                  // Skip invalid JSON lines
                }
              }
            }
          } catch (error) {
            // Skip invalid JSON lines
          }
        }
      }

      // Sort by line number
      relatedLogs.sort((a, b) => a.line_number - b.line_number);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              file_path: fullPath,
              correlation_id,
              direct_matches: matchingIndices.length,
              total_related: relatedLogs.length,
              context_window,
              time_window_minutes,
              config_used: {
                correlation_fields: this.config.schema.correlationFields,
                timestamp_field: this.config.schema.timestampField,
              },
              related_logs: relatedLogs,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(ErrorCode.InvalidRequest, `Failed to find related logs: ${error}`);
    }
  }

  private async analyzeLogPatterns(args: {
    file_path: string;
    group_by?: string;
    include_timeline?: boolean;
    analyze_errors?: boolean;
  }) {
    const { file_path, group_by, include_timeline = false, analyze_errors = false } = args;
    const fullPath = this.resolveFilePath(file_path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      const analysis: any = {
        file_path: fullPath,
        total_logs: lines.length,
        valid_logs: 0,
        invalid_logs: 0,
        patterns: {},
        config_used: {
          timestamp_field: this.config.schema.timestampField,
          level_field: this.config.schema.levelField,
          event_field: this.config.schema.eventField,
          error_fields: this.config.schema.errorFields,
        },
      };

      const groupCounts: Record<string, number> = {};
      const timelineBuckets: Record<string, number> = {};
      const errorAnalysis: any = {
        total_errors: 0,
        error_types: {},
        error_timeline: {},
      };

      // Resolve semantic group_by field
      let resolvedGroupBy = group_by;
      if (group_by) {
        const semanticFields: Record<string, keyof LogConfig['schema']> = {
          'level': 'levelField',
          'event': 'eventField',
          'timestamp': 'timestampField',
        };
        
        if (semanticFields[group_by]) {
          resolvedGroupBy = this.config.schema[semanticFields[group_by]] as string;
        }
      }

      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          analysis.valid_logs++;

          // Group by analysis
          if (resolvedGroupBy) {
            const groupValue = this.getNestedField(log, resolvedGroupBy);
            const key = groupValue !== undefined ? String(groupValue) : 'undefined';
            groupCounts[key] = (groupCounts[key] || 0) + 1;
          }

          // Timeline analysis
          if (include_timeline) {
            const timestamp = this.getConfiguredField(log, 'timestampField');
            if (timestamp) {
              const timestampDate = new Date(timestamp);
              const bucketKey = timestampDate.toISOString().split(':')[0] + ':00'; // Hour buckets
              timelineBuckets[bucketKey] = (timelineBuckets[bucketKey] || 0) + 1;
            }
          }

          // Error analysis
          if (analyze_errors) {
            let hasError = false;
            for (const errorField of this.config.schema.errorFields) {
              const errorValue = this.getNestedField(log, errorField);
              if (errorValue) {
                hasError = true;
                errorAnalysis.total_errors++;
                
                // Categorize error types
                const errorKey = typeof errorValue === 'string' ? 
                  errorValue.split(':')[0] : // Get error type before colon
                  String(errorValue).substring(0, 50); // First 50 chars
                
                errorAnalysis.error_types[errorKey] = (errorAnalysis.error_types[errorKey] || 0) + 1;
                
                // Error timeline
                if (include_timeline) {
                  const timestamp = this.getConfiguredField(log, 'timestampField');
                  if (timestamp) {
                    const timestampDate = new Date(timestamp);
                    const bucketKey = timestampDate.toISOString().split(':')[0] + ':00';
                    errorAnalysis.error_timeline[bucketKey] = (errorAnalysis.error_timeline[bucketKey] || 0) + 1;
                  }
                }
                break; // Only count once per log
              }
            }
          }

          // Common field analysis
          for (const [key, value] of Object.entries(log)) {
            if (!analysis.patterns[key]) {
              analysis.patterns[key] = {
                count: 0,
                types: new Set(),
                sample_values: [],
                is_correlation_field: this.config.schema.correlationFields.includes(key),
                is_api_response_field: this.config.schema.apiResponseFields.includes(key),
                is_error_field: this.config.schema.errorFields.includes(key),
              };
            }
            analysis.patterns[key].count++;
            analysis.patterns[key].types.add(typeof value);
            if (analysis.patterns[key].sample_values.length < 5) {
              analysis.patterns[key].sample_values.push(value);
            }
          }
        } catch (error) {
          analysis.invalid_logs++;
        }
      }

      // Convert sets to arrays for JSON serialization
      for (const pattern of Object.values(analysis.patterns) as any[]) {
        pattern.types = Array.from(pattern.types);
      }

      if (resolvedGroupBy) {
        analysis.group_by_analysis = {
          field: group_by,
          resolved_field: resolvedGroupBy,
          groups: groupCounts,
          unique_values: Object.keys(groupCounts).length,
        };
      }

      if (include_timeline) {
        analysis.timeline = Object.entries(timelineBuckets)
          .map(([timestamp, count]) => ({ timestamp, count }))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      }

      if (analyze_errors) {
        analysis.error_analysis = {
          ...errorAnalysis,
          error_percentage: analysis.valid_logs > 0 ? 
            (errorAnalysis.total_errors / analysis.valid_logs * 100).toFixed(2) + '%' : '0%',
        };
        
        if (include_timeline) {
          analysis.error_analysis.timeline = Object.entries(errorAnalysis.error_timeline)
            .map(([timestamp, count]) => ({ timestamp, count }))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(analysis, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(ErrorCode.InvalidRequest, `Failed to analyze patterns: ${error}`);
    }
  }

  private getNestedField(obj: any, field: string): any {
    const parts = field.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('JSONL Tools MCP Server running on stdio');
  }
}

const server = new JsonlToolsServer();
server.run().catch(console.error);