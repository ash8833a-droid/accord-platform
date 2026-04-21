
-- Allow committee heads (and admin) to UPDATE/DELETE payment requests for their committee
DROP POLICY IF EXISTS pr_admin_delete ON public.payment_requests;
DROP POLICY IF EXISTS pr_admin_update ON public.payment_requests;

CREATE POLICY pr_head_or_admin_update
  ON public.payment_requests
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_committee_head(auth.uid(), committee_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_committee_head(auth.uid(), committee_id)
  );

CREATE POLICY pr_head_or_admin_delete
  ON public.payment_requests
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_committee_head(auth.uid(), committee_id)
  );

-- Allow finance committee head (and admin) to UPDATE/DELETE delegates
DROP POLICY IF EXISTS delegates_admin_manage ON public.delegates;

CREATE POLICY delegates_admin_all
  ON public.delegates
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY delegates_finance_head_update
  ON public.delegates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.type = 'finance'::committee_type
        AND c.head_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.type = 'finance'::committee_type
        AND c.head_user_id = auth.uid()
    )
  );

CREATE POLICY delegates_finance_head_delete
  ON public.delegates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.type = 'finance'::committee_type
        AND c.head_user_id = auth.uid()
    )
  );

CREATE POLICY delegates_finance_head_insert
  ON public.delegates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.type = 'finance'::committee_type
        AND c.head_user_id = auth.uid()
    )
  );

-- Allow finance head to update/delete subscribers
DROP POLICY IF EXISTS subscribers_admin_delete ON public.subscribers;

CREATE POLICY subscribers_admin_or_finance_head_delete
  ON public.subscribers
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.type = 'finance'::committee_type
        AND c.head_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS subscribers_delegate_update ON public.subscribers;

CREATE POLICY subscribers_update
  ON public.subscribers
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.type = 'finance'::committee_type
        AND c.head_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.delegates d
      WHERE d.id = subscribers.delegate_id
        AND d.user_id = auth.uid()
    )
  );

-- Allow finance head to update/delete subscriptions
DROP POLICY IF EXISTS subs_admin_delete ON public.subscriptions;
DROP POLICY IF EXISTS subs_admin_update ON public.subscriptions;

CREATE POLICY subs_admin_or_finance_head_delete
  ON public.subscriptions
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.type = 'finance'::committee_type
        AND c.head_user_id = auth.uid()
    )
  );

CREATE POLICY subs_admin_or_finance_head_update
  ON public.subscriptions
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.type = 'finance'::committee_type
        AND c.head_user_id = auth.uid()
    )
  );

-- Allow finance head to delete historical shareholders
DROP POLICY IF EXISTS hs_delete ON public.historical_shareholders;

CREATE POLICY hs_delete_admin_or_finance_head
  ON public.historical_shareholders
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.committees c
      WHERE c.type = 'finance'::committee_type
        AND c.head_user_id = auth.uid()
    )
  );
