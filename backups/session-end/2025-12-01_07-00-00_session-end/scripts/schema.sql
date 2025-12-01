-- =====================================================
-- Personupplysning MCP Database Schema
-- =====================================================
-- Run this in Supabase SQL Editor:
-- https://thjwryuhtwlfxwduyqqd.supabase.co/project/thjwryuhtwlfxwduyqqd/sql/new
-- =====================================================

-- Step 1: Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 2: Create companies table
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

-- Step 3: Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_companies_orgidentitet ON public.companies(organisationsidentitet);
CREATE INDEX IF NOT EXISTS idx_companies_namn ON public.companies USING GIN (organisationsnamn gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_form ON public.companies(organisationsform);
CREATE INDEX IF NOT EXISTS idx_companies_avregistrering ON public.companies(avregistreringsdatum) WHERE avregistreringsdatum IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_aktiv ON public.companies(organisationsidentitet) WHERE avregistreringsdatum IS NULL;

-- Full-text search index (Swedish language)
CREATE INDEX IF NOT EXISTS idx_companies_fts ON public.companies USING GIN (
  to_tsvector('swedish',
    COALESCE(organisationsnamn, '') || ' ' ||
    COALESCE(verksamhetsbeskrivning, '')
  )
);

-- Step 4: Create GDPR audit log table
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

-- Step 5: Create Merinfo cache table
CREATE TABLE IF NOT EXISTS public.merinfo_cache (
  id BIGSERIAL PRIMARY KEY,
  org_nummer TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_cache_org ON public.merinfo_cache(org_nummer);
CREATE INDEX IF NOT EXISTS idx_cache_expiry ON public.merinfo_cache(expires_at) WHERE expires_at > NOW();

-- Step 6: Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merinfo_cache ENABLE ROW LEVEL SECURITY;

-- Companies: Public read access
DROP POLICY IF EXISTS "Public read access for companies" ON public.companies;
CREATE POLICY "Public read access for companies"
  ON public.companies FOR SELECT
  USING (true);

-- GDPR Log: Service role only
DROP POLICY IF EXISTS "Service role access for audit log" ON public.gdpr_audit_log;
CREATE POLICY "Service role access for audit log"
  ON public.gdpr_audit_log FOR ALL
  USING (auth.role() = 'service_role');

-- Cache: Service role only
DROP POLICY IF NOT EXISTS "Service role access for cache" ON public.merinfo_cache;
CREATE POLICY "Service role access for cache"
  ON public.merinfo_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Step 7: Create helper functions
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

CREATE OR REPLACE FUNCTION get_active_companies_count()
RETURNS BIGINT
LANGUAGE sql
AS $$
  SELECT COUNT(*) FROM public.companies WHERE avregistreringsdatum IS NULL;
$$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE 'Tables: companies, gdpr_audit_log, merinfo_cache';
  RAISE NOTICE 'Next step: Import Parquet data with npm run db:import';
END $$;
