
CREATE TYPE public.idea_status AS ENUM ('new', 'under_review', 'approved', 'implemented', 'archived');

CREATE TABLE public.ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text,
  status public.idea_status NOT NULL DEFAULT 'new',
  admin_response text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  votes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

-- Any approved member can read all ideas
CREATE POLICY ideas_select_auth ON public.ideas
  FOR SELECT TO authenticated USING (public.is_user_approved(auth.uid()));

-- Any approved member can submit their own idea
CREATE POLICY ideas_insert_own ON public.ideas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_user_approved(auth.uid()));

-- Owner can edit their own pending idea; admin can edit any
CREATE POLICY ideas_update ON public.ideas
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Owner can delete their own; admin can delete any
CREATE POLICY ideas_delete ON public.ideas
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ideas_updated_at
  BEFORE UPDATE ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Votes table (one vote per user per idea)
CREATE TABLE public.idea_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(idea_id, user_id)
);

ALTER TABLE public.idea_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY iv_select ON public.idea_votes
  FOR SELECT TO authenticated USING (public.is_user_approved(auth.uid()));

CREATE POLICY iv_insert ON public.idea_votes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_user_approved(auth.uid()));

CREATE POLICY iv_delete ON public.idea_votes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Sync votes_count
CREATE OR REPLACE FUNCTION public.sync_idea_votes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.ideas SET votes_count = votes_count + 1, updated_at = now() WHERE id = NEW.idea_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.ideas SET votes_count = GREATEST(0, votes_count - 1), updated_at = now() WHERE id = OLD.idea_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER idea_votes_sync
  AFTER INSERT OR DELETE ON public.idea_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_idea_votes_count();
