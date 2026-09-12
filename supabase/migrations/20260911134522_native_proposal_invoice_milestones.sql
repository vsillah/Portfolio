-- Invoice-managed settlement on the existing milestone ledger. No provider or invoice creation.
BEGIN;
ALTER TABLE public.proposals ADD COLUMN milestone_settlement text NOT NULL DEFAULT 'stripe_checkout'
 CHECK (milestone_settlement IN ('stripe_checkout','manual_invoice'));
ALTER TABLE public.proposals ADD CONSTRAINT invoice_requires_milestones CHECK (milestone_settlement <> 'manual_invoice' OR payment_schedule='milestones');
ALTER TABLE public.installment_payments ADD COLUMN manual_receipt_reference text,
 ADD COLUMN manual_recorded_by uuid, ADD COLUMN manual_recorded_at timestamptz;
CREATE UNIQUE INDEX manual_milestone_receipt_reference ON public.installment_payments(manual_receipt_reference) WHERE manual_receipt_reference IS NOT NULL;

CREATE FUNCTION public.guard_invoice_milestone_mode() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.milestone_settlement IS DISTINCT FROM NEW.milestone_settlement AND
 (OLD.status<>'draft' OR OLD.access_code IS NOT NULL OR OLD.signed_at IS NOT NULL OR OLD.contract_signed_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.installment_plans WHERE proposal_id=OLD.id))
 THEN RAISE EXCEPTION 'Select settlement mode before issuance or payments'; END IF;
 IF NEW.milestone_settlement='manual_invoice' AND (NEW.stripe_checkout_session_id IS NOT NULL OR NEW.stripe_payment_intent_id IS NOT NULL) THEN RAISE EXCEPTION 'Invoice-managed proposal cannot use checkout'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_invoice_milestone_mode BEFORE INSERT OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_milestone_mode();

CREATE OR REPLACE FUNCTION public.reserve_proposal_milestone(p_id uuid,p_number integer,p_revision uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.proposals%ROWTYPE; plan public.installment_plans%ROWTYPE; pay public.installment_payments%ROWTYPE;
BEGIN
 SELECT * INTO p FROM public.proposals WHERE id=p_id FOR UPDATE;
 IF p.milestone_settlement='manual_invoice' THEN RAISE EXCEPTION 'Invoice-managed milestones do not use Stripe checkout settlement'; END IF;
 IF NOT FOUND OR p.payment_schedule<>'milestones' OR p_number NOT IN (1,2) OR p_number IS NULL THEN RAISE EXCEPTION 'Invalid milestone'; END IF;
 IF p.access_code IS NULL OR p.signed_at IS NULL OR p.contract_signed_at IS NULL OR p.document_revision IS DISTINCT FROM p_revision OR p.status NOT IN ('sent','viewed','accepted','paid') THEN RAISE EXCEPTION 'Review and sign both current documents'; END IF;
 SELECT * INTO plan FROM public.installment_plans WHERE proposal_id=p_id AND billing_kind='milestones' FOR UPDATE;
 IF NOT FOUND THEN
  IF p_number<>1 OR p.valid_until<now() THEN RAISE EXCEPTION 'Initial milestone unavailable'; END IF;
  INSERT INTO public.installment_plans(proposal_id,billing_kind,num_installments,installment_amount,fee_percent,fee_amount,total_with_fee,base_amount,document_revision,currency)
   VALUES(p_id,'milestones',2,p.total_amount/2,0,0,p.total_amount,p.total_amount,p_revision,'usd') RETURNING * INTO plan;
  INSERT INTO public.installment_payments(installment_plan_id,payment_number,amount,milestone) VALUES(plan.id,1,p.total_amount/2,true),(plan.id,2,p.total_amount/2,true);
 END IF;
 IF plan.document_revision IS DISTINCT FROM p_revision OR plan.status='canceled' THEN RAISE EXCEPTION 'Payment plan unavailable'; END IF;
 SELECT * INTO pay FROM public.installment_payments WHERE installment_plan_id=plan.id AND payment_number=p_number AND milestone FOR UPDATE;
 IF pay.status='paid' THEN RETURN jsonb_build_object('paid',true); END IF;
 IF p_number=1 AND p.valid_until<now() THEN RAISE EXCEPTION 'Initial proposal payment expired'; END IF;
 IF p_number=2 AND (plan.installments_paid<>1 OR plan.delivery_status<>'accepted') THEN RAISE EXCEPTION 'Final payment requires accepted delivery'; END IF;

 -- Never re-create a session after Stripe's idempotency retention window on an ambiguous outcome.
 IF pay.attempt_started_at<now()-interval '23 hours' AND pay.checkout_session_id IS NULL THEN RAISE EXCEPTION 'Payment outcome requires reconciliation'; END IF;
 UPDATE public.installment_payments SET attempt_started_at=coalesce(attempt_started_at,now()) WHERE id=pay.id RETURNING * INTO pay;
 UPDATE public.proposals SET status='accepted',accepted_at=coalesce(accepted_at,now()) WHERE id=p_id AND status<>'paid';
 RETURN jsonb_build_object('payment_id',pay.id,'attempt',pay.checkout_attempt,'amount_cents',(pay.amount*100)::integer,'currency',plan.currency,'session_id',pay.checkout_session_id,'checkout_url',pay.checkout_url,'revision',plan.document_revision,'expires_at',extract(epoch FROM least(pay.attempt_started_at+interval '23 hours',CASE WHEN p_number=1 THEN p.valid_until ELSE NULL END))::bigint);
END $$;

CREATE OR REPLACE FUNCTION public.settle_proposal_milestone(p_proposal uuid,p_payment uuid,p_attempt uuid,p_revision uuid,p_session text,p_intent text,p_cents integer,p_currency text,p_event text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.proposals%ROWTYPE; plan public.installment_plans%ROWTYPE; pay public.installment_payments%ROWTYPE; project_id uuid; total_paid numeric;
BEGIN
 SELECT * INTO p FROM public.proposals WHERE id=p_proposal FOR UPDATE;
 IF p.milestone_settlement='manual_invoice' THEN RAISE EXCEPTION 'Invoice-managed milestones do not use Stripe checkout settlement'; END IF;
 SELECT * INTO plan FROM public.installment_plans WHERE proposal_id=p_proposal AND billing_kind='milestones' FOR UPDATE;
 SELECT * INTO pay FROM public.installment_payments WHERE id=p_payment AND installment_plan_id=plan.id AND milestone FOR UPDATE;
 IF pay.id IS NULL OR p.payment_schedule<>'milestones' OR pay.checkout_attempt IS DISTINCT FROM p_attempt OR plan.document_revision IS DISTINCT FROM p_revision OR p.document_revision IS DISTINCT FROM p_revision OR p.signed_at IS NULL OR p.contract_signed_at IS NULL OR p_cents IS DISTINCT FROM (pay.amount*100)::integer OR p_currency IS DISTINCT FROM plan.currency OR (pay.checkout_session_id IS NOT NULL AND pay.checkout_session_id<>p_session) THEN RAISE EXCEPTION 'Payment evidence mismatch'; END IF;
 IF pay.status='paid' THEN
  IF pay.checkout_session_id IS DISTINCT FROM p_session OR (p_event='paid' AND pay.payment_intent_id IS DISTINCT FROM p_intent) THEN RAISE EXCEPTION 'Paid identity mismatch'; END IF;
  RETURN;
 END IF;
 IF p_event='expired' THEN
  UPDATE public.installment_payments SET checkout_attempt=gen_random_uuid(),attempt_started_at=NULL,checkout_session_id=NULL,checkout_url=NULL WHERE id=pay.id;
  RETURN;
 END IF;
 IF p_event<>'paid' OR p_intent IS NULL OR p_session IS NULL OR (pay.payment_number=2 AND (plan.installments_paid<>1 OR plan.delivery_status<>'accepted')) THEN RAISE EXCEPTION 'Payment not eligible'; END IF;
 UPDATE public.installment_payments SET status='paid',paid_at=now(),checkout_session_id=p_session,payment_intent_id=p_intent,checkout_url=NULL WHERE id=pay.id;
 SELECT sum(amount) INTO total_paid FROM public.installment_payments WHERE installment_plan_id=plan.id AND status='paid' AND milestone;
 UPDATE public.installment_plans SET installments_paid=installments_paid+1,status=CASE WHEN pay.payment_number=2 THEN 'completed' ELSE 'active' END WHERE id=plan.id;
 -- Existing dashboard only; no inferred kickoff, onboarding generation, email or provider dispatch.
 SELECT id INTO project_id FROM public.client_projects WHERE proposal_id=p.id;
 IF project_id IS NULL THEN
  INSERT INTO public.client_projects(project_name,client_name,client_email,client_company,proposal_id,project_status,payment_amount,project_start_date)
   VALUES(p.bundle_name,p.client_name,p.client_email,p.client_company,p.id,'payment_received',total_paid,NULL) RETURNING id INTO project_id;
 ELSE UPDATE public.client_projects SET payment_amount=total_paid WHERE id=project_id; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.client_dashboard_access WHERE client_project_id=project_id AND is_active) THEN
  INSERT INTO public.client_dashboard_access(client_project_id,client_email,milestone_proposal_id) VALUES(project_id,p.client_email,p.id);
 END IF;
 UPDATE public.client_dashboard_access SET milestone_proposal_id=p.id WHERE client_project_id=project_id;
 IF pay.payment_number=2 THEN UPDATE public.proposals SET status='paid',paid_at=now() WHERE id=p.id; END IF;
END $$;

-- Admin route passes the authenticated operator ID. No public RPC execution grant.
CREATE FUNCTION public.record_invoice_milestone_receipt(p_id uuid,p_number integer,p_revision uuid,p_amount numeric,p_reference text,p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.proposals%ROWTYPE; plan public.installment_plans%ROWTYPE; pay public.installment_payments%ROWTYPE; project_id uuid; total_paid numeric;
BEGIN
 SELECT * INTO p FROM public.proposals WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p.milestone_settlement<>'manual_invoice' OR p.payment_schedule<>'milestones' OR p_number IS NULL OR p_number NOT IN(1,2) THEN RAISE EXCEPTION 'Invalid invoice milestone'; END IF;
 IF p_actor IS NULL OR p_reference IS NULL OR length(btrim(p_reference)) NOT BETWEEN 3 AND 200 OR p_amount IS DISTINCT FROM p.total_amount/2 THEN RAISE EXCEPTION 'Exact amount and receipt reference required'; END IF;
 IF p.access_code IS NULL OR p.signed_at IS NULL OR p.contract_signed_at IS NULL OR p.document_revision IS DISTINCT FROM p_revision OR p.status NOT IN('sent','viewed','accepted','paid') THEN RAISE EXCEPTION 'Both current agreements required'; END IF;
 SELECT * INTO plan FROM public.installment_plans WHERE proposal_id=p_id AND billing_kind='milestones' FOR UPDATE;
 IF NOT FOUND THEN
  IF p_number<>1 OR p.valid_until<now() THEN RAISE EXCEPTION 'Initial invoice receipt unavailable'; END IF;
  INSERT INTO public.installment_plans(proposal_id,billing_kind,num_installments,installment_amount,fee_percent,fee_amount,total_with_fee,base_amount,document_revision,currency)
   VALUES(p_id,'milestones',2,p.total_amount/2,0,0,p.total_amount,p.total_amount,p_revision,'usd') RETURNING * INTO plan;
  INSERT INTO public.installment_payments(installment_plan_id,payment_number,amount,milestone) VALUES(plan.id,1,p.total_amount/2,true),(plan.id,2,p.total_amount/2,true);
 END IF;
 IF plan.document_revision IS DISTINCT FROM p_revision OR plan.status='canceled' OR plan.stripe_subscription_id IS NOT NULL THEN RAISE EXCEPTION 'Plan unavailable'; END IF;
 SELECT * INTO pay FROM public.installment_payments WHERE installment_plan_id=plan.id AND payment_number=p_number AND milestone FOR UPDATE;
 IF pay.id IS NULL THEN RAISE EXCEPTION 'Missing payment'; END IF;
 IF pay.status='paid' THEN
  IF pay.manual_receipt_reference IS DISTINCT FROM btrim(p_reference) THEN RAISE EXCEPTION 'Receipt already recorded with different evidence'; END IF;
  RETURN;
 END IF;
 IF p_number=1 AND p.valid_until<now() THEN RAISE EXCEPTION 'Initial proposal expired'; END IF;
 IF p_number=2 AND (plan.installments_paid<>1 OR plan.delivery_status<>'accepted') THEN RAISE EXCEPTION 'Final receipt requires accepted delivery'; END IF;
 IF pay.checkout_session_id IS NOT NULL OR pay.payment_intent_id IS NOT NULL THEN RAISE EXCEPTION 'Unexpected provider payment'; END IF;
 UPDATE public.installment_payments SET status='paid',paid_at=now(),manual_receipt_reference=btrim(p_reference),manual_recorded_by=p_actor,manual_recorded_at=now() WHERE id=pay.id;
 SELECT sum(amount) INTO total_paid FROM public.installment_payments WHERE installment_plan_id=plan.id AND status='paid' AND milestone;
 UPDATE public.installment_plans SET installments_paid=installments_paid+1,status=CASE WHEN p_number=2 THEN 'completed' ELSE 'active' END WHERE id=plan.id;
 SELECT id INTO project_id FROM public.client_projects WHERE proposal_id=p.id;
 IF project_id IS NULL THEN
  INSERT INTO public.client_projects(project_name,client_name,client_email,client_company,proposal_id,project_status,payment_amount,project_start_date)
   VALUES(p.bundle_name,p.client_name,p.client_email,p.client_company,p.id,'payment_received',total_paid,NULL) RETURNING id INTO project_id;
 ELSE UPDATE public.client_projects SET payment_amount=total_paid WHERE id=project_id; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.client_dashboard_access WHERE client_project_id=project_id AND is_active) THEN
  INSERT INTO public.client_dashboard_access(client_project_id,client_email,milestone_proposal_id) VALUES(project_id,p.client_email,p.id);
 END IF;
 UPDATE public.client_dashboard_access SET milestone_proposal_id=p.id WHERE client_project_id=project_id;
 UPDATE public.proposals SET status=CASE WHEN p_number=2 THEN 'paid' ELSE 'accepted' END,accepted_at=coalesce(accepted_at,now()),paid_at=CASE WHEN p_number=2 THEN now() ELSE paid_at END WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.guard_invoice_milestone_mode() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_invoice_milestone_receipt(uuid,integer,uuid,numeric,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_invoice_milestone_receipt(uuid,integer,uuid,numeric,text,uuid) TO service_role;
COMMIT;
