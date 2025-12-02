/**
 * get_board_members tool - Fetch board members and executives from merinfo.se
 */

import { logger } from '../utils/logger.js';
import { GetBoardMembersInputSchema } from '../utils/validators.js';
import { MCPError, ErrorCode } from '../utils/errors.js';
import { merinfoClient, RateLimitError, CompanyNotFoundError, ScrapingError } from '../scrapers/merinfo-client.js';
import { parseCompanyPage, findCompanyLinkFromSearch, parsePersonPage } from '../scrapers/merinfo-parser.js';
import type { BoardMember, BoardMembersResult } from '../api-client/types.js';

/**
 * Tool definition for MCP protocol
 */
export const GET_BOARD_MEMBERS_TOOL = {
  name: 'get_board_members' as const,
  description: `Hämta styrelse och befattningshavare för ett svenskt företag.

Returnerar:
- Styrelseledamöter med namn, ålder, ort och roll
- VD/verkställande direktör
- Tillträdesdatum för respektive befattning
- Länkar till personprofiler (om tillgängliga)

Data hämtas från merinfo.se via webscraping.

Begränsningar:
- Rate limiting tillämpas (max ~20 förfrågningar/minut)
- Kan misslyckas vid hög belastning
- Kräver att företaget finns registrerat hos merinfo.se

Exempel:
- org_number: "5560001551" (Volvo)
- org_number: "556000-4615" (IKEA)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      org_number: {
        type: 'string' as const,
        description: 'Organisationsnummer (10 siffror, med eller utan bindestreck)',
        pattern: '^[0-9]{6}-?[0-9]{4}$',
      },
      include_personal_details: {
        type: 'boolean' as const,
        description: 'Hämta utökade personuppgifter (adress, telefon) - tar längre tid pga extra requests',
        default: false,
      },
    },
    required: ['org_number'],
  },
};

/**
 * Format board members for display
 */
function formatBoardMembersResponse(result: BoardMembersResult): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Styrelse och Befattningshavare`);
  lines.push(`**Företag:** ${result.companyName}`);
  lines.push(`**Organisationsnummer:** ${result.orgNumber}`);
  lines.push('');

  if (result.boardMembers.length === 0) {
    lines.push('*Inga styrelsemedlemmar hittades.*');
  } else {
    // Group by role
    const ceos = result.boardMembers.filter(m =>
      m.roles.some(r => r.toLowerCase().includes('vd') || r.toLowerCase().includes('verkställande'))
    );
    const chairmen = result.boardMembers.filter(m =>
      m.roles.some(r => r.toLowerCase().includes('ordförande'))
    );
    const members = result.boardMembers.filter(m =>
      !ceos.includes(m) && !chairmen.includes(m)
    );

    // VD section
    if (ceos.length > 0) {
      lines.push('## Verkställande Direktör');
      for (const member of ceos) {
        const age = member.age ? ` (${member.age} år)` : '';
        const city = member.city ? `, ${member.city}` : '';
        const date = member.appointedDate ? ` - Tillträdd: ${member.appointedDate}` : '';
        lines.push(`- **${member.name}**${age}${city}${date}`);
      }
      lines.push('');
    }

    // Chairman section
    if (chairmen.length > 0) {
      lines.push('## Styrelseordförande');
      for (const member of chairmen) {
        const age = member.age ? ` (${member.age} år)` : '';
        const city = member.city ? `, ${member.city}` : '';
        const date = member.appointedDate ? ` - Tillträdd: ${member.appointedDate}` : '';
        lines.push(`- **${member.name}**${age}${city}${date}`);
      }
      lines.push('');
    }

    // Other members
    if (members.length > 0) {
      lines.push('## Styrelseledamöter');
      lines.push('');
      lines.push('| Namn | Ålder | Ort | Roll | Tillträdd |');
      lines.push('|------|-------|-----|------|-----------|');

      for (const member of members) {
        const age = member.age?.toString() || '-';
        const city = member.city || '-';
        const roles = member.roles.join(', ') || '-';
        const date = member.appointedDate || '-';
        lines.push(`| ${member.name} | ${age} | ${city} | ${roles} | ${date} |`);
      }
      lines.push('');
    }
  }

  // Footer
  if (result.partial) {
    lines.push('');
    lines.push(`> **Obs:** ${result.error || 'Partiell data - vissa uppgifter kan saknas.'}`);
  }

  lines.push('');
  lines.push('---');
  lines.push(`*Data från ${result.source}, hämtad ${new Date(result.scrapedAt).toLocaleString('sv-SE')}*`);

  return lines.join('\n');
}

/**
 * Execute the get_board_members tool
 */
export async function executeGetBoardMembers(
  args: unknown,
  requestId?: string
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  const childLogger = logger.child({ tool: 'get_board_members', requestId });

  try {
    // Validate input
    const input = GetBoardMembersInputSchema.parse(args);
    const orgNumber = input.org_number;

    childLogger.info({ orgNumber }, 'Fetching board members');

    // Step 1: Search for company
    let $search;
    try {
      $search = await merinfoClient.searchCompany(orgNumber);
    } catch (error) {
      if (error instanceof RateLimitError) {
        childLogger.warn('Rate limit hit');
        return {
          content: [{
            type: 'text',
            text: formatBoardMembersResponse({
              orgNumber,
              companyName: 'Okänt',
              boardMembers: [],
              source: 'merinfo.se',
              scrapedAt: new Date().toISOString(),
              partial: true,
              error: 'Rate limit nådd - försök igen om några minuter.',
            }),
          }],
        };
      }
      throw error;
    }

    // Step 2: Find company link from search results
    const companyLink = findCompanyLinkFromSearch($search, orgNumber);

    if (!companyLink) {
      throw new CompanyNotFoundError(orgNumber);
    }

    childLogger.debug({ companyLink }, 'Found company link');

    // Step 3: Fetch company page
    const $company = await merinfoClient.fetchCompanyPage(companyLink);

    // Step 4: Parse company data
    const companyData = parseCompanyPage($company, orgNumber);

    childLogger.info(
      { memberCount: companyData.boardMembers.length },
      'Parsed board members'
    );

    // Step 5: Optionally fetch extended person details
    let boardMembers = companyData.boardMembers;

    if (input.include_personal_details && boardMembers.length > 0) {
      childLogger.info('Fetching extended personal details');

      const enhancedMembers: BoardMember[] = [];

      for (const member of boardMembers) {
        if (member.profileUrl) {
          try {
            // Extract path from full URL
            const url = new URL(member.profileUrl);
            const $person = await merinfoClient.fetchPersonPage(url.pathname);
            const personDetails = parsePersonPage($person);

            enhancedMembers.push({
              ...member,
              age: personDetails.age || member.age,
              city: personDetails.address?.city || member.city,
            });

            childLogger.debug({ name: member.name }, 'Fetched personal details');
          } catch (error) {
            // Continue with basic info if person page fails
            childLogger.warn(
              { name: member.name, error },
              'Failed to fetch personal details'
            );
            enhancedMembers.push(member);
          }
        } else {
          enhancedMembers.push(member);
        }
      }

      boardMembers = enhancedMembers;
    }

    // Build result
    const result: BoardMembersResult = {
      orgNumber,
      companyName: companyData.name,
      boardMembers,
      source: 'merinfo.se',
      scrapedAt: companyData.scrapedAt,
    };

    return {
      content: [{ type: 'text', text: formatBoardMembersResponse(result) }],
    };
  } catch (error) {
    childLogger.error({ error }, 'Failed to get board members');

    if (error instanceof RateLimitError) {
      return {
        content: [{
          type: 'text',
          text: 'Sökgräns nådd på merinfo.se. Försök igen om några minuter.',
        }],
        isError: true,
      };
    }

    if (error instanceof CompanyNotFoundError) {
      return {
        content: [{
          type: 'text',
          text: `Företaget hittades inte på merinfo.se. Kontrollera organisationsnumret.`,
        }],
        isError: true,
      };
    }

    if (error instanceof ScrapingError) {
      return {
        content: [{
          type: 'text',
          text: `Fel vid hämtning av data: ${error.message}`,
        }],
        isError: true,
      };
    }

    if (error instanceof MCPError) {
      return error.toMCPResponse();
    }

    // Unexpected error
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Oväntat fel: ${message}` }],
      isError: true,
    };
  }
}
