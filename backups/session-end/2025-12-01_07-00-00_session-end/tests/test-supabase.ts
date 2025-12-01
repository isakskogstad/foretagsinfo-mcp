#!/usr/bin/env tsx
/**
 * Test Supabase Connection and Setup
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testSupabase() {
  console.log('🧪 Testing Supabase connection...\n');

  try {
    // Test 1: Check if companies table exists
    console.log('1️⃣  Checking if companies table exists...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('companies')
      .select('count', { count: 'exact', head: true });

    if (tableError) {
      if (tableError.code === '42P01') {
        console.log('⚠️  Companies table does not exist yet');
        console.log('\n📋 Please run the following SQL in Supabase SQL Editor:');
        console.log('https://thjwryuhtwlfxwduyqqd.supabase.co/project/thjwryuhtwlfxwduyqqd/sql/new');
        console.log('\nCopy and paste from: scripts/schema.sql\n');
        process.exit(1);
      }
      throw tableError;
    }

    const count = (tableCheck as any)?.count || 0;
    console.log(`✓ Companies table exists with ${count.toLocaleString()} rows\n`);

    // Test 2: Test query performance
    if (count > 0) {
      console.log('2️⃣  Testing query performance...');
      const start = Date.now();
      const { data: sampleData, error: queryError } = await supabase
        .from('companies')
        .select('organisationsidentitet, organisationsnamn, organisationsform')
        .limit(10);

      if (queryError) throw queryError;

      const queryTime = Date.now() - start;
      console.log(`✓ Query returned ${sampleData.length} rows in ${queryTime}ms`);
      console.log('Sample company:', sampleData[0]);
      console.log();
    }

    // Test 3: Test text search
    if (count > 0) {
      console.log('3️⃣  Testing text search...');
      const searchStart = Date.now();
      const { data: searchResults, error: searchError } = await supabase
        .from('companies')
        .select('organisationsidentitet, organisationsnamn')
        .ilike('organisationsnamn', '%Jonas%')
        .limit(5);

      if (searchError) throw searchError;

      const searchTime = Date.now() - searchStart;
      console.log(`✓ Text search found ${searchResults.length} companies in ${searchTime}ms`);
      if (searchResults.length > 0) {
        console.log('First result:', searchResults[0].organisationsnamn);
      }
      console.log();
    }

    // Test 4: Check GDPR audit log table
    console.log('4️⃣  Checking GDPR audit log table...');
    const { error: auditError } = await supabase
      .from('gdpr_audit_log')
      .select('count', { count: 'exact', head: true });

    if (auditError) {
      console.log('⚠️  GDPR audit log table does not exist');
    } else {
      console.log('✓ GDPR audit log table exists\n');
    }

    // Test 5: Check Merinfo cache table
    console.log('5️⃣  Checking Merinfo cache table...');
    const { error: cacheError } = await supabase
      .from('merinfo_cache')
      .select('count', { count: 'exact', head: true });

    if (cacheError) {
      console.log('⚠️  Merinfo cache table does not exist');
    } else {
      console.log('✓ Merinfo cache table exists\n');
    }

    console.log('=' .repeat(60));
    if (count === 0) {
      console.log('⚠️  Database schema is ready but NO DATA imported yet');
      console.log('\nNext step: Import Parquet data');
      console.log('  npm run db:import\n');
    } else {
      console.log('✅ ALL TESTS PASSED');
      console.log(`\n📊 Database ready with ${count.toLocaleString()} companies`);
    }
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testSupabase();
