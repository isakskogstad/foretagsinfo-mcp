/**
 * MCP Resources - URI-baserade resurser för företagsinformation
 *
 * URI-format:
 * - company://{org_number} - Företagsinformation
 * - company://{org_number}/documents - Dokumentlista
 * - company://{org_number}/report/{year} - Årsredovisning
 * - api://status - API-status
 */
import { getBolagsverketClient } from '../api-client/bolagsverket.js';
import { validateOrgNumber } from '../utils/validators.js';
import { parseIXBRL } from '../utils/ixbrl-parser.js';
import { logger, createRequestLogger } from '../utils/logger.js';
import { MCPError, NotFoundError, ValidationError } from '../utils/errors.js';

/**
 * Resource templates for MCP
 */
export const RESOURCE_TEMPLATES = [
  {
    uriTemplate: 'company://{org_number}',
    name: 'Företagsinformation',
    description: 'Hämta grundläggande information om ett företag via organisationsnummer',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'company://{org_number}/documents',
    name: 'Dokumentlista',
    description: 'Lista tillgängliga årsredovisningar och dokument för ett företag',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'company://{org_number}/report/{year}',
    name: 'Årsredovisning',
    description: 'Hämta och analysera årsredovisning för ett specifikt år',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'api://status',
    name: 'API-status',
    description: 'Kontrollera Bolagsverket API-anslutning och status',
    mimeType: 'application/json',
  },
];

/**
 * Parse URI and extract parameters
 */
interface ParsedURI {
  type: 'company' | 'company_documents' | 'company_report' | 'api_status' | 'unknown';
  orgNumber?: string;
  year?: number;
}

function parseResourceURI(uri: string): ParsedURI {
  // API status
  if (uri === 'api://status') {
    return { type: 'api_status' };
  }

  // Company URIs
  const companyMatch = uri.match(/^company:\/\/(\d{10})$/);
  if (companyMatch) {
    return { type: 'company', orgNumber: companyMatch[1] };
  }

  const documentsMatch = uri.match(/^company:\/\/(\d{10})\/documents$/);
  if (documentsMatch) {
    return { type: 'company_documents', orgNumber: documentsMatch[1] };
  }

  const reportMatch = uri.match(/^company:\/\/(\d{10})\/report\/(\d{4})$/);
  if (reportMatch) {
    return {
      type: 'company_report',
      orgNumber: reportMatch[1],
      year: parseInt(reportMatch[2], 10),
    };
  }

  return { type: 'unknown' };
}

/**
 * Read a resource by URI
 */
export async function readResource(
  uri: string,
  requestId?: string
): Promise<{
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}> {
  const log = requestId ? createRequestLogger(requestId) : logger;
  const parsed = parseResourceURI(uri);

  log.debug({ uri, parsed }, 'Reading resource');

  try {
    switch (parsed.type) {
      case 'api_status':
        return await readApiStatus(uri, requestId);

      case 'company':
        return await readCompany(uri, parsed.orgNumber!, requestId);

      case 'company_documents':
        return await readDocuments(uri, parsed.orgNumber!, requestId);

      case 'company_report':
        return await readReport(uri, parsed.orgNumber!, parsed.year!, requestId);

      default:
        throw new ValidationError(`Ogiltig resurs-URI: ${uri}`, requestId);
    }
  } catch (error) {
    if (error instanceof MCPError) {
      throw error;
    }
    log.error({ error, uri }, 'Resource read failed');
    throw new MCPError(
      `Kunde inte läsa resurs: ${error instanceof Error ? error.message : 'Okänt fel'}`,
      undefined,
      500,
      requestId
    );
  }
}

/**
 * Read API status
 */
async function readApiStatus(
  uri: string,
  requestId?: string
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  const client = getBolagsverketClient();
  const isAlive = await client.ping();

  const status = {
    status: isAlive ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    api: {
      bolagsverket: isAlive ? 'connected' : 'error',
    },
    endpoints: {
      tokenUrl: 'https://portal.api.bolagsverket.se/oauth2/token',
      apiBase: 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1',
    },
  };

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(status, null, 2),
      },
    ],
  };
}

/**
 * Read company info
 */
async function readCompany(
  uri: string,
  orgNumber: string,
  requestId?: string
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  // Validate org number
  const validOrgNumber = validateOrgNumber(orgNumber, requestId);

  const client = getBolagsverketClient();
  const data = await client.getCompany(validOrgNumber, requestId);

  if (!data) {
    throw new NotFoundError('Företag', orgNumber, requestId);
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Read document list
 */
async function readDocuments(
  uri: string,
  orgNumber: string,
  requestId?: string
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  const validOrgNumber = validateOrgNumber(orgNumber, requestId);

  const client = getBolagsverketClient();
  const documents = await client.getDocumentList(validOrgNumber, requestId);

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ orgNumber: validOrgNumber, documents }, null, 2),
      },
    ],
  };
}

/**
 * Read annual report
 */
async function readReport(
  uri: string,
  orgNumber: string,
  year: number,
  requestId?: string
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  const validOrgNumber = validateOrgNumber(orgNumber, requestId);

  const client = getBolagsverketClient();
  const result = await client.getAnnualReport(validOrgNumber, year, requestId);

  if (!result) {
    throw new NotFoundError('Årsredovisning', `${orgNumber} år ${year}`, requestId);
  }

  // Parse iXBRL
  const reportData = await parseIXBRL(result.document, requestId);

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(
          {
            orgNumber: validOrgNumber,
            year,
            metadata: result.metadata,
            report: reportData,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * List available resources (static templates)
 */
export function listResourceTemplates() {
  return RESOURCE_TEMPLATES;
}
