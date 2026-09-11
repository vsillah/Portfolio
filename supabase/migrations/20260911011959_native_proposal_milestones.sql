-- Stacked after native document consistency. Billing/access change: hosted application held.
BEGIN;
ALTER TABLE public.client_projects ALTER COLUMN project_start_date DROP NOT NULL, ALTER COLUMN estimated_end_date DROP NOT NULL;
ALTER TABLE public.proposals ADD COLUMN payment_schedule text NOT NULL DEFAULT 'legacy' CHECK(payment_schedule IN ('legacy','milestones'));
ALTER TABLE public.installment_plans ALTER COLUMN stripe_customer_id DROP NOT NULL;
ALTER TABLE public.installment_plans ADD COLUMN billing_kind text NOT NULL DEFAULT 'subscription' CHECK(billing_kind IN ('subscription','milestones')),
 ADD COLUMN document_revision uuid, ADD COLUMN currency text NOT NULL DEFAULT 'usd',
 ADD COLUMN delivery_revision uuid, ADD COLUMN delivery_summary text,
 ADD COLUMN delivery_status text NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending','review','changes_requested','accepted')),
 ADD COLUMN delivery_feedback text, ADD COLUMN delivery_history jsonb NOT NULL DEFAULT '[]';
CREATE UNIQUE INDEX milestone_plan_proposal ON public.installment_plans(proposal_id) WHERE billing_kind='milestones';
ALTER TABLE public.installment_payments ADD COLUMN milestone boolean NOT NULL DEFAULT false,
 ADD COLUMN checkout_attempt uuid NOT NULL DEFAULT gen_random_uuid(), ADD COLUMN attempt_started_at timestamptz,
 ADD COLUMN checkout_session_id text UNIQUE, ADD COLUMN checkout_url text, ADD COLUMN payment_intent_id text UNIQUE;
CREATE UNIQUE INDEX milestone_payment_number ON public.installment_payments(installment_plan_id,payment_number) WHERE milestone;
ALTER TABLE public.client_dashboard_access ADD COLUMN milestone_proposal_id uuid REFERENCES public.proposals(id);
-- Restrictive policies coexist with legacy permissive policies; these rows are server-only.
CREATE POLICY milestone_proposals_private ON public.proposals AS RESTRICTIVE FOR ALL TO anon,authenticated USING(payment_schedule<>'milestones') WITH CHECK(payment_schedule<>'milestones');
CREATE POLICY milestone_documents_private ON public.proposal_documents AS RESTRICTIVE FOR ALL TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.proposals p WHERE p.id=proposal_id)) WITH CHECK(EXISTS(SELECT 1 FROM public.proposals p WHERE p.id=proposal_id));
CREATE POLICY milestone_plans_private ON public.installment_plans AS RESTRICTIVE FOR ALL TO anon,authenticated USING(billing_kind<>'milestones') WITH CHECK(billing_kind<>'milestones');
CREATE POLICY milestone_payments_private ON public.installment_payments AS RESTRICTIVE FOR ALL TO anon,authenticated USING(NOT milestone) WITH CHECK(NOT milestone);
CREATE POLICY milestone_dashboard_private ON public.client_dashboard_access AS RESTRICTIVE FOR ALL TO anon,authenticated USING(milestone_proposal_id IS NULL) WITH CHECK(milestone_proposal_id IS NULL);

CREATE FUNCTION public.guard_milestone_terms() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.payment_schedule IS DISTINCT FROM NEW.payment_schedule AND (OLD.access_code IS NOT NULL OR OLD.signed_at IS NOT NULL) THEN RAISE EXCEPTION 'Configure payment terms before issuance'; END IF;
 IF NEW.payment_schedule='milestones' THEN
  IF NEW.total_amount<=0 OR NEW.total_amount*100<>trunc(NEW.total_amount*100) OR mod(NEW.total_amount*100,2)<>0 THEN RAISE EXCEPTION 'Two equal whole-cent milestones required'; END IF;
  IF NEW.access_code IS NOT NULL AND (length(NEW.access_code)<32 OR NEW.pdf_url IS NULL OR NEW.contract_pdf_url IS NULL) THEN RAISE EXCEPTION 'Reviewed documents and secure issued access required'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_milestone_terms BEFORE INSERT OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.guard_milestone_terms();

CREATE FUNCTION public.reserve_proposal_milestone(p_id uuid,p_number integer,p_revision uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.proposals%ROWTYPE; plan public.installment_plans%ROWTYPE; pay public.installment_payments%ROWTYPE;
BEGIN
 SELECT * INTO p FROM public.proposals WHERE id=p_id FOR UPDATE;
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
CREATE FUNCTION public.attach_milestone_checkout(p_payment uuid,p_attempt uuid,p_session text,p_url text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE public.installment_payments SET checkout_session_id=p_session,checkout_url=p_url WHERE id=p_payment AND milestone AND checkout_attempt=p_attempt AND (checkout_session_id IS NULL OR checkout_session_id=p_session);
 IF NOT FOUND THEN RAISE EXCEPTION 'Checkout attempt changed'; END IF;
END $$;

CREATE FUNCTION public.settle_proposal_milestone(p_proposal uuid,p_payment uuid,p_attempt uuid,p_revision uuid,p_session text,p_intent text,p_cents integer,p_currency text,p_event text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.proposals%ROWTYPE; plan public.installment_plans%ROWTYPE; pay public.installment_payments%ROWTYPE; project_id uuid; total_paid numeric;
BEGIN
 SELECT * INTO p FROM public.proposals WHERE id=p_proposal FOR UPDATE;
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
CREATE FUNCTION public.review_milestone_delivery(p_id uuid,p_action text,p_revision uuid,p_note text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE plan public.installment_plans%ROWTYPE;
BEGIN
 PERFORM 1 FROM public.proposals WHERE id=p_id FOR UPDATE;
 SELECT * INTO plan FROM public.installment_plans WHERE proposal_id=p_id AND billing_kind='milestones' FOR UPDATE;
 IF plan.id IS NULL OR plan.installments_paid<>1 OR plan.delivery_status='accepted' THEN RAISE EXCEPTION 'Delivery review unavailable'; END IF;
 IF p_action='submit' THEN
  IF plan.delivery_status NOT IN ('pending','changes_requested') OR length(btrim(p_note)) NOT BETWEEN 1 AND 3000 OR p_note IS NULL THEN RAISE EXCEPTION 'Delivery evidence required'; END IF;
  UPDATE public.installment_plans SET delivery_revision=gen_random_uuid(),delivery_summary=p_note,delivery_status='review',delivery_feedback=NULL WHERE id=plan.id;
 ELSIF p_action IN ('accept','reject') THEN
  IF plan.delivery_status<>'review' OR plan.delivery_revision IS DISTINCT FROM p_revision OR p_revision IS NULL THEN RAISE EXCEPTION 'Reload current delivery'; END IF;
  IF length(p_note)>3000 THEN RAISE EXCEPTION 'Feedback too long'; END IF;
  UPDATE public.installment_plans SET delivery_status=CASE WHEN p_action='accept' THEN 'accepted' ELSE 'changes_requested' END,delivery_feedback=p_note WHERE id=plan.id;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
 UPDATE public.installment_plans SET delivery_history=delivery_history||jsonb_build_array(jsonb_build_object('action',p_action,'reviewed_revision',p_revision,'note',p_note,'at',now(),'authority',CASE WHEN p_action='submit' THEN 'admin' ELSE 'client_bearer' END)) WHERE id=plan.id;
END $$;
REVOKE ALL ON FUNCTION public.guard_milestone_terms(), public.reserve_proposal_milestone(uuid,integer,uuid), public.attach_milestone_checkout(uuid,uuid,text,text), public.settle_proposal_milestone(uuid,uuid,uuid,uuid,text,text,integer,text,text),public.review_milestone_delivery(uuid,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_proposal_milestone(uuid,integer,uuid), public.attach_milestone_checkout(uuid,uuid,text,text), public.settle_proposal_milestone(uuid,uuid,uuid,uuid,text,text,integer,text,text),public.review_milestone_delivery(uuid,text,uuid,text) TO service_role;
COMMIT;
