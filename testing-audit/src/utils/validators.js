/**
 * Input validation utilities for Personupplysning MCP
 * Uses Zod for runtime type validation and sanitization
 */
import { z } from 'zod';
/**
 * Swedish Organization Number Validator
 * Format: 10 digits (XXXXXX-XXXX or XXXXXXXXXX)
 *
 * Validates and normalizes Swedish organization numbers
 */
export const OrganisationsnummerSchema = z
    .string()
    .trim()
    .regex(/^\d{10}$|^\d{6}-\d{4}$/, 'Invalid Swedish organization number format (expected: XXXXXXXXXX or XXXXXX-XXXX)')
    .transform((val) => {
    // Remove any hyphens and return clean 10-digit string
    const cleaned = val.replace(/[^0-9]/g, '');
    if (cleaned.length !== 10) {
        throw new Error('Organization number must be exactly 10 digits');
    }
    return cleaned;
})
    .refine((val) => {
    // Validate Luhn checksum algorithm (same as personnummer)
    const digits = val.split('').map(Number);
    const checksum = digits.reduce((sum, digit, index) => {
        if (index === 9)
            return sum; // Skip last digit (checksum)
        let value = digit;
        if (index % 2 === 0) {
            value *= 2;
            if (value > 9)
                value -= 9;
        }
        return sum + value;
    }, 0);
    const expectedCheckDigit = (10 - (checksum % 10)) % 10;
    return digits[9] === expectedCheckDigit;
}, 'Invalid organization number checksum');
/**
 * Search Query Validator
 * Prevents XSS and SQL injection attempts
 */
export const SearchQuerySchema = z
    .string()
    .trim()
    .min(2, 'Search query too short (minimum 2 characters)')
    .max(200, 'Search query too long (maximum 200 characters)')
    .refine((val) => !/<script|javascript:|onerror=|onclick=/i.test(val), 'Invalid characters detected in search query')
    .refine((val) => !/(\bOR\b|\bAND\b|--|;|\/\*|\*\/|xp_|sp_|exec|execute|union|select|insert|update|delete|drop)/i.test(val), 'SQL injection patterns detected');
/**
 * Year Validator
 * For annual reports (1900 - current year + 1)
 */
export const YearSchema = z
    .number()
    .int()
    .min(1900, 'Year must be 1900 or later')
    .max(new Date().getFullYear() + 1, `Year cannot be later than ${new Date().getFullYear() + 1}`)
    .optional();
/**
 * Limit Validator
 * For pagination
 */
export const LimitSchema = z
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(1000, 'Limit cannot exceed 1000')
    .default(10);
/**
 * Offset Validator
 * For pagination
 */
export const OffsetSchema = z
    .number()
    .int()
    .min(0, 'Offset cannot be negative')
    .default(0);
/**
 * Boolean Validator
 * For flags
 */
export const BooleanSchema = z
    .boolean()
    .default(false);
/**
 * Tool Input Schemas
 */
export const SearchCompaniesInputSchema = z.object({
    query: SearchQuerySchema,
    limit: LimitSchema,
    offset: OffsetSchema.optional(),
    active_only: BooleanSchema.optional(),
});
export const GetCompanyDetailsInputSchema = z.object({
    organisationsidentitet: OrganisationsnummerSchema,
    force_refresh: BooleanSchema.optional(),
});
export const GetCompanyDocumentsInputSchema = z.object({
    organisationsidentitet: OrganisationsnummerSchema,
    force_refresh: BooleanSchema.optional(),
});
export const GetAnnualReportInputSchema = z.object({
    organisationsidentitet: OrganisationsnummerSchema,
    year: YearSchema,
    force_refresh: BooleanSchema.optional(),
});
export const GetCacheStatsInputSchema = z.object({
    include_details: BooleanSchema.optional(),
});
/**
 * Resource URI Validators
 */
export const CompanyResourceURISchema = z
    .string()
    .regex(/^company:\/\/[a-zA-Z0-9\-\/\?=&]+$/, 'Invalid company resource URI format');
/**
 * Helper function to validate and sanitize input
 */
export function validateInput(schema, input) {
    try {
        return schema.parse(input);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`Validation error: ${messages}`);
        }
        throw error;
    }
}
/**
 * Sanitize SQL LIKE pattern
 * Escapes special characters: %, _, \
 */
export function sanitizeLikePattern(input) {
    return input
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
}
/**
 * Validate and format organization number for display
 * Returns formatted version: XXXXXX-XXXX
 */
export function formatOrganisationsnummer(orgNummer) {
    const cleaned = orgNummer.replace(/[^0-9]/g, '');
    if (cleaned.length !== 10) {
        throw new Error('Invalid organization number');
    }
    return `${cleaned.slice(0, 6)}-${cleaned.slice(6)}`;
}
/**
 * Check if organization number is valid (without throwing)
 */
export function isValidOrganisationsnummer(orgNummer) {
    try {
        OrganisationsnummerSchema.parse(orgNummer);
        return true;
    }
    catch {
        return false;
    }
}
