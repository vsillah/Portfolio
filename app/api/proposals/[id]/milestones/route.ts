import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyAdmin, isAuthError } from "@/lib/auth-server";
import { milestoneAccess } from "@/lib/proposal-milestones";

async function context(request: NextRequest, id: string, admin = false) {
  let actorId: string | null = null;
  if (admin) {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) return null;
    actorId = auth.user.id;
  }
  const { data: p, error } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !p || (!admin && !milestoneAccess(request, p))) return null;
  return { ...p, actorId };
}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const p = await context(request, id, request.headers.has("authorization"));
  if (!p)
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  const { data: plan, error } = await supabaseAdmin
    .from("installment_plans")
    .select(
      "id,document_revision,delivery_status,delivery_revision,delivery_summary,delivery_feedback,installments_paid",
    )
    .eq("proposal_id", id)
    .eq("billing_kind", "milestones")
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: "Payment review unavailable" },
      { status: 503 },
    );
  return NextResponse.json({
    enabled: p.payment_schedule === "milestones",
    amount: p.total_amount / 2,
    settlement_mode: p.milestone_settlement || "stripe_checkout",
    can_configure:
      p.status === "draft" &&
      !p.access_code &&
      !p.signed_at &&
      !p.contract_signed_at,
    document_identity: {
      revision: p.document_revision,
      pdf_url: p.pdf_url,
      contract_pdf_url: p.contract_pdf_url,
    },
    signed: !!(p.signed_at && p.contract_signed_at),
    plan,
  });
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const admin = ["configure", "submit", "record_receipt"].includes(body.action);
  const p = await context(request, id, admin);
  if (!p)
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (body.action === "configure") {
    if (p.status !== "draft" || p.access_code || p.signed_at)
      return NextResponse.json(
        { error: "Configure before issuance" },
        { status: 409 },
      );
    const settlement = body.settlement_mode ?? "stripe_checkout";
    if (!["stripe_checkout", "manual_invoice"].includes(settlement))
      return NextResponse.json(
        { error: "Invalid settlement mode" },
        { status: 400 },
      );
    const { error } = await supabaseAdmin
      .from("proposals")
      .update({
        payment_schedule: "milestones",
        milestone_settlement: settlement,
      })
      .eq("id", id)
      .eq("status", "draft")
      .is("access_code", null);
    return NextResponse.json(
      error
        ? { error: "Unable to configure equal milestone amounts" }
        : { success: true },
      { status: error ? 409 : 200 },
    );
  }
  if (body.action === "record_receipt") {
    if (
      p.milestone_settlement !== "manual_invoice" ||
      ![1, 2].includes(body.milestone) ||
      typeof body.amount !== "number" ||
      !Number.isFinite(body.amount) ||
      typeof body.reference !== "string" ||
      body.reference.trim().length < 3 ||
      body.reference.length > 200
    )
      return NextResponse.json(
        { error: "Enter the exact milestone amount and receipt reference" },
        { status: 400 },
      );
    const { error } = await supabaseAdmin.rpc(
      "record_invoice_milestone_receipt",
      {
        p_id: id,
        p_number: body.milestone,
        p_revision: body.revision,
        p_amount: body.amount,
        p_reference: body.reference.trim(),
        p_actor: p.actorId,
      },
    );
    return NextResponse.json(
      error
        ? {
            error:
              "Receipt not recorded. Check the amount, agreement and delivery state, then refresh.",
          }
        : { success: true },
      { status: error ? 409 : 200 },
    );
  }
  if (
    !["submit", "accept", "reject"].includes(body.action) ||
    p.payment_schedule !== "milestones"
  )
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const { error } = await supabaseAdmin.rpc("review_milestone_delivery", {
    p_id: id,
    p_action: body.action,
    p_revision: body.revision ?? null,
    p_note: body.note ?? null,
  });
  return NextResponse.json(
    error
      ? { error: "Delivery changed or is unavailable. Reload to review." }
      : { success: true },
    { status: error ? 409 : 200 },
  );
}
