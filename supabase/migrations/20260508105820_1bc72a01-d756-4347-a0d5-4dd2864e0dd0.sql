ALTER TABLE public.grooms ADD COLUMN IF NOT EXISTS edit_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS grooms_edit_token_key ON public.grooms(edit_token);
CREATE INDEX IF NOT EXISTS grooms_phone_idx ON public.grooms(phone);
CREATE INDEX IF NOT EXISTS grooms_national_id_idx ON public.grooms(national_id);