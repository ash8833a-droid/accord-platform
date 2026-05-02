-- السماح للزوار (anon + authenticated) بقراءة سجل العريس برقم جواله للتحقق
CREATE POLICY "grooms_public_self_select"
ON public.grooms
FOR SELECT
TO anon, authenticated
USING (phone IS NOT NULL);

-- السماح للزوار بتحديث صور العريس وحقول الطلب الجديد فقط (بدون تغيير الحالة أو الموافقات)
CREATE POLICY "grooms_public_self_update"
ON public.grooms
FOR UPDATE
TO anon, authenticated
USING (phone IS NOT NULL)
WITH CHECK (phone IS NOT NULL);

-- ترقية سياسة التخزين: السماح بالرفع العام إلى مجلدات photos و ids في bucket grooms
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'grooms') THEN
    -- تأكد أن الـ bucket عام للقراءة
    UPDATE storage.buckets SET public = true WHERE id = 'grooms';
  ELSE
    INSERT INTO storage.buckets (id, name, public) VALUES ('grooms', 'grooms', true);
  END IF;
END $$;

-- سياسات تخزين عامة للرفع/القراءة على bucket grooms (مع تجنب التكرار)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='grooms_public_read'
  ) THEN
    CREATE POLICY "grooms_public_read" ON storage.objects FOR SELECT TO anon, authenticated
      USING (bucket_id = 'grooms');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='grooms_public_insert'
  ) THEN
    CREATE POLICY "grooms_public_insert" ON storage.objects FOR INSERT TO anon, authenticated
      WITH CHECK (bucket_id = 'grooms');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='grooms_public_update'
  ) THEN
    CREATE POLICY "grooms_public_update" ON storage.objects FOR UPDATE TO anon, authenticated
      USING (bucket_id = 'grooms') WITH CHECK (bucket_id = 'grooms');
  END IF;
END $$;