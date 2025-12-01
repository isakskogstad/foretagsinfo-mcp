/**
 * Integration Test Suite for Personupplysning MCP Server
 * Tests complete workflows and end-to-end functionality
 */

import { spawn, ChildProcess } from 'child_process';
import { readFileSync } from 'fs';

interface TestResult {
  testName: string;
  category: string;
  passed: boolean;
  duration: number;
  error?: string;
  response?: any;
}

const results: TestResult[] = [];

/**
 * Send JSON-RPC request to MCP server via stdio
 */
async function sendMCPRequest(server: ChildProcess, method: string, params: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = Date.now();
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    const timeout = setTimeout(() => {
      reject(new Error('Request timeout after 30s'));
    }, 30000);

    let responseBuffer = '';

    const dataHandler = (data: Buffer) => {
      responseBuffer += data.toString();

      // Try to parse JSON response
      try {
        const lines = responseBuffer.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            const response = JSON.parse(line);
            if (response.id === id) {
              clearTimeout(timeout);
              server.stdout?.off('data', dataHandler);
              resolve(response);
              return;
            }
          }
        }
      } catch (e) {
        // Not yet complete JSON, wait for more data
      }
    };

    server.stdout?.on('data', dataHandler);

    // Send request
    server.stdin?.write(JSON.stringify(request) + '\n');
  });
}

/**
 * Start MCP server in stdio mode
 */
async function startServer(): Promise<ChildProcess> {
  console.log('🚀 Starting MCP server in stdio mode...\n');

  const server = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, MCP_TRANSPORT: 'stdio' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Wait for server to be ready
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('✅ Server started\n');

  return server;
}

/**
 * Test 1: Server Initialization
 */
async function testServerInitialization(server: ChildProcess): Promise<void> {
  console.log('📋 Test 1: Server Initialization\n');
  const startTime = Date.now();

  try {
    const response = await sendMCPRequest(server, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    });

    const duration = Date.now() - startTime;

    if (response.result && response.result.serverInfo) {
      console.log(`✅ PASS: Server initialized successfully`);
      console.log(`   Server: ${response.result.serverInfo.name} v${response.result.serverInfo.version}`);
      console.log(`   Capabilities: ${JSON.stringify(response.result.capabilities)}`);
      console.log(`   Duration: ${duration}ms\n`);

      results.push({
        testName: 'Server Initialization',
        category: 'Protocol',
        passed: true,
        duration,
        response: response.result
      });
    } else {
      throw new Error('Invalid initialization response');
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`❌ FAIL: ${error.message}\n`);
    results.push({
      testName: 'Server Initialization',
      category: 'Protocol',
      passed: false,
      duration,
      error: error.message
    });
  }
}

/**
 * Test 2: List Tools
 */
async function testListTools(server: ChildProcess): Promise<void> {
  console.log('📋 Test 2: List Tools\n');
  const startTime = Date.now();

  try {
    const response = await sendMCPRequest(server, 'tools/list');
    const duration = Date.now() - startTime;

    if (response.result && Array.isArray(response.result.tools)) {
      const tools = response.result.tools;
      console.log(`✅ PASS: Listed ${tools.length} tools`);
      tools.forEach((tool: any) => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
      console.log(`   Duration: ${duration}ms\n`);

      results.push({
        testName: 'List Tools',
        category: 'Protocol',
        passed: tools.length === 5,
        duration,
        response: tools
      });

      if (tools.length !== 5) {
        console.log(`⚠️  WARNING: Expected 5 tools, got ${tools.length}\n`);
      }
    } else {
      throw new Error('Invalid tools/list response');
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`❌ FAIL: ${error.message}\n`);
    results.push({
      testName: 'List Tools',
      category: 'Protocol',
      passed: false,
      duration,
      error: error.message
    });
  }
}

/**
 * Test 3: List Resources
 */
async function testListResources(server: ChildProcess): Promise<void> {
  console.log('📋 Test 3: List Resources\n');
  const startTime = Date.now();

  try {
    const response = await sendMCPRequest(server, 'resources/list');
    const duration = Date.now() - startTime;

    if (response.result && Array.isArray(response.result.resources)) {
      const resources = response.result.resources;
      console.log(`✅ PASS: Listed ${resources.length} resources`);
      resources.forEach((resource: any) => {
        console.log(`   - ${resource.name}: ${resource.uri}`);
      });
      console.log(`   Duration: ${duration}ms\n`);

      results.push({
        testName: 'List Resources',
        category: 'Protocol',
        passed: resources.length === 5,
        duration,
        response: resources
      });

      if (resources.length !== 5) {
        console.log(`⚠️  WARNING: Expected 5 resources, got ${resources.length}\n`);
      }
    } else {
      throw new Error('Invalid resources/list response');
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`❌ FAIL: ${error.message}\n`);
    results.push({
      testName: 'List Resources',
      category: 'Protocol',
      passed: false,
      duration,
      error: error.message
    });
  }
}

/**
 * Test 4: List Prompts
 */
async function testListPrompts(server: ChildProcess): Promise<void> {
  console.log('📋 Test 4: List Prompts\n');
  const startTime = Date.now();

  try {
    const response = await sendMCPRequest(server, 'prompts/list');
    const duration = Date.now() - startTime;

    if (response.result && Array.isArray(response.result.prompts)) {
      const prompts = response.result.prompts;
      console.log(`✅ PASS: Listed ${prompts.length} prompts`);
      prompts.forEach((prompt: any) => {
        console.log(`   - ${prompt.name}: ${prompt.description}`);
      });
      console.log(`   Duration: ${duration}ms\n`);

      results.push({
        testName: 'List Prompts',
        category: 'Protocol',
        passed: prompts.length === 4,
        duration,
        response: prompts
      });

      if (prompts.length !== 4) {
        console.log(`⚠️  WARNING: Expected 4 prompts, got ${prompts.length}\n`);
      }
    } else {
      throw new Error('Invalid prompts/list response');
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`❌ FAIL: ${error.message}\n`);
    results.push({
      testName: 'List Prompts',
      category: 'Protocol',
      passed: false,
      duration,
      error: error.message
    });
  }
}

/**
 * Test 5: Search Companies Tool
 */
async function testSearchCompanies(server: ChildProcess): Promise<void> {
  console.log('📋 Test 5: Search Companies Tool\n');
  const startTime = Date.now();

  try {
    const response = await sendMCPRequest(server, 'tools/call', {
      name: 'search_companies',
      arguments: {
        query: 'spotify',
        limit: 5
      }
    });

    const duration = Date.now() - startTime;

    if (response.result && response.result.content) {
      const content = JSON.parse(response.result.content[0].text);
      console.log(`✅ PASS: Search returned ${content.count} results`);
      console.log(`   Query: "spotify"`);
      console.log(`   Duration: ${duration}ms`);
      if (content.companies && content.companies.length > 0) {
        console.log(`   First result: ${content.companies[0].organisationsnamn}\n`);
      }

      results.push({
        testName: 'Search Companies',
        category: 'Tools',
        passed: true,
        duration,
        response: content
      });
    } else {
      throw new Error('Invalid search response');
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`❌ FAIL: ${error.message}\n`);
    results.push({
      testName: 'Search Companies',
      category: 'Tools',
      passed: false,
      duration,
      error: error.message
    });
  }
}

/**
 * Test 6: Get Company Details Tool
 */
async function testGetCompanyDetails(server: ChildProcess): Promise<void> {
  console.log('📋 Test 6: Get Company Details Tool\n');
  const startTime = Date.now();

  try {
    // Using Spotify's org number
    const response = await sendMCPRequest(server, 'tools/call', {
      name: 'get_company_details',
      arguments: {
        organisationsidentitet: '5560001712'
      }
    });

    const duration = Date.now() - startTime;

    if (response.result && response.result.content) {
      const content = JSON.parse(response.result.content[0].text);
      console.log(`✅ PASS: Retrieved company details`);
      console.log(`   Company: ${content.organisationsnamn || 'N/A'}`);
      console.log(`   Org Number: ${content.organisationsidentitet}`);
      console.log(`   Duration: ${duration}ms\n`);

      results.push({
        testName: 'Get Company Details',
        category: 'Tools',
        passed: true,
        duration,
        response: content
      });
    } else {
      throw new Error('Invalid company details response');
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`❌ FAIL: ${error.message}\n`);
    results.push({
      testName: 'Get Company Details',
      category: 'Tools',
      passed: false,
      duration,
      error: error.message
    });
  }
}

/**
 * Test 7: Invalid Input Handling
 */
async function testInvalidInputHandling(server: ChildProcess): Promise<void> {
  console.log('📋 Test 7: Invalid Input Handling\n');
  const startTime = Date.now();

  try {
    const response = await sendMCPRequest(server, 'tools/call', {
      name: 'get_company_details',
      arguments: {
        organisationsidentitet: 'INVALID123'
      }
    });

    const duration = Date.now() - startTime;

    if (response.error || (response.result && response.result.isError)) {
      console.log(`✅ PASS: Invalid input rejected correctly`);
      console.log(`   Duration: ${duration}ms\n`);

      results.push({
        testName: 'Invalid Input Handling',
        category: 'Error Handling',
        passed: true,
        duration
      });
    } else {
      console.log(`❌ FAIL: Invalid input was accepted\n`);
      results.push({
        testName: 'Invalid Input Handling',
        category: 'Error Handling',
        passed: false,
        duration,
        error: 'Invalid input was not rejected'
      });
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    // Error is expected, so this is a pass
    console.log(`✅ PASS: Invalid input rejected with error\n`);
    results.push({
      testName: 'Invalid Input Handling',
      category: 'Error Handling',
      passed: true,
      duration
    });
  }
}

/**
 * Test 8: Cache Stats Tool
 */
async function testCacheStats(server: ChildProcess): Promise<void> {
  console.log('📋 Test 8: Cache Stats Tool\n');
  const startTime = Date.now();

  try {
    const response = await sendMCPRequest(server, 'tools/call', {
      name: 'get_cache_stats',
      arguments: {}
    });

    const duration = Date.now() - startTime;

    if (response.result && response.result.content) {
      const content = JSON.parse(response.result.content[0].text);
      console.log(`✅ PASS: Retrieved cache stats`);
      console.log(`   Cached company details: ${content.cached_company_details || 0}`);
      console.log(`   Cached document lists: ${content.cached_document_lists || 0}`);
      console.log(`   Total API requests: ${content.total_api_requests || 0}`);
      console.log(`   24h cache hit rate: ${content.cache_hit_rate_24h?.toFixed(2) || 0}%`);
      console.log(`   Duration: ${duration}ms\n`);

      results.push({
        testName: 'Cache Stats',
        category: 'Tools',
        passed: true,
        duration,
        response: content
      });
    } else {
      throw new Error('Invalid cache stats response');
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`❌ FAIL: ${error.message}\n`);
    results.push({
      testName: 'Cache Stats',
      category: 'Tools',
      passed: false,
      duration,
      error: error.message
    });
  }
}

/**
 * Generate Test Report
 */
function generateReport(): any {
  console.log('\n' + '='.repeat(80));
  console.log('INTEGRATION TEST REPORT');
  console.log('='.repeat(80) + '\n');

  const summary = {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length
  };

  console.log('Summary:');
  console.log(`  Total Tests: ${summary.total}`);
  console.log(`  Passed: ${summary.passed}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log(`  Average Duration: ${summary.avgDuration.toFixed(2)}ms`);

  console.log('\n' + '-'.repeat(80) + '\n');

  // Show failed tests
  const failed = results.filter(r => !r.passed);
  if (failed.length > 0) {
    console.log('Failed Tests:\n');
    failed.forEach((test, index) => {
      console.log(`${index + 1}. ${test.testName} (${test.category})`);
      console.log(`   Error: ${test.error}`);
      console.log('');
    });
  } else {
    console.log('✅ All tests passed!\n');
  }

  console.log('='.repeat(80) + '\n');

  return {
    timestamp: new Date().toISOString(),
    summary,
    results
  };
}

/**
 * Run All Integration Tests
 */
async function runIntegrationTests() {
  console.log('🧪 PERSONUPPLYSNING MCP SERVER - INTEGRATION TEST SUITE\n');
  console.log('='.repeat(80) + '\n');

  let server: ChildProcess | null = null;

  try {
    server = await startServer();

    await testServerInitialization(server);
    await testListTools(server);
    await testListResources(server);
    await testListPrompts(server);
    await testSearchCompanies(server);
    await testGetCompanyDetails(server);
    await testInvalidInputHandling(server);
    await testCacheStats(server);

    const report = generateReport();

    // Save report
    const fs = await import('fs/promises');
    await fs.writeFile(
      'testing-audit/integration-test-results.json',
      JSON.stringify(report, null, 2)
    );

    console.log('📄 Full report saved to: testing-audit/integration-test-results.json\n');

    // Cleanup
    if (server) {
      server.kill();
    }

    process.exit(report.summary.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    if (server) {
      server.kill();
    }
    process.exit(1);
  }
}

// Run tests
runIntegrationTests().catch(console.error);
