/**
 * Test local MCP server
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const BASE_URL = process.argv[2] || 'http://localhost:3457/mcp';

async function testMCP() {
  console.log(`🧪 Testing MCP at: ${BASE_URL}\n`);

  const transport = new SSEClientTransport(new URL(BASE_URL));
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    console.log('Connecting...');
    await client.connect(transport);
    console.log('✅ Connected!\n');

    // List tools
    console.log('📋 Tools:');
    const tools = await client.listTools();
    for (const tool of tools.tools) {
      console.log(`   - ${tool.name}`);
    }

    // Test get_company
    console.log('\n🔧 Testing get_company (Volvo - 5560743089)...');
    const result = await client.callTool({
      name: 'get_company',
      arguments: { org_number: '5560743089' },
    });

    if (result.content[0]?.type === 'text') {
      console.log('✅ Result:');
      console.log(result.content[0].text.substring(0, 500));
      console.log('...(truncated)\n');
    }

    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

testMCP();
