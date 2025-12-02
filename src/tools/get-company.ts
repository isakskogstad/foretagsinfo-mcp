/**
 * get_company tool - Hämta företagsinformation från Bolagsverket
 */
import { z } from 'zod';
import { getBolagsverketClient } from '../api-client/bolagsverket.js';
import { GetCompanyInputSchema } from '../utils/validators.js';
import { NotFoundError, MCPError } from '../utils/errors.js';
import { logger, createRequestLogger } from '../utils/logger.js';
import type { CompanyData, CompanyInfo } from '../api-client/types.js';

export const GET_COMPANY_TOOL = {
  name: 'get_company',
  description: `Hämta företagsinformation från Bolagsverket via organisationsnummer.

Returnerar:
- Företagsnamn (svenskt och eventuellt utländskt)
- Organisationsform (AB, HB, KB, etc.)
- Juridisk form
- SNI-koder med beskrivningar (branschklassificering)
- Postadress
- Registreringsdatum
- Aktiv/inaktiv status
- Verksamhetsbeskrivning (om tillgänglig)

OBS: Endast organisationsnummer stöds - namnsökning är inte tillgänglig via detta API.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      org_number: {
        type: 'string',
        description: 'Svenskt organisationsnummer (10 siffror, t.ex. 5560743089 för Volvo Cars)',
        pattern: '^[0-9]{10}$',
      },
    },
    required: ['org_number'],
  },
};

/**
 * Transform raw API response to simplified CompanyInfo
 */
function transformCompanyData(data: CompanyData): CompanyInfo {
  const names = data.organisationsnamn?.organisationsnamnLista || [];
  const primaryName = names.find(n => n.organisationsnamntyp?.kod === '00') || names[0];
  const foreignName = names.find(n => n.organisationsnamntyp?.kod === '01');

  const address = data.postadressOrganisation?.postadress;
  const sniCodes = data.naringsgrenOrganisation?.sni || [];

  return {
    orgNumber: data.organisationsidentitet?.identitetsbeteckning || '',
    name: primaryName?.namn || 'Okänt',
    foreignName: foreignName?.namn,
    organizationForm: data.organisationsform?.klartext || data.organisationsform?.kod || 'Okänd',
    legalForm: data.juridiskForm?.klartext || data.juridiskForm?.kod || 'Okänd',
    sniCodes: sniCodes.map(sni => ({
      code: sni.kod,
      description: sni.klartext,
    })),
    address: {
      street: address?.utdelningsadress || '',
      postalCode: address?.postnummer || '',
      city: address?.postort || '',
      country: address?.land || 'Sverige',
    },
    registrationDate: data.organisationsdatum?.registreringsdatum || '',
    isActive: data.verksamOrganisation?.kod === 'JA' && !data.avregistreradOrganisation,
    deregistrationDate: data.avregistreradOrganisation?.datum,
    businessDescription: data.verksamhetsbeskrivning?.beskrivning,
  };
}

/**
 * Format company info for text output
 */
function formatCompanyInfo(info: CompanyInfo): string {
  const lines: string[] = [];

  lines.push(`# ${info.name}`);
  if (info.foreignName) {
    lines.push(`Utländskt namn: ${info.foreignName}`);
  }
  lines.push('');

  lines.push('## Grunduppgifter');
  lines.push(`- **Organisationsnummer:** ${info.orgNumber}`);
  lines.push(`- **Organisationsform:** ${info.organizationForm}`);
  lines.push(`- **Juridisk form:** ${info.legalForm}`);
  lines.push(`- **Registreringsdatum:** ${info.registrationDate}`);
  lines.push(`- **Status:** ${info.isActive ? '✅ Aktiv' : '❌ Inaktiv'}`);
  if (info.deregistrationDate) {
    lines.push(`- **Avregistreringsdatum:** ${info.deregistrationDate}`);
  }
  lines.push('');

  if (info.businessDescription) {
    lines.push('## Verksamhetsbeskrivning');
    lines.push(info.businessDescription);
    lines.push('');
  }

  if (info.sniCodes.length > 0) {
    lines.push('## Branschkoder (SNI)');
    for (const sni of info.sniCodes) {
      lines.push(`- **${sni.code}:** ${sni.description}`);
    }
    lines.push('');
  }

  lines.push('## Adress');
  lines.push(`${info.address.street}`);
  lines.push(`${info.address.postalCode} ${info.address.city}`);
  if (info.address.country && info.address.country !== 'Sverige') {
    lines.push(info.address.country);
  }

  return lines.join('\n');
}

/**
 * Execute get_company tool
 */
export async function executeGetCompany(
  args: unknown,
  requestId?: string
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const log = requestId ? createRequestLogger(requestId) : logger;

  try {
    // Validate input
    const input = GetCompanyInputSchema.parse(args);
    log.info({ orgNumber: input.org_number }, 'Fetching company info');

    // Get company data
    const client = getBolagsverketClient();
    const data = await client.getCompany(input.org_number, requestId);

    if (!data) {
      throw new NotFoundError('Företag', input.org_number, requestId);
    }

    // Transform and format
    const info = transformCompanyData(data);
    const text = formatCompanyInfo(info);

    log.info({ orgNumber: input.org_number, name: info.name }, 'Company info retrieved');

    return {
      content: [{ type: 'text', text }],
    };

  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        content: [{ type: 'text', text: `Valideringsfel: ${message}` }],
        isError: true,
      };
    }

    if (error instanceof MCPError) {
      return error.toMCPResponse();
    }

    log.error({ error }, 'Unexpected error in get_company');
    return {
      content: [{ type: 'text', text: `Fel: ${error instanceof Error ? error.message : 'Okänt fel'}` }],
      isError: true,
    };
  }
}
