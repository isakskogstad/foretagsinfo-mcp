#!/bin/bash
# Run database migrations

echo "🗄️  Running database migrations..."
echo ""
echo "📌 INSTRUKTIONER:"
echo "1. Öppna Supabase SQL Editor: https://supabase.com/dashboard/project/thjwryuhtwlfxwduyqqd/sql"
echo "2. Kör följande SQL-filer i ordning:"
echo ""
echo "   ✓ sql/recreate-companies-table.sql (REDAN KÖRD)"
echo "   → sql/002-create-cache-tables.sql"
echo "   → sql/003-create-storage-bucket.sql"
echo ""
echo "3. Verifiera att tabellerna skapats:"
echo ""

cat << 'EOF'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'companies',
    'company_details_cache',
    'company_documents_cache',
    'financial_reports',
    'board_members',
    'api_request_log'
  )
ORDER BY table_name;
EOF

echo ""
echo "4. Verifiera Storage bucket:"
echo ""

cat << 'EOF'
SELECT * FROM storage.buckets WHERE id = 'company-documents';
EOF

echo ""
echo "✅ När migrations är klara, testa med:"
echo "   npx tsx scripts/test-caching.ts"
