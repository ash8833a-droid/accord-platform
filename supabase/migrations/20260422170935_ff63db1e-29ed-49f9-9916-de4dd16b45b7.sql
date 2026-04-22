-- Allow public (anonymous) inserts of new groom registrations from the public form
CREATE POLICY "grooms_public_insert"
ON public.grooms
FOR INSERT
TO anon
WITH CHECK (
  status = 'new'
  AND created_by IS NULL
  AND full_name IS NOT NULL
  AND phone IS NOT NULL
  AND family_branch IS NOT NULL
);

-- Public bucket for groom registration uploads (ID photos & personal photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('groom-public', 'groom-public', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read files in this public bucket
CREATE POLICY "groom_public_read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'groom-public');

-- Anyone (including anonymous) can upload to this bucket
CREATE POLICY "groom_public_insert"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'groom-public');
