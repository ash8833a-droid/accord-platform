-- Fix the recently created member: change role from 'quality' to 'committee'
-- so they are scoped only to the Women's Committee they were assigned to.
UPDATE public.user_roles
   SET role = 'committee'
 WHERE user_id = (
   SELECT user_id FROM public.profiles WHERE phone = '0553187987' LIMIT 1
 )
   AND committee_id = '98c99da7-f91d-49fe-8547-7d94e5c6c48b'
   AND role = 'quality';