-- Sprint 97: private bucket for Parchi Reader images.
-- Run in the Supabase SQL editor after 062. The API also creates the bucket
-- with the service role if this migration has not been applied yet.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'smart_stocks_documents',
  'smart_stocks_documents',
  false,
  4194304,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS smart_stocks_documents_select_workspace ON storage.objects;
DROP POLICY IF EXISTS smart_stocks_documents_insert_workspace ON storage.objects;
DROP POLICY IF EXISTS smart_stocks_documents_delete_workspace ON storage.objects;

CREATE POLICY smart_stocks_documents_select_workspace ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'smart_stocks_documents'
    AND EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY smart_stocks_documents_insert_workspace ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'smart_stocks_documents'
    AND EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND can_manage_workspace(b.user_id)
    )
  );

CREATE POLICY smart_stocks_documents_delete_workspace ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'smart_stocks_documents'
    AND EXISTS (
      SELECT 1
      FROM businesses b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND can_manage_workspace(b.user_id)
    )
  );
