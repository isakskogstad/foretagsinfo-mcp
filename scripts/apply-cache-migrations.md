# Cache Tables Migration

Kör följande SQL i Supabase SQL Editor:
https://supabase.com/dashboard/project/thjwryuhtwlfxwduyqqd/sql

```sql
-- 1. Company details cache (från Bolagsverket API)
CREATE TABLE IF NOT EXISTS public.company_details_cache (
  id BIGSERIAL PRIMARY KEY,
  organisationsidentitet TEXT UNIQUE NOT NULL,
  api_response JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  cache_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  fetch_count INTEGER DEFAULT 1,
  last_modified TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_company FOREIGN KEY (organisationsidentitet)
    REFERENCES public.companies(organisationsidentitet) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_details_orgid ON public.company_details_cache(organisationsidentitet);
CREATE INDEX IF NOT EXISTS idx_company_details_expires ON public.company_details_cache(cache_expires_at);

-- 2. Document list cache
CREATE TABLE IF NOT EXISTS public.company_documents_cache (
  id BIGSERIAL PRIMARY KEY,
  organisationsidentitet TEXT NOT NULL,
  documents JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  cache_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  fetch_count INTEGER DEFAULT 1,
  CONSTRAINT fk_company_docs FOREIGN KEY (organisationsidentitet)
    REFERENCES public.companies(organisationsidentitet) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_cache_orgid ON public.company_documents_cache(organisationsidentitet);

-- 3. Financial reports (parsed iXBRL data)
CREATE TABLE IF NOT EXISTS public.financial_reports (
  id BIGSERIAL PRIMARY KEY,
  organisationsidentitet TEXT NOT NULL,
  report_year INTEGER NOT NULL,
  report_type TEXT NOT NULL,
  filing_date DATE,
  balance_sheet JSONB,
  income_statement JSONB,
  cash_flow JSONB,
  key_metrics JSONB,
  source_document_id TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_report_per_year UNIQUE (organisationsidentitet, report_year, report_type),
  CONSTRAINT fk_company_reports FOREIGN KEY (organisationsidentitet)
    REFERENCES public.companies(organisationsidentitet) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_financial_reports_orgid ON public.financial_reports(organisationsidentitet);
CREATE INDEX IF NOT EXISTS idx_financial_reports_year ON public.financial_reports(report_year DESC);
CREATE INDEX IF NOT EXISTS idx_financial_reports_storage ON public.financial_reports(storage_path);

-- 4. Board members (styrelse)
CREATE TABLE IF NOT EXISTS public.board_members (
  id BIGSERIAL PRIMARY KEY,
  organisationsidentitet TEXT NOT NULL,
  namn TEXT NOT NULL,
  personnummer TEXT,
  roll TEXT NOT NULL,
  from_date DATE,
  to_date DATE,
  source TEXT DEFAULT 'bolagsverket_api',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_company_board FOREIGN KEY (organisationsidentitet)
    REFERENCES public.companies(organisationsidentitet) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_board_members_orgid ON public.board_members(organisationsidentitet);
CREATE INDEX IF NOT EXISTS idx_board_members_namn ON public.board_members(namn);

-- 5. API request log (för rate limiting & analytics)
CREATE TABLE IF NOT EXISTS public.api_request_log (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  organisationsidentitet TEXT,
  status_code INTEGER,
  response_time_ms INTEGER,
  cache_hit BOOLEAN DEFAULT FALSE,
  requested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_log_timestamp ON public.api_request_log(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_log_endpoint ON public.api_request_log(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_log_cache_hit ON public.api_request_log(cache_hit);

-- 6. RLS policies

-- Company details cache
ALTER TABLE public.company_details_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read cache" ON public.company_details_cache;
CREATE POLICY "Public read cache" ON public.company_details_cache
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service write cache" ON public.company_details_cache;
CREATE POLICY "Service write cache" ON public.company_details_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Documents cache
ALTER TABLE public.company_documents_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read docs cache" ON public.company_documents_cache;
CREATE POLICY "Public read docs cache" ON public.company_documents_cache
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service write docs cache" ON public.company_documents_cache;
CREATE POLICY "Service write docs cache" ON public.company_documents_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Financial reports
ALTER TABLE public.financial_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read reports" ON public.financial_reports;
CREATE POLICY "Public read reports" ON public.financial_reports
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service write reports" ON public.financial_reports;
CREATE POLICY "Service write reports" ON public.financial_reports
  FOR ALL USING (auth.role() = 'service_role');

-- Board members
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read board" ON public.board_members;
CREATE POLICY "Public read board" ON public.board_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service write board" ON public.board_members;
CREATE POLICY "Service write board" ON public.board_members
  FOR ALL USING (auth.role() = 'service_role');

-- API log (service role only)
ALTER TABLE public.api_request_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service only api log" ON public.api_request_log;
CREATE POLICY "Service only api log" ON public.api_request_log
  FOR ALL USING (auth.role() = 'service_role');
```

## Verify

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'company_details_cache',
    'company_documents_cache',
    'financial_reports',
    'board_members',
    'api_request_log'
  )
ORDER BY table_name;
```
