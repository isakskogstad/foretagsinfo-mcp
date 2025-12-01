#!/usr/bin/env tsx
/**
 * Verify database connection and data
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyDatabase() {
  console.log('🔍 Verifying database...\n');

  try {
    // Test 1: Count total companies
    console.log('📊 Test 1: Count total companies');
    const { count, error: countError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;
    console.log(`✅ Total companies: ${count?.toLocaleString() || 0}\n`);

    // Test 2: Get sample companies
    console.log('📋 Test 2: Sample companies');
    const { data: samples, error: sampleError } = await supabase
      .from('companies')
      .select('organisationsidentitet, organisationsnamn, organisationsform')
      .limit(5);

    if (sampleError) throw sampleError;
    console.log(`✅ Found ${samples?.length || 0} sample companies:`);
    samples?.forEach((c: any, i: number) => {
      console.log(`   ${i + 1}. ${c.organisationsnamn} (${c.organisationsidentitet}) - ${c.organisationsform}`);
    });
    console.log('');

    // Test 3: Search for IKEA
    console.log('📋 Test 3: Search for "IKEA"');
    const { data: ikeaResults, error: ikeaError } = await supabase
      .from('companies')
      .select('organisationsidentitet, organisationsnamn, organisationsform')
      .ilike('organisationsnamn', '%IKEA%')
      .limit(5);

    if (ikeaError) throw ikeaError;
    console.log(`✅ Found ${ikeaResults?.length || 0} IKEA-related companies:`);
    ikeaResults?.forEach((c: any, i: number) => {
      console.log(`   ${i + 1}. ${c.organisationsnamn} (${c.organisationsidentitet})`);
    });
    console.log('');

    // Test 4: Full-text search (if index exists)
    console.log('📋 Test 4: Full-text search for "IKEA"');
    const { data: ftsResults, error: ftsError } = await supabase
      .from('companies')
      .select('organisationsidentitet, organisationsnamn, organisationsform')
      .textSearch('organisationsnamn', 'IKEA', {
        type: 'websearch',
        config: 'swedish'
      })
      .limit(5);

    if (ftsError) {
      console.log(`⚠️  Full-text search error: ${ftsError.message}`);
      console.log('   (This might mean FTS index needs to be created)\n');
    } else {
      console.log(`✅ Full-text search found ${ftsResults?.length || 0} results:`);
      ftsResults?.forEach((c: any, i: number) => {
        console.log(`   ${i + 1}. ${c.organisationsnamn} (${c.organisationsidentitet})`);
      });
      console.log('');
    }

    console.log('═'.repeat(60));
    console.log('✅ Database verification complete!');
    console.log('═'.repeat(60));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyDatabase();
