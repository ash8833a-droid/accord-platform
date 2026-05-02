-- 1) إعادة ضبط المهام التي عُدِّلت سابقاً لتظهر متأخرة
UPDATE public.committee_tasks
SET due_date = NULL,
    priority = 'medium',
    updated_at = now()
WHERE id IN (
  '7cd144e5-0000-0000-0000-000000000000'::uuid
)
OR (priority = 'urgent' AND due_date = (CURRENT_DATE - INTERVAL '2 days')::date);

-- 2) لكل لجنة: اجعل أحدث مهمة (الأعلى في الترتيب) عاجلة ومتأخرة بيومين
WITH latest_per_committee AS (
  SELECT DISTINCT ON (committee_id) id
  FROM public.committee_tasks
  ORDER BY committee_id, created_at DESC
)
UPDATE public.committee_tasks ct
SET due_date = (CURRENT_DATE - INTERVAL '2 days')::date,
    priority = 'urgent',
    updated_at = now()
FROM latest_per_committee l
WHERE ct.id = l.id;