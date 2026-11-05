import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, isAuthError } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  reviewServiceCandidates,
  type ReviewService,
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
    ...((services || []) as ReviewService[]).map((service) => ({
      ...service,
      kind: "service" as const,
    })),
    ...((products || []) as ReviewService[]).map((product) => ({
      ...product,
      kind: "product" as const,
    })),
  ];
  return NextResponse.json(
    {
      items: (data || []).map((item: { answers: Record<string, string> }) => ({
        ...item,
        candidates: reviewServiceCandidates(item.answers, catalog),
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
  let auditId: number | null = null;
  if (body.status === "linked") {
    auditId = Number(body.auditId);
    if (!Number.isSafeInteger(auditId) || auditId < 1)
      return NextResponse.json(
        { error: "Choose an existing assessment audit." },
        { status: 400 },
      );
    const intake = await supabaseAdmin
      .from("accelerated_decision_file_intakes")
      .select("learner_email")
      .eq("id", body.id)
      .single();
    if (!intake.data || intake.error)
      return NextResponse.json(
        { error: "Decision file not found." },
        { status: 404 },
      );
    const audit = await supabaseAdmin
      .from("diagnostic_audits")
      .select("id,contact_submission_id")
      .eq("id", auditId)
      .single();
    if (!audit.data || audit.error)
      return NextResponse.json(
        { error: "Assessment audit not found." },
        { status: 404 },
      );
    if (!audit.data.contact_submission_id)
      return NextResponse.json(
        { error: "Assessment audit has no linked learner contact." },
        { status: 409 },
      );
    const contact = await supabaseAdmin
      .from("contact_submissions")
      .select("email")
      .eq("id", audit.data.contact_submission_id)
      .single();
    if (
      !contact.data ||
      contact.error ||
      contact.data.email?.trim().toLowerCase() !==
        intake.data.learner_email?.trim().toLowerCase()
    )
      return NextResponse.json(
        { error: "Assessment contact does not match the worksheet learner." },
        { status: 409 },
      );
  }
  const { data, error } = await supabaseAdmin
    .from("accelerated_decision_file_intakes")
    .update({
      review_status: body.status,
      linked_audit_id: auditId,
      review_note: body.note.trim(),
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .select("id,review_status,linked_audit_id")
    .single();
  if (error || !data)
    return NextResponse.json(
      { error: "Could not save review." },
      { status: 503 },
    );
  return NextResponse.json(
    { item: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
