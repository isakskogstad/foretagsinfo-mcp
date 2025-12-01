/**
 * Input Validation and Environment Validation Utilities
 */

import { ValidationError, ConfigurationError } from './errors.js';

/**
 * Required environment variables
 */
const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'BOLAGSVERKET_CLIENT_ID',
  'BOLAGSVERKET_CLIENT_SECRET',
] as const;

/**
 * Environment validation result
 */
export interface EnvironmentValidationResult {
  valid: boolean;
  missing: string[];
  configured: string[];
}

/**
 * Validate environment variables at startup
 * Fail fast if critical configuration is missing
 */
export function validateEnvironment(): EnvironmentValidationResult {
  const missing: string[] = [];
  const configured: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar] || process.env[envVar]?.trim() === '') {
      missing.push(envVar);
    } else {
      configured.push(envVar);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    configured,
  };
}

/**
 * Validate and throw if environment is invalid
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();

  if (!result.valid) {
    throw new ConfigurationError(
      `Missing required environment variables: ${result.missing.join(', ')}. ` +
      `Please check your .env file and ensure all required variables are set.`,
      undefined,
      {
        missing: result.missing,
        configured: result.configured,
      }
    );
  }
}

/**
 * Validate Swedish organization number (organisationsnummer)
 * Format: 10 digits (NNNNNN-NNNN or NNNNNNNNNN)
 */
export function validateOrgNumber(orgNumber: string, requestId?: string): void {
  // Remove hyphen if present
  const cleaned = orgNumber.replace('-', '');

  if (!/^\d{10}$/.test(cleaned)) {
    throw new ValidationError(
      `Invalid organisationsnummer: "${orgNumber}". Must be 10 digits (format: NNNNNN-NNNN or NNNNNNNNNN)`,
      requestId,
      { orgNumber, format: 'Expected 10 digits' }
    );
  }
}

/**
 * Validate year parameter
 */
export function validateYear(year: number, requestId?: string): void {
  const currentYear = new Date().getFullYear();
  const minYear = 1900;

  if (!Number.isInteger(year)) {
    throw new ValidationError(
      `Invalid year: "${year}". Must be an integer`,
      requestId,
      { year, type: typeof year }
    );
  }

  if (year < minYear || year > currentYear) {
    throw new ValidationError(
      `Invalid year: "${year}". Must be between ${minYear} and ${currentYear}`,
      requestId,
      { year, minYear, maxYear: currentYear }
    );
  }
}

/**
 * Validate limit parameter
 */
export function validateLimit(limit: number, requestId?: string): void {
  const maxLimit = 100;
  const minLimit = 1;

  if (!Number.isInteger(limit)) {
    throw new ValidationError(
      `Invalid limit: "${limit}". Must be an integer`,
      requestId,
      { limit, type: typeof limit }
    );
  }

  if (limit < minLimit || limit > maxLimit) {
    throw new ValidationError(
      `Invalid limit: "${limit}". Must be between ${minLimit} and ${maxLimit}`,
      requestId,
      { limit, minLimit, maxLimit }
    );
  }
}

/**
 * Validate search query
 */
export function validateSearchQuery(query: string, requestId?: string): void {
  if (!query || query.trim() === '') {
    throw new ValidationError(
      'Search query cannot be empty',
      requestId,
      { query }
    );
  }

  const maxLength = 200;
  if (query.length > maxLength) {
    throw new ValidationError(
      `Search query too long. Maximum ${maxLength} characters`,
      requestId,
      { query: query.substring(0, 50) + '...', length: query.length, maxLength }
    );
  }
}

/**
 * Sanitize string input (prevent injection attacks)
 */
export function sanitizeString(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/['";]/g, '') // Remove quotes and semicolons
    .trim();
}
