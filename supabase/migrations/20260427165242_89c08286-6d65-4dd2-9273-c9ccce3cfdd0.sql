-- Enum لحالات الطلب
DO $$ BEGIN
  CREATE TYPE public.procurement_request_status AS ENUM (
    'new', 'under_review', 'approved', 'rejected', 'purchasing', 'delivered'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.procurement_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- الجدول الرئيسي
CREATE TABLE IF NOT EXISTS public.procurement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  requested_by UUID,
  requester_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'قطعة',
  needed_by DATE,
  priority public.procurement_priority NOT NULL DEFAULT 'medium',
  notes TEXT,
  status public.procurement_request_status NOT NULL DEFAULT 'new',
  decision_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procreq_committee ON public.procurement_requests(requesting_committee_id);
CREATE INDEX IF NOT EXISTS idx_procreq_status ON public.procurement_requests(status);

ALTER TABLE public.procurement_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: الإدارة، الجودة، أعضاء اللجنة الطالبة، أعضاء لجنة المشتريات، اللجنة العليا
CREATE POLICY "procreq_select" ON public.procurement_requests
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'quality'::app_role)
  OR is_committee_member(auth.uid(), requesting_committee_id)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid()
      AND c.type IN ('procurement'::committee_type, 'supreme'::committee_type)
  )
);

-- INSERT: عضو في اللجنة الطالبة فقط (أو إدارة)
CREATE POLICY "procreq_insert" ON public.procurement_requests
FOR INSERT WITH CHECK (
  auth.uid() = requested_by
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_committee_member(auth.uid(), requesting_committee_id)
  )
);

-- UPDATE: الإدارة أو لجنة المشتريات (لتغيير الحالة) أو منشئ الطلب وهو لا يزال 'new'
CREATE POLICY "procreq_update" ON public.procurement_requests
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.committees c ON c.id = ur.committee_id
    WHERE ur.user_id = auth.uid() AND c.type = 'procurement'::committee_type
  )
  OR (auth.uid() = requested_by AND status = 'new')
);

-- DELETE: الإدارة أو منشئ الطلب وهو 'new'
CREATE POLICY "procreq_delete" ON public.procurement_requests
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (auth.uid() = requested_by AND status = 'new')
);

CREATE TRIGGER trg_procreq_updated_at
BEFORE UPDATE ON public.procurement_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- إشعار: عند إنشاء طلب جديد → أعضاء لجنة المشتريات
CREATE OR REPLACE FUNCTION public.notify_procurement_on_new_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  proc_id UUID;
  member_rec RECORD;
  req_committee_name TEXT;
BEGIN
  SELECT id INTO proc_id FROM public.committees WHERE type = 'procurement' LIMIT 1;
  IF proc_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO req_committee_name FROM public.committees WHERE id = NEW.requesting_committee_id;

  FOR member_rec IN
    SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.committee_id = proc_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      member_rec.user_id,
      'procurement_request',
      'طلب شراء جديد من ' || COALESCE(req_committee_name, 'لجنة'),
      NEW.item_name || ' · الكمية: ' || NEW.quantity::text || ' ' || NEW.unit
        || CASE WHEN NEW.needed_by IS NOT NULL THEN ' · مطلوب قبل: ' || NEW.needed_by::text ELSE '' END,
      '/procurement-requests',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_procurement_new
AFTER INSERT ON public.procurement_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_procurement_on_new_request();

-- إشعار: عند تغيّر الحالة → منشئ الطلب
CREATE OR REPLACE FUNCTION public.notify_requester_on_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  status_label TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.requested_by IS NOT NULL THEN
    status_label := CASE NEW.status
      WHEN 'under_review' THEN 'قيد المراجعة'
      WHEN 'approved' THEN 'تم الاعتماد'
      WHEN 'rejected' THEN 'مرفوض'
      WHEN 'purchasing' THEN 'قيد الشراء'
      WHEN 'delivered' THEN 'تم التسليم'
      ELSE NEW.status::text
    END;

    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      NEW.requested_by,
      'procurement_status',
      'تحديث طلب شراء: ' || status_label,
      NEW.item_name || COALESCE(' — ' || NEW.decision_notes, ''),
      '/procurement-requests',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_requester_status
AFTER UPDATE ON public.procurement_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_requester_on_status_change();