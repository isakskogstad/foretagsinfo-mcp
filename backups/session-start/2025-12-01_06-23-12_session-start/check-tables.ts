#!/usr/bin/env tsx
/**
 * Check what tables exist in the database
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('🔍 Checking tables in database...\n');

  // Query PostgreSQL information_schema
  const {  data, error } = await supabase
    .from('information_schema.tables')
    .select('table_schema, table_name')
    .eq('table_schema', 'public');

  if (error) {
    console.error('❌ Could not query tables:', error.message);

    // Try alternative method
    console.log('\n📊 Trying to list via pg_catalog...');

    const { data: tables, error: err2 } = await supabase.rpc('get_tables');

    if (err2) {
      console.error('Also failed:', err2.message);
    } else {
      console.log('Tables found:', tables);
    }
  } else {
    console.log('✅ Tables in public schema:');
    console.table(data);
  }
}

checkTables();
