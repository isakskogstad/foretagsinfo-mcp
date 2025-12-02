#!/usr/bin/env node
/**
 * Företagsinfo MCP Server - stdio entry point
 *
 * MCP server för svensk företagsinformation via Bolagsverkets API.
 * Används med Claude Desktop och andra MCP-klienter via stdio transport.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
import { logger } from './utils/logger.js';

// Server metadata
const SERVER_INFO = {
  name: 'foretagsinfo-mcp',
  version: '1.0.0',
  description: 'MCP server för svensk företagsinformation via Bolagsverkets API',
};

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
  const server = new Server(SERVER_INFO, {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  });

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Listing tools');
    return { tools: TOOLS };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const requestId = crypto.randomUUID();

    logger.info({ tool: name, requestId }, 'Executing tool');

    try {
      const result = await executeTool(name, args, requestId);
      return result;
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
    logger.debug('Listing resource templates');
    return { resourceTemplates: listResourceTemplates() };
  });

  // Handle resource reading
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const requestId = crypto.randomUUID();

    logger.info({ uri, requestId }, 'Reading resource');

    try {
      return await readResource(uri, requestId);
    } catch (error) {
      logger.error({ error, uri, requestId }, 'Resource read failed');
      throw error;
    }
  });

  // Handle prompt listing
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    logger.debug('Listing prompts');
    return { prompts: listPrompts() };
  });

  // Handle prompt retrieval
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info({ prompt: name }, 'Getting prompt');

    return getPromptContent(name, args || {});
  });

  return server;
}

/**
 * Main entry point
 */
async function main() {
  logger.info(SERVER_INFO, 'Starting Företagsinfo MCP server (stdio)');

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info('Server connected via stdio');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down');
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.fatal({ error }, 'Fatal error');
  process.exit(1);
});
