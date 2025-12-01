#!/bin/bash
# Recreate table via Supabase Management API

echo "🗑️  Dropping old table via SQL..."
echo ""

# Drop table
curl -X POST "https://thjwryuhtwlfxwduyqqd.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "DROP TABLE IF EXISTS public.companies CASCADE;"
  }'

echo ""
echo "✓ Table dropped"
echo ""
echo "📋 Creating table via SQL..."

# Create table
curl -X POST "https://thjwryuhtwlfxwduyqqd.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "sql": "CREATE TABLE public.companies (id BIGSERIAL PRIMARY KEY, organisationsidentitet TEXT UNIQUE NOT NULL, namnskyddslopnummer TEXT, registreringsland TEXT, organisationsnamn TEXT NOT NULL, organisationsform TEXT, avregistreringsdatum DATE, avregistreringsorsak TEXT, pagandeavvecklingselleromsstruktureringsforfarande TEXT, registreringsdatum DATE, verksamhetsbeskrivning TEXT, postadress TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()); CREATE INDEX idx_companies_orgidentitet ON public.companies(organisationsidentitet); CREATE INDEX idx_companies_namn ON public.companies USING GIN (organisationsnamn gin_trgm_ops); ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY; CREATE POLICY \"Public read\" ON public.companies FOR SELECT USING (true); CREATE POLICY \"Service write\" ON public.companies FOR ALL USING (auth.role() = 'service_role');"
}
EOF

echo ""
echo "✅ Table recreated!"
echo ""
echo "🔄 Reloading PostgREST schema..."

# Force reload
curl -X POST "https://thjwryuhtwlfxwduyqqd.supabase.co/rest/v1/rpc/pgrst_reload_schema" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  2>/dev/null

echo ""
echo "✓ Done!"
