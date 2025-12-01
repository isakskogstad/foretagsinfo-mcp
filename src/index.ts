#!/usr/bin/env node
/**
 * Personupplysning MCP Server
 *
 * HTTP MCP server för svensk företags- och persondata
 * via Bolagsverket API och Supabase cache
 *
 * Deployment: Render (HTTP mode med SSE transport)
 * Local dev: Stdio mode
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { companyDataService } from './services/company-data-service.js';
import http from 'http';
import 'dotenv/config';

// Server info
const SERVER_NAME = 'personupplysning-mcp';
const SERVER_VERSION = '0.1.0';

/**
 * MCP Tools Definition
 */
const TOOLS: Tool[] = [
  {
    name: 'search_companies',
    description: 'Sök efter svenska företag i lokal databas (1.85M företag). Snabb sökning på företagsnamn eller organisationsnummer.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Sökterm: företagsnamn eller organisationsnummer (10 siffror)'
        },
        limit: {
          type: 'number',
          description: 'Max antal resultat (default: 10)',
          default: 10
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_company_details',
    description: 'Hämta detaljerad företagsinformation från Bolagsverket API med cache-first strategi (30 dagars cache).',
    inputSchema: {
      type: 'object',
      properties: {
        organisationsidentitet: {
          type: 'string',
          description: 'Organisationsnummer (10 siffror)'
        }
      },
      required: ['organisationsidentitet']
    }
  },
  {
    name: 'get_company_documents',
    description: 'Lista alla årsredovisningar och dokument för företag från Bolagsverket (7 dagars cache).',
    inputSchema: {
      type: 'object',
      properties: {
        organisationsidentitet: {
          type: 'string',
          description: 'Organisationsnummer (10 siffror)'
        }
      },
      required: ['organisationsidentitet']
    }
  },
  {
    name: 'get_annual_report',
    description: 'Hämta och parsera årsredovisning för företag. Returnerar finansiell data extraherad från iXBRL-format.',
    inputSchema: {
      type: 'object',
      properties: {
        organisationsidentitet: {
          type: 'string',
          description: 'Organisationsnummer (10 siffror)'
        },
        year: {
          type: 'number',
          description: 'År för årsredovisning (optional, senaste om ej angivet)'
        }
      },
      required: ['organisationsidentitet']
    }
  },
  {
    name: 'get_cache_stats',
    description: 'Visa cache-statistik och API-användning för servern.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

/**
 * Create and configure MCP server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'search_companies': {
          const { query, limit = 10 } = args as { query: string; limit?: number };
          const results = await companyDataService.searchCompanies(query, limit);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  query,
                  count: results.length,
                  companies: results.map(c => ({
                    organisationsidentitet: c.organisationsidentitet,
                    organisationsnamn: c.organisationsnamn,
                    organisationsform: c.organisationsform,
                    status: c.status,
                    registreringsdatum: c.registreringsdatum
                  }))
                }, null, 2)
              }
            ]
          };
        }

        case 'get_company_details': {
          const { organisationsidentitet } = args as { organisationsidentitet: string };
          const details = await companyDataService.getCompanyDetails(organisationsidentitet);

          if (!details) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Inget företag hittades med organisationsnummer: ${organisationsidentitet}`
                }
              ],
              isError: true
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(details, null, 2)
              }
            ]
          };
        }

        case 'get_company_documents': {
          const { organisationsidentitet } = args as { organisationsidentitet: string };
          const documents = await companyDataService.getDocumentList(organisationsidentitet);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  organisationsidentitet,
                  count: documents.length,
                  documents: documents.map(d => ({
                    dokumentId: d.dokumentId,
                    filformat: d.filformat,
                    rapporteringsperiodTom: d.rapporteringsperiodTom,
                    registreringstidpunkt: d.registreringstidpunkt,
                    year: new Date(d.rapporteringsperiodTom).getFullYear()
                  }))
                }, null, 2)
              }
            ]
          };
        }

        case 'get_annual_report': {
          const { organisationsidentitet, year } = args as { organisationsidentitet: string; year?: number };
          const report = await companyDataService.getAnnualReport(organisationsidentitet, year);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  organisationsidentitet,
                  year: year || 'latest',
                  storagePath: report.storagePath,
                  financialData: report.data,
                  note: 'Financial data parsing from iXBRL will be implemented in next phase'
                }, null, 2)
              }
            ]
          };
        }

        case 'get_cache_stats': {
          const stats = await companyDataService.getCacheStats();

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  ...stats,
                  server: {
                    name: SERVER_NAME,
                    version: SERVER_VERSION,
                    uptime: process.uptime()
                  }
                }, null, 2)
              }
            ]
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Okänt verktyg: ${name}`
              }
            ],
            isError: true
          };
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}\n\nStack: ${error.stack}`
          }
        ],
        isError: true
      };
    }
  });

  return server;
}

/**
 * Start server in HTTP mode (for Render deployment)
 */
async function startHTTPServer() {
  const PORT = parseInt(process.env.PORT || '3000');
  const HOST = process.env.HOST || '0.0.0.0';

  const httpServer = http.createServer(async (req, res) => {
    // Health check endpoint
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        server: SERVER_NAME,
        version: SERVER_VERSION,
        uptime: process.uptime(),
        endpoint: '/mcp',
        environment: {
          SUPABASE_URL: process.env.SUPABASE_URL ? 'configured' : 'missing',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing',
          BOLAGSVERKET_CLIENT_ID: process.env.BOLAGSVERKET_CLIENT_ID ? 'configured' : 'missing',
          BOLAGSVERKET_CLIENT_SECRET: process.env.BOLAGSVERKET_CLIENT_SECRET ? 'configured' : 'missing',
        }
      }));
      return;
    }

    // MCP endpoint with SSE transport
    if (req.url === '/mcp' && req.method === 'POST') {
      const server = createServer();
      const transport = new SSEServerTransport('/mcp', res);

      await server.connect(transport);

      // Read request body
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const message = JSON.parse(body);
          // Handle the message through transport
          // SSE transport will handle the response
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });

      return;
    }

    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', endpoints: { health: '/', mcp: '/mcp' } }));
  });

  httpServer.listen(PORT, HOST, () => {
    console.log(`✓ ${SERVER_NAME} v${SERVER_VERSION} running on http://${HOST}:${PORT}`);
    console.log(`✓ Health check: http://${HOST}:${PORT}/health`);
    console.log(`✓ MCP endpoint: http://${HOST}:${PORT}/mcp`);
    console.log('Environment:', {
      NODE_ENV: process.env.NODE_ENV || 'development',
      SUPABASE_URL: process.env.SUPABASE_URL ? '✓ configured' : '✗ missing',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ configured' : '✗ missing',
      BOLAGSVERKET_CLIENT_ID: process.env.BOLAGSVERKET_CLIENT_ID ? '✓ configured' : '✗ missing',
      BOLAGSVERKET_CLIENT_SECRET: process.env.BOLAGSVERKET_CLIENT_SECRET ? '✓ configured' : '✗ missing',
    });
  });
}

/**
 * Start server in stdio mode (for local development)
 */
async function startStdioServer() {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
  console.error('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL ? '✓ configured' : '✗ missing',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ configured' : '✗ missing',
    BOLAGSVERKET_CLIENT_ID: process.env.BOLAGSVERKET_CLIENT_ID ? '✓ configured' : '✗ missing',
    BOLAGSVERKET_CLIENT_SECRET: process.env.BOLAGSVERKET_CLIENT_SECRET ? '✓ configured' : '✗ missing',
  });
}

/**
 * Main function - Start server based on mode
 */
async function main() {
  const mode = process.env.MCP_TRANSPORT || 'stdio';

  if (mode === 'http') {
    await startHTTPServer();
  } else {
    await startStdioServer();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
