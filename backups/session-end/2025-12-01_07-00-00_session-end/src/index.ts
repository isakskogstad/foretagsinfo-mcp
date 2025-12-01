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
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Resource,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Prompt,
  LoggingLevel,
} from '@modelcontextprotocol/sdk/types.js';
import { companyDataService } from './services/company-data-service.js';
import { logger, createLogger, logStartup, logToolExecution, logError, logEnvironmentValidation } from './utils/logger.js';
import { validateEnvironmentOrThrow, validateEnvironment } from './utils/validation.js';
import { toMCPError, MCPError, ValidationError, NotFoundError } from './utils/errors.js';
import {
  validateInput,
  SearchCompaniesInputSchema,
  GetCompanyDetailsInputSchema,
  GetCompanyDocumentsInputSchema,
  GetAnnualReportInputSchema,
  GetCacheStatsInputSchema,
} from './utils/validators.js';
import http from 'http';
import crypto from 'crypto';
import 'dotenv/config';

// Server info
const SERVER_NAME = 'personupplysning-mcp';
const SERVER_VERSION = '0.1.0';

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * MCP Resources Definition
 * Resources expose company data as passive, client-readable URIs
 */
const RESOURCE_TEMPLATES: Resource[] = [
  {
    uri: 'company://search?q={query}&limit={limit}',
    name: 'Company Search Results',
    description: 'Search results from local database (1.85M companies)',
    mimeType: 'application/json',
  },
  {
    uri: 'company://{organisationsidentitet}',
    name: 'Company Details',
    description: 'Detailed company information from Bolagsverket API with cache',
    mimeType: 'application/json',
  },
  {
    uri: 'company://{organisationsidentitet}/documents',
    name: 'Company Documents List',
    description: 'All annual reports and documents for a company',
    mimeType: 'application/json',
  },
  {
    uri: 'company://{organisationsidentitet}/report/{year}',
    name: 'Annual Report',
    description: 'Specific annual report with financial data (year optional)',
    mimeType: 'application/json',
  },
  {
    uri: 'company://stats',
    name: 'Cache Statistics',
    description: 'Server cache statistics and API usage metrics',
    mimeType: 'application/json',
  },
];

/**
 * MCP Prompts Definition
 * Prompts provide reusable templates for common business analysis workflows
 */
const PROMPTS: Prompt[] = [
  {
    name: 'analyze_company_finances',
    description: 'Analyze the financial health of a Swedish company using available data',
    arguments: [
      {
        name: 'organisationsidentitet',
        description: 'Company organization number (10 digits)',
        required: true,
      },
      {
        name: 'year',
        description: 'Fiscal year to analyze (optional, defaults to latest)',
        required: false,
      },
    ],
  },
  {
    name: 'compare_competitors',
    description: 'Compare a company with its competitors in the same industry',
    arguments: [
      {
        name: 'organisationsidentitet',
        description: 'Primary company organization number',
        required: true,
      },
      {
        name: 'competitor_org_numbers',
        description: 'Comma-separated list of competitor org numbers',
        required: true,
      },
    ],
  },
  {
    name: 'find_company_relationships',
    description: 'Find related companies (subsidiaries, parent companies, board connections)',
    arguments: [
      {
        name: 'organisationsidentitet',
        description: 'Company organization number',
        required: true,
      },
    ],
  },
  {
    name: 'generate_company_report',
    description: 'Generate a comprehensive company report including all available data',
    arguments: [
      {
        name: 'organisationsidentitet',
        description: 'Company organization number',
        required: true,
      },
      {
        name: 'include_financials',
        description: 'Include financial analysis (true/false)',
        required: false,
      },
    ],
  },
];

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
  const logger = createLogger(SERVER_NAME);

  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
        logging: {},
      },
    }
  );

  // Helper function to send log notifications
  function sendNotification(level: LoggingLevel, message: string, data?: Record<string, unknown>): void {
    try {
      server.notification({
        method: 'notifications/message',
        params: {
          level,
          logger: SERVER_NAME,
          data: {
            message,
            timestamp: new Date().toISOString(),
            ...(data || {}),
          },
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to send notification');
    }
  }

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCE_TEMPLATES,
  }));

  // Read resource by URI
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    logger.info({ requestId, uri }, 'Resource request received');
    sendNotification('info', 'Reading resource', { requestId, uri });

    try {
      // Parse URI
      const url = new URL(uri);
      const protocol = url.protocol.replace(':', '');
      const path = url.pathname;
      const searchParams = url.searchParams;

      if (protocol !== 'company') {
        throw new Error(`Unsupported protocol: ${protocol}`);
      }

      let content: any;

      // Handle different resource paths
      if (path.startsWith('/search') || url.hostname === 'search') {
        // company://search?q=query&limit=10
        const query = searchParams.get('q') || '';
        const limit = parseInt(searchParams.get('limit') || '10');
        const results = await companyDataService.searchCompanies(query, limit);

        content = {
          query,
          count: results.length,
          companies: results.map((c) => ({
            organisationsidentitet: c.organisationsidentitet,
            organisationsnamn: c.organisationsnamn,
            organisationsform: c.organisationsform,
            status: c.status,
            registreringsdatum: c.registreringsdatum,
          })),
        };
      } else if (path === '/stats' || url.hostname === 'stats') {
        // company://stats
        content = await companyDataService.getCacheStats();
      } else if (path.match(/^\/\d{10}\/documents$/)) {
        // company://5560001712/documents
        const organisationsidentitet = path.split('/')[1];
        const documents = await companyDataService.getDocumentList(organisationsidentitet);

        content = {
          organisationsidentitet,
          count: documents.length,
          documents: documents.map((d) => ({
            dokumentId: d.dokumentId,
            filformat: d.filformat,
            rapporteringsperiodTom: d.rapporteringsperiodTom,
            registreringstidpunkt: d.registreringstidpunkt,
            year: new Date(d.rapporteringsperiodTom).getFullYear(),
          })),
        };
      } else if (path.match(/^\/\d{10}\/report\/\d{4}$/)) {
        // company://5560001712/report/2023
        const parts = path.split('/');
        const organisationsidentitet = parts[1];
        const year = parseInt(parts[3]);
        const report = await companyDataService.getAnnualReport(organisationsidentitet, year);

        content = {
          organisationsidentitet,
          year,
          storagePath: report.storagePath,
          financialData: report.data,
        };
      } else if (path.match(/^\/\d{10}$/)) {
        // company://5560001712
        const organisationsidentitet = path.substring(1);
        const details = await companyDataService.getCompanyDetails(organisationsidentitet);

        if (!details) {
          throw new Error(`Company not found: ${organisationsidentitet}`);
        }

        content = details;
      } else {
        throw new Error(`Unsupported resource path: ${uri}`);
      }

      const duration = Date.now() - startTime;
      logger.info({ requestId, uri, duration }, 'Resource request completed');
      sendNotification('info', 'Resource read successfully', { requestId, uri, duration });

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(content, null, 2),
          },
        ],
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error({ requestId, uri, error, duration }, 'Resource request failed');
      sendNotification('error', 'Resource read failed', {
        requestId,
        uri,
        error: error.message,
      });

      throw error;
    }
  });

  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS,
  }));

  // Get prompt template with arguments
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const requestId = crypto.randomUUID();

    logger.info({ requestId, promptName: name, args }, 'Prompt request received');
    sendNotification('info', 'Generating prompt', { requestId, promptName: name });

    try {
      let messages: any[] = [];

      switch (name) {
        case 'analyze_company_finances': {
          const { organisationsidentitet, year } = args as {
            organisationsidentitet: string;
            year?: string;
          };

          const details = await companyDataService.getCompanyDetails(organisationsidentitet);
          const documents = await companyDataService.getDocumentList(organisationsidentitet);

          messages = [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Analyze the financial health of ${details?.organisationsnamn || 'the company'} (org: ${organisationsidentitet}).

Available data:
- Company details: ${JSON.stringify(details, null, 2)}
- Available reports: ${documents.length} documents

${year ? `Focus on fiscal year ${year}.` : 'Use the most recent fiscal year.'}

Please analyze:
1. Financial position (assets, liabilities, equity)
2. Profitability trends
3. Cash flow analysis
4. Key financial ratios
5. Risk factors and concerns
6. Overall financial health assessment`,
              },
            },
          ];
          break;
        }

        case 'compare_competitors': {
          const { organisationsidentitet, competitor_org_numbers } = args as {
            organisationsidentitet: string;
            competitor_org_numbers: string;
          };

          const competitors = competitor_org_numbers.split(',').map((id) => id.trim());
          const primaryCompany = await companyDataService.getCompanyDetails(organisationsidentitet);
          const competitorData = await Promise.all(
            competitors.map((id) => companyDataService.getCompanyDetails(id))
          );

          messages = [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Compare ${primaryCompany?.organisationsnamn || 'the primary company'} with its competitors.

Primary company:
${JSON.stringify(primaryCompany, null, 2)}

Competitors:
${competitorData.map((c, i) => `${i + 1}. ${c?.organisationsnamn || competitors[i]}\n${JSON.stringify(c, null, 2)}`).join('\n\n')}

Please compare:
1. Company size and structure
2. Financial performance
3. Market position
4. Strengths and weaknesses
5. Competitive advantages
6. Risk factors`,
              },
            },
          ];
          break;
        }

        case 'find_company_relationships': {
          const { organisationsidentitet } = args as { organisationsidentitet: string };
          const details = await companyDataService.getCompanyDetails(organisationsidentitet);

          messages = [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Find and analyze relationships for ${details?.organisationsnamn || 'the company'} (org: ${organisationsidentitet}).

Company data:
${JSON.stringify(details, null, 2)}

Please identify:
1. Parent company relationships
2. Subsidiary companies
3. Board member connections
4. Sister companies
5. Business partnerships
6. Ownership structure

Note: Use the company data to find any listed relationships in the Bolagsverket data.`,
              },
            },
          ];
          break;
        }

        case 'generate_company_report': {
          const { organisationsidentitet, include_financials } = args as {
            organisationsidentitet: string;
            include_financials?: string;
          };

          const details = await companyDataService.getCompanyDetails(organisationsidentitet);
          const documents = await companyDataService.getDocumentList(organisationsidentitet);
          const includeFinancials = include_financials === 'true';

          let reportData = `Generate a comprehensive company report for ${details?.organisationsnamn || 'the company'} (org: ${organisationsidentitet}).

## Company Information
${JSON.stringify(details, null, 2)}

## Available Documents
Total: ${documents.length} annual reports`;

          if (includeFinancials && documents.length > 0) {
            const latestYear = Math.max(
              ...documents.map((d) => new Date(d.rapporteringsperiodTom).getFullYear())
            );
            const report = await companyDataService.getAnnualReport(organisationsidentitet, latestYear);
            reportData += `\n\n## Financial Data (${latestYear})
${JSON.stringify(report.data, null, 2)}`;
          }

          messages = [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `${reportData}

Please create a comprehensive report including:
1. Executive Summary
2. Company Background
3. Business Overview
${includeFinancials ? '4. Financial Analysis\n5. Risk Assessment\n6. Recommendations' : '4. Organizational Structure\n5. Key Insights'}`,
              },
            },
          ];
          break;
        }

        default:
          throw new Error(`Unknown prompt: ${name}`);
      }

      sendNotification('info', 'Prompt generated successfully', { requestId, promptName: name });

      return {
        messages,
      };
    } catch (error: any) {
      logger.error({ requestId, promptName: name, error }, 'Prompt generation failed');
      sendNotification('error', 'Prompt generation failed', {
        requestId,
        promptName: name,
        error: error.message,
      });

      throw error;
    }
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    logger.info({ requestId, toolName: name, args }, 'Tool request received');
    sendNotification('info', 'Executing tool', { requestId, toolName: name });

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
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const isDevelopment = process.env.NODE_ENV === 'development';
      const mcpError = toMCPError(error, requestId);

      logger.error(
        {
          requestId,
          toolName: name,
          error: mcpError.toJSON(true),
          duration
        },
        'Tool execution failed'
      );

      sendNotification('error', 'Tool execution failed', {
        requestId,
        toolName: name,
        error: mcpError.message,
        code: mcpError.code,
        duration,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(mcpError.toJSON(isDevelopment), null, 2),
          },
        ],
        isError: true,
      };
    } finally {
      const duration = Date.now() - startTime;
      logger.info({ requestId, toolName: name, duration }, 'Tool request completed');
      sendNotification('info', 'Tool execution completed', { requestId, toolName: name, duration });
    }
  });

  return server;
}

/**
 * Start server in HTTP mode (for Render deployment)
 * Pattern based on Kolada-MCP implementation
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

    // MCP endpoint - Supports both GET (SSE) and POST (JSON-RPC)
    if (req.url === '/mcp') {
      // GET /mcp - SSE transport for streaming
      if (req.method === 'GET') {
        console.log('MCP SSE connection established');

        // Create new server instance per connection
        const server = createServer();
        const transport = new SSEServerTransport('/mcp', res);

        await server.connect(transport);

        req.on('close', () => {
          console.log('MCP SSE connection closed');
        });

        return;
      }

      // POST /mcp - Direct JSON-RPC (not implemented yet, but reserved)
      if (req.method === 'POST') {
        res.writeHead(501, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'JSON-RPC mode not implemented',
          message: 'Use SSE transport (GET /mcp) instead'
        }));
        return;
      }
    }

    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not found',
      endpoints: {
        health: '/',
        mcp: '/mcp (GET for SSE, POST for JSON-RPC)'
      }
    }));
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
  const logger = createLogger(SERVER_NAME);

  // Validate environment - will throw if invalid
  try {
    validateEnvironmentOrThrow();
    logger.info('Environment variables validated successfully');
  } catch (error) {
    if (error instanceof MCPError) {
      logger.error({ error: error.toJSON(true) }, 'Environment validation failed');
      console.error('\n❌ Environment validation failed:');
      console.error(`   ${error.message}\n`);
    } else {
      logger.error({ error }, 'Unexpected error during environment validation');
      console.error('\n❌ Unexpected error:', error);
    }
    process.exit(1);
  }

  const mode = process.env.MCP_TRANSPORT || 'stdio';

  if (mode === 'http') {
    await startHTTPServer();
  } else {
    await startStdioServer();
  }
}

main().catch((error) => {
  const logger = createLogger(SERVER_NAME);
  logger.error({ error }, 'Fatal error during startup');
  console.error('Fatal error:', error);
  process.exit(1);
});
