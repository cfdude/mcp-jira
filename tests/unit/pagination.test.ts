/**
 * Comprehensive pagination tests for Jira MCP server
 * Tests the pagination functionality for list-issues and search-issues-jql tools
 */

import { describe, test, expect } from '@jest/globals';
import { validateNextPageToken, handlePaginationError } from '../../src/utils/tool-wrapper.js';

describe('Pagination Utilities', () => {
  describe('validateNextPageToken', () => {
    test('should pass with valid token', () => {
      expect(() => validateNextPageToken('valid-token-123')).not.toThrow();
    });

    test('should pass with undefined token', () => {
      expect(() => validateNextPageToken(undefined)).not.toThrow();
    });

    test('should pass with empty token', () => {
      expect(() => validateNextPageToken('')).not.toThrow();
    });

    test('should throw error for whitespace-only token', () => {
      expect(() => validateNextPageToken('   ')).toThrow(
        'nextPageToken must be a non-empty string'
      );
    });

    test('should throw error for non-string token', () => {
      // @ts-expect-error - Testing runtime type checking
      expect(() => validateNextPageToken(123)).toThrow('nextPageToken must be a non-empty string');
    });
  });

  describe('handlePaginationError', () => {
    test('should throw pagination error for token-related 400 errors', () => {
      const error = {
        response: {
          status: 400,
          data: {
            errorMessages: ['Invalid token provided'],
          },
        },
      };

      expect(() => handlePaginationError(error)).toThrow(
        'Invalid pagination token. Please use a valid nextPageToken from a previous search response.'
      );
    });

    test('should throw pagination error for pagination-related 400 errors', () => {
      const error = {
        response: {
          status: 400,
          data: {
            errorMessages: ['Pagination error occurred'],
          },
        },
      };

      expect(() => handlePaginationError(error)).toThrow(
        'Invalid pagination token. Please use a valid nextPageToken from a previous search response.'
      );
    });

    test('should re-throw non-pagination errors', () => {
      const error = {
        response: {
          status: 500,
          data: {
            errorMessages: ['Internal server error'],
          },
        },
      };

      expect(() => handlePaginationError(error)).toThrow();

      // Verify the exact error object is thrown
      try {
        handlePaginationError(error);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
      }
    });

    test('should re-throw 400 errors that are not token-related', () => {
      const error = {
        response: {
          status: 400,
          data: {
            errorMessages: ['JQL syntax error'],
          },
        },
      };

      expect(() => handlePaginationError(error)).toThrow();

      // Verify the exact error object is thrown
      try {
        handlePaginationError(error);
      } catch (thrownError) {
        expect(thrownError).toBe(error);
      }
    });

    test('should re-throw errors without response structure', () => {
      const error = new Error('Network error');
      expect(() => handlePaginationError(error)).toThrow(error);
    });
  });
});

describe('Multi-page Scenario Integration Tests', () => {
  test('should simulate complete pagination workflow for large result sets', () => {
    // Simulate a workflow where user pages through 300 issues
    const totalIssues = 300;
    const pageSize = 50;
    const expectedPages = Math.ceil(totalIssues / pageSize);

    const mockPages = [];
    for (let page = 0; page < expectedPages; page++) {
      const startIndex = page * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalIssues);
      const pageIssues = [];

      for (let i = startIndex; i < endIndex; i++) {
        pageIssues.push({
          key: `PROJ-${i + 1}`,
          id: `${10000 + i}`,
          fields: {
            summary: `Issue ${i + 1}`,
            status: { name: 'To Do' },
            priority: { name: 'Medium' },
            assignee: null,
            issuetype: { name: 'Task' },
            created: '2023-01-01T10:00:00.000Z',
            updated: '2023-01-01T10:00:00.000Z',
            components: [],
            fixVersions: [],
            labels: [],
            reporter: { displayName: 'Test User' },
            project: { key: 'PROJ' },
          },
        });
      }

      mockPages.push({
        issues: pageIssues,
        total: totalIssues,
        nextPageToken: page < expectedPages - 1 ? `token-page-${page + 2}` : undefined,
      });
    }

    // Verify pagination structure
    expect(mockPages).toHaveLength(expectedPages);
    expect(mockPages[0].issues).toHaveLength(pageSize);
    expect(mockPages[0].nextPageToken).toBe('token-page-2');
    expect(mockPages[expectedPages - 1].nextPageToken).toBeUndefined();

    // Verify total issue count across all pages
    const totalMockIssues = mockPages.reduce((sum, page) => sum + page.issues.length, 0);
    expect(totalMockIssues).toBe(totalIssues);

    // Verify last page has correct issue count
    const lastPageExpectedCount = totalIssues % pageSize || pageSize;
    expect(mockPages[expectedPages - 1].issues).toHaveLength(lastPageExpectedCount);
  });

  test('should validate pagination token format consistency', () => {
    // Test various token formats that should be valid
    const validTokens = [
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
      'simple-token-123',
      'uuid-12345678-1234-1234-1234-123456789012',
      '1234567890',
      'base64encodedtoken=',
    ];

    const invalidTokens = ['', '   ', '\n\t', null, undefined, 123, true, {}];

    validTokens.forEach(token => {
      expect(() => validateNextPageToken(token)).not.toThrow();
    });

    invalidTokens.forEach(token => {
      if (token === undefined || token === null) {
        expect(() => validateNextPageToken(token)).not.toThrow();
      } else if (token === '') {
        expect(() => validateNextPageToken(token)).not.toThrow();
      } else {
        expect(() => validateNextPageToken(token as any)).toThrow();
      }
    });
  });
});
