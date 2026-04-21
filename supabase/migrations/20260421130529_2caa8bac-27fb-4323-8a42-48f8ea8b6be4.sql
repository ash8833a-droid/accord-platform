-- جدول مساهمي السنوات الماضية
CREATE TABLE public.historical_shareholders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  family_branch TEXT NOT NULL,
  hijri_year INTEGER NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  source_file_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hs_year ON public.historical_shareholders(hijri_year);
CREATE INDEX idx_hs_branch ON public.historical_shareholders(family_branch);
CREATE INDEX idx_hs_year_branch ON public.historical_shareholders(hijri_year, family_branch);

ALTER TABLE public.historical_shareholders ENABLE ROW LEVEL SECURITY;

-- عرض: أعضاء اللجنة المالية + الجودة + الإدارة
CREATE POLICY "hs_select" ON public.historical_shareholders
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'quality'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid() AND c.type = 'finance'::committee_type
  )
);

-- إضافة: اللجنة المالية + الإدارة
CREATE POLICY "hs_insert" ON public.historical_shareholders
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid() AND c.type = 'finance'::committee_type
  )
);

-- تحديث: اللجنة المالية + الإدارة
CREATE POLICY "hs_update" ON public.historical_shareholders
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid() AND c.type = 'finance'::committee_type
  )
);

-- حذف: الإدارة فقط
CREATE POLICY "hs_delete" ON public.historical_shareholders
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_hs_updated_at
BEFORE UPDATE ON public.historical_shareholders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- bucket لرفع ملفات السنوات الماضية
INSERT INTO storage.buckets (id, name, public)
VALUES ('historical-shares', 'historical-shares', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "hs_storage_select" ON storage.objects
FOR SELECT USING (
  bucket_id = 'historical-shares' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'quality'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.committees c ON c.id = ur.committee_id
      WHERE ur.user_id = auth.uid() AND c.type = 'finance'::committee_type
    )
  )
);

CREATE POLICY "hs_storage_insert" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'historical-shares' AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.committees c ON c.id = ur.committee_id
      WHERE ur.user_id = auth.uid() AND c.type = 'finance'::committee_type
    )
  )
);