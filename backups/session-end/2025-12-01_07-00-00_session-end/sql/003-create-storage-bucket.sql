-- Create Supabase Storage bucket for company documents
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/thjwryuhtwlfxwduyqqd/sql

-- 1. Create bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-documents',
  'company-documents',
  false, -- Private bucket
  52428800, -- 50MB max file size
  ARRAY[
    'application/pdf',
    'application/xml',
    'text/xml',
    'application/xhtml+xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies for storage
CREATE POLICY "Service role can upload documents"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'company-documents');

CREATE POLICY "Service role can read documents"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'company-documents');

CREATE POLICY "Authenticated users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'company-documents');

-- 3. File path structure:
-- company-documents/
--   {organisationsidentitet}/
--     annual-reports/
--       {year}/
--         report.pdf
--         report.xbrl
--     board/
--       board-composition-{date}.pdf
--     articles/
--       articles-of-association.pdf

COMMENT ON TABLE storage.buckets IS 'Storage bucket for company documents from Bolagsverket API';
