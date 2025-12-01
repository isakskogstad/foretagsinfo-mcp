#!/usr/bin/env tsx
/**
 * Test script for caching layer
 */

import { companyDataService } from '../src/services/company-data-service';
import 'dotenv/config';

async function testCaching() {
  console.log('🧪 Testing Caching Architecture\n');

  const testOrgId = '5569467466'; // Hundelska AB (aktivt företag)

  try {
    // 1. Test company details (cache-first)
    console.log('1️⃣ Testing getCompanyDetails...');
    console.time('First call (cache miss)');
    const details1 = await companyDataService.getCompanyDetails(testOrgId);
    console.timeEnd('First call (cache miss)');
    const companyName1 = details1?.organisationsnamn?.organisationsnamnLista?.[0]?.namn || 'N/A';
    console.log('✓ Company:', companyName1);

    console.time('Second call (cache hit)');
    const details2 = await companyDataService.getCompanyDetails(testOrgId);
    console.timeEnd('Second call (cache hit)');
    const companyName2 = details2?.organisationsnamn?.organisationsnamnLista?.[0]?.namn || 'N/A';
    console.log('✓ Company (cached):', companyName2);
    console.log('');

    // 2. Test document list
    console.log('2️⃣ Testing getDocumentList...');
    console.time('Document list fetch');
    const docs = await companyDataService.getDocumentList(testOrgId);
    console.timeEnd('Document list fetch');
    console.log(`✓ Found ${docs.length} documents`);
    if (docs.length > 0) {
      console.log('  First document:', docs[0]);
    }
    console.log('');

    // 3. Test search (local first)
    console.log('3️⃣ Testing searchCompanies (local first)...');
    console.time('Search local');
    const searchResults = await companyDataService.searchCompanies('Bonor', 5);
    console.timeEnd('Search local');
    console.log(`✓ Found ${searchResults.length} companies locally`);
    console.log('');

    // 4. Get cache stats
    console.log('4️⃣ Cache Statistics:');
    const stats = await companyDataService.getCacheStats();
    console.log(stats);
    console.log('');

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testCaching();
