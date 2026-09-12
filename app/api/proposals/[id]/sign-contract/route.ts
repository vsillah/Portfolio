import { NextRequest } from "next/server";
import { signProposalDocument } from "@/lib/sign-proposal-document";
export const dynamic = "force-dynamic";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return signProposalDocument(request, (await params).id, true);
}
