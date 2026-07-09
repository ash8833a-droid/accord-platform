
-- 1) Budget RPCs: require authenticated + committee membership / admin
REVOKE EXECUTE ON FUNCTION public.public_get_budget_for_committee(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.public_add_budget_item(uuid, text, numeric, numeric, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.public_add_budget_item(uuid, text, numeric, numeric, text, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.public_update_budget_item(uuid, uuid, text, numeric, numeric, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.public_update_budget_item(uuid, uuid, text, numeric, numeric, text, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.public_delete_budget_item(uuid, uuid) FROM anon, PUBLIC;

CREATE OR REPLACE FUNCTION public.public_get_budget_for_committee(_committee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول';
  END IF;
  IF NOT (public.has_role(uid, 'admin'::app_role)
          OR public.is_committee_member(uid, _committee_id)
          OR public.is_finance_committee_member(uid)) THEN
    RAISE EXCEPTION 'غير مصرّح لك بعرض ميزانية هذه اللجنة';
  END IF;
  RETURN jsonb_build_object(
    'committee', (
      SELECT jsonb_build_object('id', c.id, 'name', c.name, 'type', c.type)
      FROM public.committees c WHERE c.id = _committee_id
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', bi.id,
        'committee_id', bi.committee_id,
        'item_name', bi.item_name,
        'quantity', bi.quantity,
        'unit_cost', bi.unit_cost,
        'total_cost', bi.total_cost,
        'notes', bi.notes,
        'assigned_by_finance', bi.assigned_by_finance,
        'is_manual_total', bi.is_manual_total,
        'created_at', bi.created_at
      ) ORDER BY bi.created_at ASC)
      FROM public.budget_items bi
      WHERE bi.committee_id = _committee_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.public_add_budget_item(
  _committee_id uuid, _item_name text, _quantity numeric, _unit_cost numeric,
  _notes text DEFAULT NULL::text, _is_manual_total boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_id uuid;
  v_name text := btrim(COALESCE(_item_name,''));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول';
  END IF;
  IF NOT (public.has_role(uid, 'admin'::app_role)
          OR public.is_committee_member(uid, _committee_id)
          OR public.is_finance_committee_member(uid)) THEN
    RAISE EXCEPTION 'غير مصرّح لك بإضافة بند في هذه اللجنة';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.committees WHERE id = _committee_id) THEN
    RAISE EXCEPTION 'اللجنة غير موجودة';
  END IF;
  IF length(v_name) = 0 OR length(v_name) > 255 THEN
    RAISE EXCEPTION 'اسم البند مطلوب (1-255 حرف)';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 OR _quantity > 1000000 THEN
    RAISE EXCEPTION 'الكمية غير صحيحة';
  END IF;
  IF _unit_cost IS NULL OR _unit_cost < 0 OR _unit_cost > 100000000 THEN
    RAISE EXCEPTION 'تكلفة الوحدة غير صحيحة';
  END IF;

  INSERT INTO public.budget_items (committee_id, item_name, quantity, unit_cost, notes, assigned_by_finance, is_manual_total, created_by)
  VALUES (_committee_id, v_name, _quantity, _unit_cost,
          NULLIF(btrim(COALESCE(_notes,'')), ''), false, COALESCE(_is_manual_total, false), uid)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_update_budget_item(
  _item_id uuid, _committee_id uuid, _item_name text, _quantity numeric, _unit_cost numeric,
  _notes text DEFAULT NULL::text, _is_manual_total boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_name text := btrim(COALESCE(_item_name,''));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول';
  END IF;
  IF NOT (public.has_role(uid, 'admin'::app_role)
          OR public.is_committee_member(uid, _committee_id)
          OR public.is_finance_committee_member(uid)) THEN
    RAISE EXCEPTION 'غير مصرّح لك بتعديل بند في هذه اللجنة';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.budget_items WHERE id = _item_id AND committee_id = _committee_id) THEN
    RAISE EXCEPTION 'البند غير موجود لهذه اللجنة';
  END IF;
  IF length(v_name) = 0 OR length(v_name) > 255 THEN
    RAISE EXCEPTION 'اسم البند مطلوب';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 OR _quantity > 1000000 THEN
    RAISE EXCEPTION 'الكمية غير صحيحة';
  END IF;
  IF _unit_cost IS NULL OR _unit_cost < 0 OR _unit_cost > 100000000 THEN
    RAISE EXCEPTION 'تكلفة الوحدة غير صحيحة';
  END IF;

  UPDATE public.budget_items
  SET item_name = v_name,
      quantity = _quantity,
      unit_cost = _unit_cost,
      notes = NULLIF(btrim(COALESCE(_notes,'')), ''),
      is_manual_total = COALESCE(_is_manual_total, false),
      updated_at = now()
  WHERE id = _item_id AND committee_id = _committee_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_update_budget_item(
  _item_id uuid, _committee_id uuid, _item_name text, _quantity numeric, _unit_cost numeric,
  _notes text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.public_update_budget_item(_item_id, _committee_id, _item_name, _quantity, _unit_cost, _notes, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.public_add_budget_item(
  _committee_id uuid, _item_name text, _quantity numeric, _unit_cost numeric,
  _notes text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.public_add_budget_item(_committee_id, _item_name, _quantity, _unit_cost, _notes, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.public_delete_budget_item(_item_id uuid, _committee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول';
  END IF;
  IF NOT (public.has_role(uid, 'admin'::app_role)
          OR public.is_committee_member(uid, _committee_id)
          OR public.is_finance_committee_member(uid)) THEN
    RAISE EXCEPTION 'غير مصرّح لك بحذف بند في هذه اللجنة';
  END IF;
  DELETE FROM public.budget_items
  WHERE id = _item_id AND committee_id = _committee_id
    AND COALESCE(assigned_by_finance, false) = false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_budget_for_committee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_add_budget_item(uuid, text, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_add_budget_item(uuid, text, numeric, numeric, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_update_budget_item(uuid, uuid, text, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_update_budget_item(uuid, uuid, text, numeric, numeric, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_delete_budget_item(uuid, uuid) TO authenticated;


-- 2) women_talent_responses: enforce male-exclusion list at RLS level
CREATE OR REPLACE FUNCTION public.can_access_women_talent_survey(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _user_id <> ALL (ARRAY[
      'bd0057d4-5bc7-4c7d-a029-c30b3184f439'::uuid,
      '2a4af8b9-aa26-4a92-bb77-a908d7d22fb0'::uuid,
      '111b2a17-5b6b-40e7-8033-47cc7bdd3bb8'::uuid
    ])
    AND (
      public.has_role(_user_id, 'admin'::app_role)
      OR public.is_women_committee_member(_user_id)
      OR public.is_quality_committee_head(_user_id)
    );
$$;

DROP POLICY IF EXISTS "Admins women and quality head can view responses" ON public.women_talent_responses;
DROP POLICY IF EXISTS "Admins women and quality head can update responses" ON public.women_talent_responses;
DROP POLICY IF EXISTS "Admins women and quality head can delete responses" ON public.women_talent_responses;

CREATE POLICY "wtr_select_scoped"
ON public.women_talent_responses
FOR SELECT
USING (public.can_access_women_talent_survey(auth.uid()));

CREATE POLICY "wtr_update_scoped"
ON public.women_talent_responses
FOR UPDATE
USING (public.can_access_women_talent_survey(auth.uid()))
WITH CHECK (public.can_access_women_talent_survey(auth.uid()));

CREATE POLICY "wtr_delete_scoped"
ON public.women_talent_responses
FOR DELETE
USING (public.can_access_women_talent_survey(auth.uid()));


-- 3) invoices: replace permissive read policy with a scoped one
DROP POLICY IF EXISTS "Authenticated can view invoices" ON public.invoices;

CREATE POLICY "Finance and admins can view invoices"
ON public.invoices
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_finance_committee_member(auth.uid())
);
