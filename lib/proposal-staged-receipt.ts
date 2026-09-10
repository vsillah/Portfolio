import type Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { loadStagedPackage } from './proposal-staged-server'
import { validateReceipt, validateStagedPolicy } from './proposal-staged-policy'
/** Deliberately independent of initiation flag: in-flight payments still reconcile. */
export async function recordStagedReceipt(session: Stripe.Checkout.Session, eventId: string) {
  const id = session.metadata?.stagedProposalId
  const stage = session.metadata?.paymentStage
  if (!id || (stage !== 'deposit' && stage !== 'balance')) throw new Error('Invalid stage metadata')
  const pkg = await loadStagedPackage(id)
  validateReceipt(validateStagedPolicy(pkg.policy), stage, session)
  const { error } = await supabaseAdmin.rpc('record_proposal_stage_receipt', {
    p_proposal: id, p_stage: stage, p_session: session.id, p_event: eventId, p_amount: session.amount_total,
  })
  if (error) throw new Error('Receipt reconciliation failed')
}
