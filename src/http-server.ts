#!/usr/bin/env node
/**
 * Personupplysning MCP HTTP Server
 *
 * Express-based HTTP server with JSON-RPC 2.0 over HTTP POST
 * for Model Context Protocol (MCP)
 */

import express from 'express';
import cors from 'cors';
import { companyDataService } from './services/company-data-service.js';
import { logger, createLogger } from './utils/logger.js';
import { validateEnvironmentOrThrow } from './utils/validation.js';
import { toMCPError } from './utils/errors.js';
import {
  validateInput,
  SearchCompaniesInputSchema,
  GetCompanyDetailsInputSchema,
  GetCompanyDocumentsInputSchema,
  GetAnnualReportInputSchema,
  GetCacheStatsInputSchema,
} from './utils/validators.js';
import 'dotenv/config';

// Server info
const SERVER_NAME = 'personupplysning-mcp';
const SERVER_VERSION = '0.1.0';
const PORT = process.env.PORT || 3000;

// Validate environment on startup
validateEnvironmentOrThrow();

const app = express();
const serverLogger = createLogger(SERVER_NAME);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));
app.use(express.json());

// Tools definition
const TOOLS = [
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

// Resources definition
const RESOURCES = [
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

// Prompts definition
const PROMPTS = [
  {
    name: 'analyze_company_finances',
    description: 'Analyze the financial health of a Swedish company using available data',
    arguments: [
      {
        name: 'organisationsidentitet',
        description: 'Company organization number (10 digits)',
        required: true,
      },
    ],
  },
  {
    name: 'compare_companies',
    description: 'Compare financial metrics between multiple Swedish companies',
    arguments: [
      {
        name: 'company_ids',
        description: 'Comma-separated list of organization numbers',
        required: true,
      },
    ],
  },
  {
    name: 'industry_overview',
    description: 'Generate an overview of companies in a specific Swedish industry',
    arguments: [
      {
        name: 'industry_query',
        description: 'Industry name or keyword (e.g., "tech", "retail")',
        required: true,
      },
      {
        name: 'limit',
        description: 'Number of companies to analyze (default: 10)',
        required: false,
      },
    ],
  },
];

// GET /mcp - Server information endpoint
app.get('/mcp', (req, res) => {
  res.json({
    protocol: 'mcp',
    version: SERVER_VERSION,
    name: SERVER_NAME,
    description: 'Swedish company data via Bolagsverket API and Supabase cache (1.85M companies)',
    authentication: 'none',
    transport: 'http',
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
    connection: {
      method: 'POST',
      endpoint: '/mcp',
      content_type: 'application/json',
      format: 'MCP JSON-RPC 2.0',
    },
  });
});

// Main MCP endpoint - handles JSON-RPC requests
app.post('/mcp', async (req, res) => {
  try {
    const { jsonrpc, id, method, params } = req.body;

    // Validate JSON-RPC version
    if (jsonrpc !== '2.0') {
      return res.status(200).json({
        jsonrpc: '2.0',
        id: id || null,
        error: {
          code: -32600,
          message: 'Invalid Request: jsonrpc must be "2.0"',
        },
      });
    }

    // Handle initialize method
    if (method === 'initialize') {
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
        },
      });
    }

    // Handle initialized notification (no response per JSON-RPC spec)
    if (method === 'notifications/initialized') {
      return res.status(204).end();
    }

    // Handle tools/list
    if (method === 'tools/list') {
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS,
        },
      });
    }

    // Handle tools/call
    if (method === 'tools/call') {
      const { name, arguments: args } = params;

      try {
        let result;

        switch (name) {
          case 'search_companies': {
            const validated = validateInput(SearchCompaniesInputSchema, args);
            const searchResult = await companyDataService.searchCompanies(
              validated.query,
              validated.limit || 10
            );
            result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(searchResult, null, 2),
                },
              ],
            };
            break;
          }

          case 'get_company_details': {
            const validated = validateInput(GetCompanyDetailsInputSchema, args);
            const details = await companyDataService.getCompanyDetails(
              validated.organisationsidentitet
            );
            result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(details, null, 2),
                },
              ],
            };
            break;
          }

          case 'get_company_documents': {
            const validated = validateInput(GetCompanyDocumentsInputSchema, args);
            const documents = await companyDataService.getCompanyDocuments(
              validated.organisationsidentitet
            );
            result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(documents, null, 2),
                },
              ],
            };
            break;
          }

          case 'get_annual_report': {
            const validated = validateInput(GetAnnualReportInputSchema, args);
            const report = await companyDataService.getAnnualReport(
              validated.organisationsidentitet,
              validated.year
            );
            result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(report, null, 2),
                },
              ],
            };
            break;
          }

          case 'get_cache_stats': {
            validateInput(GetCacheStatsInputSchema, args);
            const stats = await companyDataService.getCacheStats();
            result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(stats, null, 2),
                },
              ],
            };
            break;
          }

          default:
            return res.status(200).json({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Unknown tool: ${name}`,
              },
            });
        }

        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          result,
        });
      } catch (error) {
        const mcpError = toMCPError(error);
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          error: {
            code: mcpError.code,
            message: mcpError.message,
          },
        });
      }
    }

    // Handle resources/list
    if (method === 'resources/list') {
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          resources: RESOURCES,
        },
      });
    }

    // Handle resources/read
    if (method === 'resources/read') {
      const { uri } = params;

      try {
        const url = new URL(uri);
        const protocol = url.protocol.replace(':', '');

        if (protocol !== 'company') {
          return res.status(200).json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Unsupported protocol: ${protocol}`,
            },
          });
        }

        const path = url.pathname;
        const searchParams = url.searchParams;
        let content;

        // Handle different resource URIs
        if (path === '/search') {
          const query = searchParams.get('q');
          const limit = parseInt(searchParams.get('limit') || '10', 10);
          if (!query) {
            throw new Error('Missing query parameter');
          }
          content = await companyDataService.searchCompanies(query, limit);
        } else if (path === '/stats') {
          content = await companyDataService.getCacheStats();
        } else if (path.match(/^\/\d{10}$/)) {
          const orgId = path.substring(1);
          content = await companyDataService.getCompanyDetails(orgId);
        } else if (path.match(/^\/\d{10}\/documents$/)) {
          const orgId = path.split('/')[1];
          content = await companyDataService.getCompanyDocuments(orgId);
        } else if (path.match(/^\/\d{10}\/report\/\d{4}$/)) {
          const parts = path.split('/');
          const orgId = parts[1];
          const year = parseInt(parts[3], 10);
          content = await companyDataService.getAnnualReport(orgId, year);
        } else if (path.match(/^\/\d{10}\/report$/)) {
          const orgId = path.split('/')[1];
          content = await companyDataService.getAnnualReport(orgId);
        } else {
          return res.status(200).json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Invalid resource path: ${path}`,
            },
          });
        }

        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(content, null, 2),
              },
            ],
          },
        });
      } catch (error) {
        const mcpError = toMCPError(error);
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          error: {
            code: mcpError.code,
            message: mcpError.message,
          },
        });
      }
    }

    // Handle prompts/list
    if (method === 'prompts/list') {
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          prompts: PROMPTS,
        },
      });
    }

    // Handle prompts/get
    if (method === 'prompts/get') {
      const { name, arguments: args } = params;

      const prompt = PROMPTS.find((p) => p.name === name);
      if (!prompt) {
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: `Prompt not found: ${name}`,
          },
        });
      }

      // Generate prompt messages based on the prompt name
      let messages;

      switch (name) {
        case 'analyze_company_finances':
          messages = [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Analysera den finansiella hälsan för företaget med organisationsnummer ${args.organisationsidentitet}. Använd get_company_details och get_annual_report för att hämta data. Inkludera nyckeltal som omsättning, resultat, soliditet och kassaflöde.`,
              },
            },
          ];
          break;

        case 'compare_companies':
          messages = [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Jämför företagen med organisationsnummer ${args.company_ids}. Använd get_company_details och get_annual_report för varje företag. Jämför nyckeltal som omsättning, resultat, antal anställda och tillväxt.`,
              },
            },
          ];
          break;

        case 'industry_overview':
          messages = [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Skapa en branschöversikt för "${args.industry_query}". Använd search_companies för att hitta ${args.limit || 10} relevanta företag, sedan get_company_details för att analysera varje företag. Sammanfatta branschens tillstånd och identifiera ledande aktörer.`,
              },
            },
          ];
          break;

        default:
          return res.status(200).json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Unknown prompt: ${name}`,
            },
          });
      }

      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          messages,
        },
      });
    }

    // Method not found (HTTP 200 per JSON-RPC 2.0 spec)
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    });
  } catch (error) {
    serverLogger.error('Error handling request:', error);
    // JSON-RPC errors use HTTP 200 (application-level error)
    return res.status(200).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint - simple info page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Personupplysning MCP Server</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      line-height: 1.6;
      color: #24292e;
      background: #f6f8fa;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }
    h1 {
      font-size: 2em;
      border-bottom: 1px solid #eaecef;
      padding-bottom: 0.3em;
      margin-bottom: 16px;
    }
    h2 {
      font-size: 1.5em;
      margin-top: 24px;
      margin-bottom: 16px;
    }
    p {
      margin-bottom: 16px;
    }
    code {
      background: #f6f8fa;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'Consolas', monospace;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      background: #0366d6;
      color: white;
      border-radius: 3px;
      font-size: 12px;
      margin-right: 8px;
    }
    .links {
      margin: 24px 0;
      padding: 12px;
      background: #f1f8ff;
      border: 1px solid #c8e1ff;
      border-radius: 6px;
    }
    .links a {
      color: #0366d6;
      text-decoration: none;
      margin-right: 16px;
    }
    .links a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Personupplysning MCP Server</h1>
    <div class="links">
      <span class="badge">v${SERVER_VERSION}</span>
      <a href="/mcp">API Endpoint</a>
      <a href="/health">Health Check</a>
    </div>

    <h2>Overview</h2>
    <p>
      Model Context Protocol (MCP) server providing access to Swedish company data
      via Bolagsverket API and Supabase cache with 1.85M companies.
    </p>

    <h2>Features</h2>
    <ul>
      <li>Search 1.85M Swedish companies by name or organization number</li>
      <li>Fetch detailed company information from Bolagsverket API</li>
      <li>Access annual reports and financial data in iXBRL format</li>
      <li>Intelligent cache-first strategy (30-day cache for details)</li>
      <li>Full MCP protocol support: Tools, Resources, and Prompts</li>
    </ul>

    <h2>Connection</h2>
    <p>
      <strong>Endpoint:</strong> <code>POST /mcp</code><br>
      <strong>Protocol:</strong> MCP JSON-RPC 2.0<br>
      <strong>Transport:</strong> HTTP POST
    </p>

    <h2>Tools</h2>
    <ul>
      <li><code>search_companies</code> - Search local database</li>
      <li><code>get_company_details</code> - Fetch from Bolagsverket API</li>
      <li><code>get_company_documents</code> - List annual reports</li>
      <li><code>get_annual_report</code> - Parse financial data</li>
      <li><code>get_cache_stats</code> - Cache statistics</li>
    </ul>
  </div>
</body>
</html>
  `);
});

// Start server
app.listen(PORT, () => {
  serverLogger.info(`${SERVER_NAME} v${SERVER_VERSION} running on port ${PORT}`);
  serverLogger.info(`Info endpoint: http://localhost:${PORT}/mcp`);
  serverLogger.info(`Health check: http://localhost:${PORT}/health`);
});
