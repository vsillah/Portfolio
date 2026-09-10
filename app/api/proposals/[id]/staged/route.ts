import { generateContractPDF } from '@/lib/contract-pdf'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { authorizeStagedClient, stagedView, requireStagedFlow, requirePrivateProposalBucket } from '@/lib/proposal-staged-server'
import { paymentEligibility, validateStagedPolicy } from '@/lib/proposal-staged-policy'
const credential = (r: NextRequest) => r.headers.get('x-proposal-access')
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    return NextResponse.json(await stagedView(id, credential(request) || ''), { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
  } catch { return NextResponse.json({ error: 'Package unavailable or access revoked.' }, { status: 403 }) }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const token = credential(request)
    const pkg = await authorizeStagedClient(id, token)
    const b = await request.json()
    const { data: proposal } = await supabaseAdmin.from('proposals').select('valid_until,bundle_name,client_email').eq('id', id).single()
    if (!proposal) throw new Error('Proposal unavailable.')
    const expired = proposal.valid_until && Date.parse(proposal.valid_until) < Date.now()
    if (b.action === 'document') {
      await requirePrivateProposalBucket()
      if (b.document === 'signature-record') {
        const signatures = [pkg.proposal_signed_at ? `Proposal signed by ${pkg.proposal_signed_by} at ${pkg.proposal_signed_at}` : 'Proposal unsigned.', pkg.agreement_signed_at ? `Agreement signed by ${pkg.agreement_signed_by} at ${pkg.agreement_signed_at}` : 'Agreement unsigned.'].join('\n')
        const { data: original } = await supabaseAdmin.from('proposals').select('client_name,client_company,total_amount,terms_text').eq('id', id).single()
        if (!original) throw new Error('Original document unavailable.')
        const pdf = await generateContractPDF({ ...original, reviewed_text: `${pkg.agreement_text}\n\nElectronic signature record\n${signatures}\nDocument digest: ${pkg.content_digest}\nSignatures were submitted through possession of the scoped client link. Email identity was not independently verified.\n\nAccompanying proposal terms\n${original.terms_text}` })
        return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="agreement-signature-record.pdf"', 'Cache-Control': 'no-store' } })
      }
      const path = b.document === 'proposal' ? pkg.proposal_path : b.document === 'agreement' ? pkg.agreement_path : null
      if (!path) throw new Error('Document unavailable.')
      const { data, error } = await supabaseAdmin.storage.from('proposal-private').createSignedUrl(path, 60)
      if (error || !data) throw new Error('Document unavailable. Try again.')
      return NextResponse.json({ url: data.signedUrl }, { headers: { 'Cache-Control': 'no-store' } })
    }
    requireStagedFlow()
    if (b.action === 'sign') {
      if (expired || b.confirm !== true || b.digest !== pkg.content_digest || typeof b.name !== 'string' || !b.name.trim() || b.name.length > 200 || !['proposal','agreement'].includes(b.document)) throw new Error('Confirm the exact current document and enter your name.')
      const column = b.document === 'proposal' ? 'proposal_signed_at' : 'agreement_signed_at'
      if (!pkg[column]) {
        const { error } = await supabaseAdmin.from('proposal_staged_packages').update({ [column]: new Date().toISOString(), [b.document === 'proposal' ? 'proposal_signed_by' : 'agreement_signed_by']: b.name.trim() }).eq('proposal_id', id).is(column, null)
        if (error) throw new Error('Signature could not be recorded.')
      }
      return NextResponse.json({ success: true })
    }
    const view = await stagedView(id, token!)
    if (b.action === 'accept-delivery') {
      if (!view.evidence.depositPaid || !pkg.delivered_at || b.deliveryVersion !== pkg.delivered_at || b.confirm !== true || b.digest !== pkg.content_digest || typeof b.name !== 'string' || !b.name.trim()) throw new Error('Review the delivered work and confirm all acceptance criteria.')
      if (!pkg.delivery_accepted_at) {
        const { error } = await supabaseAdmin.from('proposal_staged_packages').update({ delivery_accepted_at: new Date().toISOString(), delivery_accepted_by: b.name.trim() }).eq('proposal_id', id).eq('delivered_at', b.deliveryVersion).is('delivery_accepted_at', null)
        if (error) throw new Error('Acceptance could not be recorded.')
      }
      return NextResponse.json({ success: true })
    }
    if (b.action === 'checkout' && ['deposit','balance'].includes(b.stage)) {
      const stage = b.stage as 'deposit' | 'balance'
      if (expired && stage === 'deposit') throw new Error('Proposal expired. Contact your advisor.')
      const blocker = paymentEligibility(stage, view.evidence)
      if (blocker) throw new Error(blocker)
      if (!stripe) throw new Error('Payment service unavailable. Try again later.')
      const policy = validateStagedPolicy(pkg.policy)
      let { data: receipt, error: reservationError } = await supabaseAdmin.rpc('reserve_proposal_stage', { p_proposal: id, p_stage: stage })
      if (reservationError || !receipt) throw new Error('Payment reservation unavailable.')
      if (receipt.checkout_session_id) {
        const prior = await stripe.checkout.sessions.retrieve(receipt.checkout_session_id)
        if (prior.status === 'open' && prior.url) return NextResponse.json({ url: prior.url })
        if (prior.status !== 'expired') throw new Error('Payment confirmation is processing. Refresh shortly.')
        const rotated = await supabaseAdmin.rpc('reserve_proposal_stage', { p_proposal: id, p_stage: stage, p_expired_session: prior.id })
        if (rotated.error || !rotated.data) throw new Error('Could not reopen expired checkout.')
        receipt = rotated.data
        if (receipt.checkout_session_id) throw new Error('Another checkout is being prepared. Retry shortly.')
      }
      if (!receipt.attempt_id || Date.now() - Date.parse(receipt.reserved_at) > 23 * 60 * 60 * 1000) {
        throw new Error('Payment reservation needs advisor reconciliation before retry. No new charge was created.')
      }
      const amount = stage === 'deposit' ? policy.depositCents : policy.balanceCents
      const base = new URL(request.url).origin
      const session = await stripe.checkout.sessions.create({ mode: 'payment', payment_method_types: ['card'], client_reference_id: id,
        customer_email: proposal.client_email,
        line_items: [{ price_data: { currency: 'usd', unit_amount: amount, product_data: { name: `${proposal.bundle_name} — ${stage}` } }, quantity: 1 }],
        metadata: { stagedProposalId: id, paymentStage: stage },
        success_url: `${base}/proposal/${token}?payment=success`, cancel_url: `${base}/proposal/${token}?payment=cancelled`,
      }, { idempotencyKey: `staged:${receipt.attempt_id}` })
      const { error } = await supabaseAdmin.from('proposal_payment_stages').update({ checkout_session_id: session.id, checkout_url: session.url }).eq('proposal_id', id).eq('stage', stage).eq('attempt_id', receipt.attempt_id).is('paid_at', null)
      if (error) throw new Error('Could not save checkout. Retry to recover the same session.')
      return NextResponse.json({ url: session.url })
    }
    throw new Error('Unsupported action.')
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Action failed.' }, { status: 400 }) }
}
