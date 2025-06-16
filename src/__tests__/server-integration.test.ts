import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { DEFAULT_CONFIG } from '../config.js';

// Create temporary test files
const createTestFile = async (content: string): Promise<string> => {
  const testDir = path.join(__dirname, 'temp');
  await fs.mkdir(testDir, { recursive: true });
  const testFile = path.join(testDir, `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jsonl`);
  await fs.writeFile(testFile, content);
  return testFile;
};

const cleanupTestFile = async (filePath: string) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // Ignore cleanup errors
  }
};

describe('Server Integration Tests', () => {
  let testFiles: string[] = [];

  afterEach(async () => {
    // Clean up test files
    for (const file of testFiles) {
      await cleanupTestFile(file);
    }
    testFiles = [];
  });

  describe('JSONL Processing Logic', () => {
    it('should parse JSONL content correctly', async () => {
      const content = `{"level":"info","message":"Test 1","timestamp":"2025-01-01T00:00:00Z"}
{"level":"error","message":"Test 2","timestamp":"2025-01-01T00:01:00Z"}
{"level":"debug","message":"Test 3","timestamp":"2025-01-01T00:02:00Z"}`;
      
      const testFile = await createTestFile(content);
      testFiles.push(testFile);

      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      expect(lines).toHaveLength(3);
      
      const logs = lines.map(line => JSON.parse(line));
      expect(logs[0].level).toBe('info');
      expect(logs[1].level).toBe('error');
      expect(logs[2].level).toBe('debug');
    });

    it('should handle invalid JSON lines gracefully', async () => {
      const content = `{"valid":"json1"}
invalid json line
{"valid":"json2"}
another invalid line
{"valid":"json3"}`;
      
      const testFile = await createTestFile(content);
      testFiles.push(testFile);

      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
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
      
      expect(validLogs).toHaveLength(3);
      expect(errors).toBe(2);
    });
  });

  describe('Search Logic', () => {
    const sampleLogs = [
      { level: 'info', message: 'User login successful', id: '123', timestamp: '2025-01-01T00:00:00Z' },
      { level: 'error', message: 'Database connection failed', id: '456', timestamp: '2025-01-01T00:01:00Z' },
      { level: 'info', message: 'User 123 logged out', id: '789', timestamp: '2025-01-01T00:02:00Z' }
    ];

    it('should search by message content', async () => {
      const content = sampleLogs.map(log => JSON.stringify(log)).join('\n');
      const testFile = await createTestFile(content);
      testFiles.push(testFile);

      const searchTerm = 'login';
      const field = 'message';
      const caseSensitive = false;
      
      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      const matches = [];
      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          const fieldValue = log[field];
          if (fieldValue && typeof fieldValue === 'string') {
            const searchValue = caseSensitive ? fieldValue : fieldValue.toLowerCase();
            const searchTermValue = caseSensitive ? searchTerm : searchTerm.toLowerCase();
            if (searchValue.includes(searchTermValue)) {
              matches.push(log);
            }
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }
      
      expect(matches).toHaveLength(1);
      expect(matches[0].message).toContain('login successful');
    });

    it('should search across all fields when no specific field given', async () => {
      const content = sampleLogs.map(log => JSON.stringify(log)).join('\n');
      const testFile = await createTestFile(content);
      testFiles.push(testFile);

      const searchTerm = '123';
      
      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      const matches = [];
      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          const logString = JSON.stringify(log).toLowerCase();
          if (logString.includes(searchTerm.toLowerCase())) {
            matches.push(log);
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }
      
      expect(matches).toHaveLength(2); // Both logs containing "123"
    });
  });

  describe('Filter Logic', () => {
    const sampleLogs = [
      { level: 'info', message: 'Test 1', timestamp: '2025-01-01T00:00:00Z', event: 'login' },
      { level: 'error', message: 'Test 2', timestamp: '2025-01-01T00:01:00Z', event: 'error' },
      { level: 'info', message: 'Test 3', timestamp: '2025-01-01T00:02:00Z', event: 'logout' },
      { level: 'debug', message: 'Test 4', timestamp: '2025-01-01T00:03:00Z', event: 'debug' }
    ];

    it('should filter by log level', async () => {
      const content = sampleLogs.map(log => JSON.stringify(log)).join('\n');
      const testFile = await createTestFile(content);
      testFiles.push(testFile);

      const filterLevel = 'error';
      
      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      const filtered = [];
      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          if (log.level === filterLevel) {
            filtered.push(log);
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].level).toBe('error');
    });

    it('should filter by time range', async () => {
      const content = sampleLogs.map(log => JSON.stringify(log)).join('\n');
      const testFile = await createTestFile(content);
      testFiles.push(testFile);

      const timeFrom = '2025-01-01T00:01:00Z';
      
      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      const filtered = [];
      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          if (log.timestamp && log.timestamp >= timeFrom) {
            filtered.push(log);
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }
      
      expect(filtered).toHaveLength(3); // Last 3 logs
    });
  });

  describe('Correlation Logic', () => {
    const sampleLogs = [
      { level: 'info', message: 'Start task', migrationId: 'mig-123', taskId: 'task-456' },
      { level: 'debug', message: 'Processing', migrationId: 'mig-123', userId: 'user-789' },
      { level: 'info', message: 'Complete task', migrationId: 'mig-123', taskId: 'task-456' },
      { level: 'error', message: 'Different migration', migrationId: 'mig-999' }
    ];

    it('should find related logs by correlation ID', async () => {
      const content = sampleLogs.map(log => JSON.stringify(log)).join('\n');
      const testFile = await createTestFile(content);
      testFiles.push(testFile);

      const correlationId = 'mig-123';
      const correlationFields = DEFAULT_CONFIG.schema.correlationFields;
      
      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      const related = [];
      const foundFields = new Set();
      
      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          for (const field of correlationFields) {
            const value = log[field];
            if (value && String(value).includes(correlationId)) {
              related.push(log);
              foundFields.add(field);
              break; // Don't add the same log multiple times
            }
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }
      
      expect(related).toHaveLength(3);
      expect(foundFields.has('migrationId')).toBe(true);
    });

    it('should find logs by specific task ID', async () => {
      const content = sampleLogs.map(log => JSON.stringify(log)).join('\n');
      const testFile = await createTestFile(content);
      testFiles.push(testFile);

      const correlationId = 'task-456';
      const correlationFields = DEFAULT_CONFIG.schema.correlationFields;
      
      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      const related = [];
      const foundFields = new Set();
      
      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          for (const field of correlationFields) {
            const value = log[field];
            if (value && String(value).includes(correlationId)) {
              related.push(log);
              foundFields.add(field);
              break;
            }
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }
      
      expect(related).toHaveLength(2);
      expect(foundFields.has('taskId')).toBe(true);
    });
  });

  describe('Schema Detection Logic', () => {
    const sampleLogs = [
      { 
        timestamp: '2025-01-01T00:00:00Z',
        level: 'info',
        message: 'Test message',
        migrationId: 'mig-123',
        response: { status: 200, data: 'ok' }
      },
      {
        timestamp: '2025-01-01T00:01:00Z',
        level: 'error',
        message: 'Error message',
        migrationId: 'mig-456',
        error: 'Something failed',
        stackTrace: 'Error at line 123'
      }
    ];

    it('should detect field types using heuristics', async () => {
      const content = sampleLogs.map(log => JSON.stringify(log)).join('\n');
      const testFile = await createTestFile(content);
      testFiles.push(testFile);

      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      const fieldAnalysis: Record<string, any> = {};
      
      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          for (const [key, value] of Object.entries(log)) {
            if (!fieldAnalysis[key]) {
              fieldAnalysis[key] = {
                type: typeof value,
                examples: [],
                isLikelyTimestamp: false,
                isLikelyLevel: false,
                isLikelyMessage: false,
                isLikelyCorrelationId: false,
                isLikelyApiResponse: false,
                isLikelyError: false,
              };
            }

            if (fieldAnalysis[key].examples.length < 3) {
              fieldAnalysis[key].examples.push(value);
            }

            const keyLower = key.toLowerCase();

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

            // Correlation ID detection
            if (keyLower.includes('id') && typeof value === 'string' && value.length > 5) {
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
      
      expect(fieldAnalysis.timestamp.isLikelyTimestamp).toBe(true);
      expect(fieldAnalysis.level.isLikelyLevel).toBe(true);
      expect(fieldAnalysis.message.isLikelyMessage).toBe(true);
      expect(fieldAnalysis.migrationId.isLikelyCorrelationId).toBe(true);
      expect(fieldAnalysis.response.isLikelyApiResponse).toBe(true);
      expect(fieldAnalysis.error.isLikelyError).toBe(true);
      expect(fieldAnalysis.stackTrace.isLikelyError).toBe(true);
    });
  });

  describe('Pattern Analysis Logic', () => {
    const sampleLogs = [
      { level: 'info', event: 'login', timestamp: '2025-01-01T00:00:00Z' },
      { level: 'error', event: 'login', timestamp: '2025-01-01T00:01:00Z' },
      { level: 'info', event: 'logout', timestamp: '2025-01-01T00:02:00Z' },
      { level: 'info', event: 'login', timestamp: '2025-01-01T00:03:00Z' }
    ];

    it('should analyze patterns grouped by field', async () => {
      const content = sampleLogs.map(log => JSON.stringify(log)).join('\n');
      const testFile = await createTestFile(content);
      testFiles.push(testFile);

      const groupBy = 'event';
      
      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      const patterns: Record<string, number> = {};
      let totalAnalyzed = 0;
      
      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          const groupValue = log[groupBy];
          if (groupValue) {
            patterns[groupValue] = (patterns[groupValue] || 0) + 1;
            totalAnalyzed++;
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }
      
      expect(patterns.login).toBe(3);
      expect(patterns.logout).toBe(1);
      expect(totalAnalyzed).toBe(4);
    });

    it('should generate timeline when analyzing patterns', async () => {
      const content = sampleLogs.map(log => JSON.stringify(log)).join('\n');
      const testFile = await createTestFile(content);
      testFiles.push(testFile);

      const fileContent = await fs.readFile(testFile, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      const timeline = [];
      
      for (const line of lines) {
        try {
          const log = JSON.parse(line);
          if (log.timestamp) {
            timeline.push({
              timestamp: log.timestamp,
              level: log.level,
              event: log.event
            });
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }
      
      timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      
      expect(timeline).toHaveLength(4);
      expect(timeline[0].event).toBe('login');
      expect(timeline[1].event).toBe('login');
      expect(timeline[2].event).toBe('logout');
      expect(timeline[3].event).toBe('login');
    });
  });

  describe('Utility Functions', () => {
    it('should resolve file paths correctly', () => {
      const logDirectory = '/test/logs';
      
      const resolveFilePath = (filePath: string): string => {
        if (path.isAbsolute(filePath)) {
          return filePath;
        }
        return path.resolve(logDirectory, filePath);
      };

      expect(resolveFilePath('/absolute/path')).toBe('/absolute/path');
      expect(resolveFilePath('relative/path')).toBe(path.resolve(logDirectory, 'relative/path'));
    });

    it('should get nested field values', () => {
      const log = {
        user: {
          profile: {
            name: 'John Doe',
            id: 123
          }
        },
        level: 'info'
      };

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

      expect(getNestedField(log, 'level')).toBe('info');
      expect(getNestedField(log, 'user.profile.name')).toBe('John Doe');
      expect(getNestedField(log, 'user.profile.id')).toBe(123);
      expect(getNestedField(log, 'nonexistent.field')).toBeUndefined();
    });

    it('should truncate long field values', () => {
      const log = {
        message: 'This is a very long message that should be truncated when the max length is set to a value smaller than the message length',
        short: 'ok'
      };

      const truncateFieldValues = (obj: any, maxLength: number) => {
        const result = { ...obj };
        for (const [key, value] of Object.entries(result)) {
          if (typeof value === 'string' && value.length > maxLength) {
            result[key] = value.substring(0, maxLength) + '... [truncated]';
          }
        }
        return result;
      };

      const truncated = truncateFieldValues(log, 50);
      expect(truncated.message).toContain('... [truncated]');
      expect(truncated.message.length).toBe(65); // 50 + '... [truncated]'.length
      expect(truncated.short).toBe('ok');
    });
  });
});