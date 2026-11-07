import 'server-only'

export type InvitationDelivery = {
  appKey: string
  adultEmail: string
  rawToken: string
  expiresAt: string
}
export type DeliveryReceipt = { mode: 'synthetic'; receipt: string }
export interface InvitationDeliveryAdapter {
  deliver(invitation: InvitationDelivery): Promise<DeliveryReceipt>
}

export class ProviderDisabledDelivery implements InvitationDeliveryAdapter {
  async deliver(): Promise<DeliveryReceipt> { throw new Error('Invitation delivery provider is disabled.') }
}

// Exercise the adapter contract with reserved test addresses. It sends no mail,
// stores no token, and returns only a random receipt unrelated to token material.
export class SyntheticInvitationDelivery implements InvitationDeliveryAdapter {
  async deliver(invitation: InvitationDelivery): Promise<DeliveryReceipt> {
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(invitation.appKey)
      || !/^[^\s@]+@example\.test$/i.test(invitation.adultEmail)
      || !/^[A-Za-z0-9_-]{40,128}$/.test(invitation.rawToken)
      || !Number.isFinite(Date.parse(invitation.expiresAt))) throw new Error('Synthetic invitation fixture required.')
    const { randomUUID } = await import('node:crypto')
    return { mode: 'synthetic', receipt: `synthetic:${randomUUID()}` }
  }
}

export function getInvitationDeliveryAdapter(env: Record<string, string | undefined> = process.env): InvitationDeliveryAdapter {
  const localOrStaging = env.NODE_ENV === 'development' || (env.APP_ACTIVATION_STAGING_PROJECT_ID
    && env.VERCEL_PROJECT_ID === env.APP_ACTIVATION_STAGING_PROJECT_ID && env.VERCEL_ENV === 'production')
  return env.APP_ACTIVATION_DELIVERY_MODE === 'synthetic' && env.APP_ACTIVATION_SYNTHETIC_DELIVERY_ENABLED === 'true' && !!localOrStaging
    ? new SyntheticInvitationDelivery() : new ProviderDisabledDelivery()
}
