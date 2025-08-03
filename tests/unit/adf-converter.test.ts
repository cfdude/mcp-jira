import { describe, test, expect } from '@jest/globals';
import {
  convertTextToADF,
  safeConvertTextToADF,
  validateADF,
  createSimpleADFParagraph,
} from '../../src/utils/adf-converter.js';

describe('ADF Converter', () => {
  describe('convertTextToADF', () => {
    test('should convert simple text to ADF', () => {
      const text = 'Hello world';
      const result = convertTextToADF(text);

      expect(result).toHaveProperty('version', 1);
      expect(result).toHaveProperty('type', 'doc');
      expect(result).toHaveProperty('content');
      expect(result.content).toBeInstanceOf(Array);
    });

    test('should handle multiline text', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const result = convertTextToADF(text);

      expect(result.content).toBeInstanceOf(Array);
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe('validateADF', () => {
    test('should identify valid ADF document', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [],
      };

      expect(validateADF(adf)).toBe(true);
    });

    test('should reject invalid formats', () => {
      expect(validateADF(null as any)).toBe(false);
      expect(validateADF('string' as any)).toBe(false);
      expect(validateADF({} as any)).toBe(false);
      expect(validateADF({ type: 'doc' } as any)).toBe(false); // missing version
    });
  });

  describe('safeConvertTextToADF', () => {
    test('should convert text safely', () => {
      const text = 'Hello world';
      const result = safeConvertTextToADF(text);

      expect(result).toHaveProperty('version', 1);
      expect(result).toHaveProperty('type', 'doc');
      expect(result).toHaveProperty('content');
    });

    test('should handle empty text', () => {
      const result = safeConvertTextToADF('');
      expect(result).toHaveProperty('version', 1);
      expect(result).toHaveProperty('type', 'doc');
      expect(result.content).toBeInstanceOf(Array);
    });
  });

  describe('createSimpleADFParagraph', () => {
    test('should create simple ADF paragraph', () => {
      const text = 'Hello world';
      const result = createSimpleADFParagraph(text);

      expect(result).toHaveProperty('version', 1);
      expect(result).toHaveProperty('type', 'doc');
      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'paragraph');
    });
  });
});
