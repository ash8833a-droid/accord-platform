
-- announcements: restrict read to approved users or admin
DROP POLICY IF EXISTS ann_select_auth ON public.announcements;
CREATE POLICY ann_select_approved ON public.announcements
  FOR SELECT TO authenticated
  USING (public.is_user_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- app_settings: restrict read to approved users or admin
DROP POLICY IF EXISTS app_settings_select_auth ON public.app_settings;
CREATE POLICY app_settings_select_approved ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.is_user_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- committees: restrict read to approved users or admin
DROP POLICY IF EXISTS committees_select_auth ON public.committees;
CREATE POLICY committees_select_approved ON public.committees
  FOR SELECT TO authenticated
  USING (public.is_user_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- minute_acknowledgements: scope to committee members via parent minute
DROP POLICY IF EXISTS "Authenticated can read acknowledgements" ON public.minute_acknowledgements;
CREATE POLICY minute_ack_select_committee ON public.minute_acknowledgements
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.committee_minutes cm
      WHERE cm.id = minute_acknowledgements.minute_id
        AND public.is_committee_member(auth.uid(), cm.committee_id)
    )
  );

-- wedding_archive_items: restrict read to approved users or admin
DROP POLICY IF EXISTS "Authenticated can view archive items" ON public.wedding_archive_items;
CREATE POLICY wedding_archive_select_approved ON public.wedding_archive_items
  FOR SELECT TO authenticated
  USING (public.is_user_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
