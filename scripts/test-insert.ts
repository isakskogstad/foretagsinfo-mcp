#!/usr/bin/env tsx
/**
 * Test simple insert to force cache refresh
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('Testing direct insert...\n');

  // Try simple insert
  const { data, error } = await supabase
    .from('companies')
    .insert([
      {
        organisationsidentitet: 'TEST123456',
        organisationsnamn: 'Test Company AB',
        organisationsform: 'AB'
      }
    ])
    .select();

  if (error) {
    console.error('❌ Insert failed:', error);
  } else {
    console.log('✅ Insert successful!', data);
  }
}

testInsert();
