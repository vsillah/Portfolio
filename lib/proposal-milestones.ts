import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

export function milestoneAccess(
  request: NextRequest,
  proposal: { payment_schedule?: string; access_code?: string | null },
) {
  if (proposal.payment_schedule !== "milestones") return true;
  const supplied = (request.headers.get("x-proposal-access") || "")
    .toUpperCase()
    .trim();
  const expected = proposal.access_code || "";
  return (
    expected.length >= 32 &&
    /^[A-F0-9]+$/.test(supplied) &&
    supplied.length === expected.length &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  );
}
export async function milestoneCheckout(
  request: NextRequest,
  p: Record<string, any>,
  body: Record<string, unknown>,
) {
  if (!milestoneAccess(request, p))
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  if (
    Object.keys(body).some(
      (k) => !["milestone", "document_identity"].includes(k),
    ) ||
    ![1, 2].includes(body.milestone as number)
  )
    return NextResponse.json(
      { error: "Select the agreed milestone payment" },
      { status: 400 },
    );
  const identity = body.document_identity as
    | Record<string, unknown>
    | undefined;
  if (
    !identity ||
    identity.revision !== p.document_revision ||
    identity.pdf_url !== p.pdf_url ||
    identity.contract_pdf_url !== p.contract_pdf_url
  )
    return NextResponse.json(
      { error: "Reload and review the current documents" },
      { status: 409 },
    );
  const { data: reservation, error } = await supabaseAdmin.rpc(
    "reserve_proposal_milestone",
    { p_id: p.id, p_number: body.milestone, p_revision: identity.revision },
  );
  if (error)
    return NextResponse.json(
      {
        error: error.message?.includes("reconciliation")
          ? "Payment status needs review. Contact your consultant before retrying."
          : error.message?.includes("expired")
            ? "This proposal has expired. Contact your consultant before the initial payment."
            : "Payment unavailable. Review both signatures and delivery status, then reload.",
      },
      { status: 409 },
    );
  if (reservation.paid) return NextResponse.json({ paid: true });
  if (!stripe)
    return NextResponse.json(
      { error: "Payment service unavailable. Please retry later." },
      { status: 503 },
    );
  const returnUrl = new URL(
    `/proposal/${p.access_code}`,
    request.nextUrl.origin,
  ).toString();
  try {
    if (reservation.session_id) {
      const existing = await stripe.checkout.sessions.retrieve(
        reservation.session_id,
      );
      if (
        existing.id !== reservation.session_id ||
        existing.mode !== "payment" ||
        existing.amount_total !== reservation.amount_cents ||
        existing.currency !== reservation.currency ||
        existing.metadata?.proposalId !== p.id ||
        existing.metadata?.paymentId !== reservation.payment_id ||
        existing.metadata?.attempt !== reservation.attempt ||
        existing.metadata?.revision !== reservation.revision ||
        existing.metadata?.milestone !== "true"
      )
        throw new Error("Stored session evidence mismatch");
      if (
        existing.status === "expired" ||
        (existing.status === "complete" && existing.payment_status === "paid")
      ) {
        const settled = await supabaseAdmin.rpc("settle_proposal_milestone", {
          p_proposal: p.id,
          p_payment: reservation.payment_id,
          p_attempt: reservation.attempt,
          p_revision: reservation.revision,
          p_session: existing.id,
          p_intent:
            typeof existing.payment_intent === "string"
              ? existing.payment_intent
              : null,
          p_cents: existing.amount_total,
          p_currency: existing.currency,
          p_event: existing.status === "expired" ? "expired" : "paid",
        });
        if (settled.error) throw new Error("Reconciliation unavailable");
        return existing.status === "expired"
          ? NextResponse.json(
              {
                error:
                  "The previous checkout expired. Retry to open a new payment attempt.",
              },
              { status: 409 },
            )
          : NextResponse.json({ paid: true });
      }
      if (existing.status !== "open" || !existing.url)
        return NextResponse.json(
          {
            error: "Payment is processing. Refresh status before trying again.",
          },
          { status: 409 },
        );
      return NextResponse.json({ checkoutUrl: existing.url });
    }
    if (
      !Number.isInteger(reservation.expires_at) ||
      reservation.expires_at < Math.floor(Date.now() / 1000) + 1800
    )
      return NextResponse.json(
        {
          error:
            "This payment window is closing. Contact your consultant to review it.",
        },
        { status: 409 },
      );
    const metadata = {
      proposalId: p.id,
      milestone: "true",
      paymentId: reservation.payment_id,
      attempt: reservation.attempt,
      revision: reservation.revision,
    };
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        expires_at: reservation.expires_at,
        payment_method_types: ["card"],
        customer_email: p.client_email,
        line_items: [
          {
            price_data: {
              currency: reservation.currency,
              unit_amount: reservation.amount_cents,
              product_data: {
                name:
                  body.milestone === 1
                    ? "Initial project payment"
                    : "Final payment after accepted delivery",
              },
            },
            quantity: 1,
          },
        ],
        metadata,
        payment_intent_data: { metadata },
        success_url: `${returnUrl}?payment=processing`,
        cancel_url: `${returnUrl}?payment=cancelled`,
      },
      {
        idempotencyKey: `milestone-${reservation.payment_id}-${reservation.attempt}`,
      },
    );
    const saved = await supabaseAdmin.rpc("attach_milestone_checkout", {
      p_payment: reservation.payment_id,
      p_attempt: reservation.attempt,
      p_session: session.id,
      p_url: session.url,
    });
    if (saved.error) throw new Error("Save unavailable");
    return NextResponse.json({ checkoutUrl: session.url });
  } catch {
    return NextResponse.json(
      {
        error:
          "Payment link could not be confirmed. Retry to recover the same payment attempt.",
      },
      { status: 503 },
    );
  }
}

// Called only after Stripe signature verification, before every legacy handler.
export async function handleMilestoneEvent(
  event: Stripe.Event,
): Promise<boolean> {
  if (!event.type.startsWith("checkout.session.")) return false;
  const s = event.data.object as Stripe.Checkout.Session;
  if (s.metadata?.installmentPlanId) {
    const { data: plan, error: planError } = await supabaseAdmin
      .from("installment_plans")
      .select("billing_kind")
      .eq("id", s.metadata.installmentPlanId)
      .maybeSingle();
    if (planError || plan?.billing_kind === "milestones")
      throw new Error("Subscription event cannot settle milestone plan");
  }
  if (!s.metadata?.proposalId && s.metadata?.milestone !== "true") return false;
  const { data: p, error } = await supabaseAdmin
    .from("proposals")
    .select("payment_schedule")
    .eq("id", s.metadata?.proposalId || "")
    .maybeSingle();
  if (error) throw new Error("Cannot classify proposal payment");
  if (p?.payment_schedule !== "milestones") {
    if (s.metadata?.milestone === "true")
      throw new Error("Unknown milestone proposal");
    return false;
  }
  if (s.metadata?.milestone !== "true")
    throw new Error("Legacy payment cannot settle milestone proposal");
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
      "checkout.session.async_payment_failed",
    ].includes(event.type)
  )
    return true;
  if (event.type === "checkout.session.async_payment_failed") return true; // retain attempt; never imply paid
  const expired = event.type === "checkout.session.expired";
  if (s.mode !== "payment" || (!expired && s.payment_status !== "paid"))
    return true;
  const { error: settleError } = await supabaseAdmin.rpc(
    "settle_proposal_milestone",
    {
      p_proposal: s.metadata.proposalId,
      p_payment: s.metadata.paymentId,
      p_attempt: s.metadata.attempt,
      p_revision: s.metadata.revision,
      p_session: s.id,
      p_intent: typeof s.payment_intent === "string" ? s.payment_intent : null,
      p_cents: s.amount_total,
      p_currency: s.currency,
      p_event: expired ? "expired" : "paid",
    },
  );
  if (settleError) throw new Error("Milestone evidence rejected");
  return true;
}
