-- ==== Page-level permissions per user ====
CREATE TYPE public.page_access_level AS ENUM ('hidden', 'read', 'edit');

CREATE TABLE public.page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_key text NOT NULL,
  access_level public.page_access_level NOT NULL DEFAULT 'read',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (user_id, page_key)
);

ALTER TABLE public.page_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pp_admin_manage" ON public.page_permissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pp_select_own" ON public.page_permissions
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_page_permissions_user ON public.page_permissions(user_id);

CREATE TRIGGER trg_page_permissions_updated
  BEFORE UPDATE ON public.page_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==== User account status (enable/disable) ====
CREATE TABLE public.user_account_status (
  user_id uuid PRIMARY KEY,
  is_disabled boolean NOT NULL DEFAULT false,
  disabled_reason text,
  disabled_at timestamptz,
  disabled_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_account_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uas_admin_manage" ON public.user_account_status
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "uas_select_own" ON public.user_account_status
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ==== Activity log per user ====
CREATE TABLE public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_label text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ual_admin_select" ON public.user_activity_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE POLICY "ual_self_insert" ON public.user_activity_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ual_user_created ON public.user_activity_log(user_id, created_at DESC);

-- ==== Helper: get effective page access for current user ====
CREATE OR REPLACE FUNCTION public.get_page_access(_user_id uuid, _page_key text)
RETURNS public.page_access_level
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT access_level FROM public.page_permissions
       WHERE user_id = _user_id AND page_key = _page_key LIMIT 1),
    CASE
      WHEN public.has_role(_user_id, 'admin') THEN 'edit'::public.page_access_level
      ELSE 'read'::public.page_access_level
    END
  );
$$;

-- ==== Helper: check if account disabled ====
CREATE OR REPLACE FUNCTION public.is_account_disabled(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_disabled FROM public.user_account_status WHERE user_id = _user_id),
    false
  );
$$;