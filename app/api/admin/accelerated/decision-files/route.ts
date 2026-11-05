import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, isAuthError } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  reviewServiceCandidates,
  parseReviewCatalogOffer,
} from "@/lib/accelerated-service-review";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth))
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await supabaseAdmin
    .from("accelerated_decision_file_intakes")
    .select(
      "id,worksheet_id,content_version,learner_name,learner_email,answers,submitted_at,review_status,linked_audit_id,review_note",
    )
    .order("submitted_at", { ascending: false })
    .limit(100);
  if (error)
    return NextResponse.json(
      { error: "Could not load decision files." },
      { status: 503 },
    );
  const [{ data: services }, { data: products }] = await Promise.all([
    supabaseAdmin
      .from("services")
      .select("id,title,description,topics,is_active")
      .eq("is_active", true)
      .limit(200),
    supabaseAdmin
      .from("products")
      .select("id,title,description,is_active")
      .eq("is_active", true)
      .limit(200),
  ]);
  const catalog = [
    ...((services || []) as unknown[]).map((service: unknown) => parseReviewCatalogOffer(service, "service")),
    ...((products || []) as unknown[]).map((product: unknown) => parseReviewCatalogOffer(product, "product")),
  ].filter((offer): offer is NonNullable<typeof offer> => offer !== null);
  const approved = data?.length ? await supabaseAdmin.from('accelerated_member_recommendations')
    .select('intake_id,offer_kind,offer_id').eq('review_status', 'approved').in('intake_id', data.map((item: { id: string }) => item.id)) : { data: [], error: null };
  if (approved.error) return NextResponse.json({ error: 'Could not load reviewed recommendations.' }, { status: 503 });
  return NextResponse.json(
    {
      items: (data || []).map((item: { id: string; answers: Record<string, string> }) => ({
        ...item,
        candidates: reviewServiceCandidates(item.answers, catalog),
        approvedOfferKeys: (approved.data ?? []).filter((offer: { intake_id: string; offer_kind: string; offer_id: string }) => offer.intake_id === item.id)
          .map((offer: { offer_kind: string; offer_id: string }) => `${offer.offer_kind}:${offer.offer_id}`),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth))
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id))
    return NextResponse.json(
      { error: "Invalid decision file." },
      { status: 400 },
    );
  if (!["reviewing", "linked", "closed"].includes(String(body.status)))
    return NextResponse.json(
      { error: "Invalid review status." },
      { status: 400 },
    );
  if (typeof body.note !== "string" || body.note.length > 2000)
    return NextResponse.json(
      { error: "Add a short review note." },
      { status: 400 },
    );
  const auditId = body.status === 'linked' ? Number(body.auditId) : null;
  if (body.status === 'linked' && (!Number.isSafeInteger(auditId) || auditId! < 1))
    return NextResponse.json({ error: 'Choose an existing assessment audit.' }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc('accelerated_review_decision_file', {
    p_intake_id: body.id,
    p_status: body.status,
    p_note: body.note.trim(),
    p_audit_id: auditId,
    p_reviewer: auth.user.id,
  });
  if (error) return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'Could not save review.' }, { status: error.code === 'P0001' ? 409 : 503 });
  if (!data?.[0]) return NextResponse.json({ error: 'Review receipt was not recorded.' }, { status: 503 });
  return NextResponse.json({ item: data[0] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.id) ||
      !['service', 'product'].includes(String(body.kind)) ||
      (typeof body.offerId !== 'string' && typeof body.offerId !== 'number'))
    return NextResponse.json({ error: 'Choose a reviewed catalog candidate.' }, { status: 400 });
  const intake = await supabaseAdmin.from('accelerated_decision_file_intakes')
    .select('answers,review_status,linked_audit_id').eq('id', body.id).maybeSingle();
  if (intake.error || !intake.data) return NextResponse.json({ error: 'Decision File not found.' }, { status: 404 });
  if (intake.data.review_status !== 'linked' || !intake.data.linked_audit_id)
    return NextResponse.json({ error: 'Attach the reviewed assessment first.' }, { status: 409 });
  const [services, products] = await Promise.all([
    supabaseAdmin.from('services').select('id,title,description,topics,is_active').eq('is_active', true).limit(200),
    supabaseAdmin.from('products').select('id,title,description,is_active').eq('is_active', true).limit(200),
  ]);
  if (services.error || products.error) return NextResponse.json({ error: 'Could not verify the catalog.' }, { status: 503 });
  const catalog = [
    ...(services.data ?? []).map((row: unknown) => parseReviewCatalogOffer(row, 'service')),
    ...(products.data ?? []).map((row: unknown) => parseReviewCatalogOffer(row, 'product')),
  ].filter((offer): offer is NonNullable<typeof offer> => offer !== null);
  const candidate = reviewServiceCandidates(intake.data.answers ?? {}, catalog)
    .find((item) => item.kind === body.kind && String(item.id) === String(body.offerId));
  if (!candidate) return NextResponse.json({ error: 'This active offer is not supported by the submitted evidence.' }, { status: 409 });
  const { data, error } = await supabaseAdmin.rpc('accelerated_approve_member_recommendation', {
    p_intake_id: body.id, p_audit_id: intake.data.linked_audit_id,
    p_offer_kind: candidate.kind, p_offer_id: String(candidate.id),
    p_title: candidate.title, p_rationale: candidate.reason, p_reviewer: auth.user.id,
  });
  if (error) return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'Could not approve recommendation.' }, { status: error.code === 'P0001' ? 409 : 503 });
  return NextResponse.json({ recommendationId: data }, { headers: { 'Cache-Control': 'no-store' } });
}
