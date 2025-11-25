import fs from 'fs';
import path from 'path';
import os from 'os';

interface OpenCodeMcpEntry {
  type?: string;
  enabled?: boolean;
  command?: string[];
  url?: string;
  environment?: Record<string, string>;
  headers?: Record<string, string>;
}

interface OpenCodeConfig {
  mcp?: Record<string, OpenCodeMcpEntry>;
}

export interface OpenCodeEnvironmentResult {
  configPath: string;
  serverKey: string;
  environment: Record<string, string>;
}

const openCodeCache = new Map<string, OpenCodeEnvironmentResult | null>();

function stripJsonComments(content: string): string {
  let insideString = false;
  let insideSingleLineComment = false;
  let insideMultiLineComment = false;
  let result = '';

  for (let i = 0; i < content.length; i++) {
    const currentChar = content[i];
    const nextChar = content[i + 1];

    if (insideSingleLineComment) {
      if (currentChar === '\n') {
        insideSingleLineComment = false;
        result += currentChar;
      }
      continue;
    }

    if (insideMultiLineComment) {
      if (currentChar === '*' && nextChar === '/') {
        insideMultiLineComment = false;
        i++;
      }
      continue;
    }

    if (!insideString && currentChar === '/' && nextChar === '/') {
      insideSingleLineComment = true;
      i++;
      continue;
    }

    if (!insideString && currentChar === '/' && nextChar === '*') {
      insideMultiLineComment = true;
      i++;
      continue;
    }

    if (currentChar === '"') {
      const escaped = isEscaped(content, i);
      if (!escaped) {
        insideString = !insideString;
      }
    }

    result += currentChar;
  }

  return result;
}

function isEscaped(text: string, position: number): boolean {
  let backslashCount = 0;
  for (let i = position - 1; i >= 0; i--) {
    if (text[i] === '\\') {
      backslashCount++;
    } else {
      break;
    }
  }
  return backslashCount % 2 === 1;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.access(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function buildCandidatePaths(workingDir: string): string[] {
  const candidates: string[] = [];

  if (process.env.OPENCODE_CONFIG) {
    candidates.push(process.env.OPENCODE_CONFIG);
  }

  const visited = new Set<string>();
  if (workingDir) {
    let currentDir = path.resolve(workingDir);
    while (!visited.has(currentDir)) {
      visited.add(currentDir);

      candidates.push(path.join(currentDir, 'opencode.json'));
      candidates.push(path.join(currentDir, 'opencode.jsonc'));
      candidates.push(path.join(currentDir, '.opencode', 'opencode.json'));
      candidates.push(path.join(currentDir, '.opencode', 'opencode.jsonc'));

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
  }

  const homeConfigDir = path.join(os.homedir(), '.config', 'opencode');
  candidates.push(path.join(homeConfigDir, 'opencode.json'));
  candidates.push(path.join(homeConfigDir, 'opencode.jsonc'));

  return [...new Set(candidates)];
}

function normalizeServerKey(key: string): string {
  return key.trim().toLowerCase();
}

function findMcpEntry(
  mcpConfig: Record<string, OpenCodeMcpEntry>,
  desiredKey: string
): { key: string; entry: OpenCodeMcpEntry } | null {
  if (mcpConfig[desiredKey]) {
    return { key: desiredKey, entry: mcpConfig[desiredKey] };
  }

  const normalizedDesired = normalizeServerKey(desiredKey);
  for (const [key, entry] of Object.entries(mcpConfig)) {
    if (normalizeServerKey(key) === normalizedDesired) {
      return { key, entry };
    }
  }

  return null;
}

export function normalizePotentialPath(value: string, baseDir?: string): string {
  let normalized = value.trim();
  if (normalized.startsWith('~')) {
    normalized = path.join(os.homedir(), normalized.slice(1));
  }

  if (!path.isAbsolute(normalized) && baseDir) {
    normalized = path.resolve(baseDir, normalized);
  }

  return normalized;
}

export async function loadOpenCodeEnvironment(
  workingDir: string,
  serverKey: string = 'jira'
): Promise<OpenCodeEnvironmentResult | null> {
  const cacheKey = `${path.resolve(workingDir || '.')}:${serverKey}`;
  if (openCodeCache.has(cacheKey)) {
    return openCodeCache.get(cacheKey) ?? null;
  }

  const candidates = buildCandidatePaths(workingDir);

  for (const candidate of candidates) {
    try {
      if (!(await pathExists(candidate))) {
        continue;
      }

      const rawContent = await fs.promises.readFile(candidate, 'utf-8');
      const sanitizedContent = stripJsonComments(rawContent);
      const parsed = JSON.parse(sanitizedContent) as OpenCodeConfig;

      if (!parsed?.mcp) {
        continue;
      }

      const entryMatch = findMcpEntry(parsed.mcp, serverKey);
      if (!entryMatch) {
        continue;
      }

      const { key, entry } = entryMatch;
      if (entry.enabled === false) {
        openCodeCache.set(cacheKey, null);
        return null;
      }

      const environment: Record<string, string> = {};
      if (entry.environment) {
        for (const [envKey, envValue] of Object.entries(entry.environment)) {
          if (typeof envValue === 'string') {
            if (envKey === 'JIRA_CONFIG_PATH') {
              environment[envKey] = normalizePotentialPath(envValue, path.dirname(candidate));
            } else {
              environment[envKey] = envValue;
            }
          }
        }
      }

      const result: OpenCodeEnvironmentResult = {
        configPath: candidate,
        serverKey: key,
        environment,
      };

      openCodeCache.set(cacheKey, result);
      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse OpenCode config', {
        candidate,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
  }

  openCodeCache.set(cacheKey, null);
  return null;
}
