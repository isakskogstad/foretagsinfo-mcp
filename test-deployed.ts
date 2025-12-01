#!/usr/bin/env tsx
/**
 * Test deployed MCP server on Render.com
 */

async function testDeployedServer() {
  console.log('🚀 Testing deployed MCP server...\n');
  
  const baseUrl = 'https://personupplysning-mcp.onrender.com';
  
  // Test 1: Health check
  console.log('📋 Test 1: Health check');
  try {
    const healthResponse = await fetch(`${baseUrl}/health`);
    console.log(`   Status: ${healthResponse.status}`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log(`   ✅ Server is healthy`);
      console.log(`   Response:`, JSON.stringify(health, null, 2));
    } else {
      console.log(`   ⚠️  Status ${healthResponse.status}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');

  // Test 2: MCP endpoint
  console.log('📋 Test 2: MCP endpoint (initialize)');
  try {
    const mcpResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      })
    });

    console.log(`   Status: ${mcpResponse.status}`);
    
    if (mcpResponse.ok) {
      const data = await mcpResponse.json();
      console.log(`   ✅ MCP server responding`);
      console.log(`   Protocol: ${data.result?.protocolVersion}`);
      console.log(`   Server: ${data.result?.serverInfo?.name} v${data.result?.serverInfo?.version}`);
    } else {
      const errorText = await mcpResponse.text();
      console.log(`   ⚠️  Response: ${errorText}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');

  // Test 3: List tools
  console.log('📋 Test 3: List available tools');
  try {
    const toolsResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      })
    });

    if (toolsResponse.ok) {
      const data = await toolsResponse.json();
      console.log(`   ✅ Found ${data.result?.tools?.length || 0} tools:`);
      data.result?.tools?.forEach((tool: any) => {
        console.log(`      - ${tool.name}`);
      });
    } else {
      console.log(`   ⚠️  Status ${toolsResponse.status}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');

  // Test 4: Search companies
  console.log('📋 Test 4: Search for companies (IKEA)');
  try {
    const searchResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search_companies',
          arguments: {
            query: 'IKEA',
            limit: 3
          }
        }
      })
    });

    if (searchResponse.ok) {
      const data = await searchResponse.json();
      const content = data.result?.content?.[0]?.text;
      if (content) {
        const results = JSON.parse(content);
        console.log(`   ✅ Found ${results.total_count} companies`);
        console.log(`   Showing ${results.results?.length || 0} results:`);
        results.results?.forEach((company: any, i: number) => {
          console.log(`      ${i + 1}. ${company.organisationsnamn} (${company.organisationsidentitet})`);
        });
      }
    } else {
      console.log(`   ⚠️  Status ${searchResponse.status}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');

  console.log('═'.repeat(60));
  console.log('✅ Deployment verification complete!');
  console.log('═'.repeat(60));
  console.log('');
  console.log('🎯 Production URL: https://personupplysning-mcp.onrender.com/mcp');
}

testDeployedServer().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
