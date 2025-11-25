import { describe, expect, test, afterEach, beforeEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadOpenCodeEnvironment } from '../../src/utils/opencode-config.js';

describe('OpenCode configuration integration', () => {
  let tempDir: string;
  const originalOpencodeConfig = process.env.OPENCODE_CONFIG;
  const originalJiraConfigPath = process.env.JIRA_CONFIG_PATH;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-opencode-test-'));
    delete process.env.OPENCODE_CONFIG;
    delete process.env.JIRA_CONFIG_PATH;
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (originalOpencodeConfig) {
      process.env.OPENCODE_CONFIG = originalOpencodeConfig;
    } else {
      delete process.env.OPENCODE_CONFIG;
    }

    if (originalJiraConfigPath) {
      process.env.JIRA_CONFIG_PATH = originalJiraConfigPath;
    } else {
      delete process.env.JIRA_CONFIG_PATH;
    }
  });

  test('loads environment values from project opencode.json with comments', async () => {
    const mcpConfigDir = path.join(tempDir, 'config');
    fs.mkdirSync(mcpConfigDir, { recursive: true });

    const opencodeConfigPath = path.join(tempDir, 'opencode.json');
    const jiraConfigPath = path.join('config', '.jira-config.json');

    const opencodeConfig = `{
      "$schema": "https://opencode.ai/config.json",
      // MCP servers available to the project
      "mcp": {
        "Jira": {
          "type": "local",
          "enabled": true,
          "environment": {
            "JIRA_CONFIG_PATH": "${jiraConfigPath}",
            "CUSTOM_ENV": "example"
          }
        }
      }
    }`;

    fs.writeFileSync(opencodeConfigPath, opencodeConfig, 'utf-8');

    const result = await loadOpenCodeEnvironment(tempDir, 'jira');
    expect(result).not.toBeNull();
    expect(result?.environment.CUSTOM_ENV).toBe('example');
    expect(result?.environment.JIRA_CONFIG_PATH).toBe(path.resolve(tempDir, jiraConfigPath));
  });

  test('returns null when server is disabled', async () => {
    const opencodeConfigPath = path.join(tempDir, 'opencode.json');
    const opencodeConfig = {
      $schema: 'https://opencode.ai/config.json',
      mcp: {
        jira: {
          type: 'local',
          enabled: false,
          environment: {
            JIRA_CONFIG_PATH: './config/.jira-config.json',
          },
        },
      },
    };

    fs.writeFileSync(opencodeConfigPath, JSON.stringify(opencodeConfig, null, 2), 'utf-8');

    const result = await loadOpenCodeEnvironment(tempDir, 'jira');
    expect(result).toBeNull();
  });
});
