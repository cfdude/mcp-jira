/**
 * Regression test for the STDIO JSON-RPC corruption bug.
 *
 * In STDIO transport mode, stdout must carry ONLY framed JSON-RPC. A dependency
 * (`adf-to-md`) logs `console.log('adding warning for', node.type)` whenever it
 * meets an ADF node type it doesn't recognize, which leaked plain text onto
 * stdout and broke the client with: `... "adding war"... is not valid JSON`.
 *
 * The guard (src/utils/stdio-guard.ts) re-binds stdout-writing console methods
 * onto a stderr-backed Console. These tests assert the REAL leak path — driving
 * adf-to-md with an unknown node type — never reaches process.stdout, and that
 * the diagnostic still appears on stderr (not silently dropped).
 */
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import Converter from 'adf-to-md';

describe('stdio-guard (JSON-RPC stdout protection)', () => {
  let stdoutSpy: jest.SpiedFunction<typeof process.stdout.write>;
  let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(async () => {
    // Activate the guard. Tests never load index.ts, so importing the guard
    // module here is what installs it — without this, nothing is under test.
    await import('../../src/utils/stdio-guard.js');

    stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  test('adf-to-md unknown node type does NOT write to stdout', () => {
    // An ADF doc containing a node type adf-to-md has no handler for. This is
    // exactly what fires `console.log('adding warning for', node.type)`.
    const adf = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'someUnsupportedNodeType',
          content: [{ type: 'text', text: 'hello' }],
        },
      ],
    };

    Converter.convert(adf);

    const stdoutOutput = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stdoutOutput).toBe('');
    expect(stdoutOutput).not.toContain('adding warning');
  });

  test('the diagnostic is redirected to stderr, not dropped', () => {
    const adf = {
      version: 1,
      type: 'doc',
      content: [{ type: 'someUnsupportedNodeType' }],
    };

    Converter.convert(adf);

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('adding warning');
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  test('console.log / info / debug all route to stderr only', () => {
    console.log('plain log line');
    console.info('info line');
    console.debug('debug line');

    expect(stdoutSpy).not.toHaveBeenCalled();
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('plain log line');
    expect(stderrOutput).toContain('info line');
    expect(stderrOutput).toContain('debug line');
  });
});
