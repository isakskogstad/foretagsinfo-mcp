/**
 * Structured logging with Pino
 * IMPORTANT: In stdio mode, logs MUST go to stderr (not stdout)
 */
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isHttpMode = process.env.MCP_TRANSPORT === 'http' || process.env.PORT;

// In stdio mode, we MUST use stderr to not interfere with MCP protocol
const transport = isHttpMode
  ? undefined // HTTP mode: stdout is fine
  : {
      target: 'pino-pretty',
      options: {
        destination: 2, // stderr
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: ['*.password', '*.secret', '*.token', '*.apiKey', '*.authorization'],
    censor: '[REDACTED]',
  },
});

/**
 * Create a child logger with request context
 */
export function createRequestLogger(requestId: string, toolName?: string) {
  return logger.child({
    requestId,
    ...(toolName && { tool: toolName }),
  });
}

export default logger;
