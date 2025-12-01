#!/usr/bin/env tsx
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyNewIndexes() {
  console.log('🔍 Verifying new optimization indexes...\n');

  const expectedIndexes = [
    'idx_companies_form_active',
    'idx_companies_reg_date_active',
    'idx_companies_form_namn',
    'idx_companies_postadress_prefix',
    'idx_companies_fts_namn',
    'idx_companies_fts_beskrivning',
    'idx_companies_fts_active',
    'idx_companies_created_brin',
    'idx_financial_org_year',
    'idx_financial_with_metrics'
  ];

  const { data: allStats, error } = await supabase.rpc('get_index_stats');
  
  if (error) {
    console.error('❌ Error calling get_index_stats:', error.message);
    return;
  }

  console.log('📊 Checking for optimization indexes:\n');
  
  let foundCount = 0;
  for (const idxName of expectedIndexes) {
    const found = allStats?.find((s: any) => s.indexname === idxName);
    if (found) {
      console.log(`   ✅ ${idxName} (${found.size_mb})`);
      foundCount++;
    } else {
      console.log(`   ❌ ${idxName} - NOT FOUND`);
    }
  }

  console.log('');
  console.log(`Found ${foundCount}/${expectedIndexes.length} optimization indexes`);
  
  // Check materialized view
  console.log('\n🔍 Checking materialized view...\n');
  const { count, error: viewError } = await supabase
    .from('company_financial_summary')
    .select('*', { count: 'exact', head: true });

  if (viewError) {
    console.log('   ❌ company_financial_summary - NOT FOUND');
  } else {
    console.log(`   ✅ company_financial_summary (${count?.toLocaleString() || 0} rows)`);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  if (foundCount === expectedIndexes.length && !viewError) {
    console.log('✅ All optimizations successfully applied!');
  } else {
    console.log('⚠️  Some optimizations are missing');
  }
  console.log('════════════════════════════════════════════════════════════');
}

verifyNewIndexes();
