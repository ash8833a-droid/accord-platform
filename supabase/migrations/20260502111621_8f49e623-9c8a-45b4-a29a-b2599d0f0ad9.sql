CREATE OR REPLACE FUNCTION public.is_quality_committee_head(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.committees c
    WHERE c.type = 'quality'::committee_type
      AND c.head_user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Admins and women committee can view responses" ON public.women_talent_responses;
DROP POLICY IF EXISTS "Admins, women and quality can view responses" ON public.women_talent_responses;
CREATE POLICY "Admins women and quality head can view responses"
  ON public.women_talent_responses FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_women_committee_member(auth.uid())
    OR public.is_quality_committee_head(auth.uid())
  );

DROP POLICY IF EXISTS "Admins and women committee can update responses" ON public.women_talent_responses;
DROP POLICY IF EXISTS "Admins, women and quality can update responses" ON public.women_talent_responses;
CREATE POLICY "Admins women and quality head can update responses"
  ON public.women_talent_responses FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_women_committee_member(auth.uid())
    OR public.is_quality_committee_head(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_women_committee_member(auth.uid())
    OR public.is_quality_committee_head(auth.uid())
  );

DROP POLICY IF EXISTS "Admins and women committee can delete responses" ON public.women_talent_responses;
DROP POLICY IF EXISTS "Admins, women and quality can delete responses" ON public.women_talent_responses;
CREATE POLICY "Admins women and quality head can delete responses"
  ON public.women_talent_responses FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_women_committee_member(auth.uid())
    OR public.is_quality_committee_head(auth.uid())
  );

UPDATE public.women_talent_responses
SET family_branch = NULL
WHERE family_branch IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_women_committee_on_talent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_rec record;
BEGIN
  FOR member_rec IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE c.type = 'women'::committee_type

    UNION

    SELECT DISTINCT c.head_user_id AS user_id
    FROM public.committees c
    WHERE c.type = 'quality'::committee_type
      AND c.head_user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      member_rec.user_id,
      'women_talent_response',
      'استبيان جديد: ' || NEW.full_name,
      CASE WHEN array_length(NEW.skills, 1) > 0
        THEN 'مهارات: ' || array_to_string(NEW.skills, '، ')
        ELSE 'تم استلام رد جديد على الاستبيان' END,
      '/committee/women',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;