#!/usr/bin/env tsx
/**
 * Quick MCP Server Test
 * Tests basic functionality of the Personupplysning MCP Server
 */

import { spawn } from 'child_process';
import readline from 'readline';

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

class MCPClient {
  private process: any;
  private messageId = 1;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private rl: readline.Interface;

  constructor() {
    console.log('🚀 Starting MCP Server...\n');

    // Start the MCP server in stdio mode
    this.process = spawn('node', ['dist/index.js'], {
      env: { ...process.env, MCP_TRANSPORT: 'stdio' },
      stdio: ['pipe', 'pipe', 'inherit']
    });

    this.rl = readline.createInterface({
      input: this.process.stdout,
      crlfDelay: Infinity
    });

    this.rl.on('line', (line) => {
      try {
        const response: JSONRPCResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);

        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch (err) {
        // Ignore parsing errors (could be logs)
      }
    });

    this.process.on('error', (err: Error) => {
      console.error('❌ Process error:', err.message);
    });
  }

  async sendRequest(method: string, params?: any): Promise<any> {
    const id = this.messageId++;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process.stdin.write(JSON.stringify(request) + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async close() {
    this.process.kill();
  }
}

async function runTests() {
  const client = new MCPClient();

  try {
    // Give server time to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 1: Initialize
    console.log('📋 Test 1: Initialize connection');
    const initResult = await client.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    });
    console.log('✅ Server initialized');
    console.log(`   Protocol: ${initResult.protocolVersion}`);
    console.log(`   Server: ${initResult.serverInfo?.name} v${initResult.serverInfo?.version}\n`);

    // Test 2: List tools
    console.log('📋 Test 2: List available tools');
    const toolsResult = await client.sendRequest('tools/list');
    console.log(`✅ Found ${toolsResult.tools?.length || 0} tools:`);
    toolsResult.tools?.forEach((tool: any) => {
      console.log(`   - ${tool.name}`);
    });
    console.log('');

    // Test 3: List resources
    console.log('📋 Test 3: List available resources');
    const resourcesResult = await client.sendRequest('resources/list');
    console.log(`✅ Found ${resourcesResult.resources?.length || 0} resources:`);
    resourcesResult.resources?.forEach((resource: any) => {
      console.log(`   - ${resource.uri}`);
    });
    console.log('');

    // Test 4: List prompts
    console.log('📋 Test 4: List available prompts');
    const promptsResult = await client.sendRequest('prompts/list');
    console.log(`✅ Found ${promptsResult.prompts?.length || 0} prompts:`);
    promptsResult.prompts?.forEach((prompt: any) => {
      console.log(`   - ${prompt.name}`);
    });
    console.log('');

    // Test 5: Search companies
    console.log('📋 Test 5: Search for companies (query: "IKEA")');
    const searchResult = await client.sendRequest('tools/call', {
      name: 'search_companies',
      arguments: {
        query: 'IKEA',
        limit: 3
      }
    });

    if (searchResult.content?.[0]?.text) {
      const data = JSON.parse(searchResult.content[0].text);
      console.log(`✅ Found ${data.total_count} companies`);
      console.log(`   Showing ${data.results?.length || 0} results:`);
      data.results?.forEach((company: any, i: number) => {
        console.log(`   ${i + 1}. ${company.organisationsnamn} (${company.organisationsidentitet})`);
      });
      console.log('');

      // Test 6: Get company details (if we found any)
      if (data.results?.[0]?.organisationsidentitet) {
        const orgId = data.results[0].organisationsidentitet;
        console.log(`📋 Test 6: Get company details (${orgId})`);

        const detailsResult = await client.sendRequest('tools/call', {
          name: 'get_company_details',
          arguments: {
            organisationsidentitet: orgId
          }
        });

        if (detailsResult.content?.[0]?.text) {
          const detailsData = JSON.parse(detailsResult.content[0].text);
          console.log(`✅ Company details retrieved`);
          console.log(`   Name: ${detailsData.organisationsnamn}`);
          console.log(`   Form: ${detailsData.organisationsform}`);
          console.log(`   Status: ${detailsData.status || 'Active'}`);
          console.log('');
        }
      }
    }

    // Test 7: Cache stats
    console.log('📋 Test 7: Get cache statistics');
    const statsResult = await client.sendRequest('tools/call', {
      name: 'get_cache_stats',
      arguments: {
        include_details: false
      }
    });

    if (statsResult.content?.[0]?.text) {
      const stats = JSON.parse(statsResult.content[0].text);
      console.log('✅ Cache statistics:');
      console.log(`   Local DB: ${stats.local_database?.total_companies?.toLocaleString()} companies`);
      console.log(`   Details cache: ${stats.company_details_cache?.total_entries || 0} entries`);
      console.log(`   Hit rate: ${stats.cache_summary?.estimated_hit_rate || 'N/A'}`);
      console.log('');
    }

    console.log('🎉 All tests passed!\n');
    console.log('═'.repeat(60));
    console.log('✅ MCP Server is working correctly!');
    console.log('═'.repeat(60));

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run tests
runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
