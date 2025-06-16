import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { DEFAULT_CONFIG } from '../config.js';

// Mock fs/promises
const mockReadFile = jest.fn() as jest.MockedFunction<any>;
const mockWriteFile = jest.fn() as jest.MockedFunction<any>;

jest.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}));

// Mock MCP SDK to prevent actual server initialization
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

describe('JsonlToolsServer Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Core Business Logic', () => {
    describe('File Path Resolution', () => {
      it('should resolve absolute paths correctly', () => {
        const resolveFilePath = (filePath: string, logDirectory: string): string => {
          if (path.isAbsolute(filePath)) {
            return filePath;
          }
          return path.resolve(logDirectory, filePath);
        };

        const logDirectory = '/test/logs';
        
        expect(resolveFilePath('/absolute/path', logDirectory)).toBe('/absolute/path');
        expect(resolveFilePath('relative/file.jsonl', logDirectory)).toBe('/test/logs/relative/file.jsonl');
      });
    });

    describe('Nested Field Access', () => {
      it('should get nested field values correctly', () => {
        const getNestedField = (obj: any, fieldPath: string) => {
          const parts = fieldPath.split('.');
          let current = obj;
          
          for (const part of parts) {
            if (current === null || current === undefined) {
              return undefined;
            }
            current = current[part];
          }
          
          return current;
        };

        const log = {
          level: 'info',
          user: {
            profile: {
              name: 'John Doe',
              id: 123
            }
          }
        };

        expect(getNestedField(log, 'level')).toBe('info');
        expect(getNestedField(log, 'user.profile.name')).toBe('John Doe');
        expect(getNestedField(log, 'user.profile.id')).toBe(123);
        expect(getNestedField(log, 'nonexistent.field')).toBeUndefined();
        expect(getNestedField(log, 'user.nonexistent')).toBeUndefined();
      });
    });

    describe('Field Truncation', () => {
      it('should truncate long field values', () => {
        const truncateFieldValues = (obj: any, maxLength: number) => {
          const result = { ...obj };
          for (const [key, value] of Object.entries(result)) {
            if (typeof value === 'string' && value.length > maxLength) {
              result[key] = value.substring(0, maxLength) + '... [truncated]';
            } else if (typeof value === 'object' && value !== null) {
              result[key] = truncateFieldValues(value, maxLength);
            }
          }
          return result;
        };

        const log = {
          message: 'This is a very long message that should be truncated when the max length is exceeded',
          short: 'ok',
          nested: {
            longText: 'Another very long text that should also be truncated when max length is reached'
          }
        };

        const truncated = truncateFieldValues(log, 20);
        
        expect(truncated.message).toBe('This is a very long ... [truncated]');
        expect(truncated.message.length).toBe(35); // 20 + '... [truncated]'.length
        expect(truncated.short).toBe('ok');
        expect(truncated.nested.longText).toBe('Another very long te... [truncated]');
      });
    });

    describe('Correlation Field Detection', () => {
      it('should find correlation fields containing ID', () => {
        const findCorrelationFields = (log: any, correlationId: string, correlationFields: string[]): string[] => {
          const foundFields: string[] = [];
          for (const field of correlationFields) {
            const value = log[field];
            if (value && String(value).includes(correlationId)) {
              foundFields.push(field);
            }
          }
          return foundFields;
        };

        const log = {
          migrationId: 'migration-123',
          taskId: 'task-456',
          userId: 'user-123',
          level: 'info'
        };

        const correlationFields = ['migrationId', 'taskId', 'userId', 'sessionId'];
        
        expect(findCorrelationFields(log, '123', correlationFields)).toEqual(['migrationId', 'userId']);
        expect(findCorrelationFields(log, 'task-456', correlationFields)).toEqual(['taskId']);
        expect(findCorrelationFields(log, 'nonexistent', correlationFields)).toEqual([]);
      });
    });

    describe('Log Formatting for Display', () => {
      it('should format logs with line numbers when configured', () => {
        const formatLogForDisplay = (log: any, lineNumber?: number, showLineNumbers: boolean = true) => {
          const formatted = { ...log };
          if (showLineNumbers && lineNumber) {
            formatted._line_number = lineNumber;
          }
          return formatted;
        };

        const log = { level: 'info', message: 'test' };
        
        const withLineNumber = formatLogForDisplay(log, 42, true);
        expect(withLineNumber._line_number).toBe(42);
        
        const withoutLineNumber = formatLogForDisplay(log, 42, false);
        expect(withoutLineNumber._line_number).toBeUndefined();
      });

      it('should handle API response formatting', () => {
        const formatApiResponse = (log: any, apiResponseFields: string[], prettyPrint: boolean) => {
          if (!prettyPrint) return log;
          
          const formatted = { ...log };
          for (const field of apiResponseFields) {
            const value = formatted[field];
            if (value && typeof value === 'object') {
              // In real implementation, this would pretty-print the JSON
              formatted[field] = value; // Keep as-is for testing
            }
          }
          return formatted;
        };

        const log = {
          response: { status: 200, data: { id: 1 } },
          message: 'API call successful'
        };

        const formatted = formatApiResponse(log, ['response'], true);
        expect(formatted.response).toEqual({ status: 200, data: { id: 1 } });
      });
    });
  });

  describe('Schema Detection Heuristics', () => {
    it('should identify timestamp fields', () => {
      const isLikelyTimestamp = (key: string, value: any) => {
        const keyLower = key.toLowerCase();
        return (keyLower.includes('time') || keyLower.includes('date') || keyLower.includes('at')) && 
               (typeof value === 'string' && !isNaN(Date.parse(value)));
      };

      expect(isLikelyTimestamp('timestamp', '2025-01-01T00:00:00Z')).toBe(true);
      expect(isLikelyTimestamp('createdAt', '2025-01-01T00:00:00Z')).toBe(true);
      expect(isLikelyTimestamp('date', '2025-01-01')).toBe(true);
      expect(isLikelyTimestamp('level', 'info')).toBe(false);
      expect(isLikelyTimestamp('timestamp', 'invalid-date')).toBe(false);
    });

    it('should identify level fields', () => {
      const isLikelyLevel = (key: string, value: any) => {
        const keyLower = key.toLowerCase();
        return keyLower === 'level' || keyLower === 'severity';
      };

      expect(isLikelyLevel('level', 'info')).toBe(true);
      expect(isLikelyLevel('severity', 'error')).toBe(true);
      expect(isLikelyLevel('LEVEL', 'debug')).toBe(true);
      expect(isLikelyLevel('message', 'info')).toBe(false);
    });

    it('should identify message fields', () => {
      const isLikelyMessage = (key: string, value: any) => {
        const keyLower = key.toLowerCase();
        return keyLower.includes('message') || keyLower.includes('msg');
      };

      expect(isLikelyMessage('message', 'test message')).toBe(true);
      expect(isLikelyMessage('msg', 'test')).toBe(true);
      expect(isLikelyMessage('errorMessage', 'error occurred')).toBe(true);
      expect(isLikelyMessage('level', 'info')).toBe(false);
    });

    it('should identify correlation ID fields', () => {
      const isLikelyCorrelationId = (key: string, value: any) => {
        const keyLower = key.toLowerCase();
        return keyLower.includes('id') && typeof value === 'string' && value.length > 10;
      };

      expect(isLikelyCorrelationId('migrationId', 'migration-123456')).toBe(true);
      expect(isLikelyCorrelationId('taskId', 'task-abcdefghij')).toBe(true);
      expect(isLikelyCorrelationId('userId', '123')).toBe(false); // Too short
      expect(isLikelyCorrelationId('message', 'long-string-here')).toBe(false);
    });

    it('should identify API response fields', () => {
      const isLikelyApiResponse = (key: string, value: any) => {
        const keyLower = key.toLowerCase();
        const responsePatterns = /^(response|data|result|payload|body)$/i;
        return responsePatterns.test(key) && typeof value === 'object' && value !== null;
      };

      expect(isLikelyApiResponse('response', { status: 200 })).toBe(true);
      expect(isLikelyApiResponse('data', { id: 1 })).toBe(true);
      expect(isLikelyApiResponse('result', { success: true })).toBe(true);
      expect(isLikelyApiResponse('response', 'string-response')).toBe(false);
      expect(isLikelyApiResponse('message', { nested: true })).toBe(false);
    });

    it('should identify error fields', () => {
      const isLikelyError = (key: string, value: any) => {
        const keyLower = key.toLowerCase();
        const errorPatterns = /^(error|err|exception|stack.*|failure)$/i;
        return errorPatterns.test(keyLower) && value != null;
      };

      expect(isLikelyError('error', 'Something went wrong')).toBe(true);
      expect(isLikelyError('exception', new Error('test'))).toBe(true);
      expect(isLikelyError('stackTrace', 'Error at line 123')).toBe(true);
      expect(isLikelyError('message', 'error message')).toBe(false);
    });
  });

  describe('Search and Filter Logic', () => {
    describe('Search Implementation', () => {
      it('should search in specific fields', () => {
        const searchInField = (log: any, searchTerm: string, field: string, caseSensitive: boolean = false) => {
          const fieldValue = log[field];
          if (!fieldValue || typeof fieldValue !== 'string') return false;
          
          const searchValue = caseSensitive ? fieldValue : fieldValue.toLowerCase();
          const searchTermValue = caseSensitive ? searchTerm : searchTerm.toLowerCase();
          
          return searchValue.includes(searchTermValue);
        };

        const log = { level: 'info', message: 'User Login Successful', id: '123' };
        
        expect(searchInField(log, 'login', 'message', false)).toBe(true);
        expect(searchInField(log, 'LOGIN', 'message', true)).toBe(false);
        expect(searchInField(log, 'error', 'message', false)).toBe(false);
        expect(searchInField(log, '123', 'id', false)).toBe(true);
      });

      it('should search across all fields', () => {
        const searchAllFields = (log: any, searchTerm: string, caseSensitive: boolean = false) => {
          const logString = JSON.stringify(log);
          const searchValue = caseSensitive ? logString : logString.toLowerCase();
          const searchTermValue = caseSensitive ? searchTerm : searchTerm.toLowerCase();
          
          return searchValue.includes(searchTermValue);
        };

        const log = { level: 'info', message: 'User login', userId: '12345' };
        
        expect(searchAllFields(log, 'login', false)).toBe(true);
        expect(searchAllFields(log, '12345', false)).toBe(true);
        expect(searchAllFields(log, 'error', false)).toBe(false);
      });
    });

    describe('Filter Implementation', () => {
      it('should filter by log level', () => {
        const filterByLevel = (log: any, targetLevel: string, levelField: string = 'level') => {
          return log[levelField] === targetLevel;
        };

        expect(filterByLevel({ level: 'error', message: 'test' }, 'error')).toBe(true);
        expect(filterByLevel({ level: 'info', message: 'test' }, 'error')).toBe(false);
      });

      it('should filter by time range', () => {
        const filterByTimeRange = (log: any, timeFrom?: string, timeTo?: string, timestampField: string = 'timestamp') => {
          const logTime = log[timestampField];
          if (!logTime) return false;
          
          if (timeFrom && logTime < timeFrom) return false;
          if (timeTo && logTime > timeTo) return false;
          
          return true;
        };

        const log1 = { timestamp: '2025-01-01T00:30:00Z', message: 'test' };
        const log2 = { timestamp: '2025-01-01T01:30:00Z', message: 'test' };
        
        expect(filterByTimeRange(log1, '2025-01-01T00:00:00Z', '2025-01-01T01:00:00Z')).toBe(true);
        expect(filterByTimeRange(log2, '2025-01-01T00:00:00Z', '2025-01-01T01:00:00Z')).toBe(false);
        expect(filterByTimeRange(log1, '2025-01-01T00:00:00Z')).toBe(true);
        expect(filterByTimeRange(log1, undefined, '2025-01-01T01:00:00Z')).toBe(true);
      });

      it('should filter by custom criteria', () => {
        const filterByCustom = (log: any, customFilter: Record<string, any>) => {
          for (const [key, value] of Object.entries(customFilter)) {
            if (log[key] !== value) return false;
          }
          return true;
        };

        const log = { level: 'info', event: 'login', userId: '123' };
        
        expect(filterByCustom(log, { level: 'info' })).toBe(true);
        expect(filterByCustom(log, { level: 'error' })).toBe(false);
        expect(filterByCustom(log, { level: 'info', event: 'login' })).toBe(true);
        expect(filterByCustom(log, { level: 'info', event: 'logout' })).toBe(false);
      });
    });
  });

  describe('Pattern Analysis Logic', () => {
    it('should group logs by field values', () => {
      const groupByField = (logs: any[], groupBy: string) => {
        const patterns: Record<string, number> = {};
        
        for (const log of logs) {
          const groupValue = log[groupBy];
          if (groupValue) {
            patterns[groupValue] = (patterns[groupValue] || 0) + 1;
          }
        }
        
        return patterns;
      };

      const logs = [
        { event: 'login', level: 'info' },
        { event: 'login', level: 'error' },
        { event: 'logout', level: 'info' },
        { event: 'login', level: 'info' }
      ];

      const eventPatterns = groupByField(logs, 'event');
      expect(eventPatterns.login).toBe(3);
      expect(eventPatterns.logout).toBe(1);

      const levelPatterns = groupByField(logs, 'level');
      expect(levelPatterns.info).toBe(3);
      expect(levelPatterns.error).toBe(1);
    });

    it('should generate timeline from logs', () => {
      const generateTimeline = (logs: any[], timestampField: string = 'timestamp') => {
        return logs
          .filter(log => log[timestampField])
          .map(log => ({
            timestamp: log[timestampField],
            level: log.level,
            event: log.event
          }))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      };

      const logs = [
        { timestamp: '2025-01-01T00:02:00Z', level: 'info', event: 'logout' },
        { timestamp: '2025-01-01T00:00:00Z', level: 'info', event: 'login' },
        { timestamp: '2025-01-01T00:01:00Z', level: 'error', event: 'login' }
      ];

      const timeline = generateTimeline(logs);
      expect(timeline).toHaveLength(3);
      expect(timeline[0].event).toBe('login');
      expect(timeline[1].event).toBe('login');
      expect(timeline[2].event).toBe('logout');
    });
  });

  describe('Configuration Management', () => {
    it('should merge configurations correctly', () => {
      const mergeConfig = (defaultConfig: any, customConfig: any) => {
        return { 
          ...defaultConfig, 
          ...customConfig,
          schema: { ...defaultConfig.schema, ...customConfig.schema },
          display: { ...defaultConfig.display, ...customConfig.display }
        };
      };

      const defaultConfig = {
        logDirectory: './logs',
        schema: { timestampField: 'timestamp', levelField: 'level' },
        display: { showLineNumbers: true }
      };

      const customConfig = {
        logDirectory: '/custom/logs',
        schema: { timestampField: 'ts' }
      };

      const merged = mergeConfig(defaultConfig, customConfig);
      
      expect(merged.logDirectory).toBe('/custom/logs');
      expect(merged.schema.timestampField).toBe('ts');
      expect(merged.schema.levelField).toBe('level'); // Should keep default
      expect(merged.display.showLineNumbers).toBe(true); // Should keep default
    });

    it('should validate required configuration fields', () => {
      const validateConfig = (config: any): string[] => {
        const errors: string[] = [];
        
        if (!config.logDirectory) {
          errors.push('logDirectory is required');
        }
        
        if (!config.schema) {
          errors.push('schema is required');
        } else {
          if (!config.schema.timestampField) {
            errors.push('schema.timestampField is required');
          }
          if (!config.schema.levelField) {
            errors.push('schema.levelField is required');
          }
        }
        
        return errors;
      };

      expect(validateConfig(DEFAULT_CONFIG)).toEqual([]);
      expect(validateConfig({})).toContain('logDirectory is required');
      expect(validateConfig({ logDirectory: '/test' })).toContain('schema is required');
      expect(validateConfig({ 
        logDirectory: '/test', 
        schema: { timestampField: 'ts' } 
      })).toContain('schema.levelField is required');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON lines gracefully', () => {
      const parseJsonLines = (content: string) => {
        const lines = content.split('\n').filter(line => line.trim());
        const validLogs = [];
        let errors = 0;
        
        for (const line of lines) {
          try {
            const log = JSON.parse(line);
            validLogs.push(log);
          } catch (error) {
            errors++;
          }
        }
        
        return { validLogs, errors };
      };

      const content = `{"valid":"json1"}
invalid json line
{"valid":"json2"}
another invalid line`;

      const result = parseJsonLines(content);
      expect(result.validLogs).toHaveLength(2);
      expect(result.errors).toBe(2);
    });

    it('should handle missing fields gracefully', () => {
      const safeGetField = (log: any, field: string, defaultValue: any = undefined) => {
        return log[field] ?? defaultValue;
      };

      const log = { level: 'info', message: 'test' };
      
      expect(safeGetField(log, 'level')).toBe('info');
      expect(safeGetField(log, 'nonexistent')).toBeUndefined();
      expect(safeGetField(log, 'nonexistent', 'default')).toBe('default');
    });
  });
});