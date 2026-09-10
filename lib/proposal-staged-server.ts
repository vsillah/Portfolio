import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { paymentEligibility, validateStagedPolicy, type StagedEvidence } from './proposal-staged-policy'

export function requireStagedFlow() {
  if (process.env.PROPOSAL_STAGED_PAYMENTS_ENABLED !== 'true') throw new Error('Staged proposals are not enabled.')
}
export async function loadStagedPackage(id: string) {
  const { data, error } = await supabaseAdmin.from('proposal_staged_packages').select('*').eq('proposal_id', id).single()
  if (error || !data) throw new Error('Package unavailable.')
  return data
}
export async function authorizeStagedClient(id: string, credential: string | null) {
  if (!credential || !/^[A-F0-9]{64}$/.test(credential)) throw new Error('Client access required.')
  const pkg = await loadStagedPackage(id)
  const { data: access } = await supabaseAdmin.from('client_dashboard_access').select('access_token,is_active').eq('client_project_id', pkg.client_project_id).single()
  if (!pkg.ready || !pkg.released_at || !access?.is_active || access.access_token.length !== credential.length ||
    !timingSafeEqual(Buffer.from(access.access_token), Buffer.from(credential))) throw new Error('Client access required.')
  return pkg
}
export async function stagedView(id: string, credential: string) {
  const pkg = await authorizeStagedClient(id, credential)
  const [{ data: p }, { data: stages, error }] = await Promise.all([
    supabaseAdmin.from('proposals').select('id,client_name,client_company,bundle_name,line_items,total_amount,terms_text,valid_until,status').eq('id', id).single(),
    supabaseAdmin.from('proposal_payment_stages').select('stage,amount_cents,paid_at').eq('proposal_id', id),
  ])
  if (!p || error || stages?.length !== 2) throw new Error('Package unavailable.')
  const policy = validateStagedPolicy(pkg.policy)
  const evidence: StagedEvidence = {
    proposalSigned: !!pkg.proposal_signed_at, agreementSigned: !!pkg.agreement_signed_at,
    depositPaid: stages.some((s: { stage: string; paid_at: string | null }) => s.stage === 'deposit' && s.paid_at),
    balancePaid: stages.some((s: { stage: string; paid_at: string | null }) => s.stage === 'balance' && s.paid_at),
    delivered: !!pkg.delivered_at, deliveryAccepted: !!pkg.delivery_accepted_at,
  }
  return { actionsEnabled: process.env.PROPOSAL_STAGED_PAYMENTS_ENABLED === 'true', proposal: p, policy, evidence, agreement: pkg.agreement_text,
    signatures: { proposal: pkg.proposal_signed_at ? { name: pkg.proposal_signed_by, at: pkg.proposal_signed_at } : null, agreement: pkg.agreement_signed_at ? { name: pkg.agreement_signed_by, at: pkg.agreement_signed_at } : null },
    digest: pkg.content_digest, deliveryVersion: pkg.delivered_at, deliveryNote: pkg.delivery_note,
    depositBlocker: paymentEligibility('deposit', evidence), balanceBlocker: paymentEligibility('balance', evidence),
    dashboardPath: `/client/dashboard/${credential}`, proposalPath: `/proposal/${credential}`,
  }
}

export async function requirePrivateProposalBucket() {
  const { data, error } = await supabaseAdmin.storage.getBucket('proposal-private')
  if (error || !data || data.public !== false) throw new Error('Private proposal storage is unavailable.')
}
