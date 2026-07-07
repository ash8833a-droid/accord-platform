-- Reconcile committee financial totals with actual data
UPDATE public.committees c
SET budget_allocated = COALESCE((
      SELECT SUM(total_cost) FROM public.budget_items bi WHERE bi.committee_id = c.id
    ), 0),
    budget_spent = COALESCE((
      SELECT SUM(amount) FROM public.payment_requests pr
      WHERE pr.committee_id = c.id AND pr.status = 'paid'
    ), 0),
    updated_at = now();