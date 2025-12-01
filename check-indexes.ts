#!/usr/bin/env tsx
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIndexes() {
  console.log('🔍 Checking database indexes...\n');

  // Check for new indexes
  const { data: indexes, error } = await supabase
    .rpc('get_index_stats');

  if (error) {
    console.log('⚠️  get_index_stats function not found - running basic check...\n');
    
    // Fallback: count indexes directly
    const { data: indexList, error: indexError } = await supabase
      .from('pg_indexes')
      .select('indexname')
      .eq('schemaname', 'public')
      .eq('tablename', 'companies');

    if (indexError) {
      console.error('❌ Error:', indexError.message);
      return;
    }

    console.log(`✅ Found ${indexList?.length || 0} indexes on companies table:`);
    indexList?.forEach((idx: any, i: number) => {
      console.log(`   ${i + 1}. ${idx.indexname}`);
    });
    return;
  }

  console.log('✅ Index statistics:');
  console.log(`   Total indexes tracked: ${indexes?.length || 0}`);
  console.log('');
  
  console.log('📊 Top 5 most used indexes:');
  indexes?.slice(0, 5).forEach((idx: any, i: number) => {
    console.log(`   ${i + 1}. ${idx.indexname}`);
    console.log(`      Scans: ${idx.idx_scan.toLocaleString()}`);
    console.log(`      Size: ${idx.size_mb}`);
    console.log('');
  });
}

checkIndexes();
