-- PREPARATION ONLY: apply before application release; no hosted application authorized.
BEGIN;
ALTER TABLE public.proposals ADD COLUMN document_revision uuid NOT NULL DEFAULT gen_random_uuid();
CREATE FUNCTION public.advance_proposal_document_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE changed boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM unnest(ARRAY['pdf_url','contract_pdf_url','terms_text','line_items','total_amount','subtotal','discount_amount','discount_description','valid_until','client_name','client_company','bundle_name']) k
    WHERE to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k) INTO changed;
  IF changed THEN
    IF OLD.signed_at IS NOT NULL OR OLD.contract_signed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Signed document content is immutable' USING ERRCODE='P0001'; END IF;
    NEW.document_revision := gen_random_uuid();
  ELSE NEW.document_revision := OLD.document_revision;
  END IF;
  IF OLD.signed_at IS NOT NULL AND (NEW.signed_at IS DISTINCT FROM OLD.signed_at OR NEW.signed_by_name IS DISTINCT FROM OLD.signed_by_name OR NEW.signature_data IS DISTINCT FROM OLD.signature_data OR NEW.signed_ip IS DISTINCT FROM OLD.signed_ip)
    OR OLD.contract_signed_at IS NOT NULL AND (NEW.contract_signed_at IS DISTINCT FROM OLD.contract_signed_at OR NEW.contract_signed_by_name IS DISTINCT FROM OLD.contract_signed_by_name OR NEW.contract_signed_ip IS DISTINCT FROM OLD.contract_signed_ip) THEN
    RAISE EXCEPTION 'Existing signature is immutable' USING ERRCODE='P0001'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER proposal_document_revision BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.advance_proposal_document_revision();
REVOKE ALL ON FUNCTION public.advance_proposal_document_revision() FROM PUBLIC,anon,authenticated;
ALTER TABLE public.proposal_documents
  ADD COLUMN binding_role text NOT NULL DEFAULT 'supporting'
    CHECK (binding_role IN ('supporting', 'primary', 'agreement')),
  ADD COLUMN content_sha256 text CHECK (content_sha256 ~ '^[a-f0-9]{64}$');

-- Existing document UUID is also the retry identity; paths are immutable per attempt.
CREATE FUNCTION public.bind_proposal_document(
  p_proposal uuid, p_request uuid, p_role text, p_title text, p_type text,
  p_path text, p_sha text, p_expected jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE p public.proposals%ROWTYPE; d public.proposal_documents%ROWTYPE; n integer;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE id=p_proposal FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found' USING ERRCODE='P0002'; END IF;
  IF p_role NOT IN ('supporting','primary','agreement') OR p_role IS NULL
    OR length(btrim(p_title)) NOT BETWEEN 1 AND 200
    OR p_title IS NULL OR p_type IS NULL
    OR p_type NOT IN ('strategy_report','opportunity_quantification','proposal_package','other')
    OR p_sha IS NULL OR p_sha !~ '^[a-f0-9]{64}$'
    OR p_request IS NULL OR p_path IS NULL
    OR p_path !~ ('^proposal-docs/' || p_proposal::text || '/[a-f0-9-]{36}\.pdf$')
  THEN RAISE EXCEPTION 'Invalid document' USING ERRCODE='22023'; END IF;
  SELECT * INTO d FROM public.proposal_documents WHERE id=p_request;
  IF FOUND THEN
    IF d.proposal_id=p_proposal AND d.binding_role=p_role AND d.title=btrim(p_title)
      AND d.document_type=p_type AND d.content_sha256=p_sha THEN
      RETURN to_jsonb(d) || jsonb_build_object('is_current',CASE WHEN p_role='primary' THEN p.pdf_url='storage:documents/'||d.file_path WHEN p_role='agreement' THEN p.contract_pdf_url='storage:documents/'||d.file_path ELSE true END); -- exact replay, even after subsequent issuance/signing
    END IF;
    RAISE EXCEPTION 'Request identity already used' USING ERRCODE='P0001';
  END IF;
  IF p_role <> 'supporting' THEN
    IF p.status IS DISTINCT FROM 'draft' OR p.access_code IS NOT NULL OR p.sent_at IS NOT NULL
      OR p.viewed_at IS NOT NULL OR p.accepted_at IS NOT NULL OR p.paid_at IS NOT NULL
      OR p.signed_at IS NOT NULL OR p.signed_by_name IS NOT NULL OR p.signature_data IS NOT NULL
      OR p.contract_signed_at IS NOT NULL OR p.contract_signed_by_name IS NOT NULL
      OR p.stripe_checkout_session_id IS NOT NULL OR p.stripe_payment_intent_id IS NOT NULL
      OR p.signed_ip IS NOT NULL OR p.contract_signed_ip IS NOT NULL
    THEN RAISE EXCEPTION 'Document binding is locked' USING ERRCODE='P0001'; END IF;
    IF p_expected IS NULL OR NOT (p_expected ? 'pdf_url' AND p_expected ? 'contract_pdf_url')
      OR (p_expected->>'revision') IS DISTINCT FROM p.document_revision::text
      OR (p_expected->>'pdf_url') IS DISTINCT FROM p.pdf_url
      OR (p_expected->>'contract_pdf_url') IS DISTINCT FROM p.contract_pdf_url
    THEN RAISE EXCEPTION 'Documents changed. Reload before attaching.' USING ERRCODE='P0001'; END IF;
  END IF;
  SELECT coalesce(max(display_order),-1)+1 INTO n FROM public.proposal_documents WHERE proposal_id=p_proposal;
  INSERT INTO public.proposal_documents(id,proposal_id,document_type,title,file_path,display_order,source,binding_role,content_sha256)
    VALUES(p_request,p_proposal,p_type,btrim(p_title),p_path,n,'uploaded',p_role,p_sha) RETURNING * INTO d;
  IF p_role='primary' THEN UPDATE public.proposals SET pdf_url='storage:documents/'||p_path WHERE id=p_proposal;
  ELSIF p_role='agreement' THEN UPDATE public.proposals SET contract_pdf_url='storage:documents/'||p_path WHERE id=p_proposal;
  END IF;
  RETURN to_jsonb(d) || jsonb_build_object('is_current',true);
END $$;

CREATE FUNCTION public.sign_proposal_document(
  p_proposal uuid, p_contract boolean, p_name text, p_ip text, p_signature jsonb, p_expected jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE p public.proposals%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE id=p_proposal FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found' USING ERRCODE='P0002'; END IF;
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 200 OR p_contract IS NULL THEN
    RAISE EXCEPTION 'Invalid signature' USING ERRCODE='22023'; END IF;
  IF p_expected IS NULL OR NOT (p_expected ? 'pdf_url' AND p_expected ? 'contract_pdf_url')
    OR (p_expected->>'revision') IS DISTINCT FROM p.document_revision::text
      OR (p_expected->>'pdf_url') IS DISTINCT FROM p.pdf_url
    OR (p_expected->>'contract_pdf_url') IS DISTINCT FROM p.contract_pdf_url
  THEN RAISE EXCEPTION 'Documents changed. Reload and review before signing.' USING ERRCODE='P0001'; END IF;
  IF (p_contract AND p.contract_signed_at IS NOT NULL) OR (NOT p_contract AND p.signed_at IS NOT NULL) THEN
    IF (CASE WHEN p_contract THEN p.contract_signed_by_name ELSE p.signed_by_name END) IS DISTINCT FROM btrim(p_name) THEN
      RAISE EXCEPTION 'Already signed. Reload to review.' USING ERRCODE='P0001'; END IF;
    RETURN jsonb_build_object('success',true,'already_signed',true);
  END IF;
  IF p.status IS NULL OR p.status NOT IN ('draft','sent','viewed') OR (p.valid_until IS NOT NULL AND p.valid_until < now()) THEN
    RAISE EXCEPTION 'Proposal cannot be signed. Reload to review.' USING ERRCODE='P0001'; END IF;
  IF p.access_code IS NULL AND (p.pdf_url LIKE 'storage:documents/%' OR p.contract_pdf_url LIKE 'storage:documents/%') THEN
    RAISE EXCEPTION 'Document has not been issued' USING ERRCODE='P0001'; END IF;
  IF p_contract THEN
    IF p.contract_pdf_url IS NULL OR p.signed_at IS NULL THEN
      RAISE EXCEPTION 'Review and sign the proposal first.' USING ERRCODE='P0001'; END IF;
    UPDATE public.proposals SET contract_signed_at=now(),contract_signed_by_name=btrim(p_name),contract_signed_ip=p_ip WHERE id=p_proposal;
  ELSE
    UPDATE public.proposals SET signed_at=now(),signed_by_name=btrim(p_name),signed_ip=p_ip,signature_data=p_signature WHERE id=p_proposal;
  END IF;
  RETURN jsonb_build_object('success',true);
END $$;

CREATE FUNCTION public.delete_proposal_supporting_document(p_proposal uuid,p_document uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE p public.proposals%ROWTYPE; d public.proposal_documents%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE id=p_proposal FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO d FROM public.proposal_documents WHERE id=p_document AND proposal_id=p_proposal;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',true); END IF;
  IF p.status IS DISTINCT FROM 'draft' OR p.access_code IS NOT NULL
    OR p.sent_at IS NOT NULL OR p.viewed_at IS NOT NULL OR p.accepted_at IS NOT NULL OR p.paid_at IS NOT NULL
    OR p.signed_at IS NOT NULL OR p.contract_signed_at IS NOT NULL
    OR d.binding_role <> 'supporting' OR p.pdf_url='storage:documents/'||d.file_path
    OR p.contract_pdf_url='storage:documents/'||d.file_path
    OR split_part(p.pdf_url,'?',1) LIKE '%/documents/'||d.file_path
    OR split_part(p.contract_pdf_url,'?',1) LIKE '%/documents/'||d.file_path THEN
    RAISE EXCEPTION 'Primary and agreement documents are retained in history.' USING ERRCODE='P0001'; END IF;
  DELETE FROM public.proposal_documents WHERE id=p_document AND proposal_id=p_proposal;
  RETURN jsonb_build_object('success',true,'file_path',d.file_path);
END $$;

REVOKE ALL ON FUNCTION public.bind_proposal_document(uuid,uuid,text,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sign_proposal_document(uuid,boolean,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.delete_proposal_supporting_document(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bind_proposal_document(uuid,uuid,text,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sign_proposal_document(uuid,boolean,text,text,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_proposal_supporting_document(uuid,uuid) TO service_role;
COMMIT;
