/**
 * Custom Error Classes for MCP Server
 * Provides structured error handling with error codes and request IDs
 */

export enum ErrorCode {
  // Client errors (4xx)
  INVALID_INPUT = 'INVALID_INPUT',
  COMPANY_NOT_FOUND = 'COMPANY_NOT_FOUND',
  INVALID_ORG_NUMBER = 'INVALID_ORG_NUMBER',
  INVALID_YEAR = 'INVALID_YEAR',
  NO_DOCUMENTS_FOUND = 'NO_DOCUMENTS_FOUND',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  API_ERROR = 'API_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',

  // Configuration errors
  MISSING_CONFIG = 'MISSING_CONFIG',
  INVALID_CONFIG = 'INVALID_CONFIG',

  // External API errors
  BOLAGSVERKET_ERROR = 'BOLAGSVERKET_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
}

export interface ErrorMetadata {
  [key: string]: unknown;
}

/**
 * Base MCP Error class with structured error information
 */
export class MCPError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly requestId?: string;
  public readonly metadata?: ErrorMetadata;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    requestId?: string,
    metadata?: ErrorMetadata
  ) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
  }

  /**
   * Convert error to safe JSON response (no stack trace in production)
   */
  toJSON(includeSensitive: boolean = false): object {
    const base = {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        requestId: this.requestId,
        timestamp: this.timestamp,
        ...(this.metadata && { metadata: this.metadata }),
      },
    };

    if (includeSensitive) {
      return {
        ...base,
        error: {
          ...base.error,
          stack: this.stack,
        },
      };
    }

    return base;
  }
}

/**
 * Validation Error (4xx)
 */
export class ValidationError extends MCPError {
  constructor(message: string, requestId?: string, metadata?: ErrorMetadata) {
    super(ErrorCode.INVALID_INPUT, message, 400, requestId, metadata);
    this.name = 'ValidationError';
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends MCPError {
  constructor(message: string, requestId?: string, metadata?: ErrorMetadata) {
    super(ErrorCode.COMPANY_NOT_FOUND, message, 404, requestId, metadata);
    this.name = 'NotFoundError';
  }
}

/**
 * API Error (502)
 */
export class APIError extends MCPError {
  constructor(message: string, requestId?: string, metadata?: ErrorMetadata) {
    super(ErrorCode.API_ERROR, message, 502, requestId, metadata);
    this.name = 'APIError';
  }
}

/**
 * Configuration Error (500)
 */
export class ConfigurationError extends MCPError {
  constructor(message: string, requestId?: string, metadata?: ErrorMetadata) {
    super(ErrorCode.MISSING_CONFIG, message, 500, requestId, metadata);
    this.name = 'ConfigurationError';
  }
}

/**
 * Bolagsverket API specific error
 */
export class BolagsverketError extends MCPError {
  constructor(message: string, statusCode: number = 502, requestId?: string, metadata?: ErrorMetadata) {
    super(ErrorCode.BOLAGSVERKET_ERROR, message, statusCode, requestId, metadata);
    this.name = 'BolagsverketError';
  }
}

/**
 * Convert unknown error to MCPError
 */
export function toMCPError(error: unknown, requestId?: string): MCPError {
  if (error instanceof MCPError) {
    return error;
  }

  if (error instanceof Error) {
    return new MCPError(
      ErrorCode.INTERNAL_ERROR,
      error.message,
      500,
      requestId,
      { originalError: error.name }
    );
  }

  return new MCPError(
    ErrorCode.INTERNAL_ERROR,
    'An unknown error occurred',
    500,
    requestId,
    { error: String(error) }
  );
}
