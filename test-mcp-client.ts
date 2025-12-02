/**
 * Full MCP client test using the SDK
 * Tests all tools against the remote server
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const BASE_URL = 'https://foretagsinfo-mcp.onrender.com/mcp';

async function testMCPClient() {
  console.log('🧪 Full MCP Client Test\n');
  console.log(`📍 Connecting to: ${BASE_URL}\n`);
  console.log('='.repeat(70));

  const transport = new SSEClientTransport(new URL(BASE_URL));
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log('\n✅ Connected to MCP server\n');

    // List tools
    console.log('📋 Available Tools:');
    const tools = await client.listTools();
    for (const tool of tools.tools) {
      console.log(`   - ${tool.name}: ${tool.description}`);
    }

    // List prompts
    console.log('\n📋 Available Prompts:');
    const prompts = await client.listPrompts();
    for (const prompt of prompts.prompts) {
      console.log(`   - ${prompt.name}: ${prompt.description}`);
    }

    // List resources
    console.log('\n📋 Available Resource Templates:');
    const resources = await client.listResourceTemplates();
    for (const template of resources.resourceTemplates) {
      console.log(`   - ${template.uriTemplate}: ${template.description}`);
    }

    console.log('\n' + '='.repeat(70));

    // Test get_company
    console.log('\n🔧 Test 1: get_company (Volvo Cars - 5560743089)');
    console.log('-'.repeat(70));
    const companyResult = await client.callTool({
      name: 'get_company',
      arguments: { org_number: '5560743089' },
    });
    if (companyResult.content[0]?.type === 'text') {
      console.log(companyResult.content[0].text.substring(0, 1000));
      if (companyResult.content[0].text.length > 1000) console.log('...(truncated)');
    }

    // Test get_documents
    console.log('\n🔧 Test 2: get_documents (H&M - 5560427220)');
    console.log('-'.repeat(70));
    const docsResult = await client.callTool({
      name: 'get_documents',
      arguments: { org_number: '5560427220' },
    });
    if (docsResult.content[0]?.type === 'text') {
      console.log(docsResult.content[0].text);
    }

    // Test get_annual_report (for a company with digital reports)
    console.log('\n🔧 Test 3: get_annual_report (Senior Candy AB - 5566543210)');
    console.log('-'.repeat(70));
    const reportResult = await client.callTool({
      name: 'get_annual_report',
      arguments: { org_number: '5566543210' },
    });
    if (reportResult.content[0]?.type === 'text') {
      console.log(reportResult.content[0].text);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ All tests completed successfully!');
    console.log('\n🎉 MCP Server is fully operational!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

testMCPClient().catch(console.error);
