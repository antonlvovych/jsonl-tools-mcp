export interface LogConfig {
  // Base directory for log files
  logDirectory: string;
  
  // Schema mapping - semantic field names to actual field names
  schema: {
    timestampField: string;
    levelField: string;
    messageField: string;
    eventField?: string;
    // Fields that can be used for finding related logs
    correlationFields: string[];
    // Fields containing raw API JSON responses
    apiResponseFields: string[];
    // Fields containing error information
    errorFields: string[];
  };
  
  // Default settings for tools
  defaults: {
    searchLimit: number;
    filterLimit: number;
    parseLimit: number;
    contextWindow: number;
    timeWindowMinutes: number;
    caseSensitive: boolean;
  };
  
  // File patterns
  filePatterns: {
    // Include these file patterns
    include: string[];
    // Exclude these file patterns
    exclude: string[];
  };
  
  // Custom field mappings for specific log formats
  fieldMappings?: Record<string, string>;
  
  // Display preferences
  display: {
    prettyPrintApiResponses: boolean;
    showLineNumbers: boolean;
    maxFieldValueLength: number;
    dateFormat?: string;
  };
}

export const DEFAULT_CONFIG: LogConfig = {
  logDirectory: "./logs",
  schema: {
    timestampField: "timestamp",
    levelField: "level", 
    messageField: "message",
    eventField: "event",
    correlationFields: [
      "migrationId",
      "taskId", 
      "listId",
      "spaceId",
      "folderId",
      "userId",
      "requestId",
      "sessionId",
      "traceId",
      "correlationId"
    ],
    apiResponseFields: [
      "response",
      "data", 
      "payload",
      "result",
      "apiResponse"
    ],
    errorFields: [
      "error",
      "errorMessage",
      "stackTrace",
      "exception"
    ]
  },
  defaults: {
    searchLimit: 100,
    filterLimit: 100,
    parseLimit: 1000,
    contextWindow: 5,
    timeWindowMinutes: 10,
    caseSensitive: false
  },
  filePatterns: {
    include: ["*.jsonl", "*.log", "*.ndjson"],
    exclude: ["*.tmp", "*.bak", "*~"]
  },
  display: {
    prettyPrintApiResponses: true,
    showLineNumbers: true,
    maxFieldValueLength: 500,
    dateFormat: "ISO"
  }
};

export interface SchemaDetectionResult {
  detectedFields: {
    timestampField?: string;
    levelField?: string;
    messageField?: string;
    eventField?: string;
    correlationFields: string[];
    apiResponseFields: string[];
    errorFields: string[];
  };
  fieldAnalysis: Record<string, {
    type: string;
    examples: any[];
    frequency: number;
    isLikelyTimestamp: boolean;
    isLikelyLevel: boolean;
    isLikelyMessage: boolean;
    isLikelyEvent: boolean;
    isLikelyCorrelationId: boolean;
    isLikelyApiResponse: boolean;
    isLikelyError: boolean;
  }>;
  confidence: number;
  suggestions: string[];
}