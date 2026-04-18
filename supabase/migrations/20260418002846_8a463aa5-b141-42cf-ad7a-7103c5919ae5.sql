-- Convert existing logistics committee row(s) to procurement
UPDATE public.committees
SET type = 'procurement'::public.committee_type,
    name = 'لجنة المشتريات',
    description = 'إدارة المشتريات والموردين وضبط التكاليف وضمان الجودة وتسليم المستلزمات في الوقت المحدد',
    updated_at = now()
WHERE type = 'logistics'::public.committee_type;

-- Insert women committee if missing
INSERT INTO public.committees (type, name, description, max_members, min_budget, max_budget, budget_allocated)
SELECT 'women'::public.committee_type,
       'اللجنة النسائية',
       'القسم النسائي للحفل: المشتريات والتجهيزات والضيافة وتنسيق الزفّات وتكاليفها',
       15, 0, 0, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.committees WHERE type = 'women'::public.committee_type
);

-- Update grooms select policy to include new committees
DROP POLICY IF EXISTS grooms_select ON public.grooms;
CREATE POLICY grooms_select
ON public.grooms
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'quality'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid()
      AND c.type = ANY (ARRAY[
        'programs'::public.committee_type,
        'reception'::public.committee_type,
        'dinner'::public.committee_type,
        'procurement'::public.committee_type,
        'women'::public.committee_type
      ])
  )
);
