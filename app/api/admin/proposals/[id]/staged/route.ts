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
