import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateProposalPDF } from '@/lib/proposal-pdf'
import { COMPANY_DISPLAY_NAME } from '@/lib/pdf-brand-styles'
import { generateContractPDF } from '@/lib/contract-pdf'
import { requireStagedFlow, loadStagedPackage, requirePrivateProposalBucket } from '@/lib/proposal-staged-server'
import { validateStagedPolicy } from '@/lib/proposal-staged-policy'

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    requireStagedFlow()
    await requirePrivateProposalBucket()
    const b = await request.json()
    const policy = validateStagedPolicy(b.policy)
    if (!/^[a-f0-9-]{36}$/i.test(b.preparation_key || '') || !Number.isSafeInteger(b.contact_id) ||
      !['client_name','client_email','title','terms_text','agreement_text'].every(k => typeof b[k] === 'string' && b[k].trim()) ||
      !Array.isArray(b.line_items) || !b.line_items.length ||
      b.line_items.some((i: { title?: string; price?: number }) => !i.title || typeof i.price !== 'number' || i.price < 0) ||
      Math.round(b.line_items.reduce((s: number, i: { price: number }) => s + i.price, 0) * 100) !== policy.totalCents ||
      !Object.hasOwn(b, 'valid_until') || (b.valid_until !== null && (!Number.isFinite(Date.parse(b.valid_until)) || Date.parse(b.valid_until) <= Date.now()))) {
      return NextResponse.json({ error: 'Provide exact reviewed content, matching line items, contact and explicit expiry (or null).' }, { status: 400 })
    }
    const payload = { contact_id: b.contact_id, client_name: b.client_name, client_email: b.client_email.trim().toLowerCase(),
      client_company: b.client_company || null, title: b.title, terms_text: b.terms_text, agreement_text: b.agreement_text,
      line_items: b.line_items, policy, valid_until: b.valid_until }
    const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    const { data: id, error } = await supabaseAdmin.rpc('prepare_staged_proposal', { p_key: b.preparation_key, p_digest: digest, p_payload: payload, p_actor: auth.user.id })
    if (error || !id) throw new Error('Preparation failed. Confirm migrations, contact matching and preparation key.')
    const pkg = await loadStagedPackage(id)
    if (!pkg.ready) {
      const { data: p } = await supabaseAdmin.from('proposals').select('*').eq('id', id).single()
      if (!p) throw new Error('Proposal unavailable; retry the same preparation key.')
      const proposalPDF = await generateProposalPDF({ ...p, company_name: COMPANY_DISPLAY_NAME, electronic_signature_only: true, valid_until: p.valid_until || '' })
      const agreementPDF = await generateContractPDF({ client_name: p.client_name, client_company: p.client_company, total_amount: p.total_amount, reviewed_text: payload.agreement_text })
      for (const [path, buffer] of [[`${id}/proposal.pdf`, proposalPDF], [`${id}/agreement.pdf`, agreementPDF]] as const) {
        const { error: uploadError } = await supabaseAdmin.storage.from('proposal-private').upload(path, buffer, { contentType: 'application/pdf', upsert: true })
        if (uploadError) throw new Error('Private document preparation failed. Retry the same key; access remains closed.')
      }
      const { error: readyError } = await supabaseAdmin.from('proposal_staged_packages').update({ ready: true, proposal_path: `${id}/proposal.pdf`, agreement_path: `${id}/agreement.pdf` }).eq('proposal_id', id)
      if (readyError) throw new Error('Could not finalize package preparation.')
    }
    return NextResponse.json({ proposalId: id, projectId: pkg.client_project_id, ready: true, released: !!pkg.released_at, contentDigest: digest })
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Preparation failed.' }, { status: 400 }) }
}
