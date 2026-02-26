/**
 * Lead magnet category and access type (internal only).
 * Used for access control: where a resource appears (Resources page vs private link vs client portal).
 * Not displayed to clients — use funnel stage for client-facing organization.
 */

export const LEAD_MAGNET_CATEGORIES = ['gate_keeper', 'deal_closer', 'retention'] as const
export type LeadMagnetCategory = (typeof LEAD_MAGNET_CATEGORIES)[number]

export const LEAD_MAGNET_ACCESS_TYPES = [
  'public_gated',
  'private_link',
  'internal',
  'client_portal',
] as const
export type LeadMagnetAccessType = (typeof LEAD_MAGNET_ACCESS_TYPES)[number]

/** Internal labels (admin only) */
export const CATEGORY_LABELS: Record<LeadMagnetCategory, string> = {
  gate_keeper: 'Gate Keeper',
  deal_closer: 'Deal Closer',
  retention: 'Retention',
}

export const ACCESS_TYPE_LABELS: Record<LeadMagnetAccessType, string> = {
  public_gated: 'Public (auth-gated)',
  private_link: 'Private link',
  internal: 'Internal only',
  client_portal: 'Client portal',
}

export function isValidCategory(value: string): value is LeadMagnetCategory {
  return LEAD_MAGNET_CATEGORIES.includes(value as LeadMagnetCategory)
}

export function isValidAccessType(value: string): value is LeadMagnetAccessType {
  return LEAD_MAGNET_ACCESS_TYPES.includes(value as LeadMagnetAccessType)
}

/** Lead magnet resource type (pdf, ebook, audiobook, etc.). Must match DB lead_magnets_type_check. */
export const LEAD_MAGNET_TYPES = ['pdf', 'ebook', 'document', 'link', 'interactive', 'audiobook'] as const
export type LeadMagnetType = (typeof LEAD_MAGNET_TYPES)[number]

export const LEAD_MAGNET_TYPE_LABELS: Record<LeadMagnetType, string> = {
  pdf: 'PDF',
  ebook: 'Ebook',
  document: 'Document',
  link: 'Link',
  interactive: 'Interactive',
  audiobook: 'Audiobook',
}

export function isValidLeadMagnetType(value: string): value is LeadMagnetType {
  return LEAD_MAGNET_TYPES.includes(value as LeadMagnetType)
}
