import { describe, test, expect } from '@jest/globals';
import { JiraServer } from '../../src/jira-server.js';

describe('JiraServer Integration', () => {
  test('should create JiraServer instance', () => {
    const server = new JiraServer();
    expect(server).toBeInstanceOf(JiraServer);
  });

  test('should have run method', () => {
    const server = new JiraServer();
    expect(typeof server.run).toBe('function');
  });

  test('should initialize without throwing', () => {
    expect(() => new JiraServer()).not.toThrow();
  });
});
