-- نظام منشورات اللجان: منجز / خبر / استفسار / إعلان داخلي
CREATE TYPE public.post_type AS ENUM ('achievement', 'news', 'inquiry', 'internal_announcement');
CREATE TYPE public.post_scope AS ENUM ('committee', 'targeted', 'all');

CREATE TABLE public.committee_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  source_committee_id UUID NOT NULL,
  target_committee_id UUID,
  scope post_scope NOT NULL DEFAULT 'committee',
  post_type post_type NOT NULL DEFAULT 'news',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_source ON public.committee_posts(source_committee_id);
CREATE INDEX idx_posts_target ON public.committee_posts(target_committee_id);
CREATE INDEX idx_posts_scope ON public.committee_posts(scope);
CREATE INDEX idx_posts_created ON public.committee_posts(created_at DESC);

ALTER TABLE public.committee_posts ENABLE ROW LEVEL SECURITY;

-- إدراج: العضو يكتب فقط من لجنته
CREATE POLICY posts_insert ON public.committee_posts FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_committee_member(auth.uid(), source_committee_id)
  )
);

-- قراءة: حسب النطاق
CREATE POLICY posts_select ON public.committee_posts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'quality'::app_role)
  OR is_supreme_member(auth.uid())
  OR scope = 'all'
  OR (scope = 'committee' AND is_committee_member(auth.uid(), source_committee_id))
  OR (scope = 'targeted' AND (
        is_committee_member(auth.uid(), source_committee_id)
        OR (target_committee_id IS NOT NULL AND is_committee_member(auth.uid(), target_committee_id))
     ))
);

-- تحديث/حذف: الكاتب أو الأدمن أو رئيس اللجنة المصدر
CREATE POLICY posts_update ON public.committee_posts FOR UPDATE TO authenticated
USING (
  auth.uid() = author_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_committee_head(auth.uid(), source_committee_id)
);

CREATE POLICY posts_delete ON public.committee_posts FOR DELETE TO authenticated
USING (
  auth.uid() = author_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_committee_head(auth.uid(), source_committee_id)
);

CREATE TRIGGER trg_posts_updated_at
BEFORE UPDATE ON public.committee_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- تعليقات على المنشورات
CREATE TABLE public.committee_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.committee_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_comments_post ON public.committee_post_comments(post_id);

ALTER TABLE public.committee_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pc_insert ON public.committee_post_comments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.committee_posts p WHERE p.id = post_id)
);

CREATE POLICY pc_select ON public.committee_post_comments FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.committee_posts p WHERE p.id = post_id)
);

CREATE POLICY pc_delete ON public.committee_post_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- إشعار تلقائي عند نشر منشور جديد
CREATE OR REPLACE FUNCTION public.notify_new_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  type_label TEXT;
  src_name TEXT;
  rec RECORD;
  link_url TEXT := '/posts';
BEGIN
  type_label := CASE NEW.post_type
    WHEN 'achievement' THEN 'منجز'
    WHEN 'news' THEN 'خبر'
    WHEN 'inquiry' THEN 'استفسار'
    WHEN 'internal_announcement' THEN 'إعلان داخلي'
    ELSE 'منشور'
  END;

  SELECT name INTO src_name FROM public.committees WHERE id = NEW.source_committee_id;

  IF NEW.scope = 'all' THEN
    FOR rec IN
      SELECT DISTINCT user_id FROM public.user_roles
      WHERE user_id <> NEW.author_id AND committee_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
      VALUES (rec.user_id, 'committee_post',
              type_label || ' من ' || COALESCE(src_name, 'لجنة') || ': ' || NEW.title,
              substring(NEW.body, 1, 160), link_url, NEW.id);
    END LOOP;
  ELSIF NEW.scope = 'targeted' AND NEW.target_committee_id IS NOT NULL THEN
    FOR rec IN
      SELECT DISTINCT user_id FROM public.user_roles
      WHERE committee_id IN (NEW.source_committee_id, NEW.target_committee_id)
        AND user_id <> NEW.author_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
      VALUES (rec.user_id, 'committee_post',
              type_label || ' من ' || COALESCE(src_name, 'لجنة') || ': ' || NEW.title,
              substring(NEW.body, 1, 160), link_url, NEW.id);
    END LOOP;
  ELSE
    FOR rec IN
      SELECT DISTINCT user_id FROM public.user_roles
      WHERE committee_id = NEW.source_committee_id
        AND user_id <> NEW.author_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
      VALUES (rec.user_id, 'committee_post',
              type_label || ' داخل ' || COALESCE(src_name, 'اللجنة') || ': ' || NEW.title,
              substring(NEW.body, 1, 160), link_url, NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_post
AFTER INSERT ON public.committee_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_new_post();

-- إشعار صاحب المنشور عند تعليق جديد
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  post_rec RECORD;
BEGIN
  SELECT author_id, title INTO post_rec FROM public.committee_posts WHERE id = NEW.post_id;
  IF post_rec.author_id IS NOT NULL AND post_rec.author_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (post_rec.author_id, 'post_comment',
            'تعليق جديد من ' || NEW.author_name || ' على: ' || post_rec.title,
            substring(NEW.body, 1, 160), '/posts', NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_post_comment
AFTER INSERT ON public.committee_post_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();