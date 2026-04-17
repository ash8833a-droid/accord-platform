CREATE OR REPLACE FUNCTION public.sync_committee_budget_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- New paid request
  IF TG_OP = 'INSERT' AND NEW.status = 'paid' THEN
    UPDATE public.committees
       SET budget_spent = budget_spent + NEW.amount,
           updated_at = now()
     WHERE id = NEW.committee_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Status transitioned TO paid
    IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
      UPDATE public.committees
         SET budget_spent = budget_spent + NEW.amount,
             updated_at = now()
       WHERE id = NEW.committee_id;
    -- Status transitioned AWAY from paid (revert)
    ELSIF OLD.status = 'paid' AND NEW.status IS DISTINCT FROM 'paid' THEN
      UPDATE public.committees
         SET budget_spent = GREATEST(0, budget_spent - OLD.amount),
             updated_at = now()
       WHERE id = OLD.committee_id;
    -- Amount changed while still paid
    ELSIF NEW.status = 'paid' AND OLD.status = 'paid' AND NEW.amount <> OLD.amount THEN
      UPDATE public.committees
         SET budget_spent = GREATEST(0, budget_spent - OLD.amount + NEW.amount),
             updated_at = now()
       WHERE id = NEW.committee_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Deletion of a paid request
  IF TG_OP = 'DELETE' AND OLD.status = 'paid' THEN
    UPDATE public.committees
       SET budget_spent = GREATEST(0, budget_spent - OLD.amount),
           updated_at = now()
     WHERE id = OLD.committee_id;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_committee_budget ON public.payment_requests;

CREATE TRIGGER trg_sync_committee_budget
AFTER INSERT OR UPDATE OR DELETE ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_committee_budget_on_payment();