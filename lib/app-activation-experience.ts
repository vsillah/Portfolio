export type ActivationExperience = {
  appKey: string
  name: string
  returnPath: string
  sourceReceipt: string
}

// Public presentation metadata. Registration and origin authorization remain server owned.
export const activationExperiences: Record<string, ActivationExperience> = {
  'trumpet-trainer': {
    appKey: 'trumpet-trainer',
    name: 'Trumpet Trainer',
    returnPath: '/work/trumpet-trainer#interest',
    sourceReceipt: 'portfolio:trumpet-trainer:interest-v1',
  },
}

export const adultConsent = {
  version: 'adult-interest-2026-11-07-v1',
  title: 'Adult tester interest and contact consent',
  statement: 'I am an adult. I agree that AmaduTown may use my email address to review my interest in this app and contact me about a possible tester invitation. Sharing interest does not enroll me or a child, promise access, or authorize a purchase. I will not provide a child’s name, school, exact age, address, photo, or recording. I can ask to withdraw my contact consent at any time. If invited, I will review the tester terms before accepting.',
} as const

export type ActivationFailure = 'disabled' | 'invalid' | 'expired' | 'used' | 'blocked' | 'auth' | 'unavailable'

export function activationFailureMessage(kind: ActivationFailure): string {
  switch (kind) {
    case 'disabled': return 'Tester activation is closed for now. You can return to the product page and check for a future opening.'
    case 'invalid': return 'This invitation cannot be verified. The link may be invalid, expired, or already used. Check the original link or ask the pilot team for a new one.'
    case 'expired': return 'This invitation has expired. Ask the pilot team for a new invitation.'
    case 'used': return 'This invitation has already been used. Sign in with the adult account that accepted it, or ask the pilot team for help.'
    case 'blocked': return 'This request is temporarily limited. Wait a few minutes before trying again.'
    case 'auth': return 'Sign in with the adult account that received the invitation, then open the original invitation link again.'
    default: return 'Activation is unavailable right now. Return to the product page and try again later.'
  }
}

export function classifyActivationResponse(status: number): ActivationFailure {
  if (status === 401) return 'auth'
  if (status === 429) return 'blocked'
  if (status === 503) return 'disabled'
  // The server deliberately gives the same response for invalid, used and expired tokens.
  return status === 404 ? 'invalid' : 'unavailable'
}
