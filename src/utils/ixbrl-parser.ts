/**
 * iXBRL Parser for Swedish Annual Reports
 * Extracts financial data from Bolagsverket iXBRL ZIP files
 *
 * Swedish iXBRL uses inline XBRL format with:
 * - ix:nonFraction for numeric values
 * - ix:nonNumeric for text values
 * - scale attribute for value multipliers (e.g., scale="3" = x1000)
 */
import JSZip from 'jszip';
import { ParseError } from './errors.js';
import { logger } from './logger.js';
import type { AnnualReportData } from '../api-client/types.js';

// Field mappings from Swedish XBRL taxonomy to our data structure
const NUMERIC_MAPPINGS: Record<string, { category: string; field: string }> = {
  // Income statement
  'se-gen-base:Nettoomsattning': { category: 'income', field: 'revenue' },
  'se-gen-base:RorelseintakterLagerforandringarMm': { category: 'income', field: 'totalRevenue' },
  'se-gen-base:Rorelseresultat': { category: 'income', field: 'operatingResult' },
  'se-gen-base:ResultatEfterFinansiellaPoster': { category: 'income', field: 'financialResult' },
  'se-gen-base:AretsResultat': { category: 'income', field: 'netIncome' },
  'se-gen-base:AretsResultatEgetKapital': { category: 'income', field: 'netIncome' },

  // Balance sheet - Assets
  'se-gen-base:SummaTillgangar': { category: 'balance', field: 'totalAssets' },
  'se-gen-base:Tillgangar': { category: 'balance', field: 'totalAssets' },
  'se-gen-base:SummaAnlaggningstillgangar': { category: 'balance', field: 'fixedAssets' },
  'se-gen-base:SummaOmsattningstillgangar': { category: 'balance', field: 'currentAssets' },
  'se-gen-base:BalansomslutningTillgangar': { category: 'balance', field: 'totalAssets' },

  // Balance sheet - Equity & Liabilities
  'se-gen-base:SummaEgetKapital': { category: 'balance', field: 'equity' },
  'se-gen-base:EgetKapital': { category: 'balance', field: 'equity' },
  'se-gen-base:SummaLangfristigaSkulder': { category: 'balance', field: 'longTermLiabilities' },
  'se-gen-base:SummaKortfristigaSkulder': { category: 'balance', field: 'currentLiabilities' },
  'se-gen-base:SummaSkulderEgetKapital': { category: 'balance', field: 'totalEquityAndLiabilities' },
  'se-gen-base:BalansomslutningEgetKapitalSkulder': { category: 'balance', field: 'totalEquityAndLiabilities' },

  // Key metrics - solidityRaw is processed separately to ensure proper percentage handling
  'se-gen-base:MedelantaletAnstallda': { category: 'metrics', field: 'employees' },
  'se-gen-base:Soliditet': { category: 'metrics', field: 'solidityRaw' },
};

// Fields where scale should NOT be applied (values are already in correct unit)
const NO_SCALE_FIELDS = new Set([
  'se-gen-base:Soliditet',
  'se-gen-base:MedelantaletAnstallda',
]);

// Text field mappings
const TEXT_MAPPINGS: Record<string, string> = {
  'se-cd-base:RakenskapsarForstaDag': 'periodFrom',
  'se-cd-base:RakenskapsarSistaDag': 'periodTo',
  'se-gen-base:UnderskriftArsredovisningForetradareTilltalsnamn': 'signerFirstName',
  'se-gen-base:UnderskriftArsredovisningForetradareEfternamn': 'signerLastName',
  'se-gen-base:UnderskriftArsredovisningForetradareForetradarroll': 'signerRole',
};

interface ExtractedValue {
  name: string;
  value: number;
  scale: number;
  contextRef?: string;
}

interface ExtractedText {
  name: string;
  value: string;
}

/**
 * Parse iXBRL ZIP file and extract financial data
 */
export async function parseIXBRL(zipBuffer: Buffer, requestId?: string): Promise<AnnualReportData> {
  try {
    // Unzip the file
    const zip = await JSZip.loadAsync(zipBuffer);

    // Find the main iXBRL file
    let xbrlContent: string | null = null;
    let xbrlFileName: string | null = null;

    for (const [filename, file] of Object.entries(zip.files)) {
      if (filename.endsWith('.xhtml') || filename.endsWith('.xml') || filename.endsWith('.xbrl')) {
        xbrlContent = await file.async('string');
        xbrlFileName = filename;
        break;
      }
    }

    if (!xbrlContent) {
      throw new ParseError('No XBRL file found in ZIP archive', requestId);
    }

    logger.debug({ filename: xbrlFileName }, 'Parsing iXBRL file');

    // Extract data using regex-based parsing
    const numericValues = extractNonFractionValues(xbrlContent);
    const textValues = extractNonNumericValues(xbrlContent);

    // Build result
    const result = buildAnnualReportData(numericValues, textValues);

    logger.info({
      hasRevenue: !!result.incomeStatement.revenue,
      hasAssets: !!result.balanceSheet.totalAssets,
      hasSolidity: !!result.keyMetrics.solidityPercent,
      employees: result.keyMetrics.employees,
      fieldsExtracted: countExtractedFields(result),
    }, 'iXBRL parsed successfully');

    return result;

  } catch (error) {
    if (error instanceof ParseError) throw error;

    logger.error({ error }, 'iXBRL parsing failed');
    throw new ParseError(
      `Failed to parse iXBRL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      requestId
    );
  }
}

/**
 * Extract numeric values from ix:nonFraction tags
 */
function extractNonFractionValues(content: string): ExtractedValue[] {
  const values: ExtractedValue[] = [];

  // Match ix:nonFraction tags with their attributes and content
  // Example: <ix:nonFraction contextRef="PERIOD0" name="se-gen-base:Nettoomsattning" unitRef="SEK" decimals="-3" scale="3" format="ixt:numspacecomma">411</ix:nonFraction>
  const regex = /<ix:nonFraction([^>]*)>([^<]*)<\/ix:nonFraction>/gi;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const attributes = match[1];
    const textValue = match[2].trim();

    // Extract name attribute
    const nameMatch = attributes.match(/name="([^"]+)"/);
    if (!nameMatch) continue;

    const name = nameMatch[1];

    // Extract scale attribute (default to 0)
    const scaleMatch = attributes.match(/scale="([^"]+)"/);
    const scale = scaleMatch ? parseInt(scaleMatch[1], 10) : 0;

    // Extract contextRef for period identification
    const contextMatch = attributes.match(/contextRef="([^"]+)"/);
    const contextRef = contextMatch ? contextMatch[1] : undefined;

    // Parse the numeric value (Swedish format with space as thousand separator)
    const numericValue = parseSwedishNumber(textValue);
    if (numericValue !== null) {
      // Apply scale (e.g., scale="3" means multiply by 1000)
      // But skip scale for certain fields that are already in correct unit
      const shouldApplyScale = !NO_SCALE_FIELDS.has(name);
      const scaledValue = shouldApplyScale ? numericValue * Math.pow(10, scale) : numericValue;

      values.push({
        name,
        value: scaledValue,
        scale,
        contextRef,
      });
    }
  }

  return values;
}

/**
 * Extract text values from ix:nonNumeric tags
 */
function extractNonNumericValues(content: string): ExtractedText[] {
  const values: ExtractedText[] = [];

  // Match ix:nonNumeric tags
  const regex = /<ix:nonNumeric([^>]*)>([^<]*)<\/ix:nonNumeric>/gi;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const attributes = match[1];
    const textValue = match[2].trim();

    // Extract name attribute
    const nameMatch = attributes.match(/name="([^"]+)"/);
    if (!nameMatch) continue;

    if (textValue) {
      values.push({
        name: nameMatch[1],
        value: textValue,
      });
    }
  }

  return values;
}

/**
 * Parse Swedish number format (space as thousand separator, comma as decimal)
 */
function parseSwedishNumber(value: string): number | null {
  if (!value) return null;

  // Remove all spaces (thousand separators)
  let cleaned = value.replace(/\s/g, '');

  // Replace comma with dot for decimal
  cleaned = cleaned.replace(',', '.');

  // Remove any remaining non-numeric characters except dot and minus
  cleaned = cleaned.replace(/[^\d.\-]/g, '');

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Build AnnualReportData from extracted values
 */
function buildAnnualReportData(
  numericValues: ExtractedValue[],
  textValues: ExtractedText[]
): AnnualReportData {
  const result: AnnualReportData = {
    period: { from: '', to: '' },
    incomeStatement: {},
    balanceSheet: {},
    keyMetrics: {},
    management: { boardMembers: [] },
    rawXmlAvailable: true,
  };

  // Process text values for period
  for (const tv of textValues) {
    const mapping = TEXT_MAPPINGS[tv.name];
    if (mapping === 'periodFrom') {
      result.period.from = tv.value;
    } else if (mapping === 'periodTo') {
      result.period.to = tv.value;
    }
  }

  // Group numeric values by context (period/tidpunkt)
  // PERIOD0 = most recent income statement period
  // TIDPUNKT0 = most recent balance sheet point in time
  // We prioritize PERIOD0 and TIDPUNKT0 values

  // Create a map of name -> first value found, prioritizing most recent context
  const valueMap = new Map<string, number>();

  // First pass: add all values with most recent context
  for (const v of numericValues) {
    const isPriorityContext = v.contextRef === 'PERIOD0' || v.contextRef === 'TIDPUNKT0';
    if (isPriorityContext && !valueMap.has(v.name)) {
      valueMap.set(v.name, v.value);
    }
  }

  // Second pass: fill in any missing values from other contexts
  for (const v of numericValues) {
    if (!valueMap.has(v.name)) {
      valueMap.set(v.name, v.value);
    }
  }

  // Map to our structure
  for (const [name, value] of valueMap) {
    const mapping = NUMERIC_MAPPINGS[name];
    if (!mapping) continue;

    if (mapping.category === 'income') {
      (result.incomeStatement as Record<string, number>)[mapping.field] = value;
    } else if (mapping.category === 'balance') {
      (result.balanceSheet as Record<string, number>)[mapping.field] = value;
    } else if (mapping.category === 'metrics') {
      (result.keyMetrics as Record<string, number>)[mapping.field] = value;
    }
  }

  // Convert solidityRaw to solidityPercent
  // Soliditet from XBRL is typically 0-100 (e.g., 80 = 80%)
  // But sometimes it's 0-1 (e.g., 0.8 = 80%)
  if ((result.keyMetrics as Record<string, number>).solidityRaw !== undefined) {
    const rawValue = (result.keyMetrics as Record<string, number>).solidityRaw;
    // If value is <= 1, it's likely a decimal (0.8 = 80%), multiply by 100
    // If value is > 1 and <= 100, it's already a percentage
    result.keyMetrics.solidityPercent = rawValue <= 1 ? Math.round(rawValue * 1000) / 10 : Math.round(rawValue * 10) / 10;
    delete (result.keyMetrics as Record<string, number>).solidityRaw;
  }

  // Try to calculate equity from components if not directly available
  if (!result.balanceSheet.equity) {
    const aktiekapital = valueMap.get('se-gen-base:Aktiekapital') || 0;
    const reservfond = valueMap.get('se-gen-base:Reservfond') || 0;
    const balanserat = valueMap.get('se-gen-base:BalanseratResultat') || 0;
    const aretsResultat = valueMap.get('se-gen-base:AretsResultatEgetKapital') || 0;

    if (aktiekapital > 0) {
      result.balanceSheet.equity = aktiekapital + reservfond + balanserat + aretsResultat;
    }
  }

  // Extract board members and CEO from text values
  const signers: Array<{ firstName: string; lastName: string; role: string }> = [];
  let currentSigner: { firstName?: string; lastName?: string; role?: string } = {};

  for (const tv of textValues) {
    const mapping = TEXT_MAPPINGS[tv.name];
    if (mapping === 'signerFirstName') {
      if (currentSigner.firstName) {
        // Save previous signer and start new one
        if (currentSigner.firstName && currentSigner.lastName) {
          signers.push(currentSigner as { firstName: string; lastName: string; role: string });
        }
        currentSigner = {};
      }
      currentSigner.firstName = tv.value;
    } else if (mapping === 'signerLastName') {
      currentSigner.lastName = tv.value;
    } else if (mapping === 'signerRole') {
      currentSigner.role = tv.value;
    }
  }

  // Add last signer
  if (currentSigner.firstName && currentSigner.lastName) {
    signers.push(currentSigner as { firstName: string; lastName: string; role: string });
  }

  // Categorize signers
  for (const signer of signers) {
    const fullName = `${signer.firstName} ${signer.lastName}`;
    const role = signer.role?.toLowerCase() || '';

    if (role.includes('verkställande') || role.includes('vd')) {
      result.management.ceo = fullName;
    } else {
      result.management.boardMembers.push(fullName);
    }
  }

  // Calculate solidity if we have equity and assets but no explicit solidity
  if (result.balanceSheet.equity && result.balanceSheet.totalAssets && !result.keyMetrics.solidityPercent) {
    result.keyMetrics.solidityPercent = Math.round(
      (result.balanceSheet.equity / result.balanceSheet.totalAssets) * 100 * 10
    ) / 10;
  }

  // If we have net income from equity section but not income statement, use it
  if (!result.incomeStatement.netIncome && (result.incomeStatement as Record<string, number>).netIncome === undefined) {
    // Check if there's an AretsResultatEgetKapital value
    const netIncomeFromEquity = valueMap.get('se-gen-base:AretsResultatEgetKapital');
    if (netIncomeFromEquity !== undefined) {
      result.incomeStatement.netIncome = netIncomeFromEquity;
    }
  }

  return result;
}

/**
 * Count total extracted fields for logging
 */
function countExtractedFields(data: AnnualReportData): number {
  let count = 0;
  if (data.period.from) count++;
  if (data.period.to) count++;
  count += Object.keys(data.incomeStatement).length;
  count += Object.keys(data.balanceSheet).length;
  count += Object.keys(data.keyMetrics).length;
  count += data.management.boardMembers.length;
  if (data.management.ceo) count++;
  return count;
}

/**
 * Format annual report data for display
 */
export function formatAnnualReport(data: AnnualReportData): string {
  const lines: string[] = [];

  if (data.period.from && data.period.to) {
    lines.push(`Period: ${data.period.from} - ${data.period.to}`);
    lines.push('');
  }

  // Income statement
  if (Object.keys(data.incomeStatement).length > 0) {
    lines.push('=== Resultaträkning ===');
    if (data.incomeStatement.revenue !== undefined) {
      lines.push(`Nettoomsättning: ${formatCurrency(data.incomeStatement.revenue)}`);
    }
    if (data.incomeStatement.operatingResult !== undefined) {
      lines.push(`Rörelseresultat: ${formatCurrency(data.incomeStatement.operatingResult)}`);
    }
    if (data.incomeStatement.netIncome !== undefined) {
      lines.push(`Årets resultat: ${formatCurrency(data.incomeStatement.netIncome)}`);
    }
    lines.push('');
  }

  // Balance sheet
  if (Object.keys(data.balanceSheet).length > 0) {
    lines.push('=== Balansräkning ===');
    if (data.balanceSheet.totalAssets !== undefined) {
      lines.push(`Summa tillgångar: ${formatCurrency(data.balanceSheet.totalAssets)}`);
    }
    if (data.balanceSheet.equity !== undefined) {
      lines.push(`Eget kapital: ${formatCurrency(data.balanceSheet.equity)}`);
    }
    lines.push('');
  }

  // Key metrics
  if (Object.keys(data.keyMetrics).length > 0) {
    lines.push('=== Nyckeltal ===');
    if (data.keyMetrics.solidityPercent !== undefined) {
      lines.push(`Soliditet: ${data.keyMetrics.solidityPercent}%`);
    }
    if (data.keyMetrics.employees !== undefined) {
      lines.push(`Medelantal anställda: ${data.keyMetrics.employees}`);
    }
    lines.push('');
  }

  // Management
  if (data.management.boardMembers.length > 0 || data.management.ceo) {
    lines.push('=== Ledning ===');
    if (data.management.ceo) {
      lines.push(`VD: ${data.management.ceo}`);
    }
    if (data.management.boardMembers.length > 0) {
      lines.push(`Styrelse: ${data.management.boardMembers.join(', ')}`);
    }
  }

  return lines.join('\n');
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(value);
}
