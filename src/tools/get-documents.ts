/**
 * get_documents tool - Lista tillgängliga dokument för ett företag
 */
import { z } from 'zod';
import { getBolagsverketClient } from '../api-client/bolagsverket.js';
import { GetDocumentsInputSchema } from '../utils/validators.js';
import { MCPError } from '../utils/errors.js';
import { logger, createRequestLogger } from '../utils/logger.js';
import type { DocumentMetadata } from '../api-client/types.js';

export const GET_DOCUMENTS_TOOL = {
  name: 'get_documents',
  description: `Lista tillgängliga årsredovisningar och andra dokument för ett företag.

Returnerar en lista med:
- Dokument-ID (för användning med get_annual_report)
- Rapporteringsperiod (räkenskapsår)
- Filformat (vanligtvis iXBRL ZIP)
- Registreringstidpunkt

OBS: Inte alla företag har digitalt inlämnade årsredovisningar.
Mindre företag och äldre årsredovisningar kanske inte finns tillgängliga.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      org_number: {
        type: 'string',
        description: 'Svenskt organisationsnummer (10 siffror)',
        pattern: '^[0-9]{10}$',
      },
    },
    required: ['org_number'],
  },
};

/**
 * Format document list for text output
 */
function formatDocumentList(documents: DocumentMetadata[], orgNumber: string): string {
  const lines: string[] = [];

  lines.push(`# Tillgängliga dokument för ${orgNumber}`);
  lines.push('');

  if (documents.length === 0) {
    lines.push('Inga digitala dokument hittades för detta företag.');
    lines.push('');
    lines.push('**Möjliga orsaker:**');
    lines.push('- Företaget har inte lämnat in digitala årsredovisningar');
    lines.push('- Årsredovisningarna är för gamla (endast nyare finns digitalt)');
    lines.push('- Företaget är för litet och behöver inte lämna årsredovisning');
    return lines.join('\n');
  }

  // Sort by period end date, newest first
  const sorted = [...documents].sort((a, b) =>
    new Date(b.rapporteringsperiodTom).getTime() - new Date(a.rapporteringsperiodTom).getTime()
  );

  lines.push(`Hittade **${documents.length}** dokument:`);
  lines.push('');

  for (const doc of sorted) {
    const periodYear = new Date(doc.rapporteringsperiodTom).getFullYear();
    const registrationDate = new Date(doc.registreringstidpunkt).toLocaleDateString('sv-SE');

    lines.push(`## Räkenskapsår ${periodYear}`);
    lines.push(`- **Dokument-ID:** \`${doc.dokumentId}\``);
    lines.push(`- **Period t.o.m.:** ${doc.rapporteringsperiodTom}`);
    lines.push(`- **Format:** ${doc.filformat}`);
    lines.push(`- **Registrerad:** ${registrationDate}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('*Använd `get_annual_report` för att hämta och analysera en specifik årsredovisning.*');

  return lines.join('\n');
}

/**
 * Execute get_documents tool
 */
export async function executeGetDocuments(
  args: unknown,
  requestId?: string
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const log = requestId ? createRequestLogger(requestId) : logger;

  try {
    // Validate input
    const input = GetDocumentsInputSchema.parse(args);
    log.info({ orgNumber: input.org_number }, 'Fetching document list');

    // Get document list
    const client = getBolagsverketClient();
    const documents = await client.getDocumentList(input.org_number, requestId);

    // Format output
    const text = formatDocumentList(documents, input.org_number);

    log.info(
      { orgNumber: input.org_number, documentCount: documents.length },
      'Document list retrieved'
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

    log.error({ error }, 'Unexpected error in get_documents');
    return {
      content: [{ type: 'text', text: `Fel: ${error instanceof Error ? error.message : 'Okänt fel'}` }],
      isError: true,
    };
  }
}
