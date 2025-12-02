/**
 * Företagsinfo MCP Server - HTTP entry point
 *
 * HTTP server for Render.com deployment.
 * Provides MCP protocol over SSE transport + health/info endpoints.
 */
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { TOOLS, executeTool } from './tools/index.js';
import { listResourceTemplates, readResource } from './resources/index.js';
import { listPrompts, getPromptContent } from './prompts/index.js';
import { getBolagsverketClient } from './api-client/bolagsverket.js';
import { logger } from './utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);

// Server metadata
const SERVER_INFO = {
  name: 'foretagsinfo-mcp',
  version: '1.0.0',
  description: 'MCP server för svensk företagsinformation via Bolagsverkets API',
};

// Track active connections
const activeConnections = new Map<string, SSEServerTransport>();

/**
 * Create MCP server instance
 */
function createMCPServer(): Server {
  const server = new Server(SERVER_INFO, {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  });

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const requestId = crypto.randomUUID();

    logger.info({ tool: name, requestId }, 'Executing tool');

    try {
      return await executeTool(name, args, requestId);
    } catch (error) {
      logger.error({ error, tool: name, requestId }, 'Tool execution failed');
      return {
        content: [
          {
            type: 'text',
            text: `Fel vid körning av ${name}: ${error instanceof Error ? error.message : 'Okänt fel'}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Handle resource template listing
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    return { resourceTemplates: listResourceTemplates() };
  });

  // Handle resource reading
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const requestId = crypto.randomUUID();
    logger.info({ uri, requestId }, 'Reading resource');
    return await readResource(uri, requestId);
  });

  // Handle prompt listing
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: listPrompts() };
  });

  // Handle prompt retrieval
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return getPromptContent(name, args || {});
  });

  return server;
}

/**
 * Handle root endpoint - serve README as HTML
 */
async function handleRoot(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    // Try to read README.md
    const readmePath = join(__dirname, '..', 'README.md');
    let readmeContent: string;

    try {
      readmeContent = await readFile(readmePath, 'utf-8');
    } catch {
      readmeContent = `# Företagsinfo MCP

MCP server för svensk företagsinformation via Bolagsverkets API.

## Endpoints

- \`GET /\` - Denna sida
- \`GET /health\` - Hälsokontroll
- \`GET /mcp\` - MCP SSE endpoint
- \`POST /mcp\` - MCP JSON-RPC endpoint

## Verktyg

- \`get_company\` - Hämta företagsinformation
- \`get_documents\` - Lista tillgängliga dokument
- \`get_annual_report\` - Hämta och analysera årsredovisning

## Användning

Lägg till i din MCP-klient:

\`\`\`json
{
  "mcpServers": {
    "foretagsinfo": {
      "type": "sse",
      "url": "https://foretagsinfo-mcp.onrender.com/mcp"
    }
  }
}
\`\`\`
`;
    }

    // Simple markdown to HTML conversion
    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Företagsinfo MCP</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3 { color: #1a1a1a; }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    pre {
      background: #f4f4f4;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    pre code { padding: 0; background: none; }
    a { color: #0066cc; }
    .badge {
      display: inline-block;
      background: #28a745;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <article>
    ${markdownToHtml(readmeContent)}
  </article>
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666;">
    <p>Företagsinfo MCP v${SERVER_INFO.version}</p>
    <p><a href="/health">Hälsokontroll</a> | <a href="/mcp">MCP Endpoint</a></p>
  </footer>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (error) {
    logger.error({ error }, 'Failed to serve root page');
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

/**
 * Simple markdown to HTML converter
 */
function markdownToHtml(markdown: string): string {
  return markdown
    // Headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Lists
    .replace(/^\- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match;
      return `<p>${match}</p>`;
    });
}

/**
 * Handle health endpoint
 */
async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const client = getBolagsverketClient();
    const apiStatus = await client.ping();

    const health = {
      status: apiStatus ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: SERVER_INFO.version,
      api: {
        bolagsverket: apiStatus ? 'connected' : 'error',
      },
      connections: activeConnections.size,
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };

    res.writeHead(apiStatus ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', error: 'Health check failed' }));
  }
}

/**
 * Handle MCP SSE connection (GET /mcp)
 */
async function handleMCPGet(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const existingSessionId = url.searchParams.get('sessionId');

  // If sessionId provided, this might be a reconnection or the POST endpoint discovery
  if (existingSessionId && activeConnections.has(existingSessionId)) {
    // Return the existing session info
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(`event: endpoint\ndata: /mcp?sessionId=${existingSessionId}\n\n`);
    return;
  }

  const server = createMCPServer();
  const transport = new SSEServerTransport('/mcp', res);

  // Get the sessionId from transport's public getter
  const sessionId = transport.sessionId;
  logger.info({ sessionId }, 'New MCP SSE connection');

  activeConnections.set(sessionId, transport);

  req.on('close', () => {
    logger.info({ sessionId }, 'MCP connection closed');
    activeConnections.delete(sessionId);
  });

  try {
    await server.connect(transport);
  } catch (error) {
    logger.error({ error, sessionId }, 'MCP connection error');
    activeConnections.delete(sessionId);
  }
}

/**
 * Handle MCP JSON-RPC request (POST /mcp)
 */
async function handleMCPPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // Get sessionId from URL query params (primary) or header (fallback)
  const sessionId = url.searchParams.get('sessionId') || req.headers['x-session-id'] as string;

  logger.debug({ sessionId, activeConnections: activeConnections.size }, 'MCP POST request');

  // Find the transport for this session
  const transport = sessionId ? activeConnections.get(sessionId) : null;

  if (!transport) {
    // Parse body to get request id for error response
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }
    let requestId = null;
    try {
      const parsed = JSON.parse(body);
      requestId = parsed.id;
    } catch {
      // Ignore parse errors
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: -32600,
        message: 'Invalid session. Connect via GET /mcp first.',
      },
    }));
    return;
  }

  try {
    // Forward to transport - it handles body parsing
    await transport.handlePostMessage(req, res);
  } catch (error) {
    logger.error({ error }, 'MCP POST handler error');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
      },
    }));
  }
}

/**
 * Main HTTP request handler
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  logger.debug({ method: req.method, path: url.pathname }, 'HTTP request');

  try {
    // Handle /mcp with or without query params
    if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp?')) {
      if (req.method === 'GET') {
        await handleMCPGet(req, res);
      } else if (req.method === 'POST') {
        await handleMCPPost(req, res);
      } else {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
      }
      return;
    }

    switch (url.pathname) {
      case '/':
        await handleRoot(req, res);
        break;

      case '/health':
        await handleHealth(req, res);
        break;

      default:
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
  } catch (error) {
    logger.error({ error, path: url.pathname }, 'Request handler error');
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const server = createHttpServer(handleRequest);

  server.listen(PORT, () => {
    logger.info({ port: PORT, ...SERVER_INFO }, 'HTTP server started');
    console.log(`Företagsinfo MCP server running on port ${PORT}`);
    console.log(`  - Info:   http://localhost:${PORT}/`);
    console.log(`  - Health: http://localhost:${PORT}/health`);
    console.log(`  - MCP:    http://localhost:${PORT}/mcp`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down');
    server.close(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down');
    server.close(() => process.exit(0));
  });
}

main().catch((error) => {
  logger.fatal({ error }, 'Fatal error');
  process.exit(1);
});
