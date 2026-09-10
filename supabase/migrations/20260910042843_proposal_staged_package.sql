-- Opt-in staged packages only. No existing proposal or document is rewritten.
-- Production activation requires explicit approval of this privacy/payment boundary.
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS staged_package boolean NOT NULL DEFAULT false;
ALTER TABLE public.client_projects ADD COLUMN IF NOT EXISTS staged_package boolean NOT NULL DEFAULT false;
ALTER TABLE public.client_dashboard_access ADD COLUMN IF NOT EXISTS staged_package boolean NOT NULL DEFAULT false;
CREATE POLICY staged_proposals_server_only ON public.proposals AS RESTRICTIVE FOR ALL TO anon,authenticated USING (NOT staged_package) WITH CHECK (NOT staged_package);
ALTER TABLE public.client_projects ALTER COLUMN project_start_date DROP NOT NULL;
ALTER TABLE public.client_projects ALTER COLUMN estimated_end_date DROP NOT NULL;
ALTER TABLE public.client_projects ADD CONSTRAINT client_projects_legacy_dates_required CHECK
 (staged_package OR (project_start_date IS NOT NULL AND estimated_end_date IS NOT NULL));
CREATE POLICY staged_projects_server_only ON public.client_projects AS RESTRICTIVE FOR ALL TO anon,authenticated USING (NOT staged_package) WITH CHECK (NOT staged_package);
CREATE POLICY staged_access_server_only ON public.client_dashboard_access AS RESTRICTIVE FOR ALL TO anon,authenticated USING (NOT staged_package) WITH CHECK (NOT staged_package);
ALTER TABLE public.client_projects DROP CONSTRAINT IF EXISTS client_projects_project_status_check;
ALTER TABLE public.client_projects ADD CONSTRAINT client_projects_project_status_check CHECK
 (project_status IN ('pending','active','paused','testing','delivering','complete','payment_received','onboarding_scheduled','onboarding_completed','kickoff_scheduled'));
CREATE TABLE public.proposal_staged_packages (
 proposal_id uuid PRIMARY KEY REFERENCES public.proposals(id),
 preparation_key uuid UNIQUE NOT NULL,
 content_digest text NOT NULL,
 client_project_id uuid UNIQUE REFERENCES public.client_projects(id),
 policy jsonb NOT NULL,
 agreement_text text NOT NULL,
 ready boolean NOT NULL DEFAULT false,
 released_at timestamptz,
 proposal_path text,
 agreement_path text,
 proposal_signed_at timestamptz,
 agreement_signed_at timestamptz,
 proposal_signed_by text,
 agreement_signed_by text,
 delivered_at timestamptz,
 delivered_by uuid,
 delivery_note text,
 delivery_accepted_at timestamptz,
 delivery_accepted_by text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.proposal_payment_stages (
 proposal_id uuid REFERENCES public.proposal_staged_packages(proposal_id),
 stage text CHECK (stage IN ('deposit','balance')),
 amount_cents bigint NOT NULL CHECK (amount_cents>0),
 checkout_session_id text UNIQUE,
 checkout_url text,
 paid_at timestamptz,
 stripe_event_id text UNIQUE,
 PRIMARY KEY(proposal_id,stage)
);
ALTER TABLE public.proposal_staged_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_payment_stages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proposal_staged_packages,public.proposal_payment_stages FROM anon,authenticated;
GRANT ALL ON public.proposal_staged_packages,public.proposal_payment_stages TO service_role;
INSERT INTO storage.buckets(id,name,public) VALUES ('proposal-private','proposal-private',false)
ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='proposal-private' AND public) THEN RAISE EXCEPTION 'proposal-private must be private'; END IF; END $$;
CREATE POLICY staged_documents_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING (bucket_id <> 'proposal-private') WITH CHECK (bucket_id <> 'proposal-private');
-- Server-mediated access only. Do not mutate documents bucket.

CREATE OR REPLACE FUNCTION public.record_proposal_stage_receipt(p_proposal uuid,p_stage text,p_session text,p_event text,p_amount bigint)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE receipt public.proposal_payment_stages; package public.proposal_staged_packages;
BEGIN
 SELECT * INTO package FROM public.proposal_staged_packages WHERE proposal_id=p_proposal FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown staged proposal'; END IF;
 SELECT * INTO receipt FROM public.proposal_payment_stages WHERE proposal_id=p_proposal AND stage=p_stage FOR UPDATE;
 IF NOT FOUND OR receipt.checkout_session_id IS DISTINCT FROM p_session OR receipt.amount_cents<>p_amount THEN
   RAISE EXCEPTION 'Receipt does not match checkout'; END IF;
 IF receipt.paid_at IS NOT NULL THEN RETURN; END IF;
 IF package.proposal_signed_at IS NULL OR package.agreement_signed_at IS NULL THEN RAISE EXCEPTION 'Unsigned package'; END IF;
 IF p_stage='balance' AND (package.delivery_accepted_at IS NULL OR NOT EXISTS
   (SELECT 1 FROM public.proposal_payment_stages WHERE proposal_id=p_proposal AND stage='deposit' AND paid_at IS NOT NULL))
 THEN RAISE EXCEPTION 'Balance is not eligible'; END IF;
 UPDATE public.proposal_payment_stages SET paid_at=now(),stripe_event_id=p_event WHERE proposal_id=p_proposal AND stage=p_stage;
 UPDATE public.client_projects SET payment_amount=(SELECT sum(amount_cents)/100.0 FROM public.proposal_payment_stages WHERE proposal_id=p_proposal AND paid_at IS NOT NULL)
 WHERE id=package.client_project_id;
 IF p_stage='balance' THEN UPDATE public.proposals SET status='paid',paid_at=now() WHERE id=p_proposal;
 ELSE UPDATE public.proposals SET status='deposit_paid' WHERE id=p_proposal; END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_proposal_stage_receipt(uuid,text,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_proposal_stage_receipt(uuid,text,text,text,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_staged_proposal(p_key uuid,p_digest text,p_payload jsonb,p_actor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE existing public.proposal_staged_packages; proposal_uuid uuid; project_uuid uuid; token text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('email:'||lower(p_payload->>'client_email'),0));
 PERFORM pg_advisory_xact_lock(hashtextextended('contact:'||(p_payload->>'contact_id'),0));
 SELECT * INTO existing FROM public.proposal_staged_packages WHERE preparation_key=p_key;
 IF FOUND THEN
   IF existing.content_digest<>p_digest THEN RAISE EXCEPTION 'Preparation key already used for different terms'; END IF;
   RETURN existing.proposal_id;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.contact_submissions WHERE id=(p_payload->>'contact_id')::bigint AND lower(email)=lower(p_payload->>'client_email'))
 THEN RAISE EXCEPTION 'Contact identity mismatch'; END IF;
 IF EXISTS (SELECT 1 FROM public.client_projects WHERE contact_submission_id=(p_payload->>'contact_id')::bigint OR lower(client_email)=lower(p_payload->>'client_email'))
 THEN RAISE EXCEPTION 'Existing client project requires explicit matching'; END IF;
 token=upper(replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''));
 INSERT INTO public.proposals(client_name,client_email,client_company,bundle_name,line_items,subtotal,discount_amount,total_amount,terms_text,valid_until,status,created_by,staged_package,access_code)
 VALUES(p_payload->>'client_name',p_payload->>'client_email',p_payload->>'client_company',p_payload->>'title',p_payload->'line_items',
 (p_payload->'policy'->>'totalCents')::numeric/100,0,(p_payload->'policy'->>'totalCents')::numeric/100,p_payload->>'terms_text',
 (p_payload->>'valid_until')::timestamptz,'draft',p_actor,true,token) RETURNING id INTO proposal_uuid;
 INSERT INTO public.client_projects(project_name,description,client_name,client_email,client_company,contact_submission_id,proposal_id,client_id,project_status,current_phase,project_value,payment_amount,currency,staged_package)
 VALUES(p_payload->>'title','Proposal awaiting client decision',p_payload->>'client_name',p_payload->>'client_email',p_payload->>'client_company',
 (p_payload->>'contact_id')::bigint,proposal_uuid,gen_random_uuid(),'pending',1,(p_payload->'policy'->>'totalCents')::numeric/100,0,'USD',true) RETURNING id INTO project_uuid;
 INSERT INTO public.client_dashboard_access(client_project_id,client_email,access_token,is_active,staged_package) VALUES(project_uuid,p_payload->>'client_email',token,false,true);
 INSERT INTO public.proposal_staged_packages(proposal_id,preparation_key,content_digest,client_project_id,policy,agreement_text)
 VALUES(proposal_uuid,p_key,p_digest,project_uuid,p_payload->'policy',p_payload->>'agreement_text');
 INSERT INTO public.proposal_payment_stages(proposal_id,stage,amount_cents) VALUES
 (proposal_uuid,'deposit',(p_payload->'policy'->>'depositCents')::bigint),(proposal_uuid,'balance',(p_payload->'policy'->>'balanceCents')::bigint);
 RETURN proposal_uuid;
END $$;
REVOKE ALL ON FUNCTION public.prepare_staged_proposal(uuid,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_staged_proposal(uuid,text,jsonb,uuid) TO service_role;

ALTER TABLE public.proposal_payment_stages ADD COLUMN attempt_id uuid;
ALTER TABLE public.proposal_payment_stages ADD COLUMN reserved_at timestamptz;
CREATE FUNCTION public.reserve_proposal_stage(p_proposal uuid,p_stage text,p_expired_session text DEFAULT NULL)
RETURNS public.proposal_payment_stages LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.proposal_payment_stages;
BEGIN
 SELECT * INTO r FROM public.proposal_payment_stages WHERE proposal_id=p_proposal AND stage=p_stage FOR UPDATE;
 IF NOT FOUND OR r.paid_at IS NOT NULL THEN RAISE EXCEPTION 'Stage unavailable'; END IF;
 IF p_expired_session IS NOT NULL AND r.checkout_session_id=p_expired_session THEN
   UPDATE public.proposal_payment_stages SET attempt_id=gen_random_uuid(),reserved_at=now(),checkout_session_id=NULL,checkout_url=NULL WHERE proposal_id=p_proposal AND stage=p_stage RETURNING * INTO r;
 ELSIF r.attempt_id IS NULL THEN
   UPDATE public.proposal_payment_stages SET attempt_id=gen_random_uuid(),reserved_at=now() WHERE proposal_id=p_proposal AND stage=p_stage RETURNING * INTO r;
 END IF;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.reserve_proposal_stage(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_proposal_stage(uuid,text,text) TO service_role;
CREATE FUNCTION public.release_staged_proposal(p_proposal uuid,p_digest text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p public.proposal_staged_packages; a public.client_dashboard_access;
BEGIN
 SELECT * INTO p FROM public.proposal_staged_packages WHERE proposal_id=p_proposal FOR UPDATE;
 IF NOT FOUND OR NOT p.ready OR p.content_digest<>p_digest THEN RAISE EXCEPTION 'Package not reviewed and ready'; END IF;
 SELECT * INTO a FROM public.client_dashboard_access WHERE client_project_id=p.client_project_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Access unavailable'; END IF;
 IF p.released_at IS NOT NULL AND NOT a.is_active THEN RAISE EXCEPTION 'Access revoked; explicit reissue required'; END IF;
 UPDATE public.proposal_staged_packages SET released_at=coalesce(released_at,now()) WHERE proposal_id=p_proposal;
 UPDATE public.client_dashboard_access SET is_active=true WHERE id=a.id;
 RETURN a.access_token;
END $$;
REVOKE ALL ON FUNCTION public.release_staged_proposal(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_staged_proposal(uuid,text) TO service_role;

CREATE FUNCTION public.protect_staged_proposal_content() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.staged_package AND (NEW.client_email,NEW.client_name,NEW.client_company,NEW.bundle_name,NEW.line_items,NEW.total_amount,NEW.subtotal,NEW.discount_amount,NEW.terms_text,NEW.valid_until,NEW.staged_package,NEW.access_code)
 IS DISTINCT FROM (OLD.client_email,OLD.client_name,OLD.client_company,OLD.bundle_name,OLD.line_items,OLD.total_amount,OLD.subtotal,OLD.discount_amount,OLD.terms_text,OLD.valid_until,OLD.staged_package,OLD.access_code)
 THEN RAISE EXCEPTION 'Staged proposal content is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER staged_proposal_content_immutable BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.protect_staged_proposal_content();

-- Keep native status truthful; access release is never an email-send event.
CREATE FUNCTION public.project_staged_status() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.proposal_signed_at IS NOT NULL AND NEW.agreement_signed_at IS NOT NULL THEN
   UPDATE public.proposals SET status=CASE WHEN status IN ('paid','deposit_paid') THEN status ELSE 'accepted' END WHERE id=NEW.proposal_id;
 ELSIF NEW.released_at IS NOT NULL THEN
   UPDATE public.proposals SET status='released' WHERE id=NEW.proposal_id AND status='draft';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER staged_native_status AFTER UPDATE ON public.proposal_staged_packages FOR EACH ROW EXECUTE FUNCTION public.project_staged_status();
