import { freezeOwned, releaseHash, type CampaignReleaseAction } from './campaign-release-manifest'
import { sandboxReceiptVerifier, type ReceiptContext, type ReceiptTrust, type SandboxCallback } from './campaign-release-receipts'

export type CertificationProvider = CampaignReleaseAction['provider'] | 'sms'
export type ProviderCertificationContract = {
  operation: CampaignReleaseAction['operation'] | 'send_sms'
  receipt: CampaignReleaseAction['expectedReceipt'] | 'sms_delivery_receipt'
  completion: string; acceptedIsComplete: false; enabled: false; mode: 'sandbox' | 'parked'
}
const social = { operation: 'publish', receipt: 'platform_post_id', completion: 'Read back the published post ID, account, exact content and visibility.' } as const
/** Required production evidence, NOT a statement that a provider is certified.
 * Gmail message identity proves the authorized send record, not inbox placement or reading.
 * Manual handoff confirmation proves the handoff only, never publication.
 * SMS is deliberately outside the manifest schema and has no dispatch or fixture factory. */
export const campaignCertificationContracts: Readonly<Record<CertificationProvider, ProviderCertificationContract>> = freezeOwned(Object.fromEntries(Object.entries({
  linkedin: social, instagram: social, facebook: social, x: social, tiktok: social,
  gmail: { operation: 'send', receipt: 'gmail_message_id', completion: 'Read back the sent message ID, mailbox, exact recipients and content.' },
  heygen: { operation: 'render', receipt: 'heygen_video_id', completion: 'Verify completed job, video ID, account and approved input/asset identity.' },
  youtube: { operation: 'publish', receipt: 'platform_post_id', completion: 'Read back video ID, channel, processing completion and approved publication visibility.' },
  manual_social: { operation: 'manual_handoff', receipt: 'manual_confirmation', completion: 'Authenticated operator acknowledges the exact handoff and account; this is not publication proof.' },
  sms: { operation: 'send_sms', receipt: 'sms_delivery_receipt', completion: 'Parked. Separate consent, sender, suppression and delivery-receipt certification required.' },
}).map(([provider, contract]) => [provider, { ...contract, acceptedIsComplete: false, enabled: false, mode: provider === 'sms' ? 'parked' : 'sandbox' }])) as Record<CertificationProvider, ProviderCertificationContract>)

/** Pure deterministic adapter double. No URL, credential, transport, hook or production
 * registration is accepted. The existing verifier owns proofs; journal owns callback replay.
 * A label on a real callback cannot enter this harness: fixtures are generated here. */
export function certifiedSandboxCallback(context: ReceiptContext, input: {
  outcome: Extract<ReceiptTrust, 'provider_accepted' | 'provider_confirmed' | 'rejected' | 'uncertain'>
  sequence: number; at: string; spentCents?: number
}) {
  const contract = campaignCertificationContracts[context.provider]
  if (!contract || contract.mode !== 'sandbox' || contract.receipt !== context.receiptType || !Number.isSafeInteger(input.sequence) || input.sequence < 0) throw new Error('Sandbox operation contract mismatch or parked provider.')
  const event: SandboxCallback = { ...structuredClone(context), callbackId: `sandbox:${context.attemptId}:${context.tryCount}:${input.sequence}`,
    evidenceId: `sandbox-contract:${context.provider}:v1`, providerId: `sandbox:${releaseHash({ key: context.actionKey, attempt: context.attemptId, retry: context.tryCount })}`,
    trust: input.outcome, receivedAt: input.at, spentCents: input.spentCents ?? 0 }
  return sandboxReceiptVerifier([event]).verify(event, context)
}
