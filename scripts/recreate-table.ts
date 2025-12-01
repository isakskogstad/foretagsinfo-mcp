#!/usr/bin/env tsx
/**
 * Drop and recreate companies table to fix PostgREST cache
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
  console.log('🗑️  Dropping companies table...\n');

  // Drop table
  const { error: dropError } = await supabase.rpc('exec_sql', {
    sql: 'DROP TABLE IF EXISTS public.companies CASCADE;'
  }).catch(() => ({ error: null }));

  console.log('📋 Creating table with proper schema...\n');

  // Create table with all columns
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.companies (
      id BIGSERIAL PRIMARY KEY,
      organisationsidentitet TEXT UNIQUE NOT NULL,
      namnskyddslopnummer TEXT,
      registreringsland TEXT,
      organisationsnamn TEXT NOT NULL,
      organisationsform TEXT,
      avregistreringsdatum DATE,
      avregistreringsorsak TEXT,
      pagandeavvecklingselleromsstruktureringsforfarande TEXT,
      registreringsdatum DATE,
      verksamhetsbeskrivning TEXT,
      postadress TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_companies_orgidentitet ON public.companies(organisationsidentitet);
    CREATE INDEX IF NOT EXISTS idx_companies_namn ON public.companies USING GIN (to_tsvector('swedish', organisationsnamn));

    -- Enable RLS
    ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

    -- Public read policy
    DROP POLICY IF EXISTS "Public read" ON public.companies;
    CREATE POLICY "Public read" ON public.companies FOR SELECT USING (true);

    -- Service role write policy
    DROP POLICY IF EXISTS "Service write" ON public.companies;
    CREATE POLICY "Service write" ON public.companies FOR ALL USING (auth.role() = 'service_role');
  `;

  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: createTableSQL
  }).catch(() => ({ error: null }));

  console.log('✅ Table recreated!\n');
  console.log('🔄 Testing insert to verify cache...\n');

  // Test insert
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
    console.log('❌ Insert test failed:', error.message);
    console.log('\n⚠️  PostgREST cache still not updated. Manual intervention needed.');
    process.exit(1);
  }

  console.log('✅ Insert successful! PostgREST cache is working!');
  console.log('📊 Test record:', data);

  // Clean up test record
  await supabase.from('companies').delete().eq('organisationsidentitet', 'TEST123456');

  console.log('\n🎉 Ready for import!');
}

recreateTable();
