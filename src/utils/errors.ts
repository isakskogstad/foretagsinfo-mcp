/**
 * Custom error classes for Företagsinfo MCP
 */

export enum ErrorCode {
  // Input validation
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_ORG_NUMBER = 'INVALID_ORG_NUMBER',
  INVALID_CHECKSUM = 'INVALID_CHECKSUM',

  // API errors
  API_ERROR = 'API_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  NOT_FOUND = 'NOT_FOUND',

  // Document errors
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
  PARSE_ERROR = 'PARSE_ERROR',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

export interface ErrorMetadata {
  orgNumber?: string;
  endpoint?: string;
  statusCode?: number;
  [key: string]: unknown;
}

/**
 * Base MCP Error class with request tracking
 */
export class MCPError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly requestId?: string;
  public readonly metadata?: ErrorMetadata;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
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

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(includeStack = false): Record<string, unknown> {
    return {
      error: true,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      requestId: this.requestId,
      timestamp: this.timestamp,
      ...(includeStack && process.env.NODE_ENV !== 'production' && { stack: this.stack }),
    };
  }

  toMCPResponse(): { content: Array<{ type: 'text'; text: string }>; isError: true } {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(this.toJSON(), null, 2),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Validation error for invalid inputs
 */
export class ValidationError extends MCPError {
  constructor(message: string, requestId?: string, metadata?: ErrorMetadata) {
    super(message, ErrorCode.INVALID_INPUT, 400, requestId, metadata);
    this.name = 'ValidationError';
  }
}

/**
 * Invalid org number format or checksum
 */
export class InvalidOrgNumberError extends MCPError {
  constructor(orgNumber: string, reason: string, requestId?: string) {
    super(
      `Invalid org number "${orgNumber}": ${reason}`,
      ErrorCode.INVALID_ORG_NUMBER,
      400,
      requestId,
      { orgNumber }
    );
    this.name = 'InvalidOrgNumberError';
  }
}

/**
 * Bolagsverket API error
 */
export class BolagsverketAPIError extends MCPError {
  constructor(
    message: string,
    statusCode: number = 500,
    requestId?: string,
    metadata?: ErrorMetadata
  ) {
    super(message, ErrorCode.API_ERROR, statusCode, requestId, metadata);
    this.name = 'BolagsverketAPIError';
  }
}

/**
 * Company or document not found
 */
export class NotFoundError extends MCPError {
  constructor(resource: string, identifier: string, requestId?: string) {
    super(
      `${resource} not found: ${identifier}`,
      ErrorCode.NOT_FOUND,
      404,
      requestId,
      { resource, identifier }
    );
    this.name = 'NotFoundError';
  }
}

/**
 * iXBRL parsing error
 */
export class ParseError extends MCPError {
  constructor(message: string, requestId?: string, metadata?: ErrorMetadata) {
    super(message, ErrorCode.PARSE_ERROR, 500, requestId, metadata);
    this.name = 'ParseError';
  }
}
