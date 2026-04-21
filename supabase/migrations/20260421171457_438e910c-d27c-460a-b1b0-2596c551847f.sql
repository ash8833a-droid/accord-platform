-- Fix committee_tasks.assigned_to to reference team_members instead of auth.users
-- The application assigns tasks to team_members rows, not auth users directly.
ALTER TABLE public.committee_tasks
  DROP CONSTRAINT IF EXISTS committee_tasks_assigned_to_fkey;

-- Clean up any orphan values that wouldn't match a team_members row
UPDATE public.committee_tasks
SET assigned_to = NULL
WHERE assigned_to IS NOT NULL
  AND assigned_to NOT IN (SELECT id FROM public.team_members);

ALTER TABLE public.committee_tasks
  ADD CONSTRAINT committee_tasks_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES public.team_members(id) ON DELETE SET NULL;