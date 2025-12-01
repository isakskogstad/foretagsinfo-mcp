/**
 * Structured Logger using Pino
 * Logs to stderr in stdio mode, supports contextual logging with request IDs
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';
const isStdioMode = process.env.MCP_TRANSPORT !== 'http';

/**
 * Create pino logger instance
 */
export const logger = pino({
  name: 'personupplysning-mcp',
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // In stdio mode, ALWAYS log to stderr (never stdout)
  // In HTTP mode, log to stdout (goes to Render logs)
  ...(isStdioMode && {
    transport: {
      target: 'pino-pretty',
      options: {
        destination: 2, // stderr
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),

  // In production HTTP mode, use JSON format
  ...(!isDevelopment && !isStdioMode && {
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  }),
});

/**
 * Logger interface for type-safe logging
 */
export interface LogContext {
  requestId?: string;
  toolName?: string;
  organisationsidentitet?: string;
  duration?: number;
  statusCode?: number;
  cacheHit?: boolean;
  error?: Error | unknown;
  [key: string]: unknown;
}

/**
 * Create logger instance with name
 */
export function createLogger(name: string): pino.Logger {
  return logger.child({ name });
}

/**
 * Create child logger with request context
 */
export function createRequestLogger(requestId: string, toolName?: string): pino.Logger {
  return logger.child({ requestId, toolName });
}

/**
 * Log tool execution
 */
export function logToolExecution(
  requestId: string,
  toolName: string,
  duration: number,
  success: boolean,
  metadata?: Record<string, unknown>
): void {
  logger.info(
    {
      requestId,
      toolName,
      duration,
      success,
      ...metadata,
    },
    'Tool execution completed'
  );
}

/**
 * Log API request
 */
export function logAPIRequest(
  requestId: string,
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number,
  cacheHit: boolean
): void {
  logger.info(
    {
      requestId,
      endpoint,
      method,
      duration,
      statusCode,
      cacheHit,
    },
    'API request completed'
  );
}

/**
 * Log error with context
 */
export function logError(
  requestId: string | undefined,
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  logger.error(
    {
      requestId,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: isDevelopment ? error.stack : undefined,
      } : String(error),
      ...context,
    },
    'Error occurred'
  );
}

/**
 * Log startup information
 */
export function logStartup(mode: 'stdio' | 'http', config: Record<string, unknown>): void {
  logger.info(
    {
      mode,
      ...config,
    },
    'Server starting'
  );
}

/**
 * Log environment validation
 */
export function logEnvironmentValidation(valid: boolean, missing?: string[]): void {
  if (valid) {
    logger.info('Environment variables validated successfully');
  } else {
    logger.error(
      {
        missing,
      },
      'Environment validation failed'
    );
  }
}

export default logger;
