
CREATE OR REPLACE FUNCTION public.sync_media_grooms_access()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type committee_type;
BEGIN
  IF NEW.committee_id IS NULL THEN RETURN NEW; END IF;
  SELECT type INTO v_type FROM committees WHERE id = NEW.committee_id;
  IF v_type = 'media' THEN
    INSERT INTO public.page_permissions (user_id, page_key, access_level)
    VALUES (NEW.user_id, 'grooms', 'edit'::page_access_level)
    ON CONFLICT (user_id, page_key) DO UPDATE SET access_level = 'edit'::page_access_level, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_media_grooms_access ON public.user_roles;
CREATE TRIGGER trg_sync_media_grooms_access
AFTER INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_media_grooms_access();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'page_permissions_user_page_unique') THEN
    ALTER TABLE public.page_permissions ADD CONSTRAINT page_permissions_user_page_unique UNIQUE (user_id, page_key);
  END IF;
END $$;

INSERT INTO public.page_permissions (user_id, page_key, access_level)
SELECT DISTINCT ur.user_id, 'grooms', 'edit'::page_access_level
FROM public.user_roles ur
JOIN public.committees c ON c.id = ur.committee_id
WHERE c.type = 'media'
ON CONFLICT (user_id, page_key) DO UPDATE SET access_level = 'edit'::page_access_level, updated_at = now();
