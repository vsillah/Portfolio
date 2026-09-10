/**
 * Admin API: List, create, and reorder proposal documents.
 * GET — list documents for proposal (ordered by display_order)
 * POST — upload PDF and create document row (multipart: file, title, document_type)
 * PATCH — reorder (body: { documentIds: string[] })
 */

import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import {
  DOCUMENT_ROLES,
  PDF_LIMIT,
  UUID,
  validDocumentIdentity,
  documentIdentity,
  documentRpcStatus,
} from "@/lib/proposal-document-binding";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyAdmin, isAuthError } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const DOCUMENT_TYPES = [
  "strategy_report",
  "opportunity_quantification",
  "proposal_package",
  "other",
] as const;
const BUCKET = "documents";
const PATH_PREFIX = "proposal-docs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: proposalId } = await params;
  if (!proposalId) {
    return NextResponse.json(
      { error: "Proposal ID required" },
      { status: 400 },
    );
  }

  const { data: proposal } = await supabaseAdmin
    .from("proposals")
    .select(
      "id, document_revision, pdf_url, contract_pdf_url, status, access_code, signed_at, contract_signed_at, sent_at, viewed_at, accepted_at, paid_at, signed_by_name, signature_data, contract_signed_by_name, stripe_checkout_session_id",
    )
    .eq("id", proposalId)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const { data: docs, error } = await supabaseAdmin
    .from("proposal_documents")
    .select(
      "id, proposal_id, document_type, title, file_path, display_order, source, created_at, binding_role",
    )
    .eq("proposal_id", proposalId)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Error fetching proposal documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 },
    );
  }

  const documents = await Promise.all(
    (docs ?? []).map(
      async (doc: {
        id: string;
        file_path: string;
        binding_role: string;
        [key: string]: unknown;
      }) => {
        const { data } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(doc.file_path, 3600);
        const ref = "storage:documents/" + doc.file_path;
        return {
          ...doc,
          signedUrl: data?.signedUrl ?? null,
          current_role:
            proposal.pdf_url === ref
              ? "primary"
              : proposal.contract_pdf_url === ref
                ? "agreement"
                : null,
        };
      },
    ),
  );
  const bindingEligible =
    proposal.status === "draft" &&
    [
      "access_code",
      "sent_at",
      "viewed_at",
      "accepted_at",
      "paid_at",
      "signed_at",
      "signed_by_name",
      "signature_data",
      "contract_signed_at",
      "contract_signed_by_name",
      "stripe_checkout_session_id",
    ].every((key) => proposal[key] == null);
  return NextResponse.json({
    documents,
    document_identity: documentIdentity(proposal),
    binding_eligible: bindingEligible,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: proposalId } = await params;
  if (!proposalId) {
    return NextResponse.json(
      { error: "Proposal ID required" },
      { status: 400 },
    );
  }

  if (!UUID.test(proposalId))
    return NextResponse.json({ error: "Invalid proposal ID" }, { status: 400 });
  // Column availability is a migration preflight, before any Storage write.
  const { data: history, error: schemaError } = await supabaseAdmin
    .from("proposal_documents")
    .select("id,binding_role")
    .eq("proposal_id", proposalId)
    .limit(1);
  void history;
  if (schemaError)
    return NextResponse.json(
      { error: "Document service unavailable. Retry after setup is complete." },
      { status: 503 },
    );
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = form.get("file");
  const title = form.get("title");
  const role = form.get("binding_role") ?? "supporting";
  const type = form.get("document_type") ?? "other";
  const requestId = form.get("request_id");
  let expected: unknown;
  try {
    expected = JSON.parse(String(form.get("document_identity") ?? "null"));
  } catch {
    expected = null;
  }
  if (
    !file ||
    typeof file === "string" ||
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 200 ||
    typeof role !== "string" ||
    !DOCUMENT_ROLES.includes(role as (typeof DOCUMENT_ROLES)[number]) ||
    typeof type !== "string" ||
    !DOCUMENT_TYPES.includes(type as (typeof DOCUMENT_TYPES)[number]) ||
    (requestId !== null &&
      (typeof requestId !== "string" || !UUID.test(requestId))) ||
    (role !== "supporting" && (!requestId || !validDocumentIdentity(expected)))
  ) {
    return NextResponse.json(
      {
        error: "Provide a valid title, PDF, role and current document review.",
      },
      { status: 400 },
    );
  }
  if (
    file.type !== "application/pdf" ||
    file.size === 0 ||
    file.size > PDF_LIMIT
  )
    return NextResponse.json(
      { error: "Select a PDF up to 10 MB." },
      { status: 400 },
    );
  const { data: target, error: targetError } = await supabaseAdmin
    .from("proposals")
    .select(
      "id,status,access_code,sent_at,viewed_at,accepted_at,paid_at,signed_at,signed_by_name,signature_data,contract_signed_at,contract_signed_by_name,stripe_checkout_session_id",
    )
    .eq("id", proposalId)
    .maybeSingle();
  if (targetError)
    return NextResponse.json(
      { error: "Could not verify proposal. Retry." },
      { status: 503 },
    );
  if (!target)
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  // A replay is permitted after locking; the RPC checks identical content and metadata.
  const { data: prior, error: priorError } = requestId
    ? await supabaseAdmin
        .from("proposal_documents")
        .select("id")
        .eq("id", requestId)
        .maybeSingle()
    : { data: null, error: null };
  if (priorError)
    return NextResponse.json(
      { error: "Could not verify retry. Retry." },
      { status: 503 },
    );
  if (
    role !== "supporting" &&
    !prior &&
    (target.status !== "draft" ||
      [
        "access_code",
        "sent_at",
        "viewed_at",
        "accepted_at",
        "paid_at",
        "signed_at",
        "signed_by_name",
        "signature_data",
        "contract_signed_at",
        "contract_signed_by_name",
        "stripe_checkout_session_id",
      ].some((key) => target[key] != null))
  )
    return NextResponse.json(
      {
        error: "Primary and agreement PDFs require an unissued unsigned draft.",
      },
      { status: 409 },
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-")))
      throw new Error("Invalid header");
    const pdf = await PDFDocument.load(bytes);
    if (pdf.getPageCount() < 1) throw new Error("Empty PDF");
  } catch {
    return NextResponse.json(
      { error: "The file is not a readable, unencrypted PDF." },
      { status: 400 },
    );
  }
  const filePath = `${PATH_PREFIX}/${proposalId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError)
    return NextResponse.json(
      { error: "Upload failed. Retry with the same selection." },
      { status: 503 },
    );
  let result;
  try {
    result = await supabaseAdmin.rpc("bind_proposal_document", {
      p_proposal: proposalId,
      p_request: requestId ?? crypto.randomUUID(),
      p_role: role,
      p_title: title.trim(),
      p_type:
        role === "primary"
          ? "proposal_package"
          : role === "agreement"
            ? "other"
            : type,
      p_path: filePath,
      p_sha: createHash("sha256").update(bytes).digest("hex"),
      p_expected: expected,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Save outcome unknown. Retry the same selection to recover; uploaded bytes retained safely.",
      },
      { status: 503 },
    );
  }
  const { data: document, error } = result;
  if (error) {
    // Only definitive transaction rejection proves this attempt is unreferenced.
    const definitive = ["P0001", "P0002", "22023", "23505"].includes(
      error.code,
    );
    const cleanup = definitive
      ? await supabaseAdmin.storage.from(BUCKET).remove([filePath])
      : null;
    return NextResponse.json(
      {
        error: definitive
          ? error.code === "P0002"
            ? "Proposal not found"
            : "Documents changed or are locked. Reload before attaching."
          : "Save outcome unknown. Retry the same selection to recover.",
        cleanup_pending: !definitive || !!cleanup?.error,
      },
      { status: documentRpcStatus(error.code) },
    );
  }
  let cleanupPending = false;
  if (document.file_path !== filePath) {
    const cleanup = await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
    cleanupPending = !!cleanup.error;
  }
  return NextResponse.json(
    { document, cleanup_pending: cleanupPending },
    { status: 201 },
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: proposalId } = await params;
  if (!proposalId) {
    return NextResponse.json(
      { error: "Proposal ID required" },
      { status: 400 },
    );
  }

  let body: { documentIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const documentIds = body.documentIds;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json(
      { error: "documentIds array required" },
      { status: 400 },
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("proposal_documents")
    .select("id")
    .eq("proposal_id", proposalId);

  const existingIds = new Set(
    (existing ?? []).map((r: { id: string }) => r.id),
  );
  const validIds = documentIds.filter(
    (id): id is string => typeof id === "string" && existingIds.has(id),
  );
  if (
    validIds.length !== documentIds.length ||
    validIds.length !== existingIds.size
  ) {
    return NextResponse.json(
      {
        error:
          "documentIds must match exactly the current document ids for this proposal",
      },
      { status: 400 },
    );
  }

  const updates = validIds.map((id, index) =>
    supabaseAdmin
      .from("proposal_documents")
      .update({ display_order: index })
      .eq("id", id)
      .eq("proposal_id", proposalId),
  );

  const results = await Promise.all(updates);
  const failed = results.some((r) => r.error);
  if (failed) {
    console.error("Error reordering proposal documents:", results);
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }

  const { data: docs } = await supabaseAdmin
    .from("proposal_documents")
    .select(
      "id, proposal_id, document_type, title, file_path, display_order, source, created_at, binding_role",
    )
    .eq("proposal_id", proposalId)
    .order("display_order", { ascending: true });

  return NextResponse.json({ documents: docs ?? [] });
}
