import { describe, test, expect } from '@jest/globals';
import { formatIssueList, formatDate, formatIssue } from '../../src/utils/formatting.js';

describe('Formatting Utils', () => {
  describe('formatDate', () => {
    test('should format ISO date string', () => {
      const isoDate = '2024-01-15T10:30:00.000Z';
      const result = formatDate(isoDate);

      // Should return a formatted date string like "Jan 15, 2024"
      expect(result).toMatch(/^[A-Za-z]{3} \d{1,2}, \d{4}$/);
    });

    test('should handle invalid date', () => {
      const result = formatDate('invalid-date');
      expect(result).toBe('Invalid Date');
    });

    test('should handle empty string', () => {
      expect(formatDate('')).toBe('Invalid Date');
    });
  });

  describe('formatIssue', () => {
    test('should format a basic issue', () => {
      const issue = {
        key: 'TEST-1',
        fields: {
          summary: 'Test issue',
          status: { name: 'To Do' },
          assignee: { displayName: 'John Doe', emailAddress: 'john@example.com' },
          priority: { name: 'Medium' },
          issuetype: { name: 'Task' },
          creator: { displayName: 'Jane Smith' },
          description: 'Test description',
        },
      };

      const result = formatIssue(issue);
      expect(result).toContain('TEST-1');
      expect(result).toContain('Test issue');
      expect(result).toContain('To Do');
      expect(result).toContain('John Doe');
      expect(result).toContain('Jane Smith');
    });

    test('should handle unassigned issue', () => {
      const issue = {
        key: 'TEST-2',
        fields: {
          summary: 'Unassigned issue',
          status: { name: 'In Progress' },
          assignee: null,
          priority: { name: 'High' },
          issuetype: { name: 'Bug' },
          creator: { displayName: 'Bob Wilson' },
          description: null,
        },
      };

      const result = formatIssue(issue);
      expect(result).toContain('TEST-2');
      expect(result).toContain('Unassigned issue');
      expect(result).toContain('Unassigned');
      expect(result).toContain('Bob Wilson');
    });
  });

  describe('formatIssueList', () => {
    test('should format list of issues', () => {
      const issues = [
        {
          key: 'TEST-1',
          fields: {
            summary: 'First issue',
            status: { name: 'To Do' },
            assignee: { displayName: 'John Doe', emailAddress: 'john@example.com' },
            priority: { name: 'Medium' },
            issuetype: { name: 'Task' },
            creator: { displayName: 'Jane Smith' },
            description: 'First description',
          },
        },
        {
          key: 'TEST-2',
          fields: {
            summary: 'Second issue',
            status: { name: 'In Progress' },
            assignee: null,
            priority: { name: 'High' },
            issuetype: { name: 'Bug' },
            creator: { displayName: 'Bob Wilson' },
            description: null,
          },
        },
      ];

      const result = formatIssueList(issues);

      expect(result).toContain('TEST-1');
      expect(result).toContain('First issue');
      expect(result).toContain('To Do');
      expect(result).toContain('John Doe');
      expect(result).toContain('TEST-2');
      expect(result).toContain('Second issue');
      expect(result).toContain('In Progress');
      expect(result).toContain('Unassigned');
    });

    test('should handle empty issue list', () => {
      const result = formatIssueList([]);
      expect(result).toContain('No issues found');
    });
  });
});
