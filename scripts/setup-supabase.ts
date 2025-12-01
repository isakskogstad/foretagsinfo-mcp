#!/usr/bin/env tsx
/**
 * Setup Supabase Database Schema for Personupplysning MCP
 *
 * Creates tables, indexes, and RLS policies for:
 * 1. companies - Bolagsverket company data (1.88M rows)
 * 2. gdpr_audit_log - GDPR compliance logging
 * 3. merinfo_cache - Cached scraping results
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_v0_8824bb420f61e620f2a99aa9461ab6bf2e7fe902';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to execute SQL via REST API
async function executeSql(sql: string): Promise<any> {
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!projectRef) throw new Error('Could not extract project ref from URL');

  const response = await axios.post(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    { query: sql },
    {
      headers: {
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database schema...\n');

  try {
    // Step 1: Enable pg_trgm extension for full-text search
    console.log('📦 Enabling pg_trgm extension...');
    const { error: extError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
    });
    if (extError) console.warn('⚠️  Extension might already exist:', extError.message);
    console.log('✓ pg_trgm enabled\n');

    // Step 2: Create companies table
    console.log('📊 Creating companies table...');
    const { error: companiesError } = await supabase.rpc('exec_sql', {
      sql: `
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

        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_companies_orgidentitet ON public.companies(organisationsidentitet);
        CREATE INDEX IF NOT EXISTS idx_companies_namn ON public.companies USING GIN (organisationsnamn gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_companies_form ON public.companies(organisationsform);
        CREATE INDEX IF NOT EXISTS idx_companies_avregistrering ON public.companies(avregistreringsdatum) WHERE avregistreringsdatum IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_companies_aktiv ON public.companies(organisationsidentitet) WHERE avregistreringsdatum IS NULL;

        -- Full-text search index
        CREATE INDEX IF NOT EXISTS idx_companies_fts ON public.companies USING GIN (
          to_tsvector('swedish',
            COALESCE(organisationsnamn, '') || ' ' ||
            COALESCE(verksamhetsbeskrivning, '')
          )
        );
      `
    });
    if (companiesError) throw companiesError;
    console.log('✓ Companies table created with indexes\n');

    // Step 3: Create GDPR audit log table
    console.log('🔒 Creating GDPR audit log table...');
    const { error: auditError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.gdpr_audit_log (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          query TEXT NOT NULL,
          purpose TEXT NOT NULL CHECK (purpose IN ('journalistik', 'rekrytering', 'kreditprövning', 'affärsutveckling')),
          data_sources TEXT[] NOT NULL,
          result_count INTEGER,
          timestamp TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_audit_user_timestamp ON public.gdpr_audit_log(user_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.gdpr_audit_log(timestamp DESC);
      `
    });
    if (auditError) throw auditError;
    console.log('✓ GDPR audit log created\n');

    // Step 4: Create Merinfo cache table
    console.log('💾 Creating Merinfo cache table...');
    const { error: cacheError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.merinfo_cache (
          id BIGSERIAL PRIMARY KEY,
          org_nummer TEXT UNIQUE NOT NULL,
          data JSONB NOT NULL,
          cached_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
        );

        CREATE INDEX IF NOT EXISTS idx_cache_org ON public.merinfo_cache(org_nummer);
        CREATE INDEX IF NOT EXISTS idx_cache_expiry ON public.merinfo_cache(expires_at) WHERE expires_at > NOW();
      `
    });
    if (cacheError) throw cacheError;
    console.log('✓ Merinfo cache created\n');

    // Step 5: Enable RLS
    console.log('🔐 Enabling Row Level Security...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.gdpr_audit_log ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.merinfo_cache ENABLE ROW LEVEL SECURITY;

        -- Companies: Public read access
        CREATE POLICY IF NOT EXISTS "Public read access for companies"
          ON public.companies FOR SELECT
          USING (true);

        -- GDPR Log: Service role only
        CREATE POLICY IF NOT EXISTS "Service role access for audit log"
          ON public.gdpr_audit_log FOR ALL
          USING (auth.role() = 'service_role');

        -- Cache: Service role only
        CREATE POLICY IF NOT EXISTS "Service role access for cache"
          ON public.merinfo_cache FOR ALL
          USING (auth.role() = 'service_role');
      `
    });
    if (rlsError) throw rlsError;
    console.log('✓ RLS policies created\n');

    // Step 6: Create helper functions
    console.log('⚙️  Creating helper functions...');
    const { error: funcError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Function to search companies by name (fuzzy)
        CREATE OR REPLACE FUNCTION search_companies_fuzzy(
          search_term TEXT,
          limit_count INTEGER DEFAULT 20
        )
        RETURNS TABLE (
          organisationsidentitet TEXT,
          organisationsnamn TEXT,
          organisationsform TEXT,
          similarity_score REAL
        )
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RETURN QUERY
          SELECT
            c.organisationsidentitet,
            c.organisationsnamn,
            c.organisationsform,
            similarity(c.organisationsnamn, search_term) as similarity_score
          FROM public.companies c
          WHERE c.organisationsnamn % search_term
          ORDER BY similarity_score DESC
          LIMIT limit_count;
        END;
        $$;

        -- Function to get active companies count
        CREATE OR REPLACE FUNCTION get_active_companies_count()
        RETURNS BIGINT
        LANGUAGE sql
        AS $$
          SELECT COUNT(*) FROM public.companies WHERE avregistreringsdatum IS NULL;
        $$;
      `
    });
    if (funcError) throw funcError;
    console.log('✓ Helper functions created\n');

    console.log('=' .repeat(60));
    console.log('✅ Database setup complete!\n');
    console.log('Next steps:');
    console.log('1. Run: npm run db:import    (Import Parquet data)');
    console.log('2. Run: npm run test:supabase (Test database)');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
