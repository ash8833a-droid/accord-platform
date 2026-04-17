-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'committee', 'delegate', 'quality');
CREATE TYPE public.committee_type AS ENUM ('finance', 'media', 'quality', 'programs', 'dinner', 'logistics', 'reception', 'design');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'completed');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.subscription_status AS ENUM ('pending', 'confirmed', 'rejected');
CREATE TYPE public.payment_request_status AS ENUM ('pending', 'approved', 'rejected', 'paid');
CREATE TYPE public.groom_status AS ENUM ('new', 'under_review', 'approved', 'rejected', 'completed');

-- ========== TIMESTAMP TRIGGER ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  family_branch TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'phone');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== USER ROLES ==========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  committee_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, committee_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_committee_member(_user_id UUID, _committee_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND committee_id = _committee_id);
$$;

-- ========== COMMITTEES ==========
CREATE TABLE public.committees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type committee_type NOT NULL,
  description TEXT,
  budget_allocated NUMERIC(12,2) NOT NULL DEFAULT 0,
  budget_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  head_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER committees_updated_at BEFORE UPDATE ON public.committees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_committee_fk
  FOREIGN KEY (committee_id) REFERENCES public.committees(id) ON DELETE CASCADE;

-- ========== COMMITTEE TASKS ==========
CREATE TABLE public.committee_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.committee_tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.committee_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== DELEGATES ==========
CREATE TABLE public.delegates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  family_branch TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delegates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER delegates_updated_at BEFORE UPDATE ON public.delegates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== SUBSCRIBERS (family members under a delegate) ==========
CREATE TABLE public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegate_id UUID NOT NULL REFERENCES public.delegates(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  national_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER subscribers_updated_at BEFORE UPDATE ON public.subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== SUBSCRIPTIONS (300 SAR yearly) ==========
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES public.subscribers(id) ON DELETE CASCADE,
  delegate_id UUID NOT NULL REFERENCES public.delegates(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 300,
  year INT NOT NULL DEFAULT EXTRACT(YEAR FROM now())::INT,
  status subscription_status NOT NULL DEFAULT 'pending',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== PAYMENT REQUESTS ==========
CREATE TABLE public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  invoice_url TEXT,
  status payment_request_status NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER payment_requests_updated_at BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== GROOMS ==========
CREATE TABLE public.grooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  national_id TEXT,
  family_branch TEXT NOT NULL,
  bride_name TEXT,
  wedding_date DATE,
  status groom_status NOT NULL DEFAULT 'new',
  requirements_checklist JSONB NOT NULL DEFAULT '{}'::JSONB,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grooms ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER grooms_updated_at BEFORE UPDATE ON public.grooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== GROOM DOCUMENTS ==========
CREATE TABLE public.groom_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  groom_id UUID NOT NULL REFERENCES public.grooms(id) ON DELETE CASCADE,
  doc_name TEXT NOT NULL,
  doc_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.groom_documents ENABLE ROW LEVEL SECURITY;

-- ========== REPORTS ==========
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id UUID REFERENCES public.committees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  report_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM now())::INT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ========== ANNOUNCEMENTS ==========
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- ========== RLS POLICIES ==========

-- profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'quality'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'quality'));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- committees: visible to everyone authenticated
CREATE POLICY "committees_select_auth" ON public.committees FOR SELECT TO authenticated USING (true);
CREATE POLICY "committees_admin_manage" ON public.committees FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- committee_tasks: members of that committee, admin, quality
CREATE POLICY "tasks_select" ON public.committee_tasks FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'quality') OR
    public.is_committee_member(auth.uid(), committee_id)
  );
CREATE POLICY "tasks_insert" ON public.committee_tasks FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.is_committee_member(auth.uid(), committee_id)
  );
CREATE POLICY "tasks_update" ON public.committee_tasks FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.is_committee_member(auth.uid(), committee_id)
  );
CREATE POLICY "tasks_delete" ON public.committee_tasks FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- delegates
CREATE POLICY "delegates_select" ON public.delegates FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'quality') OR
    auth.uid() = user_id
  );
CREATE POLICY "delegates_admin_manage" ON public.delegates FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- subscribers: own delegate, admin, quality
CREATE POLICY "subscribers_select" ON public.subscribers FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'quality') OR
    EXISTS (SELECT 1 FROM public.delegates d WHERE d.id = subscribers.delegate_id AND d.user_id = auth.uid())
  );
CREATE POLICY "subscribers_delegate_insert" ON public.subscribers FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.delegates d WHERE d.id = subscribers.delegate_id AND d.user_id = auth.uid())
  );
CREATE POLICY "subscribers_delegate_update" ON public.subscribers FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.delegates d WHERE d.id = subscribers.delegate_id AND d.user_id = auth.uid())
  );
CREATE POLICY "subscribers_admin_delete" ON public.subscribers FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- subscriptions
CREATE POLICY "subs_select" ON public.subscriptions FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'quality') OR
    EXISTS (SELECT 1 FROM public.delegates d WHERE d.id = subscriptions.delegate_id AND d.user_id = auth.uid())
  );
CREATE POLICY "subs_delegate_insert" ON public.subscriptions FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.delegates d WHERE d.id = subscriptions.delegate_id AND d.user_id = auth.uid())
  );
CREATE POLICY "subs_admin_update" ON public.subscriptions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "subs_admin_delete" ON public.subscriptions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- payment_requests
CREATE POLICY "pr_select" ON public.payment_requests FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'quality') OR
    public.is_committee_member(auth.uid(), committee_id)
  );
CREATE POLICY "pr_committee_insert" ON public.payment_requests FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.is_committee_member(auth.uid(), committee_id)
  );
CREATE POLICY "pr_admin_update" ON public.payment_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pr_admin_delete" ON public.payment_requests FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- grooms (programs/quality/admin)
CREATE POLICY "grooms_select" ON public.grooms FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'quality') OR
    EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.committees c ON c.id = ur.committee_id
            WHERE ur.user_id = auth.uid() AND c.type IN ('programs','reception','dinner','logistics'))
  );
CREATE POLICY "grooms_insert" ON public.grooms FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.committees c ON c.id = ur.committee_id
            WHERE ur.user_id = auth.uid() AND c.type IN ('programs','reception'))
  );
CREATE POLICY "grooms_update" ON public.grooms FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.committees c ON c.id = ur.committee_id
            WHERE ur.user_id = auth.uid() AND c.type IN ('programs','reception'))
  );
CREATE POLICY "grooms_admin_delete" ON public.grooms FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- groom_documents
CREATE POLICY "gd_select" ON public.groom_documents FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'quality') OR
    EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.committees c ON c.id = ur.committee_id
            WHERE ur.user_id = auth.uid() AND c.type IN ('programs','reception'))
  );
CREATE POLICY "gd_insert" ON public.groom_documents FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.committees c ON c.id = ur.committee_id
            WHERE ur.user_id = auth.uid() AND c.type IN ('programs','reception'))
  );

-- reports
CREATE POLICY "reports_select_auth" ON public.reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "reports_insert" ON public.reports FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'quality') OR
    (committee_id IS NOT NULL AND public.is_committee_member(auth.uid(), committee_id))
  );
CREATE POLICY "reports_admin_delete" ON public.reports FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- announcements
CREATE POLICY "ann_select_auth" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "ann_admin_manage" ON public.announcements FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== STORAGE BUCKETS ==========
INSERT INTO storage.buckets (id, name, public) VALUES
  ('invoices', 'invoices', false),
  ('groom-docs', 'groom-docs', false),
  ('reports', 'reports', false);

-- invoices: committee members can upload/read their committee's, admin all
CREATE POLICY "invoices_auth_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoices' AND (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'quality') OR
    auth.uid()::text = (storage.foldername(name))[1]
  ));
CREATE POLICY "invoices_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

-- groom-docs
CREATE POLICY "gdocs_auth_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'groom-docs' AND (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'quality') OR
    EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.committees c ON c.id = ur.committee_id
            WHERE ur.user_id = auth.uid() AND c.type IN ('programs','reception'))
  ));
CREATE POLICY "gdocs_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'groom-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- reports
CREATE POLICY "reports_auth_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reports');
CREATE POLICY "reports_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ========== SEED COMMITTEES ==========
INSERT INTO public.committees (name, type, description, budget_allocated) VALUES
  ('اللجنة المالية', 'finance', 'إدارة الاشتراكات والميزانيات والصرف', 50000),
  ('لجنة الإعلام', 'media', 'التغطية الإعلامية والتصوير والنشر', 25000),
  ('لجنة الجودة', 'quality', 'المتابعة والرقابة وقياس الرضا', 10000),
  ('لجنة البرامج', 'programs', 'البرامج المقدمة للعرسان والضيوف', 40000),
  ('لجنة العشاء', 'dinner', 'تنظيم وجبات الحفل', 80000),
  ('لجنة الاستقبال', 'reception', 'استقبال العرسان والضيوف', 15000),
  ('لجنة التجهيزات', 'logistics', 'الصوتيات والإضاءة والمكان', 60000),
  ('لجنة التصميم', 'design', 'تصميم الديكور والشعارات والمطبوعات', 20000);