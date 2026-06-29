UPDATE public.committee_tasks
SET status = 'completed',
    updated_at = now()
WHERE id IN (
  'c26afb17-ffdd-473e-a3d2-b775a25c71e3',  -- حجز الضيافة
  '0ad1c6ef-89a2-4fe2-987f-e200fcac8b66',  -- حصر أسماء وبيانات العرسان
  '49752be4-fd81-42b9-994f-56b38ad86b89'   -- تقديم الوجبات يوم الحفل
);

UPDATE public.committee_tasks
SET status = 'in_progress',
    updated_at = now()
WHERE id = '2bd7192d-b385-4369-9c4b-e3edb19a6859';  -- قائمة التدقيق (Checklist) لكل لجنة