import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { validateDecisionFile } from "@/lib/accelerated-decision-file";
import { tryVerifyAuth } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: noStore });

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 36000)
    return fail("The worksheet is too large to send.", 413);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid worksheet data.", 400);
  }
  if (JSON.stringify(body).length > 36000)
    return fail("The worksheet is too large to send.", 413);
  const checked = validateDecisionFile(body.draft);
  if (!checked.ok) return fail(checked.error, 400);
  const { draft } = checked;
  if (body.worksheetId !== draft.worksheetId)
    return fail("Worksheet identity does not match.", 400);
  if (body.consent !== true)
    return fail("Review and consent are required before sending.", 400);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (
    !name ||
    name.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  )
    return fail("Enter a valid name and email.", 400);
  if (!Object.values(draft.answers).some((answer) => answer.trim()))
    return fail("Add at least one answer before sending.", 400);
  // Local review fixture exercises the completion state without writing learner evidence.
  if (
    process.env.NODE_ENV === "development" &&
    name === "QA Fixture" &&
    email === "qa-fixture@example.invalid"
  ) {
    return NextResponse.json(
      { received: true, fixture: true },
      { status: 201, headers: noStore },
    );
  }
  const evidence = {
    worksheet_id: draft.worksheetId,
    content_version: draft.version,
    learner_name: name,
    learner_email: email,
    answers: Object.fromEntries(Object.entries(draft.answers).sort(([left], [right]) => left.localeCompare(right))),
  };
  const digest = createHash("sha256")
    .update(JSON.stringify(evidence))
    .digest("hex");
  const authenticated = await tryVerifyAuth(request);
  if (request.headers.has("authorization") && !authenticated)
    return fail("Your session has expired. Sign in again before sending this worksheet.", 401);
  if (authenticated) {
    const { data: memberReceipt, error: memberError } = await supabaseAdmin.rpc(
      "accelerated_submit_member_decision_file",
      {
        p_user_id: authenticated.user.id,
        p_worksheet_id: draft.worksheetId,
        p_content_version: draft.version,
        p_payload_sha256: digest,
        p_learner_name: name,
        p_learner_email: email,
        p_answers: evidence.answers,
        p_consented_at: new Date().toISOString(),
      },
    );
    if (memberError) {
      if (memberError.code === "P0001" || memberError.code === "23505")
        return fail(memberError.message, 409);
      return fail(
        "Could not link this worksheet to your profile for assessment review.",
        503,
      );
    }
    const receipt = memberReceipt?.[0];
    if (!receipt?.id)
      return fail("The member assessment receipt was not recorded.", 503);
    return NextResponse.json(
      { received: true, memberLinked: true, replay: receipt.replay },
      { status: receipt.replay ? 200 : 201, headers: noStore },
    );
  }
  const { data, error } = await supabaseAdmin
    .from("accelerated_decision_file_intakes")
    .insert({
      ...evidence,
      payload_sha256: digest,
      consented_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const existing = await supabaseAdmin
      .from("accelerated_decision_file_intakes")
      .select("id,payload_sha256")
      .eq("worksheet_id", draft.worksheetId)
      .single();
    if (existing.data?.payload_sha256 === digest)
      return NextResponse.json({ received: true }, { headers: noStore });
    return fail(
      "This worksheet was already sent. Start a new local worksheet for further changes.",
      409,
    );
  }
  if (error || !data)
    return fail(
      "Could not receive the worksheet. Your local copy is still available.",
      503,
    );
  return NextResponse.json(
    { received: true },
    { status: 201, headers: noStore },
  );
}
