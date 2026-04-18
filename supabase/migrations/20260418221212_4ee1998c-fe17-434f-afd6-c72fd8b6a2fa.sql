ALTER TABLE public.grooms 
  ADD COLUMN IF NOT EXISTS request_type text,
  ADD COLUMN IF NOT EXISTS request_details text,
  ADD COLUMN IF NOT EXISTS vip_guests text;