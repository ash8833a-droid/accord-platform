UPDATE public.committee_tasks
SET due_date = (CURRENT_DATE - INTERVAL '2 days')::date,
    priority = 'urgent',
    updated_at = now()
WHERE id IN (
  '7cd144e5-5d0f-4635-bb4a-85bc358e1a8c',
  'dbdcb5e5-3053-4156-bbe6-6269f028c133',
  '49752be4-fd81-42b9-994f-56b38ad86b89',
  '90dea876-7322-4ef3-a995-bbb094d9bca8',
  '7aeece19-856a-4bd9-af1e-69ea28c77de2',
  'd8e75dca-c1f7-44e8-ad42-ba086c16ad9d',
  '8357fe58-5a1d-4bb6-a5ff-d2f516e348ac',
  '3f823d94-82ef-4549-9b34-f6cc7a2b3681'
);