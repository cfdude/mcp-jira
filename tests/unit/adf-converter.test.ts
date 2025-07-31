import { describe, test, expect } from '@jest/globals';
import {
  textToAdf,
  markdownToAdf,
  isAdfFormat,
  ensureAdfFormat,
} from '../../src/utils/adf-converter.js';

describe('ADF Converter', () => {
  describe('textToAdf', () => {
    test('should convert simple text to ADF', () => {
      const text = 'Hello world';
      const result = textToAdf(text);

      expect(result).toHaveProperty('version', 1);
      expect(result).toHaveProperty('type', 'doc');
      expect(result).toHaveProperty('content');
      expect(result.content).toBeInstanceOf(Array);
    });

    test('should handle multiline text', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const result = textToAdf(text);

      expect(result.content).toBeInstanceOf(Array);
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe('markdownToAdf', () => {
    test('should convert simple markdown to ADF', () => {
      const markdown = 'Hello world';
      const result = markdownToAdf(markdown);

      expect(result).toHaveProperty('version', 1);
      expect(result).toHaveProperty('type', 'doc');
      expect(result).toHaveProperty('content');
      expect(result.content).toBeInstanceOf(Array);
    });

    test('should handle empty markdown', () => {
      const result = markdownToAdf('');
      expect(result).toHaveProperty('version', 1);
      expect(result).toHaveProperty('type', 'doc');
      expect(result.content).toBeInstanceOf(Array);
      // Empty markdown still creates a paragraph with empty text
      expect(result.content.length).toBe(1);
      expect(result.content[0]).toHaveProperty('type', 'paragraph');
    });
  });

  describe('isAdfFormat', () => {
    test('should identify valid ADF document', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [],
      };

      expect(isAdfFormat(adf)).toBe(true);
    });

    test('should reject invalid formats', () => {
      expect(isAdfFormat(null)).toBe(false);
      expect(isAdfFormat('string')).toBe(false);
      expect(isAdfFormat({})).toBe(false);
      expect(isAdfFormat({ type: 'doc' })).toBe(false); // missing version
    });
  });

  describe('ensureAdfFormat', () => {
    test('should pass through valid ADF', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [],
      };

      const result = ensureAdfFormat(adf);
      expect(result).toEqual(adf);
    });

    test('should convert string to ADF', () => {
      const text = 'Hello world';
      const result = ensureAdfFormat(text);

      expect(result).toHaveProperty('version', 1);
      expect(result).toHaveProperty('type', 'doc');
      expect(result).toHaveProperty('content');
    });
  });
});
