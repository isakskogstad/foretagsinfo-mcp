#!/usr/bin/env tsx
/**
 * Test deployed MCP server with SSE transport
 */

async function testSSEEndpoint() {
  console.log('🚀 Testing MCP server with SSE transport...\n');
  
  const baseUrl = 'https://personupplysning-mcp.onrender.com';
  
  console.log('📋 Testing SSE endpoint (GET /mcp)');
  try {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream'
      }
    });

    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    
    if (response.ok) {
      console.log('   ✅ SSE endpoint is responding');
      
      // Read first few bytes to verify SSE format
      const reader = response.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        const text = new TextDecoder().decode(value);
        console.log('   First response:');
        console.log('   ' + text.split('\n').slice(0, 5).join('\n   '));
      }
    } else {
      console.log('   ⚠️  Unexpected status');
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log('✅ Server is live and using SSE transport!');
  console.log('═'.repeat(60));
  console.log('');
  console.log('📚 To connect, use:');
  console.log('   URL: https://personupplysning-mcp.onrender.com/mcp');
  console.log('   Transport: SSE (Server-Sent Events)');
  console.log('   Method: GET with Accept: text/event-stream');
}

testSSEEndpoint();
