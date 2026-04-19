-- Notifications fan-out on groom approval to relevant committees
CREATE OR REPLACE FUNCTION public.notify_committees_on_groom_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  member_rec record;
  finance_id uuid;
  procurement_id uuid;
  programs_id uuid;
  reception_id uuid;
  media_id uuid;
  extra_amount numeric;
  body_extra text;
  body_part text;
  body_vip text;
  body_media text;
BEGIN
  -- Only fire when status transitions TO approved
  IF NOT (TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO finance_id     FROM public.committees WHERE type = 'finance'     LIMIT 1;
  SELECT id INTO procurement_id FROM public.committees WHERE type = 'procurement' LIMIT 1;
  SELECT id INTO programs_id    FROM public.committees WHERE type = 'programs'    LIMIT 1;
  SELECT id INTO reception_id   FROM public.committees WHERE type = 'reception'   LIMIT 1;
  SELECT id INTO media_id       FROM public.committees WHERE type = 'media'       LIMIT 1;

  -- ===== 1) Extra sheep -> Finance + Procurement (2000 per sheep) =====
  IF COALESCE(NEW.extra_sheep, 0) > 0 THEN
    extra_amount := NEW.extra_sheep * 2000;
    body_extra := NEW.full_name || ' · ' || NEW.family_branch
                  || ' — عدد الذبائح الزيادة: ' || NEW.extra_sheep
                  || ' (المبلغ المستحق على العريس: ' || extra_amount::text || ' ر.س — 2000 لكل ذبيحة)';

    -- Finance committee members
    IF finance_id IS NOT NULL THEN
      FOR member_rec IN
        SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.committee_id = finance_id
      LOOP
        INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
        VALUES (member_rec.user_id, 'groom_extra_sheep_finance',
                'ذبائح إضافية — متابعة سداد من العريس',
                body_extra, '/committee/finance', NEW.id);
      END LOOP;
    END IF;

    -- Procurement committee members
    IF procurement_id IS NOT NULL THEN
      FOR member_rec IN
        SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.committee_id = procurement_id
      LOOP
        INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
        VALUES (member_rec.user_id, 'groom_extra_sheep_procurement',
                'ذبائح إضافية مطلوب توفيرها',
                NEW.full_name || ' · ' || NEW.family_branch
                  || ' — عدد الذبائح الزيادة المطلوب توفيرها: ' || NEW.extra_sheep,
                '/committee/procurement', NEW.id);
      END LOOP;
    END IF;
  END IF;

  -- ===== 2) External participation -> Programs committee =====
  IF NEW.external_participation IS TRUE AND programs_id IS NOT NULL THEN
    body_part := NEW.full_name || ' · ' || NEW.family_branch || E'\n'
                 || COALESCE(NEW.external_participation_details, 'لم تُذكر التفاصيل');
    FOR member_rec IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.committee_id = programs_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
      VALUES (member_rec.user_id, 'groom_external_participation',
              'مشاركات خارجية — لإدراجها ضمن فقرات البرنامج',
              body_part, '/committee/programs', NEW.id);
    END LOOP;
  END IF;

  -- ===== 3) VIP guests -> Reception committee =====
  IF NEW.vip_guests IS NOT NULL AND btrim(NEW.vip_guests) <> '' AND reception_id IS NOT NULL THEN
    body_vip := NEW.full_name || ' · ' || NEW.family_branch || E'\nالضيوف:\n' || NEW.vip_guests;
    FOR member_rec IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.committee_id = reception_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
      VALUES (member_rec.user_id, 'groom_vip_guests',
              'ضيوف شخصيات اعتبارية — حجز مقاعد مخصصة',
              body_vip, '/committee/reception', NEW.id);
    END LOOP;
  END IF;

  -- ===== 4) Full data summary -> Media committee (database/details) =====
  IF media_id IS NOT NULL THEN
    body_media := 'العريس: ' || NEW.full_name
                  || E'\nالفرع: ' || NEW.family_branch
                  || E'\nالجوال: ' || NEW.phone
                  || CASE WHEN NEW.bride_name IS NOT NULL THEN E'\nالعروس: ' || NEW.bride_name ELSE '' END
                  || CASE WHEN NEW.wedding_date IS NOT NULL THEN E'\nموعد الزفاف: ' || NEW.wedding_date::text ELSE '' END
                  || E'\nذبائح إضافية: ' || COALESCE(NEW.extra_sheep,0)::text
                  || ' · كروت رجال إضافية: ' || COALESCE(NEW.extra_cards_men,0)::text
                  || ' · كروت نساء إضافية: ' || COALESCE(NEW.extra_cards_women,0)::text
                  || CASE WHEN NEW.external_participation THEN E'\nمشاركات خارجية: نعم' ELSE '' END
                  || CASE WHEN NEW.vip_guests IS NOT NULL AND btrim(NEW.vip_guests) <> ''
                          THEN E'\nضيوف VIP: ' || NEW.vip_guests ELSE '' END;
    FOR member_rec IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.committee_id = media_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
      VALUES (member_rec.user_id, 'groom_approved_media',
              'اعتماد عريس — تفاصيل كاملة لقاعدة البيانات',
              body_media, '/grooms', NEW.id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_committees_on_groom_approval ON public.grooms;
CREATE TRIGGER trg_notify_committees_on_groom_approval
AFTER UPDATE ON public.grooms
FOR EACH ROW EXECUTE FUNCTION public.notify_committees_on_groom_approval();