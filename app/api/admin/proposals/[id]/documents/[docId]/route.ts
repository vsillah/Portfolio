/**
 * Admin API: Delete a proposal document (row and optional Storage object).
 */

import { UUID, documentRpcStatus } from "@/lib/proposal-document-binding";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyAdmin, isAuthError } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: proposalId, docId } = await params;
  if (!proposalId || !docId) {
    return NextResponse.json(
      { error: "Proposal ID and document ID required" },
      { status: 400 },
    );
  }

  if (!UUID.test(proposalId) || !UUID.test(docId))
    return NextResponse.json(
      { error: "Invalid document target" },
      { status: 400 },
    );
  const { data, error } = await supabaseAdmin.rpc(
    "delete_proposal_supporting_document",
    { p_proposal: proposalId, p_document: docId },
  );
  if (error)
    return NextResponse.json(
      { error: "Document retained. Reload to review its role or retry." },
      { status: documentRpcStatus(error.code) },
    );
  let cleanupPending = false;
  if (data.file_path) {
    const cleanup = await supabaseAdmin.storage
      .from("documents")
      .remove([data.file_path]);
    cleanupPending = !!cleanup.error;
  }
  return NextResponse.json({ success: true, cleanup_pending: cleanupPending });
}
