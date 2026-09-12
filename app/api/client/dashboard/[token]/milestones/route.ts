import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  GET as read,
  POST as review,
} from "@/app/api/proposals/[id]/milestones/route";
import { POST as pay } from "@/app/api/proposals/[id]/accept/route";
async function route(request: NextRequest, token: string, post: boolean) {
  if (token.length < 32)
    return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  const { data: a, error } = await supabaseAdmin
    .from("client_dashboard_access")
    .select("milestone_proposal_id")
    .eq("access_token", token)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !a?.milestone_proposal_id)
    return NextResponse.json({ enabled: false }, { status: 404 });
  const { data: p } = await supabaseAdmin
    .from("proposals")
    .select("access_code")
    .eq("id", a.milestone_proposal_id)
    .single();
  if (!p?.access_code)
    return NextResponse.json({ error: "Review unavailable" }, { status: 404 });
  let body;
  try {
    body = post ? await request.json() : null;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (post && !["accept", "reject", "pay"].includes(body.action))
    return NextResponse.json({ error: "Invalid action" }, { status: 403 });
  const headers = {
    "x-proposal-access": p.access_code,
    "Content-Type": "application/json",
  };
  const forwarded = new NextRequest(request.url, {
    method: post ? "POST" : "GET",
    headers,
    ...(post
      ? {
          body: JSON.stringify(
            body.action === "pay"
              ? { milestone: 2, document_identity: body.document_identity }
              : body,
          ),
        }
      : {}),
  });
  const params = Promise.resolve({ id: a.milestone_proposal_id });
  return post
    ? body.action === "pay"
      ? pay(forwarded, { params })
      : review(forwarded, { params })
    : read(forwarded, { params });
}
export async function GET(
  r: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return route(r, (await params).token, false);
}
export async function POST(
  r: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  return route(r, (await params).token, true);
}
