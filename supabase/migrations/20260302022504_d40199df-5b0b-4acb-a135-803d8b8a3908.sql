-- Allow service role to upload and read comprovantes (edge functions use service role key)
-- The existing policies only allow authenticated users, but edge functions use service_role
-- Service role bypasses RLS by default, so no additional policies needed.
-- Just ensure the bucket allows the right mime types by updating it:
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf']::text[],
    file_size_limit = 10485760
WHERE id = 'comprovantes';
