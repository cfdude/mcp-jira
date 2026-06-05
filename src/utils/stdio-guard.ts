/**
 * stdio-guard
 *
 * In STDIO transport mode the MCP server speaks JSON-RPC over stdout. The SDK's
 * StdioServerTransport writes serialized protocol messages directly to
 * `process.stdout` (`this._stdout.write(json)`), so stdout MUST carry nothing
 * but framed JSON-RPC. Any stray write corrupts the stream and the client fails
 * with errors like: `Unexpected token 'a', "adding war"... is not valid JSON`.
 *
 * The leaks are not in our code (which logs exclusively via `console.error`),
 * but in third-party dependencies that log to stdout via `console.*`:
 *   - `adf-to-md` -> `console.log('adding warning for', node.type)` on any ADF
 *     node type it doesn't recognize (fires while rendering issue descriptions /
 *     comments on the get_issue / list_issues read paths).
 *   - `dotenv` -> `console.log('[dotenv@...] injecting env ... -- tip: ...')` on
 *     load.
 *
 * We CANNOT override `process.stdout.write` globally — the transport calls it to
 * emit JSON-RPC, so doing so would break the protocol. Instead we re-bind the
 * stdout-writing `console` methods onto a Console instance whose output stream is
 * `process.stderr`. This is the canonical MCP stdio guard: every diagnostic line
 * (ours or a dependency's) goes to stderr, stdout stays pristine for JSON-RPC.
 *
 * This module must be imported BEFORE any module that may log at import time
 * (e.g. `dotenv/config`). Import it as the very first import of the STDIO entry
 * point. HTTP mode carries JSON-RPC over the network, not stdout, so it does not
 * need (and does not load) this guard.
 */
import { Console } from 'node:console';

// A Console whose stdout is redirected to stderr. Calling its `log`/`info`/etc.
// methods formats output identically to the global console but emits on stderr.
const stderrConsole = new Console({
  stdout: process.stderr,
  stderr: process.stderr,
});

// The console methods that write to stdout by default. (`warn`/`error`/`assert`/
// `trace` already write to stderr, so they are intentionally left untouched.)
const STDOUT_METHODS = [
  'log',
  'info',
  'debug',
  'dir',
  'dirxml',
  'table',
  'group',
  'groupCollapsed',
  'groupEnd',
  'count',
  'countReset',
  'time',
  'timeLog',
  'timeEnd',
] as const;

for (const method of STDOUT_METHODS) {
  const redirected = stderrConsole[method as keyof Console] as unknown;
  if (typeof redirected === 'function') {
    // Keep the global `console` object identity; only rewire the stdout methods
    // so any code holding a reference to `console` is transparently redirected.
    (console as unknown as Record<string, unknown>)[method] = (
      redirected as (...args: unknown[]) => unknown
    ).bind(stderrConsole);
  }
}

export {};
