WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY committee_id
      ORDER BY
        CASE priority::text
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        created_at DESC
    ) AS rn
  FROM public.committee_tasks
)
UPDATE public.committee_tasks t
SET sort_order = r.rn * 1000
FROM ranked r
WHERE t.id = r.id;