#!/usr/bin/env tsx
/**
 * Drop and recreate table using raw SQL via Supabase
 * This forces PostgREST to recognize it
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { autoRefreshToken: false, persistSession: false }
});

async function recreateTable() {
  console.log('🗑️  Dropping existing companies table...\n');

  // Drop table via RPC (if function exists)
  try {
    await supabase.rpc('exec_sql', {
      sql: 'DROP TABLE IF EXISTS public.companies CASCADE;'
    });
  } catch (e) {
    // Function doesn't exist, that's ok - table will be dropped via dashboard
    console.log('Note: exec_sql RPC not available (this is normal)');
  }

  console.log('\n📋 Please manually recreate the table via Supabase Dashboard:');
  console.log('\n1. Go to: https://supabase.com/dashboard/project/thjwryuhtwlfxwduyqqd/editor');
  console.log('2. Table Editor → New table');
  console.log('3. Table name: companies');
  console.log('4. Add columns:');
  console.log('   - organisationsidentitet (text, unique)');
  console.log('   - namnskyddslopnummer (text)');
  console.log('   - registreringsland (text)');
  console.log('   - organisationsnamn (text)');
  console.log('   - organisationsform (text)');
  console.log('   - avregistreringsdatum (date)');
  console.log('   - avregistreringsorsak (text)');
  console.log('   - pagandeavvecklingselleromsstruktureringsforfarande (text)');
  console.log('   - registreringsdatum (date)');
  console.log('   - verksamhetsbeskrivning (text)');
  console.log('   - postadress (text)');
  console.log('\n5. Enable RLS: Yes');
  console.log('6. Save');
  console.log('\nALTERNATIVE: Run schema.sql in SQL Editor instead!');
}

recreateTable();
