UPDATE public.app_settings
SET value = jsonb_set(value, '{name}', '"منصة لجنة الزواج الجماعي"'::jsonb),
    updated_at = now()
WHERE key = 'brand_identity';