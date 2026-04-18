-- Add personal photo, national ID document, and groom requests fields
ALTER TABLE public.grooms
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS national_id_url text,
  ADD COLUMN IF NOT EXISTS extra_sheep integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_cards_men integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_cards_women integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_participation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_participation_details text,
  ADD COLUMN IF NOT EXISTS special_requests text;

-- Storage policies for groom-docs bucket: allow approved committees to upload/read groom photo & ID
-- Bucket already exists (groom-docs). Add policies if missing.
DO $$
BEGIN
  -- SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='groom_docs_select'
  ) THEN
    CREATE POLICY "groom_docs_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'groom-docs' AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'quality'::public.app_role)
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.committees c ON c.id = ur.committee_id
            WHERE ur.user_id = auth.uid()
              AND c.type = ANY (ARRAY['programs'::public.committee_type, 'reception'::public.committee_type])
          )
        )
      );
  END IF;

  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='groom_docs_insert'
  ) THEN
    CREATE POLICY "groom_docs_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'groom-docs' AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.committees c ON c.id = ur.committee_id
            WHERE ur.user_id = auth.uid()
              AND c.type = ANY (ARRAY['programs'::public.committee_type, 'reception'::public.committee_type])
          )
        )
      );
  END IF;

  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='groom_docs_update'
  ) THEN
    CREATE POLICY "groom_docs_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'groom-docs' AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.committees c ON c.id = ur.committee_id
            WHERE ur.user_id = auth.uid()
              AND c.type = ANY (ARRAY['programs'::public.committee_type, 'reception'::public.committee_type])
          )
        )
      );
  END IF;

  -- DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='groom_docs_delete'
  ) THEN
    CREATE POLICY "groom_docs_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'groom-docs' AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.committees c ON c.id = ur.committee_id
            WHERE ur.user_id = auth.uid()
              AND c.type = ANY (ARRAY['programs'::public.committee_type, 'reception'::public.committee_type])
          )
        )
      );
  END IF;
END$$;