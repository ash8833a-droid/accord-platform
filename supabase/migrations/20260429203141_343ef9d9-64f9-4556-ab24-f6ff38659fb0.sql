-- Internal requests system between users/committees
CREATE TYPE public.internal_request_category AS ENUM ('financial','administrative','logistics','media','consultative','urgent');
CREATE TYPE public.internal_request_status AS ENUM ('new','in_progress','pending_confirmation','completed','rejected','cancelled');
CREATE TYPE public.internal_request_priority AS ENUM ('low','medium','high','urgent');

CREATE TABLE public.internal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category public.internal_request_category NOT NULL DEFAULT 'administrative',
  priority public.internal_request_priority NOT NULL DEFAULT 'medium',
  status public.internal_request_status NOT NULL DEFAULT 'new',
  -- Requester
  requester_id uuid NOT NULL,
  requester_name text NOT NULL,
  requester_committee_id uuid,
  -- Target (committee and/or specific user)
  target_committee_id uuid,
  target_user_id uuid,
  target_user_name text,
  -- Tracking
  due_date date,
  completed_at timestamptz,
  completed_by uuid,
  completion_note text,
  rejection_reason text,
  attachment_url text,
  attachment_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ir_status ON public.internal_requests(status);
CREATE INDEX idx_ir_category ON public.internal_requests(category);
CREATE INDEX idx_ir_target_user ON public.internal_requests(target_user_id);
CREATE INDEX idx_ir_target_committee ON public.internal_requests(target_committee_id);
CREATE INDEX idx_ir_requester ON public.internal_requests(requester_id);

ALTER TABLE public.internal_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: admin/quality/supreme + requester + target user + members of source/target committees
CREATE POLICY ir_select ON public.internal_requests FOR SELECT
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'quality'::app_role)
  OR is_supreme_member(auth.uid())
  OR auth.uid() = requester_id
  OR auth.uid() = target_user_id
  OR (requester_committee_id IS NOT NULL AND is_committee_member(auth.uid(), requester_committee_id))
  OR (target_committee_id IS NOT NULL AND is_committee_member(auth.uid(), target_committee_id))
);

-- INSERT: any approved user as requester
CREATE POLICY ir_insert ON public.internal_requests FOR INSERT
WITH CHECK (
  auth.uid() = requester_id AND is_user_approved(auth.uid())
);

-- UPDATE: admin OR requester OR target user OR member of target committee OR committee head
CREATE POLICY ir_update ON public.internal_requests FOR UPDATE
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR auth.uid() = requester_id
  OR auth.uid() = target_user_id
  OR (target_committee_id IS NOT NULL AND is_committee_member(auth.uid(), target_committee_id))
  OR (target_committee_id IS NOT NULL AND is_committee_head(auth.uid(), target_committee_id))
);

-- DELETE: admin or requester (only if still new)
CREATE POLICY ir_delete ON public.internal_requests FOR DELETE
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR (auth.uid() = requester_id AND status = 'new')
);

CREATE TRIGGER trg_ir_updated_at BEFORE UPDATE ON public.internal_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify target user / committee on new request and on status changes
CREATE OR REPLACE FUNCTION public.notify_internal_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  member_rec record;
  status_label text;
  cat_label text;
BEGIN
  cat_label := CASE NEW.category::text
    WHEN 'financial' THEN 'مالي'
    WHEN 'administrative' THEN 'إداري'
    WHEN 'logistics' THEN 'لوجستي'
    WHEN 'media' THEN 'إعلامي'
    WHEN 'consultative' THEN 'استشاري'
    WHEN 'urgent' THEN 'عاجل'
    ELSE NEW.category::text END;

  IF TG_OP = 'INSERT' THEN
    IF NEW.target_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id,type,title,body,link,related_id)
      VALUES (NEW.target_user_id,'internal_request',
              'طلب '||cat_label||' جديد من '||NEW.requester_name,
              NEW.title,'/requests',NEW.id);
    END IF;
    IF NEW.target_committee_id IS NOT NULL THEN
      FOR member_rec IN SELECT DISTINCT user_id FROM public.user_roles
        WHERE committee_id = NEW.target_committee_id AND user_id <> NEW.requester_id
          AND (NEW.target_user_id IS NULL OR user_id <> NEW.target_user_id)
      LOOP
        INSERT INTO public.notifications (user_id,type,title,body,link,related_id)
        VALUES (member_rec.user_id,'internal_request',
                'طلب '||cat_label||' جديد من '||NEW.requester_name,
                NEW.title,'/requests',NEW.id);
      END LOOP;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    status_label := CASE NEW.status::text
      WHEN 'new' THEN 'جديد'
      WHEN 'in_progress' THEN 'قيد التنفيذ'
      WHEN 'pending_confirmation' THEN 'بانتظار التأكيد'
      WHEN 'completed' THEN 'مكتمل'
      WHEN 'rejected' THEN 'مرفوض'
      WHEN 'cancelled' THEN 'ملغي'
      ELSE NEW.status::text END;
    INSERT INTO public.notifications (user_id,type,title,body,link,related_id)
    VALUES (NEW.requester_id,'internal_request_status',
            'تحديث طلبك: '||status_label, NEW.title,'/requests',NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ir AFTER INSERT OR UPDATE ON public.internal_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_internal_request();