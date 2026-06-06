
-- Returns the committee name + budget items for a single committee.
CREATE OR REPLACE FUNCTION public.public_get_budget_for_committee(_committee_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
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
        'created_at', bi.created_at
      ) ORDER BY bi.created_at ASC)
      FROM public.budget_items bi
      WHERE bi.committee_id = _committee_id
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.public_add_budget_item(
  _committee_id uuid,
  _item_name text,
  _quantity numeric,
  _unit_cost numeric,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text := btrim(COALESCE(_item_name,''));
BEGIN
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

  INSERT INTO public.budget_items (committee_id, item_name, quantity, unit_cost, notes, assigned_by_finance)
  VALUES (_committee_id, v_name, _quantity, _unit_cost,
          NULLIF(btrim(COALESCE(_notes,'')), ''), false)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_update_budget_item(
  _item_id uuid,
  _committee_id uuid,
  _item_name text,
  _quantity numeric,
  _unit_cost numeric,
  _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(COALESCE(_item_name,''));
BEGIN
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
      updated_at = now()
  WHERE id = _item_id AND committee_id = _committee_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_delete_budget_item(
  _item_id uuid,
  _committee_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.budget_items
  WHERE id = _item_id AND committee_id = _committee_id
    AND COALESCE(assigned_by_finance, false) = false; -- can't delete finance-assigned items
END;
$$;

-- Grant execute to anon + authenticated for the shareable link
GRANT EXECUTE ON FUNCTION public.public_get_budget_for_committee(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_add_budget_item(uuid, text, numeric, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_update_budget_item(uuid, uuid, text, numeric, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_delete_budget_item(uuid, uuid) TO anon, authenticated;
