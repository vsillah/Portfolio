import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { loadStagedPackage, requireStagedFlow, requirePrivateProposalBucket } from '@/lib/proposal-staged-server'
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    requireStagedFlow()
    const { id } = await params
    const b = await request.json()
    const pkg = await loadStagedPackage(id)
    if (b.action === 'release') {
      if (!pkg.ready || b.digest !== pkg.content_digest || b.termsReviewed !== true || b.accessReviewed !== true) throw new Error('Review exact agreement, expiry and bearer access before release.')
      await requirePrivateProposalBucket()
      const { data: token, error } = await supabaseAdmin.rpc('release_staged_proposal', { p_proposal: id, p_digest: b.digest })
      if (error || !token) throw new Error('Release failed or access was revoked. Revoked access needs explicit reissue.')
      return NextResponse.json({ proposalPath: `/proposal/${token}`, dashboardPath: `/client/dashboard/${token}` })
    }
    if (b.action === 'deliver') {
      const { data: deposit } = await supabaseAdmin.from('proposal_payment_stages').select('paid_at').eq('proposal_id', id).eq('stage', 'deposit').single()
      if (!deposit?.paid_at || !pkg.agreement_signed_at || typeof b.note !== 'string' || !b.note.trim()) throw new Error('Confirmed deposit and a delivery review note are required.')
      if (pkg.delivered_at) throw new Error('Submitted delivery is immutable; review a revision separately.');
      if (pkg.delivery_accepted_at) throw new Error('Accepted delivery is immutable.')
      const { error } = await supabaseAdmin.from('proposal_staged_packages').update({ delivered_at: new Date().toISOString(), delivered_by: auth.user.id, delivery_note: b.note.trim() }).eq('proposal_id', id).is('delivered_at', null)
      if (error) throw new Error('Could not record delivery.')
      return NextResponse.json({ success: true })
    }
    throw new Error('Unsupported action.')
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Action failed.' }, { status: 400 }) }
}

/** Read-only operator recovery, independent of the initiation flag. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { id } = await params
    const pkg = await loadStagedPackage(id)
    const [{ data: proposal, error }, { data: stages, error: stageError }, { data: access }] = await Promise.all([
      supabaseAdmin.from('proposals').select('id,client_name,client_company,bundle_name,status,terms_text,valid_until,total_amount').eq('id', id).single(),
      supabaseAdmin.from('proposal_payment_stages').select('stage,amount_cents,paid_at').eq('proposal_id', id),
      supabaseAdmin.from('client_dashboard_access').select('access_token,is_active').eq('client_project_id', pkg.client_project_id).single(),
    ])
    if (error || !proposal || stageError) throw new Error('Package state unavailable.')
    return NextResponse.json({ proposalId: id, contentDigest: pkg.content_digest, ready: pkg.ready,
      retryPayload: pkg.ready ? null : { ...pkg.preparation_payload, preparation_key: pkg.preparation_key },
      proposal, policy: pkg.policy, agreement: pkg.agreement_text, released: !!pkg.released_at, accessActive: !!access?.is_active,
      proposalSigned: !!pkg.proposal_signed_at, agreementSigned: !!pkg.agreement_signed_at,
      depositPaid: !!stages?.some((s: { stage: string; paid_at: string | null }) => s.stage === 'deposit' && s.paid_at),
      delivered: !!pkg.delivered_at, deliveryAccepted: !!pkg.delivery_accepted_at, deliveryNote: pkg.delivery_note,
      actionsEnabled: process.env.PROPOSAL_STAGED_PAYMENTS_ENABLED === 'true',
      links: pkg.released_at && access?.is_active ? { proposalPath: `/proposal/${access.access_token}`, dashboardPath: `/client/dashboard/${access.access_token}` } : null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'Package unavailable. Return to Sales to select an existing proposal.' }, { status: 404 }) }
}
