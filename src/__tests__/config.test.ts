import { describe, it, expect } from '@jest/globals';
import { DEFAULT_CONFIG, type LogConfig } from '../config.js';

describe('Config Module', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_CONFIG).toBeDefined();
      expect(DEFAULT_CONFIG.logDirectory).toBe('./logs');
      expect(DEFAULT_CONFIG.schema.timestampField).toBe('timestamp');
      expect(DEFAULT_CONFIG.schema.levelField).toBe('level');
      expect(DEFAULT_CONFIG.schema.messageField).toBe('message');
      expect(DEFAULT_CONFIG.schema.eventField).toBe('event');
    });

    it('should have correlation fields array', () => {
      expect(Array.isArray(DEFAULT_CONFIG.schema.correlationFields)).toBe(true);
      expect(DEFAULT_CONFIG.schema.correlationFields).toContain('migrationId');
      expect(DEFAULT_CONFIG.schema.correlationFields).toContain('taskId');
      expect(DEFAULT_CONFIG.schema.correlationFields).toContain('listId');
    });

    it('should have API response fields array', () => {
      expect(Array.isArray(DEFAULT_CONFIG.schema.apiResponseFields)).toBe(true);
      expect(DEFAULT_CONFIG.schema.apiResponseFields).toContain('response');
      expect(DEFAULT_CONFIG.schema.apiResponseFields).toContain('data');
    });

    it('should have error fields array', () => {
      expect(Array.isArray(DEFAULT_CONFIG.schema.errorFields)).toBe(true);
      expect(DEFAULT_CONFIG.schema.errorFields).toContain('error');
      expect(DEFAULT_CONFIG.schema.errorFields).toContain('errorMessage');
    });

    it('should have valid default values', () => {
      expect(DEFAULT_CONFIG.defaults.searchLimit).toBe(100);
      expect(DEFAULT_CONFIG.defaults.filterLimit).toBe(100);
      expect(DEFAULT_CONFIG.defaults.parseLimit).toBe(1000);
      expect(DEFAULT_CONFIG.defaults.contextWindow).toBe(5);
      expect(DEFAULT_CONFIG.defaults.timeWindowMinutes).toBe(10);
      expect(DEFAULT_CONFIG.defaults.caseSensitive).toBe(false);
    });

    it('should have file patterns configuration', () => {
      expect(Array.isArray(DEFAULT_CONFIG.filePatterns.include)).toBe(true);
      expect(DEFAULT_CONFIG.filePatterns.include).toContain('*.jsonl');
      expect(DEFAULT_CONFIG.filePatterns.include).toContain('*.log');
      expect(Array.isArray(DEFAULT_CONFIG.filePatterns.exclude)).toBe(true);
      expect(DEFAULT_CONFIG.filePatterns.exclude).toContain('*.tmp');
    });

    it('should have display configuration', () => {
      expect(DEFAULT_CONFIG.display.prettyPrintApiResponses).toBe(true);
      expect(DEFAULT_CONFIG.display.showLineNumbers).toBe(true);
      expect(DEFAULT_CONFIG.display.maxFieldValueLength).toBe(500);
      expect(DEFAULT_CONFIG.display.dateFormat).toBe('ISO');
    });
  });

  describe('LogConfig interface validation', () => {
    it('should accept valid config objects', () => {
      const validConfig: LogConfig = {
        logDirectory: '/tmp/logs',
        schema: {
          timestampField: 'ts',
          levelField: 'lvl',
          messageField: 'msg',
          eventField: 'evt',
          correlationFields: ['id1', 'id2'],
          apiResponseFields: ['resp'],
          errorFields: ['err']
        },
        defaults: {
          searchLimit: 50,
          filterLimit: 50,
          parseLimit: 500,
          contextWindow: 3,
          timeWindowMinutes: 5,
          caseSensitive: true
        },
        filePatterns: {
          include: ['*.json'],
          exclude: ['*.bak']
        },
        display: {
          prettyPrintApiResponses: false,
          showLineNumbers: false,
          maxFieldValueLength: 200
        }
      };

      expect(validConfig).toBeDefined();
      expect(validConfig.logDirectory).toBe('/tmp/logs');
      expect(validConfig.schema.timestampField).toBe('ts');
    });

    it('should handle optional fields', () => {
      const configWithoutOptional: Partial<LogConfig> = {
        logDirectory: '/test',
        schema: {
          timestampField: 'timestamp',
          levelField: 'level',
          messageField: 'message',
          correlationFields: [],
          apiResponseFields: [],
          errorFields: []
        }
      };

      expect(configWithoutOptional.schema?.eventField).toBeUndefined();
    });
  });

  describe('Schema field validation', () => {
    it('should require essential schema fields', () => {
      const config = { ...DEFAULT_CONFIG };
      
      expect(config.schema.timestampField).toBeTruthy();
      expect(config.schema.levelField).toBeTruthy();
      expect(config.schema.messageField).toBeTruthy();
    });

    it('should allow empty arrays for optional field lists', () => {
      const config: LogConfig = {
        ...DEFAULT_CONFIG,
        schema: {
          ...DEFAULT_CONFIG.schema,
          correlationFields: [],
          apiResponseFields: [],
          errorFields: []
        }
      };

      expect(config.schema.correlationFields).toEqual([]);
      expect(config.schema.apiResponseFields).toEqual([]);
      expect(config.schema.errorFields).toEqual([]);
    });
  });
});