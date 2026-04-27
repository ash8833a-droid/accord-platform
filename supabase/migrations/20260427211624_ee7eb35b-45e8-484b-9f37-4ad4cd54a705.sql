CREATE OR REPLACE FUNCTION public.notify_new_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  type_label TEXT;
  src_name TEXT;
  rec RECORD;
  link_url TEXT := '/communications';
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
            substring(NEW.body, 1, 160), '/communications', NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;