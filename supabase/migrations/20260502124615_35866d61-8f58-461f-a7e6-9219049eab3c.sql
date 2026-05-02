ALTER TABLE public.committee_tasks
ADD COLUMN IF NOT EXISTS sort_order double precision NOT NULL DEFAULT 0;

-- Initialize sort_order for existing tasks (newest = highest position at top within each committee+status)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY committee_id, status ORDER BY created_at DESC) AS rn
  FROM public.committee_tasks
)
UPDATE public.committee_tasks t
SET sort_order = r.rn * 1000
FROM ranked r
WHERE t.id = r.id;

CREATE INDEX IF NOT EXISTS idx_committee_tasks_sort
  ON public.committee_tasks (committee_id, status, sort_order);