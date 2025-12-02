/**
 * get_annual_report tool - Hämta och analysera årsredovisning
 */
import { z } from 'zod';
import { getBolagsverketClient } from '../api-client/bolagsverket.js';
import { GetAnnualReportInputSchema } from '../utils/validators.js';
import { NotFoundError, MCPError } from '../utils/errors.js';
import { logger, createRequestLogger } from '../utils/logger.js';
import { parseIXBRL, formatAnnualReport } from '../utils/ixbrl-parser.js';
import type { AnnualReportData } from '../api-client/types.js';

export const GET_ANNUAL_REPORT_TOOL = {
  name: 'get_annual_report',
  description: `Hämta och analysera en årsredovisning för ett företag.

Extraherar finansiell data från iXBRL-filer inklusive:

**Resultaträkning:**
- Nettoomsättning
- Rörelseresultat
- Resultat efter finansiella poster
- Årets resultat

**Balansräkning:**
- Summa tillgångar
- Anläggningstillgångar
- Omsättningstillgångar
- Eget kapital
- Långfristiga skulder
- Kortfristiga skulder

**Nyckeltal:**
- Soliditet (%)
- Medelantal anställda

**Ledning:**
- Styrelseledamöter
- VD

Om inget år anges hämtas den senaste tillgängliga årsredovisningen.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      org_number: {
        type: 'string',
        description: 'Svenskt organisationsnummer (10 siffror)',
        pattern: '^[0-9]{10}$',
      },
      year: {
        type: 'number',
        description: 'Räkenskapsår att hämta (valfritt, senaste om ej angivet)',
        minimum: 1900,
        maximum: 2100,
      },
    },
    required: ['org_number'],
  },
};

/**
 * Format annual report for text output with more details
 */
function formatDetailedReport(
  data: AnnualReportData,
  orgNumber: string,
  periodEnd: string
): string {
  const lines: string[] = [];
  const year = new Date(periodEnd).getFullYear();

  lines.push(`# Årsredovisning ${year}`);
  lines.push(`**Organisationsnummer:** ${orgNumber}`);
  lines.push('');

  if (data.period.from && data.period.to) {
    lines.push(`**Räkenskapsperiod:** ${data.period.from} – ${data.period.to}`);
    lines.push('');
  }

  // Income statement
  const income = data.incomeStatement;
  if (Object.keys(income).length > 0) {
    lines.push('## Resultaträkning');
    lines.push('');
    lines.push('| Post | Belopp (SEK) |');
    lines.push('|------|-------------|');

    if (income.revenue !== undefined) {
      lines.push(`| Nettoomsättning | ${formatNumber(income.revenue)} |`);
    }
    if (income.operatingResult !== undefined) {
      lines.push(`| Rörelseresultat | ${formatNumber(income.operatingResult)} |`);
    }
    if (income.financialResult !== undefined) {
      lines.push(`| Resultat efter fin. poster | ${formatNumber(income.financialResult)} |`);
    }
    if (income.netIncome !== undefined) {
      lines.push(`| **Årets resultat** | **${formatNumber(income.netIncome)}** |`);
    }
    lines.push('');
  }

  // Balance sheet
  const balance = data.balanceSheet;
  if (Object.keys(balance).length > 0) {
    lines.push('## Balansräkning');
    lines.push('');

    // Assets
    lines.push('### Tillgångar');
    lines.push('| Post | Belopp (SEK) |');
    lines.push('|------|-------------|');

    if (balance.fixedAssets !== undefined) {
      lines.push(`| Anläggningstillgångar | ${formatNumber(balance.fixedAssets)} |`);
    }
    if (balance.currentAssets !== undefined) {
      lines.push(`| Omsättningstillgångar | ${formatNumber(balance.currentAssets)} |`);
    }
    if (balance.totalAssets !== undefined) {
      lines.push(`| **Summa tillgångar** | **${formatNumber(balance.totalAssets)}** |`);
    }
    lines.push('');

    // Equity & Liabilities
    lines.push('### Eget kapital och skulder');
    lines.push('| Post | Belopp (SEK) |');
    lines.push('|------|-------------|');

    if (balance.equity !== undefined) {
      lines.push(`| Eget kapital | ${formatNumber(balance.equity)} |`);
    }
    if (balance.longTermLiabilities !== undefined) {
      lines.push(`| Långfristiga skulder | ${formatNumber(balance.longTermLiabilities)} |`);
    }
    if (balance.currentLiabilities !== undefined) {
      lines.push(`| Kortfristiga skulder | ${formatNumber(balance.currentLiabilities)} |`);
    }
    lines.push('');
  }

  // Key metrics
  const metrics = data.keyMetrics;
  if (Object.keys(metrics).length > 0) {
    lines.push('## Nyckeltal');
    lines.push('');

    if (metrics.solidityPercent !== undefined) {
      const solidityEmoji = metrics.solidityPercent >= 30 ? '✅' : metrics.solidityPercent >= 20 ? '⚠️' : '❌';
      lines.push(`- **Soliditet:** ${metrics.solidityPercent}% ${solidityEmoji}`);
    }
    if (metrics.employees !== undefined) {
      lines.push(`- **Medelantal anställda:** ${metrics.employees}`);
    }
    lines.push('');

    // Add interpretation
    if (metrics.solidityPercent !== undefined) {
      lines.push('*Soliditet = Eget kapital / Totala tillgångar. ');
      if (metrics.solidityPercent >= 30) {
        lines.push('Över 30% anses som god finansiell styrka.*');
      } else if (metrics.solidityPercent >= 20) {
        lines.push('20-30% är acceptabelt men bör övervakas.*');
      } else {
        lines.push('Under 20% indikerar hög skuldsättning.*');
      }
      lines.push('');
    }
  }

  // Management
  const mgmt = data.management;
  if (mgmt.boardMembers.length > 0 || mgmt.ceo) {
    lines.push('## Ledning');
    lines.push('');

    if (mgmt.ceo) {
      lines.push(`**Verkställande direktör:** ${mgmt.ceo}`);
      lines.push('');
    }

    if (mgmt.boardMembers.length > 0) {
      lines.push('**Styrelse:**');
      for (const member of mgmt.boardMembers) {
        lines.push(`- ${member}`);
      }
      lines.push('');
    }
  }

  // Footer
  lines.push('---');
  lines.push('*Data extraherad från digital årsredovisning (iXBRL) via Bolagsverket.*');

  return lines.join('\n');
}

/**
 * Format number with Swedish locale
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('sv-SE').format(value);
}

/**
 * Execute get_annual_report tool
 */
export async function executeGetAnnualReport(
  args: unknown,
  requestId?: string
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const log = requestId ? createRequestLogger(requestId) : logger;

  try {
    // Validate input
    const input = GetAnnualReportInputSchema.parse(args);
    log.info({ orgNumber: input.org_number, year: input.year }, 'Fetching annual report');

    // Get annual report
    const client = getBolagsverketClient();
    const result = await client.getAnnualReport(input.org_number, input.year, requestId);

    if (!result) {
      const yearText = input.year ? ` för år ${input.year}` : '';
      throw new NotFoundError(
        'Årsredovisning',
        `${input.org_number}${yearText}`,
        requestId
      );
    }

    // Parse iXBRL
    log.debug('Parsing iXBRL document');
    const reportData = await parseIXBRL(result.document, requestId);

    // Format output
    const text = formatDetailedReport(
      reportData,
      input.org_number,
      result.metadata.rapporteringsperiodTom
    );

    log.info(
      {
        orgNumber: input.org_number,
        period: result.metadata.rapporteringsperiodTom,
        hasRevenue: !!reportData.incomeStatement.revenue,
      },
      'Annual report parsed'
    );

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

    log.error({ error }, 'Unexpected error in get_annual_report');
    return {
      content: [{ type: 'text', text: `Fel: ${error instanceof Error ? error.message : 'Okänt fel'}` }],
      isError: true,
    };
  }
}
