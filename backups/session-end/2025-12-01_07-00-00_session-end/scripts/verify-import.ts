#!/usr/bin/env tsx
/**
 * Verify import success
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('📊 Verifierar import...\n');

  // Count total companies
  const { count, error } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Total företag importerade: ${count?.toLocaleString('sv-SE')}`);

  // Sample some companies
  const { data: samples } = await supabase
    .from('companies')
    .select('organisationsidentitet, organisationsnamn, organisationsform')
    .limit(5);

  console.log('\n📋 Exempel på importerade företag:');
  samples?.forEach((c, i) => {
    console.log(`${i + 1}. ${c.organisationsnamn} (${c.organisationsidentitet}) - ${c.organisationsform || 'N/A'}`);
  });

  // Check index performance
  const start = Date.now();
  const { data: searchResult } = await supabase
    .from('companies')
    .select('organisationsnamn')
    .ilike('organisationsnamn', '%AB%')
    .limit(1);
  const searchTime = Date.now() - start;

  console.log(`\n⚡ Sökprestanda: ${searchTime}ms (index fungerar: ${searchTime < 100 ? 'JA ✓' : 'NEJ ✗'})`);
}

verify();
