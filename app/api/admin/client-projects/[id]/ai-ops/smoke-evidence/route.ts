import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  buildClientAiOpsRealPilotQaPlan,
  buildClientAiOpsSmokeEvidencePacket,
} from '@/lib/client-ai-ops-real-pilot-qa'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const qaPlan = buildClientAiOpsRealPilotQaPlan()
  const smokeEvidence = buildClientAiOpsSmokeEvidencePacket(qaPlan)

  return NextResponse.json({
    clientProjectId: id,
    source: 'synthetic_smoke_evidence_template',
    sideEffectsEnabled: false,
    capturesAccepted: false,
    smokeEvidence,
    approvalBoundary: {
      liveSetupActions: 'agent_approvals_required',
      evidencePersistence: 'not_enabled_in_v1',
      clientDataMutation: 'agent_approvals_required',
    },
    nextAction: 'Capture authenticated smoke evidence with synthetic or explicitly test-owned data, then review before any live setup.',
  })
}
