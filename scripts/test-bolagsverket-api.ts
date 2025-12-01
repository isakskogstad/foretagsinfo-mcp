#!/usr/bin/env tsx
/**
 * Quick test of Bolagsverket API
 */

import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root (ES module compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env') });

import { BolagsverketClient } from '../src/clients/bolagsverket-api';

async function testAPI() {
  console.log('🧪 Testing Bolagsverket API\n');

  const client = new BolagsverketClient({
    enableLogging: true,
  });

  try {
    // 1. Ping
    console.log('1️⃣ Testing API connection...');
    const isAlive = await client.ping();
    console.log(`✓ API Status: ${isAlive ? 'ONLINE' : 'OFFLINE'}\n`);

    if (!isAlive) {
      console.error('❌ API is not responding');
      process.exit(1);
    }

    // 2. Search by org number first
    const testOrgId = '5569467466'; // Allgot AB (aktivt företag)
    console.log(`2️⃣ Searching by identitetsbeteckning: ${testOrgId}...`);
    const searchResult = await client.searchOrganizations({
      identitetsbeteckning: testOrgId,
    });

    console.log(`✓ Found ${Array.isArray(searchResult) ? searchResult.length : 1} company(ies)`);
    if (Array.isArray(searchResult) && searchResult.length > 0) {
      console.log('First result:', JSON.stringify(searchResult[0], null, 2));
    } else {
      console.log('Result:', JSON.stringify(searchResult, null, 2));
    }
    console.log('');

    // 3. Get document list
    console.log(`3️⃣ Getting document list for ${testOrgId}...`);
    const documents = await client.getDocumentList(testOrgId);

    console.log(`✓ Found ${documents.length} documents`);
    if (documents.length > 0) {
      console.log('Recent documents:');
      documents.slice(0, 5).forEach((doc, i) => {
        const year = new Date(doc.rapporteringsperiodTom).getFullYear();
        const regDate = doc.registreringstidpunkt.split('T')[0];
        console.log(
          `  ${i + 1}. Year ${year} - Registered: ${regDate} (${doc.filformat})`
        );
      });
    }
    console.log('');

    console.log('✅ All API tests passed!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    if (error.statusCode) {
      console.error('Status code:', error.statusCode);
    }
    process.exit(1);
  }
}

testAPI();
