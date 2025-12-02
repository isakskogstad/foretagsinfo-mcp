/**
 * Input validation with Zod + Luhn checksum
 */
import { z } from 'zod';
import { InvalidOrgNumberError } from './errors.js';

/**
 * Validate Swedish organization number with Luhn checksum
 * Format: 10 digits (NNNNNN-NNNN), century digit omitted
 */
export function validateOrgNumber(orgNumber: string, requestId?: string): string {
  // Remove any hyphens or spaces
  const cleaned = orgNumber.replace(/[-\s]/g, '');

  // Must be exactly 10 digits
  if (!/^\d{10}$/.test(cleaned)) {
    throw new InvalidOrgNumberError(
      orgNumber,
      'Must be exactly 10 digits',
      requestId
    );
  }

  // Validate Luhn checksum
  if (!isValidLuhn(cleaned)) {
    throw new InvalidOrgNumberError(
      orgNumber,
      'Invalid checksum (Luhn validation failed)',
      requestId
    );
  }

  return cleaned;
}

/**
 * Luhn algorithm (mod 10) validation
 * Used for Swedish personnummer and organisationsnummer
 */
function isValidLuhn(num: string): boolean {
  const digits = num.split('').map(Number);
  let sum = 0;

  for (let i = 0; i < digits.length; i++) {
    let d = digits[i];

    // Double every second digit from the right (in 10-digit number, that's even positions)
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }

    sum += d;
  }

  return sum % 10 === 0;
}

/**
 * Calculate Luhn checksum digit
 */
export function calculateLuhnChecksum(num: string): number {
  const digits = num.split('').map(Number);
  let sum = 0;

  for (let i = 0; i < digits.length; i++) {
    let d = digits[i];
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Zod schema for organization number
 */
export const OrgNumberSchema = z
  .string()
  .min(10, 'Organization number must be at least 10 characters')
  .max(13, 'Organization number must be at most 13 characters (with hyphens)')
  .transform((val) => val.replace(/[-\s]/g, ''))
  .refine((val) => /^\d{10}$/.test(val), {
    message: 'Organization number must be exactly 10 digits',
  })
  .refine((val) => isValidLuhn(val), {
    message: 'Invalid organization number checksum',
  });

/**
 * Schema for get_company tool input
 */
export const GetCompanyInputSchema = z.object({
  org_number: OrgNumberSchema,
});

/**
 * Schema for get_documents tool input
 */
export const GetDocumentsInputSchema = z.object({
  org_number: OrgNumberSchema,
});

/**
 * Schema for get_annual_report tool input
 */
export const GetAnnualReportInputSchema = z.object({
  org_number: OrgNumberSchema,
  year: z.number().int().min(1900).max(2100).optional(),
});

export type GetCompanyInput = z.infer<typeof GetCompanyInputSchema>;
export type GetDocumentsInput = z.infer<typeof GetDocumentsInputSchema>;
export type GetAnnualReportInput = z.infer<typeof GetAnnualReportInputSchema>;
