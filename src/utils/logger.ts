/**
 * Simple console logging replacement for Winston
 */

interface Logger {
  info(message: string, meta?: any): void;
  error(message: string | Error, meta?: any): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  child(meta: any): Logger;
}

const formatMessage = (level: string, message: string | Error, meta?: any): string => {
  const timestamp = new Date().toISOString();
  const msg = message instanceof Error ? message.message : message;
  const stack = message instanceof Error ? message.stack : undefined;
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';

  let result = `[${timestamp}] ${level.toUpperCase()}: ${msg}${metaStr}`;
  if (stack) {
    result += `\n${stack}`;
  }
  return result;
};

const createLogger = (baseMeta?: any): Logger => ({
  info: (message: string, meta?: any) => {
    const combinedMeta = baseMeta ? { ...baseMeta, ...meta } : meta;
    // Use stderr for all logging in MCP servers to avoid interfering with JSON-RPC on stdout
    console.error(formatMessage('info', message, combinedMeta));
  },
  error: (message: string | Error, meta?: any) => {
    const combinedMeta = baseMeta ? { ...baseMeta, ...meta } : meta;
    console.error(formatMessage('error', message, combinedMeta));
  },
  warn: (message: string, meta?: any) => {
    const combinedMeta = baseMeta ? { ...baseMeta, ...meta } : meta;
    console.error(formatMessage('warn', message, combinedMeta));
  },
  debug: (message: string, meta?: any) => {
    const combinedMeta = baseMeta ? { ...baseMeta, ...meta } : meta;
    console.error(formatMessage('debug', message, combinedMeta));
  },
  child: (meta: any) => createLogger(baseMeta ? { ...baseMeta, ...meta } : meta),
});

const logger = createLogger();

export default logger;
