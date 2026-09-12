import { milestoneAccess } from '@/lib/proposal-milestones';
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  UUID,
  validDocumentIdentity,
  documentRpcStatus,
} from "@/lib/proposal-document-binding";
export async function signProposalDocument(
  request: NextRequest,
  id: string,
  contract: boolean,
) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !UUID.test(id) ||
    typeof body.signed_by_name !== "string" ||
    !body.signed_by_name.trim() ||
    body.signed_by_name.trim().length > 200
  )
    return NextResponse.json(
      { error: "Valid proposal and signer name required" },
      { status: 400 },
    );
  if (!validDocumentIdentity(body.document_identity))
    return NextResponse.json(
      {
        error: "Reload and review the current documents before signing.",
        reload_required: true,
      },
      { status: 409 },
    );
  const {data: proposal,error: accessError}=await supabaseAdmin.from('proposals').select('payment_schedule,access_code').eq('id',id).single();
  if(accessError || !proposal || !milestoneAccess(request,proposal)) return NextResponse.json({error:'Proposal not found'},{status:404});
  const { data, error } = await supabaseAdmin.rpc("sign_proposal_document", {
    p_proposal: id,
    p_contract: contract,
    p_name: body.signed_by_name.trim(),
    p_ip:
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown",
    p_signature: body.signature_data ?? null,
    p_expected: body.document_identity,
  });
  if (error)
    return NextResponse.json(
      {
        error:
          "Signature not recorded. Reload and review the current documents, or retry after service recovery.",
        reload_required: true,
      },
      { status: documentRpcStatus(error.code) },
    );
  return NextResponse.json(data);
}
