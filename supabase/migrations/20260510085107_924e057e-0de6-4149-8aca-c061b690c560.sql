
CREATE OR REPLACE FUNCTION public.route_groom_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_committee RECORD;
  v_task_id uuid;
  v_title text;
  v_desc text;
BEGIN
  -- Only fire when status transitions INTO 'approved'
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  -- 1) PROCUREMENT: extra sacrifices
  IF COALESCE(NEW.extra_sheep, 0) > 0 THEN
    SELECT id, head_user_id INTO v_committee
      FROM committees WHERE type = 'procurement' LIMIT 1;
    IF v_committee.id IS NOT NULL THEN
      v_title := '[طلب عريس] ' || NEW.full_name || ' — زيادة ذبائح';
      v_desc  := 'الفرع: ' || NEW.family_branch
              || E'\nالجوال: ' || NEW.phone
              || E'\nعدد الذبائح الإضافية المطلوبة: ' || NEW.extra_sheep
              || COALESCE(E'\nتاريخ الزواج: ' || to_char(NEW.wedding_date, 'YYYY-MM-DD'), '')
              || COALESCE(E'\nملاحظات: ' || NEW.special_requests, '');
      INSERT INTO committee_tasks (committee_id, title, description, status, created_by)
        VALUES (v_committee.id, v_title, v_desc, 'todo', NEW.created_by)
        RETURNING id INTO v_task_id;

      IF v_committee.head_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, body, link, related_id)
          VALUES (v_committee.head_user_id, 'groom_request',
            'طلب عريس جديد — لجنة المشتريات',
            v_title, '/admin/tasks', v_task_id);
      END IF;

      INSERT INTO groom_audit_log (groom_id, event_type, note, actor_user_id)
        VALUES (NEW.id, 'routed_procurement',
                'تم توجيه طلب زيادة ذبائح إلى لجنة المشتريات', NEW.created_by);
    END IF;
  END IF;

  -- 2) RECEPTION: VIP guests
  IF NEW.vip_guests IS NOT NULL AND length(btrim(NEW.vip_guests)) > 0 THEN
    SELECT id, head_user_id INTO v_committee
      FROM committees WHERE type = 'reception' LIMIT 1;
    IF v_committee.id IS NOT NULL THEN
      v_title := '[طلب عريس] ' || NEW.full_name || ' — حجز كراسي شخصيات اعتبارية';
      v_desc  := 'الفرع: ' || NEW.family_branch
              || E'\nالجوال: ' || NEW.phone
              || COALESCE(E'\nتاريخ الزواج: ' || to_char(NEW.wedding_date, 'YYYY-MM-DD'), '')
              || E'\nالضيوف VIP:\n' || NEW.vip_guests;
      INSERT INTO committee_tasks (committee_id, title, description, status, created_by)
        VALUES (v_committee.id, v_title, v_desc, 'todo', NEW.created_by)
        RETURNING id INTO v_task_id;

      IF v_committee.head_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, body, link, related_id)
          VALUES (v_committee.head_user_id, 'groom_request',
            'طلب عريس جديد — لجنة الاستقبال والضيافة',
            v_title, '/admin/tasks', v_task_id);
      END IF;

      INSERT INTO groom_audit_log (groom_id, event_type, note, actor_user_id)
        VALUES (NEW.id, 'routed_reception',
                'تم توجيه حجز كراسي VIP إلى لجنة الاستقبال', NEW.created_by);
    END IF;
  END IF;

  -- 3) PROGRAMS: external performance / poetry / sheilat
  IF NEW.external_participation = true THEN
    SELECT id, head_user_id INTO v_committee
      FROM committees WHERE type = 'programs' LIMIT 1;
    IF v_committee.id IS NOT NULL THEN
      v_title := '[طلب عريس] ' || NEW.full_name || ' — قصائد / شيلات / مشاركة خارجية';
      v_desc  := 'الفرع: ' || NEW.family_branch
              || E'\nالجوال: ' || NEW.phone
              || COALESCE(E'\nتاريخ الزواج: ' || to_char(NEW.wedding_date, 'YYYY-MM-DD'), '')
              || E'\nتفاصيل المشاركة:\n' || COALESCE(NEW.external_participation_details, 'لم تُذكر التفاصيل');
      INSERT INTO committee_tasks (committee_id, title, description, status, created_by)
        VALUES (v_committee.id, v_title, v_desc, 'todo', NEW.created_by)
        RETURNING id INTO v_task_id;

      IF v_committee.head_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, body, link, related_id)
          VALUES (v_committee.head_user_id, 'groom_request',
            'طلب عريس جديد — لجنة البرامج',
            v_title, '/admin/tasks', v_task_id);
      END IF;

      INSERT INTO groom_audit_log (groom_id, event_type, note, actor_user_id)
        VALUES (NEW.id, 'routed_programs',
                'تم توجيه طلب القصائد/الشيلات إلى لجنة البرامج', NEW.created_by);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_groom_requests ON public.grooms;
CREATE TRIGGER trg_route_groom_requests
AFTER INSERT OR UPDATE OF status ON public.grooms
FOR EACH ROW
EXECUTE FUNCTION public.route_groom_requests();
