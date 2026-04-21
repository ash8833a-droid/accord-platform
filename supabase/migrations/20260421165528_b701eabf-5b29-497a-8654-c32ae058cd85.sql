
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select_auth"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "app_settings_admin_manage"
  ON public.app_settings FOR ALL
  TO public
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.app_settings (key, value) VALUES
  ('urgent_alert', '{"enabled": true, "label": "عاجل"}'::jsonb);
