-- Drop and recreate companies table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/thjwryuhtwlfxwduyqqd/sql

-- 1. Drop existing table
DROP TABLE IF EXISTS public.companies CASCADE;

-- 2. Create table with all columns
CREATE TABLE public.companies (
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

-- 3. Create indexes
CREATE INDEX idx_companies_orgidentitet ON public.companies(organisationsidentitet);
CREATE INDEX idx_companies_namn ON public.companies USING GIN (to_tsvector('swedish', organisationsnamn));

-- 4. Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 5. Public read policy
CREATE POLICY "Public read" ON public.companies
  FOR SELECT
  USING (true);

-- 6. Service role write policy
CREATE POLICY "Service write" ON public.companies
  FOR ALL
  USING (auth.role() = 'service_role');

-- 7. Test insert
INSERT INTO public.companies (
  organisationsidentitet,
  organisationsnamn,
  organisationsform
) VALUES (
  'TEST123456',
  'Test Company AB',
  'AB'
);

-- 8. Verify
SELECT COUNT(*) FROM public.companies;

-- 9. Clean up test
DELETE FROM public.companies WHERE organisationsidentitet = 'TEST123456';
