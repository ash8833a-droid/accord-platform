-- 1) grooms.edit_token: revoke column-level SELECT from anon/authenticated.
-- Service role (used by server-side public groom-edit functions) retains access.
REVOKE SELECT (edit_token) ON public.grooms FROM anon;
REVOKE SELECT (edit_token) ON public.grooms FROM authenticated;
REVOKE SELECT (edit_token) ON public.grooms FROM PUBLIC;

-- Re-grant SELECT on all other columns to authenticated so committee reads keep working
GRANT SELECT (
  id, full_name, phone, national_id, family_branch, bride_name, wedding_date,
  status, requirements_checklist, notes, created_by, created_at, updated_at,
  groom_contribution, deficit_share, contribution_paid, cards_men, cards_women,
  cards_printed, photo_url, national_id_url, extra_sheep, extra_cards_men,
  extra_cards_women, external_participation, external_participation_details,
  special_requests, request_type, request_details, vip_guests
) ON public.grooms TO authenticated;

-- 2) women_talent_responses: enforce one submission per phone number to limit
--    anonymous spam through the public form. Existing rows kept; duplicates blocked going forward.
CREATE UNIQUE INDEX IF NOT EXISTS women_talent_responses_phone_unique
  ON public.women_talent_responses (phone);
