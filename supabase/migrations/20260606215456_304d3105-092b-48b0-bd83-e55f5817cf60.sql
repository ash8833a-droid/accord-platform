CREATE TABLE IF NOT EXISTS public.minute_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  minute_id uuid NOT NULL REFERENCES public.committee_minutes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (minute_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_minute_ack_minute ON public.minute_acknowledgements(minute_id);
CREATE INDEX IF NOT EXISTS idx_minute_ack_user ON public.minute_acknowledgements(user_id);
GRANT SELECT, INSERT, DELETE ON public.minute_acknowledgements TO authenticated;
GRANT ALL ON public.minute_acknowledgements TO service_role;
ALTER TABLE public.minute_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read acknowledgements" ON public.minute_acknowledgements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can acknowledge as themselves" ON public.minute_acknowledgements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own acknowledgement" ON public.minute_acknowledgements FOR DELETE TO authenticated USING (auth.uid() = user_id);