#!/usr/bin/env tsx
/**
 * Test DuckDB Parquet reading
 *
 * Verifies that we can:
 * 1. Connect to DuckDB
 * 2. Read Parquet file directly
 * 3. Query company data
 * 4. Measure performance
 */

import { Database } from 'duckdb-async';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PARQUET_PATH = join(__dirname, '../data/bolagsverket_data.parquet');

async function testDuckDB() {
  console.log('🦆 Testing DuckDB with Bolagsverket dataset...\n');

  const db = await Database.create(':memory:');

  try {
    // Test 1: Load Parquet file
    console.log('📂 Loading Parquet file...');
    const startLoad = Date.now();
    await db.run(`
      CREATE TABLE companies AS
      SELECT * FROM read_parquet('${PARQUET_PATH}')
    `);
    const loadTime = Date.now() - startLoad;
    console.log(`✓ Loaded in ${loadTime}ms\n`);

    // Test 2: Count total companies
    console.log('🔢 Counting companies...');
    const startCount = Date.now();
    const countResult = await db.all('SELECT COUNT(*) as count FROM companies');
    const countTime = Date.now() - startCount;
    const totalCompanies = countResult[0].count;
    console.log(`✓ Total companies: ${totalCompanies.toLocaleString()}`);
    console.log(`✓ Query time: ${countTime}ms\n`);

    // Test 3: Search by company name
    console.log('🔍 Testing company name search...');
    const startSearch = Date.now();
    const searchResult = await db.all(`
      SELECT
        organisationsidentitet,
        organisationsnamn,
        organisationsform,
        registreringsdatum,
        verksamhetsbeskrivning
      FROM companies
      WHERE organisationsnamn LIKE '%Jonas%'
      LIMIT 10
    `);
    const searchTime = Date.now() - startSearch;
    console.log(`✓ Found ${searchResult.length} companies matching 'Jonas'`);
    console.log(`✓ Query time: ${searchTime}ms`);
    console.log('First result:', {
      orgNr: searchResult[0]?.organisationsidentitet,
      name: searchResult[0]?.organisationsnamn?.split('$')[0],
      form: searchResult[0]?.organisationsform,
      regDate: searchResult[0]?.registreringsdatum
    });
    console.log();

    // Test 4: Filter by status (active companies)
    console.log('📊 Counting active companies...');
    const startActive = Date.now();
    const activeResult = await db.all(`
      SELECT COUNT(*) as count
      FROM companies
      WHERE avregistreringsdatum IS NULL
    `);
    const activeTime = Date.now() - startActive;
    const activeCompanies = activeResult[0].count;
    console.log(`✓ Active companies: ${activeCompanies.toLocaleString()} (${((activeCompanies / totalCompanies) * 100).toFixed(1)}%)`);
    console.log(`✓ Query time: ${activeTime}ms\n`);

    // Test 5: Aggregate by organization type
    console.log('📈 Top 5 organization types...');
    const startAgg = Date.now();
    const aggResult = await db.all(`
      SELECT
        organisationsform,
        COUNT(*) as count
      FROM companies
      GROUP BY organisationsform
      ORDER BY count DESC
      LIMIT 5
    `);
    const aggTime = Date.now() - startAgg;
    console.log('✓ Results:');
    aggResult.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.organisationsform}: ${row.count.toLocaleString()}`);
    });
    console.log(`✓ Query time: ${aggTime}ms\n`);

    // Test 6: Find bankruptcies in 2024
    console.log('💔 Counting bankruptcies in 2024...');
    const startBankrupt = Date.now();
    const bankruptResult = await db.all(`
      SELECT COUNT(*) as count
      FROM companies
      WHERE avregistreringsdatum BETWEEN '2024-01-01' AND '2024-12-31'
        AND avregistreringsorsak LIKE '%KK%'
    `);
    const bankruptTime = Date.now() - startBankrupt;
    console.log(`✓ Bankruptcies: ${bankruptResult[0].count.toLocaleString()}`);
    console.log(`✓ Query time: ${bankruptTime}ms\n`);

    // Summary
    console.log('=' .repeat(60));
    console.log('✅ ALL TESTS PASSED\n');
    console.log('Performance Summary:');
    console.log(`  • Load Parquet:      ${loadTime}ms`);
    console.log(`  • Count query:       ${countTime}ms`);
    console.log(`  • Text search:       ${searchTime}ms`);
    console.log(`  • Filter query:      ${activeTime}ms`);
    console.log(`  • Aggregate query:   ${aggTime}ms`);
    console.log(`  • Bankruptcy query:  ${bankruptTime}ms`);
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

testDuckDB().catch(console.error);
